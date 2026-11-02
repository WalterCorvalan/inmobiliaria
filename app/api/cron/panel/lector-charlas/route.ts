import { createClient } from "@supabase/supabase-js";
import { chatJsonV2, isAiConfiguredV2 } from "@/lib/ai/indexV2";
import { registrarError } from "@/lib/panel/logger";
import { asignacionPorAuto } from "@/lib/panel/asignacionPorAuto";
import { estaVacia } from "@/lib/panel/prospeccionLead";
import { asignarCharlaWhatsapp, charlaQuieta, textoClienteDejoDeContestar } from "@/lib/panel/asignacionWhatsapp";
import { estaEnHorario, horarioDeConfig } from "@/lib/panel/horarioBots";
import { notificarEncargados, notificarPersona } from "@/lib/panel/notificaciones";
import {
  CANALES_LECTOR, DIAS_HACIA_ATRAS, MINUTOS_QUIETA, RespuestaLectorSchema, armarPedidoLector, autoPorTexto, fusionarProspeccion,
  necesitaLectura, prospeccionDeRespuesta, telefonoDelCliente, type AutoStock,
} from "@/lib/panel/lectorCharlas";

// Lector de charlas (17/10/2026). Corre cada 2 minutos (desde el 21/10/2026; antes cada 10) (pg_cron, migraciones/sql_lector_charlas.sql). Busca las charlas
// en las que contestó una persona (bot apagado) y que llevan 5 minutos quietas con mensajes que todavía no leyó, y
// completa el lead: resumen, auto vinculado y "Cómo compra" (con la permuta). Reglas en lib/panel/lectorCharlas.ts.
// También recorre, de a poco, las charlas de los últimos 5 días que nunca leyó.
// Y en WhatsApp le pasa a un vendedor las charlas con el bot en las que el cliente dejó de contestar (asignarCharlasQuietas).

export const maxDuration = 120;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE2_URL!, process.env.SUPABASE2_SERVICE_ROLE_KEY!);

/** Charlas leídas por vuelta, en total: alcanza para el día a día y pone un techo al gasto de IA. */
const POR_VUELTA = 8;
const ORIGEN_IA = "panel-v2/lector-charlas";

type Conversacion = {
  id: string; vendedor_id: string | null; vehiculo_id: string | null; prospeccion: unknown; lector_leido_hasta: string | null;
  contacto_id?: string | null; telefono_contacto?: string | null;
};
type Canal = (typeof CANALES_LECTOR)[number];

async function ultimoMensaje(c: Canal, id: string): Promise<string | null> {
  const { data } = await supabase.from(c.mensajes).select("created_at").eq("conversacion_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (data?.created_at as string | undefined) ?? null;
}

async function candidatos(c: Canal, ahora: Date, diasAtras: number): Promise<{ conv: Conversacion; ultimo: string }[]> {
  const campos = "id, vendedor_id, vehiculo_id, prospeccion, lector_leido_hasta"
    + (c.telefono === "contacto" ? ", contacto_id" : c.telefono === "conversacion" ? ", telefono_contacto" : "");
  // Con actividad reciente (dos días), y las viejas que nunca se leyeron.
  const desdeReciente = new Date(ahora.getTime() - 2 * 864e5).toISOString();
  const { data: recientes } = await supabase.from(c.mensajes).select("conversacion_id, created_at").gte("created_at", desdeReciente).order("created_at", { ascending: false }).limit(3000);
  const ultimoPorConv = new Map<string, string>();
  for (const m of recientes || []) if (!ultimoPorConv.has(m.conversacion_id)) ultimoPorConv.set(m.conversacion_id, m.created_at);

  const lista: { conv: Conversacion; ultimo: string }[] = [];
  const ids = [...ultimoPorConv.keys()];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase.from(c.tabla).select(campos).in("id", ids.slice(i, i + 200)).eq("ai_habilitada", false);
    if (error) throw error;
    for (const conv of (data || []) as unknown as Conversacion[]) {
      const ultimo = ultimoPorConv.get(conv.id)!;
      if (necesitaLectura({ ultimoMensaje: ultimo, leidoHasta: conv.lector_leido_hasta, ahora })) lista.push({ conv, ultimo });
    }
  }

  const desdeViejas = new Date(ahora.getTime() - diasAtras * 864e5).toISOString();
  const { data: viejas } = await supabase.from(c.tabla).select(campos).eq("ai_habilitada", false).is("lector_leido_hasta", null)
    .gte("created_at", desdeViejas).order("created_at", { ascending: false }).limit(POR_VUELTA);
  for (const conv of (viejas || []) as unknown as Conversacion[]) {
    if (lista.some((x) => x.conv.id === conv.id)) continue;
    const ultimo = await ultimoMensaje(c, conv.id);
    if (ultimo && necesitaLectura({ ultimoMensaje: ultimo, leidoHasta: null, ahora })) lista.push({ conv, ultimo });
  }
  return lista;
}

