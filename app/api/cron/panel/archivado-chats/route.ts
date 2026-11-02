import { createClient } from "@supabase/supabase-js";
import { registrarError } from "@/lib/panel/logger";

// Corre 1 vez por día vía pg_cron. Pedido de la reunión del 22/9: archivar
// automáticamente las conversaciones de WhatsApp/Instagram sin actividad
// hace 20 días, para no saturar la bandeja -- antes el archivado era 100%
// manual (botón "Archivar" en ChatClient.tsx). No toca rodi_conversaciones
// (el chat del sitio público), que no tiene columna `archivada`.

const DIAS_INACTIVIDAD = 20;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE2_URL!,
  process.env.SUPABASE2_SERVICE_ROLE_KEY!
);

async function archivarInactivas(tabla: "whatsapp_conversaciones" | "instagram_conversaciones") {
  const limite = new Date();
  limite.setUTCDate(limite.getUTCDate() - DIAS_INACTIVIDAD);

  const { data, error } = await supabase
    .from(tabla)
    .update({ archivada: true })
    .eq("archivada", false)
    .lt("last_message_at", limite.toISOString())
    .select("id");

  if (error) {
    registrarError(`cron/archivado-chats:${tabla}`, error);
    return 0;
  }
  return data?.length || 0;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [whatsapp, instagram] = await Promise.all([
    archivarInactivas("whatsapp_conversaciones"),
    archivarInactivas("instagram_conversaciones"),
  ]);

  return Response.json({ ok: true, archivadas: { whatsapp, instagram } });
}
