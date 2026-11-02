import { createClient } from "@supabase/supabase-js";
import { sendTextMessage } from "@/lib/meta/client";
import { decrypt } from "@/lib/crypto";
import { crearAlerta } from "@/lib/panel/alertas";
import { enviarTextoBot } from "@/lib/panel/enviarMensajeBot";
import { estaEnHorario, horarioDeConfig } from "@/lib/panel/horarioBots";

// Portado de app/api/cron/automatizaciones/route.ts (v1, borrado) -- corría
// contra la base vieja (NEXT_PUBLIC_SUPABASE_URL), que ya no recibe leads ni
// ventas reales. Estas 4 automatizaciones nunca se habían migrado a v2 (a
// diferencia de cuotas por vencer, que sí -- ver avisarCuotasPorVencer en
// seguimientos/route.ts). El dedup ahora es un flag boolean por fila (mismo
// patrón que el resto de panel-v2), no la tabla aparte automatizaciones_wa
// de v1.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE2_URL!,
  process.env.SUPABASE2_SERVICE_ROLE_KEY!
);

async function tokenWhatsapp(): Promise<{ phoneNumberId: string; token: string } | null> {
  const { data: config } = await supabase.from("whatsapp_configuracion").select("*").eq("id", true).maybeSingle();
  if (!config?.listo || !config.token_cifrado || !config.token_iv || !config.token_tag || !config.phone_number_id) return null;
  return { phoneNumberId: config.phone_number_id, token: decrypt(config.token_cifrado, config.token_iv, config.token_tag) };
}

// A. Lead caliente sin respuesta interna del vendedor hace 24h+ -- escala
// avisando por la campanita (no le manda nada al cliente).
async function escalarLeadsCalientesSinAtender(): Promise<number> {
  const hace24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: conversaciones } = await supabase
    .from("whatsapp_conversaciones")
    .select("id, vendedor_id, last_inbound_at, aviso_caliente_sin_atender_enviado, whatsapp_contactos(nombre_perfil, telefono)")
    .eq("calificacion", "caliente")
    .lte("last_inbound_at", hace24h)
    .eq("aviso_caliente_sin_atender_enviado", false)
    .is("handoff_at", null);

  let avisados = 0;
  for (const c of conversaciones || []) {
    const contacto = c.whatsapp_contactos as any;
    const nombreLead = contacto?.nombre_perfil || contacto?.telefono || "un lead";
    const mensaje = `${nombreLead} está calificado como caliente y hace 24hs+ que nadie le responde.`;
    const link = `/panel/whatsapp?tab=leads&lead=${c.id}&origen=whatsapp`;
    if (c.vendedor_id) {
      await crearAlerta(supabase, c.vendedor_id, mensaje, { link, tipo: "lead_caliente_sin_atender", prioridad: "alta", categoriaNotif: "leads", modulo: "leads" });
    } else {
      const { data: encargados } = await supabase.from("perfiles").select("id").or("roles.cs.{admin},roles.cs.{director},roles.cs.{encargado}").eq("activo", true);
      for (const e of encargados || []) {
        await crearAlerta(supabase, e.id, mensaje, { link, tipo: "lead_caliente_sin_atender", prioridad: "alta", categoriaNotif: "leads", modulo: "leads" });
      }
    }
    await supabase.from("whatsapp_conversaciones").update({ aviso_caliente_sin_atender_enviado: true }).eq("id", c.id);
    avisados++;
  }
  return avisados;
}

// C. A los 30-45 min de nuestro último mensaje, si el cliente no volvió a
// escribir, un empujoncito suave preguntando si quiere más info.
async function nudgeSinRespuesta(): Promise<number> {
  const wa = await tokenWhatsapp();
  if (!wa) return 0;

  const hace30min = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const hace45min = new Date(Date.now() - 45 * 60 * 1000).toISOString();
  const { data: conversaciones } = await supabase
    .from("whatsapp_conversaciones")
    .select("id, last_message_at, last_inbound_at, aviso_nudge_enviado, whatsapp_contactos(telefono)")
    .lte("last_message_at", hace30min)
    .gte("last_message_at", hace45min)
    .eq("aviso_nudge_enviado", false)
    .is("handoff_at", null);

  let enviados = 0;
  for (const c of conversaciones || []) {
    // Si el último mensaje fue del cliente (last_inbound_at === last_message_at), ya nos toca a nosotros, no hace falta nudge.
    if (c.last_inbound_at === c.last_message_at) continue;
    const telefono = (c.whatsapp_contactos as any)?.telefono;
    if (!telefono) continue;
    const texto = "¿Te gustaría que te pase más información, fotos o el precio actualizado? Cualquier cosa, estamos por acá.";
    try {
      const resultado = await sendTextMessage(wa.phoneNumberId, wa.token, telefono, texto);
      await supabase.from("whatsapp_mensajes").insert({ conversacion_id: c.id, direccion: "out", tipo: "text", texto, status: "sent", ai_generado: true, wa_message_id: resultado.messages?.[0]?.id });
      await supabase.from("whatsapp_conversaciones").update({ aviso_nudge_enviado: true, last_message_at: new Date().toISOString() }).eq("id", c.id);
      enviados++;
    } catch (err) {
      console.error("[cron/automatizaciones] error mandando nudge", c.id, err);
    }
  }
  return enviados;
}