async function leer(c: Canal, conv: Conversacion, ultimo: string, stock: AutoStock[]): Promise<boolean> {
  const { data: desc } = await supabase.from(c.mensajes).select("direccion, texto").eq("conversacion_id", conv.id).order("created_at", { ascending: false }).limit(60);
  const historial = [...(desc || [])].reverse().filter((m) => m.texto) as { direccion: string; texto: string }[];
  if (!historial.some((m) => m.direccion === "in")) {
    await supabase.from(c.tabla).update({ lector_leido_hasta: ultimo }).eq("id", conv.id);
    return false;
  }

  const r = await chatJsonV2(RespuestaLectorSchema, armarPedidoLector(historial, stock), { origen: ORIGEN_IA, maxRetries: 1 });
  if (!r.ok) {
    registrarError("lector-charlas:ia", r.error, { canal: c.canal, conversacionId: conv.id });
    return false;
  }

  const patch: Record<string, unknown> = { lector_leido_hasta: ultimo };
  const cambios: string[] = [];
  if (r.data.resumen.trim()) {
    patch.handoff_resumen = r.data.resumen.trim();
    cambios.push("resumen");
  }
  const prospeccion = fusionarProspeccion(conv.prospeccion, prospeccionDeRespuesta(r.data));
  if (!estaVacia(prospeccion) && JSON.stringify(prospeccion) !== JSON.stringify(conv.prospeccion)) {
    patch.prospeccion = prospeccion;
    cambios.push(prospeccion.usado ? "cómo compra (con permuta)" : "cómo compra");
  }

  const textosCliente = historial.filter((m) => m.direccion === "in").map((m) => m.texto);

  // El teléfono que el cliente dejó escrito, solo si la ficha no tiene uno (nunca pisa el cargado).
  const telefono = c.telefono ? telefonoDelCliente(textosCliente) : null;
  if (telefono && c.telefono === "conversacion" && !conv.telefono_contacto) {
    patch.telefono_contacto = telefono;
    cambios.push(`teléfono ${telefono}`);
  }
  if (telefono && c.telefono === "contacto" && c.contactos && conv.contacto_id) {
    const { data: contacto } = await supabase.from(c.contactos).select("telefono").eq("id", conv.contacto_id).maybeSingle();
    if (contacto && !contacto.telefono) {
      const { error: errTel } = await supabase.from(c.contactos).update({ telefono }).eq("id", conv.contacto_id);
      if (errTel) registrarError("lector-charlas:telefono", errTel, { canal: c.canal, conversacionId: conv.id });
      else cambios.push(`teléfono ${telefono}`);
    }
  }

  // Si el cliente solo vende o consigna su auto, no se vincula ninguno del stock: el texto del cliente nombra SU auto
  // ("Corolla Cross") y autoPorTexto lo confundía con el Corolla del stock (chat de Jorge Rodríguez, 10/10/2026).
  if (!conv.vehiculo_id && !r.data.solo_vende_su_auto) {
    const deIa = r.data.vehiculo_id && stock.some((v) => v.id === r.data.vehiculo_id) ? r.data.vehiculo_id : null;
    const vehiculoId = autoPorTexto(textosCliente, stock) ?? deIa;
    if (vehiculoId) {
      patch.vehiculo_id = vehiculoId;
      const v = stock.find((x) => x.id === vehiculoId)!;
      cambios.push(`auto vinculado: ${v.marca} ${v.modelo}${v.anio ? ` ${v.anio}` : ""}`);
      // Con el auto, el lead va a quien lo tiene, salvo que lo hayan pasado a mano (Walter, 21/10/2026: el lead de
      // Nacho por la Karry de Don Torcuato quedó en Gabriel porque el lector vinculaba el auto pero no asignaba).
      const porAuto = await asignacionPorAuto(supabase, { fk: c.fk, conversacionId: conv.id, vehiculoId, vendedorActual: conv.vendedor_id });
      if (porAuto) {
        patch.vendedor_id = porAuto.vendedorId;
        patch.estado_lead = "asignado";
        await supabase.from("eventos_lead").insert({ [c.fk]: conv.id, tipo: "asignacion", descripcion: porAuto.descripcion });
      }
    }
  }

  const { error } = await supabase.from(c.tabla).update(patch).eq("id", conv.id);
  if (error) {
    registrarError("lector-charlas:guardar", error, { canal: c.canal, conversacionId: conv.id });
    return false;
  }
  if (cambios.length) {
    await supabase.from("eventos_lead").insert({ [c.fk]: conv.id, tipo: "lector", descripcion: `El lector de charlas completó: ${cambios.join(", ")}.` });
  }
  return true;
}

