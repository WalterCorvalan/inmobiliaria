// Lo que hace un bot de mensajería (Instagram, Messenger) DESPUÉS de que contesta la IA: guardar los datos que dio
// el cliente, registrar el pedido cuando no hay stock y, al derivar, asignar el vendedor de la sucursal elegida,
// avisar y agendar la visita. Es la misma lógica que tiene el webhook de WhatsApp (pedido de Walter, 8/10/2026:
// "que Instagram y Messenger sean como WhatsApp"). Solo para rutas de servidor (cliente con service role).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentReplyV2 } from "@/lib/ai/agenteV2";
import { registrarError } from "@/lib/panel/logger";
import { notificarPersona, notificarEncargados } from "@/lib/panel/notificaciones";
import { resolverFechaVisitaConControl } from "@/lib/fechas";
import { completarVisitaRepetida } from "@/lib/panel/visitaRepetida";

export type CanalDM = "instagram" | "messenger";

const NOMBRE_CANAL: Record<CanalDM, string> = { instagram: "Instagram", messenger: "Messenger" };
type DatosDetectados = AgentReplyV2["datos_detectados"];

// Nombre, mail, teléfono y CUIL que el cliente vaya dando se guardan en el contacto apenas aparecen (como WhatsApp).
export async function guardarDatosDeContacto(supabase: SupabaseClient, canal: CanalDM, contactoId: string | null | undefined, datos: DatosDetectados | null | undefined) {
  if (!contactoId || !datos) return;
  const patch: Record<string, unknown> = {};
  if (datos.nombre) patch.nombre_perfil = datos.nombre;
  if (datos.email) patch.email = datos.email;
  if (datos.telefono) patch.telefono = datos.telefono;
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase.from(`${canal}_contactos`).update(patch).eq("id", contactoId);
  if (error) registrarError(`bot:${canal}:datos-contacto`, error, { contactoId });
}

