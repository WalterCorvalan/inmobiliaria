import { createClient } from "@supabase/supabase-js";
import { crearAlerta } from "@/lib/panel/alertas";
import { registrarError } from "@/lib/panel/logger";
import { HORAS_AVISO, estadoVentana, horasVentana, textoRestante } from "@/lib/panel/ventana24h";

// Aviso de la ventana de 24 hs (19/10/2026, Walter: caso Mateo, el cliente escribió el sábado y lo contestaron el lunes,
// con los mensajes rechazados por Meta). Cada 15 minutos (pg_cron, migraciones/sql_aviso_ventana_24h.sql): a cada
// vendedor con un cliente que le escribió y espera respuesta, cuando faltan 3 hs o menos para que se cierre la ventana,
// le llega un aviso a la campanita (y al celular) que dice hasta qué hora le puede contestar. Uno solo por charla.

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE2_URL!, process.env.SUPABASE2_SERVICE_ROLE_KEY!);

const CANALES = [
  { canal: "whatsapp", nombre: "WhatsApp", tabla: "whatsapp_conversaciones", mensajes: "whatsapp_mensajes", link: "/panel/whatsapp" },
  { canal: "instagram", nombre: "Instagram", tabla: "instagram_conversaciones", mensajes: "instagram_mensajes", link: "/panel/instagram" },
  { canal: "messenger", nombre: "Messenger", tabla: "messenger_conversaciones", mensajes: "messenger_mensajes", link: "/panel/messenger" },
] as const;

const TIPO = "ventana_24h";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) return new Response("Unauthorized", { status: 401 });

  const ahora = new Date();
  let enviados = 0;

  for (const c of CANALES) {
    // Instagram y Messenger dan 7 días con el permiso Human Agent prendido; WhatsApp, 24 hs.
    const horas = horasVentana(c.canal);
    const desde = new Date(ahora.getTime() - horas * 3_600_000).toISOString();
    const hasta = new Date(ahora.getTime() - (horas - HORAS_AVISO) * 3_600_000).toISOString();
    try {
      // Charlas cuyo último movimiento cae dentro de las últimas 3 hs de la ventana, con vendedor asignado.
      const { data: convs, error } = await supabase.from(c.tabla).select("id, vendedor_id")
        .gte("last_message_at", desde).lte("last_message_at", hasta).not("vendedor_id", "is", null);
      if (error) throw error;

      for (const conv of convs || []) {
        const { data: ultimo } = await supabase.from(c.mensajes).select("direccion, created_at")
          .eq("conversacion_id", conv.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
        // Solo si el último mensaje es del cliente: está esperando respuesta.
        if (!ultimo || ultimo.direccion !== "in") continue;
        const v = estadoVentana(ultimo.created_at, ahora, horas);
        if (!v || v.estado !== "por_vencer") continue;

        const link = `${c.link}?conversacion=${conv.id}`;
        const { data: yaAvisado } = await supabase.from("alertas").select("id")
          .eq("destinatario_id", conv.vendedor_id).eq("tipo", TIPO).eq("link", link).gte("created_at", desde).limit(1);
        if (yaAvisado?.length) continue;

        const hora = v.cierra.toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
        await crearAlerta(supabase, conv.vendedor_id as string, `Contestale antes de las ${hora} por ${c.nombre}`, {
          mensaje: c.canal === "whatsapp"
            ? `Un cliente te escribió y espera respuesta. Quedan ${textoRestante(v.restanteMs)}: después solo vas a poder mandarle una plantilla aprobada.`
            : `Un cliente te escribió y espera respuesta. Quedan ${textoRestante(v.restanteMs)}: después no vas a poder escribirle por ${c.nombre} hasta que vuelva a escribir.`,
          link,
          tipo: TIPO,
          prioridad: "alta",
          modulo: "leads",
          categoriaNotif: "leads",
        });
        enviados++;
      }
    } catch (err) {
      registrarError("cron/aviso-ventana-24h", err, { canal: c.canal });
    }
  }

  return Response.json({ ok: true, enviados });
}