// WhatsApp: la charla con el bot no tiene vendedor hasta que termina (Walter, 31/10/2026; lib/panel/asignacionWhatsapp.ts).
// Si el cliente dejó de contestar, se le pasa a un vendedor (la sucursal que eligió, o la ronda) con un aviso. Sin IA.
// last_message_at es el último mensaje del cliente. Fuera del horario de los bots no se asigna: espera a la mañana.
async function asignarCharlasQuietas(ahora: Date): Promise<number> {
  const { data: config } = await supabase.from("whatsapp_configuracion").select("horario_inicio, horario_fin").eq("id", true).maybeSingle();
  if (!estaEnHorario(horarioDeConfig(config), ahora)) return 0;
  const { data, error } = await supabase.from("whatsapp_conversaciones").select("id, sucursal_id, last_message_at, charla_quieta_avisada_at")
    .is("vendedor_id", null).eq("ai_habilitada", true)
    .gte("last_message_at", new Date(ahora.getTime() - 2 * 864e5).toISOString())
    .lte("last_message_at", new Date(ahora.getTime() - MINUTOS_QUIETA * 60_000).toISOString())
    .limit(30);
  if (error) throw error;
  let asignadas = 0;
  for (const c of data || []) {
    if (!charlaQuieta({ ultimoMensaje: c.last_message_at, avisadaHasta: c.charla_quieta_avisada_at, ahora })) continue;
    // Primero se marca, así una falla no repite el aviso en cada vuelta.
    await supabase.from("whatsapp_conversaciones").update({ charla_quieta_avisada_at: c.last_message_at }).eq("id", c.id);
    const { data: ultimoBot } = await supabase.from("whatsapp_mensajes").select("texto").eq("conversacion_id", c.id).eq("direccion", "out")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    const mensaje = textoClienteDejoDeContestar(ultimoBot?.texto);
    const link = `/panel/whatsapp?conversacion=${c.id}`;
    const vendedorId = await asignarCharlaWhatsapp(supabase, { conversacionId: c.id, sucursalId: c.sucursal_id, motivo: "el cliente dejó de contestar." });
    if (vendedorId) {
      asignadas++;
      await notificarPersona(supabase, vendedorId, "whatsapp_handoff", mensaje, link, { categoriaNotif: "leads", modulo: "leads" });
    } else {
      await notificarEncargados(supabase, mensaje, link, "whatsapp_handoff", c.sucursal_id, "media", { categoriaNotif: "leads", modulo: "leads" });
    }
  }
  return asignadas;
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) return new Response("Unauthorized", { status: 401 });
  const ahora = new Date();
  let charlasAsignadas = 0;
  try {
    charlasAsignadas = await asignarCharlasQuietas(ahora);
  } catch (err) {
    registrarError("lector-charlas:asignar-quietas", err);
  }
  if (!isAiConfiguredV2()) return Response.json({ ok: true, leidas: 0, charlasAsignadas, motivo: "sin IA configurada" });

  // ?dias=10 para una pasada puntual más hacia atrás (Walter, 17/10/2026: una vez a 10 días); la tarea programada usa 5.
  const pedido = Number(new URL(req.url).searchParams.get("dias"));
  const diasAtras = Number.isFinite(pedido) && pedido > 0 ? Math.min(pedido, 15) : DIAS_HACIA_ATRAS;
  const { data: autos } = await supabase.from("vehiculos").select("id, marca, modelo, anio, km, color").in("estado", ["disponible", "reservado", "señado", "en_preparacion"]);
  const stock = (autos || []) as AutoStock[];

  // El techo cuenta intentos, no éxitos: una charla que falla no puede hacer que una vuelta llame a la IA sin fin.
  let intentos = 0, leidas = 0;
  const porCanal: Record<string, number> = {};
  for (const c of CANALES_LECTOR) {
    if (intentos >= POR_VUELTA) break;
    try {
      for (const { conv, ultimo } of await candidatos(c, ahora, diasAtras)) {
        if (intentos >= POR_VUELTA) break;
        intentos++;
        if (await leer(c, conv, ultimo, stock)) {
          leidas++;
          porCanal[c.canal] = (porCanal[c.canal] || 0) + 1;
        }
      }
    } catch (err) {
      // Un canal que falla (por ejemplo, una tabla sin la columna nueva) no frena a los demás.
      registrarError("lector-charlas:canal", err, { canal: c.canal });
    }
  }
  return Response.json({ ok: true, intentos, leidas, porCanal, charlasAsignadas });
}
