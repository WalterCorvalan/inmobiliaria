import { createClient } from "@supabase/supabase-js";
import { registrarError } from "@/lib/panel/logger";
import { debeMandarApertura, HORAS_VALIDEZ_AVISO_PARA_APERTURA, TEXTO_APERTURA_POR_DEFECTO } from "@/lib/panel/horarioBots";
import { enviarTextoBot, TABLAS_CANAL, type CanalBot } from "@/lib/panel/enviarMensajeBot";

// Corre 1 vez por día a las 9 (hora argentina) vía pg_cron. Pedido de Walter, 8/10/2026: a quien escribió de
// noche por WhatsApp, Instagram o Messenger y recibió el aviso de fuera de horario, a la mañana se le manda UN
// mensaje: "ya estamos disponibles". Solo si nadie le contestó desde el aviso y ninguna persona tomó la charla
// (reglas en lib/panel/horarioBots.ts). El texto se puede cambiar en Configuración → WhatsApp → Memoria del bot,
// categoría "apertura"; si no hay, usa uno por defecto. Rodi (chat de la web) no entra: atiende las 24 horas.

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE2_URL!, process.env.SUPABASE2_SERVICE_ROLE_KEY!);

async function textoApertura(): Promise<string> {
  const { data } = await supabase.from("whatsapp_memoria").select("respuesta").eq("categoria", "apertura").eq("activo", true).order("orden", { ascending: true }).limit(1).maybeSingle();
  return data?.respuesta || TEXTO_APERTURA_POR_DEFECTO;
}

async function procesarCanal(canal: CanalBot, texto: string): Promise<{ enviados: number; revisados: number }> {
  const t = TABLAS_CANAL[canal];
  const desde = new Date(Date.now() - HORAS_VALIDEZ_AVISO_PARA_APERTURA * 3600_000).toISOString();
  const { data: candidatas, error } = await supabase.from(t.conversaciones).select("*").gte("fuera_horario_avisado_at", desde);
  if (error) {
    registrarError(`cron/bots-apertura:${canal}`, error);
    return { enviados: 0, revisados: 0 };
  }
  const { data: config } = await supabase.from(t.config).select("*").eq("id", true).maybeSingle();
  let enviados = 0;
  for (const c of candidatas || []) {
    const { data: ultimoMensaje } = await supabase.from(t.mensajes).select("direccion, created_at").eq("conversacion_id", c.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!debeMandarApertura({ avisadoAt: c.fuera_horario_avisado_at, aperturaAt: c.apertura_enviada_at, aiHabilitada: c.ai_habilitada, ultimoMensaje })) continue;
    // Se marca antes de mandar: si el cron se dispara dos veces, no le llegan dos mensajes.
    await supabase.from(t.conversaciones).update({ apertura_enviada_at: new Date().toISOString() }).eq("id", c.id);
    if (await enviarTextoBot(supabase, canal, c.id, texto, config)) enviados++;
  }
  return { enviados, revisados: candidatas?.length || 0 };
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const texto = await textoApertura();
    const [whatsapp, instagram, messenger] = await Promise.all([
      procesarCanal("whatsapp", texto),
      procesarCanal("instagram", texto),
      procesarCanal("messenger", texto),
    ]);
    return Response.json({ ok: true, whatsapp, instagram, messenger });
  } catch (err) {
    registrarError("cron/bots-apertura", err);
    return Response.json({ ok: false }, { status: 500 });
  }
}