// Derivación a una persona. Igual que WhatsApp:
//  - cliente ofensivo: se pausa la IA y no se avisa a nadie;
//  - si la charla no tiene vendedor y el cliente eligió sucursal, se asigna por la ronda de ESA sucursal;
//  - se avisa al vendedor (o a los encargados de la sucursal, o a todos);
//  - si dio día y horario, se agenda la visita en el módulo Visitas (y se avisa si choca con otra).
// En Instagram el aviso general lo dispara el trigger de la base (instagram_notificar_handoff) al marcar handoff_at,
// por eso acá se asigna el vendedor ANTES de marcarlo y no se manda un segundo aviso.
export async function procesarDerivacion(supabase: SupabaseClient, canal: CanalDM, conversacionId: string, respuesta: Pick<AgentReplyV2, "pausar_sin_notificar" | "resumen_handoff" | "datos_detectados">) {
  const { pausar_sin_notificar, resumen_handoff, datos_detectados } = respuesta;
  const tablaConv = `${canal}_conversaciones`;

  if (pausar_sin_notificar) {
    await supabase.from(tablaConv).update({ handoff_at: new Date().toISOString(), handoff_reason: "cliente_ofensivo", handoff_resumen: resumen_handoff || null, ai_habilitada: false }).eq("id", conversacionId);
    return;
  }

  const { data: conv } = await supabase.from(tablaConv).select(`vendedor_id, contacto_id, ${canal}_contactos(*)`).eq("id", conversacionId).maybeSingle();
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const contacto = (conv as any)?.[`${canal}_contactos`] as { telefono?: string | null; nombre_perfil?: string | null; username?: string | null } | null;
  let vendedorAsignado: string | null = conv?.vendedor_id ?? null;

  let sucursalElegida: { id: string; nombre: string } | null = null;
  if (datos_detectados?.zona) {
    const { data } = await supabase.from("sucursales").select("id, nombre").eq("slug", datos_detectados.zona).maybeSingle();
    sucursalElegida = data;
  }
  // Canal con la asignación automática apagada (Lead Routing, 16/10/2026): el lead queda sin asignar aunque el bot
  // haya detectado la sucursal; lo toma quien corresponde desde Leads.
  const { data: asignaSolo } = await supabase.rpc("asignacion_auto_en_tabla", { p_tabla: tablaConv });
  if (!vendedorAsignado && sucursalElegida && asignaSolo !== false) {
    // Messenger no tiene ronda propia por sucursal: usa la de WhatsApp (mismos vendedores de esa sucursal).
    const propia = await supabase.rpc(`asignar_vendedor_ronda_${canal}_por_sucursal`, { p_sucursal_id: sucursalElegida.id });
    const nuevo = propia.error ? (await supabase.rpc("asignar_vendedor_ronda_whatsapp_por_sucursal", { p_sucursal_id: sucursalElegida.id })).data : propia.data;
    if (nuevo) {
      vendedorAsignado = nuevo as string;
      await supabase.from(tablaConv).update({ vendedor_id: vendedorAsignado, estado_lead: "asignado" }).eq("id", conversacionId);
    }
  }

  await supabase.from(tablaConv).update({ handoff_at: new Date().toISOString(), handoff_reason: "cliente_pidio_humano", handoff_resumen: resumen_handoff || null, ai_habilitada: false }).eq("id", conversacionId);

  const link = `/panel/${canal}?conversacion=${conversacionId}`;
  if (canal === "messenger") {
    const mensaje = resumen_handoff || "El cliente pidió hablar con una persona — la IA dejó de responder.";
    const avisar = vendedorAsignado
      ? notificarPersona(supabase, vendedorAsignado, sucursalElegida ? "whatsapp_venta_zona" : "whatsapp_handoff", mensaje, link, { categoriaNotif: "leads", modulo: "leads" })
      : notificarEncargados(supabase, mensaje, link, sucursalElegida ? "whatsapp_venta_zona" : "whatsapp_handoff", sucursalElegida?.id ?? null, sucursalElegida ? "alta" : "media", { categoriaNotif: "leads", modulo: "leads" });
    avisar.catch((err) => registrarError(`bot:${canal}:aviso-derivacion`, err, { conversacionId }));
  }

  if (datos_detectados?.dia_visita && datos_detectados?.horario_visita) {
    const nombreCliente = datos_detectados.nombre || contacto?.nombre_perfil || (contacto?.username ? `@${contacto.username}` : `Cliente de ${NOMBRE_CANAL[canal]}`);
    const { fecha: fechaVisita, dudosa: fechaDudosa } = resolverFechaVisitaConControl(datos_detectados.dia_visita);
    const sucursalVisita = sucursalElegida?.nombre || "Sin especificar";
    // Si ya pidió visita ese día por otro lado, no se repite: se completa esa (lib/panel/visitaRepetida.ts).
    const visitaYaCargada = await completarVisitaRepetida(supabase, {
      telefono: datos_detectados.telefono || contacto?.telefono, fecha: fechaVisita,
      
    });
    const { data: ocupados } = visitaYaCargada ? { data: [] } : await supabase.rpc("visitas_horarios_ocupados", { p_sucursal: sucursalVisita, p_fecha: fechaVisita });
    const hayConflicto = (ocupados || []).some((o: { horario_visita: string }) => o.horario_visita === datos_detectados.horario_visita);
    const { error } = visitaYaCargada ? { error: null } : await supabase.from("visitas").insert({
      nombre_cliente: nombreCliente,
      telefono_cliente: datos_detectados.telefono || contacto?.telefono || "sin dato",
      fecha_visita: fechaVisita,
      horario_visita: datos_detectados.horario_visita,
      sucursal: sucursalVisita,
      estado: "Pendiente",
      vendedor_id: vendedorAsignado,
    });
    if (error) registrarError(`bot:${canal}:crear-visita`, error, { conversacionId });
    else if (fechaDudosa && !visitaYaCargada) {
      const mensaje = `📅 ${nombreCliente} agendó por ${NOMBRE_CANAL[canal]} "${datos_detectados.dia_visita}", pero ese día de la semana no coincide con el número. Quedó el ${fechaVisita}: confirmar la fecha con el cliente.`;
      const avisar = vendedorAsignado
        ? notificarPersona(supabase, vendedorAsignado, "whatsapp_venta_zona", mensaje, "/panel/visitas", { modulo: "visitas" })
        : notificarEncargados(supabase, mensaje, "/panel/visitas", "whatsapp_venta_zona", sucursalElegida?.id, "alta", { modulo: "visitas" });
      avisar.catch((err) => registrarError(`bot:${canal}:aviso-fecha-dudosa`, err, { conversacionId }));
    }
    if (!error && hayConflicto) {
      const mensaje = `⚠️ ${nombreCliente} agendó por ${NOMBRE_CANAL[canal]} a las ${datos_detectados.horario_visita} el ${fechaVisita} en ${sucursalVisita}, pero ese horario ya estaba ocupado. Reagendar una de las dos.`;
      const avisar = vendedorAsignado
        ? notificarPersona(supabase, vendedorAsignado, "whatsapp_venta_zona", mensaje, "/panel/visitas", { modulo: "visitas" })
        : notificarEncargados(supabase, mensaje, "/panel/visitas", "whatsapp_venta_zona", sucursalElegida?.id, "alta", { modulo: "visitas" });
      avisar.catch((err) => registrarError(`bot:${canal}:aviso-conflicto-visita`, err, { conversacionId }));
    }
  }
}
