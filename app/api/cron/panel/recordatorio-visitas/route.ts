import { zonaActual, supabaseEmpresa as supabase, paraCadaEmpresa } from "@/lib/empresa/db";
import { registrarError } from "@/lib/panel/logger";
import { horaArgentina } from "@/lib/panel/horarioBots";
import { notificarEncargados, notificarPersona } from "@/lib/panel/notificaciones";
import { textoRecordatorio } from "@/lib/visitas/visitas";

// Corre cada hora; cada empresa actúa a las 18 de su zona horaria. A cada asesor le llega un aviso por cada visita de
// MAÑANA que siga pendiente o confirmada, con el botón para confirmarla por WhatsApp desde Visitas. Las visitas sin asesor
// les llegan a los encargados. No le escribe al cliente (fuera de la ventana de 24 h WhatsApp pide plantilla aprobada).
const HORA_DEL_RECORDATORIO = 18;

function fechaDeMananaEn(zona: string): string {
  const manana = new Date(Date.now() + 24 * 3600_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit" }).format(manana);
}

async function trabajoDeLaEmpresa(): Promise<Record<string, unknown>> {
  if (horaArgentina(new Date(), zonaActual()) !== HORA_DEL_RECORDATORIO) return { omitido: "todavía no son las 18 en esta empresa" };
  const fecha = fechaDeMananaEn(zonaActual());
  const { data: visitas, error } = await supabase.from("visitas")
    .select("id, nombre_cliente, horario_visita, sucursal, propiedad_codigo, vendedor_id")
    .eq("fecha_visita", fecha).in("estado", ["Pendiente", "Confirmada"]).is("recordatorio_enviado_at", null);
  if (error) {
    registrarError("cron/recordatorio-visitas", error);
    return { ok: false };
  }
  let avisadas = 0;
  for (const v of visitas || []) {
    // Se marca antes de avisar: si la tarea corre dos veces, no llegan dos avisos.
    const { error: errMarca } = await supabase.from("visitas").update({ recordatorio_enviado_at: new Date().toISOString() }).eq("id", v.id);
    if (errMarca) continue;
    const texto = textoRecordatorio(v);
    if (v.vendedor_id) await notificarPersona(supabase, v.vendedor_id, "recordatorio_visita", texto, "/panel/visitas", { modulo: "visitas" });
    else await notificarEncargados(supabase, texto, "/panel/visitas", "recordatorio_visita", null, "media", { modulo: "visitas" });
    avisadas++;
  }
  return { ok: true, fecha, avisadas };
}

// Las tareas automáticas recorren todas las empresas activas; cada una corre con sus datos, su horario y su zona horaria.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) return new Response("Unauthorized", { status: 401 });
  const empresas = await paraCadaEmpresa(trabajoDeLaEmpresa);
  return Response.json({ ok: true, empresas });
}