// E. Handoff viejo sin actividad 30+ días -- reactiva a Rodi para que la
// conversación no quede muda para siempre si el vendedor la dejó sin cerrar.
// No borra nada del historial, solo vuelve a habilitar la IA.
async function reactivarHandoffViejo(): Promise<number> {
  const hace30dias = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data: conversaciones } = await supabase
    .from("whatsapp_conversaciones")
    .select("id")
    .eq("ai_habilitada", false)
    .not("handoff_at", "is", null)
    .lte("last_message_at", hace30dias);

  let reactivadas = 0;
  for (const c of conversaciones || []) {
    await supabase
      .from("whatsapp_conversaciones")
      .update({ ai_habilitada: true, handoff_at: null, handoff_reason: null, handoff_resumen: null })
      .eq("id", c.id);
    reactivadas++;
  }
  return reactivadas;
}

// Instagram y Messenger, igual que WhatsApp (pedido de Walter, 8/10/2026): lead caliente sin atender 24 h+,
// recordatorio a los 30-45 min de nuestro último mensaje sin respuesta del cliente (solo en horario de los bots) y
// reactivación de la IA en charlas derivadas sin movimiento hace 30 días. 
type CanalDM = "instagram" | "messenger";
const TEXTO_NUDGE = "¿Te gustaría que te pase más información, fotos o el precio actualizado? Cualquier cosa, estamos por acá.";

async function escalarLeadsCalientesSinAtenderDM(canal: CanalDM): Promise<number> {
  const hace24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: conversaciones } = await supabase
    .from(`${canal}_conversaciones`)
    .select(`id, vendedor_id, ${canal}_contactos(*)`)
    .eq("calificacion", "caliente")
    .lte("last_inbound_at", hace24h)
    .eq("aviso_caliente_sin_atender_enviado", false)
    .is("handoff_at", null);
  let avisados = 0;
  for (const c of conversaciones || []) {
    const contacto = (c as unknown as Record<string, { nombre_perfil?: string | null; username?: string | null } | null>)[`${canal}_contactos`];
    const nombreLead = contacto?.nombre_perfil || (contacto?.username ? `@${contacto.username}` : "un lead");
    const mensaje = `${nombreLead} (${canal === "instagram" ? "Instagram" : "Messenger"}) está calificado como caliente y hace 24hs+ que nadie le responde.`;
    const link = `/panel/${canal}?tab=leads&lead=${c.id}&origen=${canal}`;
    const destinatarios = c.vendedor_id ? [c.vendedor_id] : ((await supabase.from("perfiles").select("id").or("roles.cs.{admin},roles.cs.{director},roles.cs.{encargado}").eq("activo", true)).data || []).map((e) => e.id);
    for (const id of destinatarios) await crearAlerta(supabase, id, mensaje, { link, tipo: "lead_caliente_sin_atender", prioridad: "alta", categoriaNotif: "leads", modulo: "leads" });
    await supabase.from(`${canal}_conversaciones`).update({ aviso_caliente_sin_atender_enviado: true }).eq("id", c.id);
    avisados++;
  }
  return avisados;
}

async function nudgeSinRespuestaDM(canal: CanalDM): Promise<number> {
  const { data: configWa } = await supabase.from("whatsapp_configuracion").select("horario_inicio, horario_fin").eq("id", true).maybeSingle();
  if (!estaEnHorario(horarioDeConfig(configWa))) return 0;
  const ahora = Date.now();
  const hace2h = new Date(ahora - 2 * 3600 * 1000).toISOString();
  const { data: candidatas } = await supabase
    .from(`${canal}_conversaciones`)
    .select("id, ai_habilitada")
    .gte("last_message_at", hace2h)
    .eq("aviso_nudge_enviado", false)
    .is("handoff_at", null);
  let enviados = 0;
  for (const c of candidatas || []) {
    if (c.ai_habilitada === false) continue;
    // El último mensaje tiene que ser nuestro (del bot), de hace 30 a 45 minutos: el cliente no contestó.
    const { data: ultimo } = await supabase.from(`${canal}_mensajes`).select("direccion, created_at, ai_generado").eq("conversacion_id", c.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!ultimo || ultimo.direccion !== "out" || !ultimo.ai_generado) continue;
    const minutos = (ahora - new Date(ultimo.created_at).getTime()) / 60000;
    if (minutos < 30 || minutos > 45) continue;
    await supabase.from(`${canal}_conversaciones`).update({ aviso_nudge_enviado: true }).eq("id", c.id);
    if (await enviarTextoBot(supabase, canal, c.id, TEXTO_NUDGE)) enviados++;
  }
  return enviados;
}

async function reactivarHandoffViejoDM(canal: CanalDM): Promise<number> {
  const hace30dias = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data } = await supabase
    .from(`${canal}_conversaciones`)
    .update({ ai_habilitada: true, handoff_at: null, handoff_reason: null, handoff_resumen: null })
    .eq("ai_habilitada", false)
    .not("handoff_at", "is", null)
    .lte("last_message_at", hace30dias)
    .select("id");
  return data?.length || 0;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [leadsCalientes, nudges, handoffReactivados] = await Promise.all([
    escalarLeadsCalientesSinAtender(),
    nudgeSinRespuesta(),
    reactivarHandoffViejo(),
  ]);

  // Instagram y Messenger: cada uno por separado, así un error en uno no frena al resto.
  const dm: Record<string, unknown> = {};
  for (const canal of ["instagram", "messenger"] as const) {
    try {
      dm[canal] = { leadsCalientes: await escalarLeadsCalientesSinAtenderDM(canal), nudges: await nudgeSinRespuestaDM(canal), handoffReactivados: await reactivarHandoffViejoDM(canal) };
    } catch (err) {
      console.error(`[cron/automatizaciones] ${canal}`, err);
      dm[canal] = { error: true };
    }
  }

  return Response.json({ ok: true, leadsCalientes, nudges, handoffReactivados, ...dm });
}
