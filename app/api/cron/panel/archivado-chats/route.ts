import { supabaseEmpresa as supabase, paraCadaEmpresa } from "@/lib/empresa/db";
import { registrarError } from "@/lib/panel/logger";

// Corre 1 vez por día vía pg_cron. Pedido de la reunión del 22/9: archivar
// automáticamente las conversaciones de WhatsApp/Instagram sin actividad
// hace 20 días, para no saturar la bandeja -- antes el archivado era 100%
// manual (botón "Archivar" en ChatClient.tsx). No toca rodi_conversaciones
// (el chat del sitio público), que no tiene columna `archivada`.

const DIAS_INACTIVIDAD = 20;


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

async function trabajoDeLaEmpresa(req: Request): Promise<Response> {
  const [whatsapp, instagram] = await Promise.all([
    archivarInactivas("whatsapp_conversaciones"),
    archivarInactivas("instagram_conversaciones"),
  ]);

  return Response.json({ ok: true, archivadas: { whatsapp, instagram } });
}


// Las tareas automáticas recorren todas las empresas activas; cada una corre con sus datos, su horario y su zona horaria.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) return new Response("Unauthorized", { status: 401 });
  const empresas = await paraCadaEmpresa(async () => (await trabajoDeLaEmpresa(req)).json());
  return Response.json({ ok: true, empresas });
}
