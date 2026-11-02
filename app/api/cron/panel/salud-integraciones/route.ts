import { supabaseEmpresa as supabase, paraCadaEmpresa } from "@/lib/empresa/db";
import { decrypt } from "@/lib/crypto";
import { crearAlerta } from "@/lib/panel/alertas";
import { registrarError } from "@/lib/panel/logger";
import {
  debeAvisar, estadoTokenDeRespuesta, evaluarTokenCanal, evaluarWebhooks, evaluarWhatsapp, HORAS_FIRMA,
  type EstadoToken, type Hallazgo,
} from "@/lib/panel/saludIntegraciones";

// Corre cada 30 minutos vía pg_cron (ver migraciones/sql_cron_salud_integraciones.sql). Revisa WhatsApp, Instagram y
// Messenger y avisa a los admin con una alerta en el panel si algo se rompió. Solo lee: no cambia nada en Meta.
// Un problema no se vuelve a avisar hasta pasadas HORAS_ENTRE_AVISOS, para no llenar la campanita.
const HORAS_ENTRE_AVISOS = 12;

const GRAPH = `${process.env.META_GRAPH_BASE_URL ?? "https://graph.facebook.com"}/${process.env.META_GRAPH_API_VERSION ?? "v25.0"}`;
const GRAPH_INSTAGRAM = `https://graph.instagram.com/${process.env.META_GRAPH_API_VERSION ?? "v25.0"}`;

interface RespuestaMeta { ok: boolean; codigoError: number | null; datos: Record<string, unknown> }

// Una consulta de lectura a la API de Meta. Nunca tira: si no hay red o Meta no responde, vuelve ok=false sin código.
async function consultar(url: string, token: string): Promise<RespuestaMeta> {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) });
    const datos = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const codigo = (datos?.error as { code?: number } | undefined)?.code;
    return { ok: res.ok && !datos?.error, codigoError: typeof codigo === "number" ? codigo : null, datos };
  } catch {
    return { ok: false, codigoError: null, datos: {} };
  }
}

type FilaConfig = { listo?: boolean; token_cifrado?: string | null; token_iv?: string | null; token_tag?: string | null } & Record<string, unknown>;

function descifrar(c: FilaConfig | null): string | null {
  if (!c?.listo || !c.token_cifrado || !c.token_iv || !c.token_tag) return null;
  try { return decrypt(c.token_cifrado, c.token_iv, c.token_tag); } catch { return null; }
}

async function hechosWhatsapp(): Promise<Hallazgo[]> {
  const { data: c } = await supabase.from("whatsapp_configuracion").select("*").maybeSingle();
  const token = descifrar(c);
  if (!token || !c?.phone_number_id) return [];

  const numero = await consultar(`${GRAPH}/${c.phone_number_id}?fields=status`, token);
  const tokenEstado: EstadoToken = estadoTokenDeRespuesta(numero);
  let negocioVerificacion: string | null = null;
  let pagoAsociado: boolean | null = null;
  if (c.waba_id && tokenEstado === "ok") {
    const waba = await consultar(`${GRAPH}/${c.waba_id}?fields=business_verification_status,primary_funding_id`, token);
    if (waba.ok) {
      negocioVerificacion = (waba.datos.business_verification_status as string) ?? null;
      pagoAsociado = typeof waba.datos.primary_funding_id === "string";
    }
  }

  const desde = new Date(Date.now() - 24 * 3600000).toISOString();
  const { count } = await supabase.from("whatsapp_mensajes").select("id", { count: "exact", head: true }).ilike("error_detalle", "%131042%").gte("created_at", desde);

  return evaluarWhatsapp({
    token: tokenEstado,
    numeroEstado: (numero.datos.status as string) ?? null,
    negocioVerificacion,
    pagoAsociado,
    erroresPago24h: count ?? 0,
  });
}

async function hechosMessenger(): Promise<Hallazgo[]> {
  const { data: c } = await supabase.from("messenger_configuracion").select("*").maybeSingle();
  const token = descifrar(c);
  if (!token || !c?.page_id) return [];
  return evaluarTokenCanal("Messenger", estadoTokenDeRespuesta(await consultar(`${GRAPH}/${c.page_id}?fields=id`, token)));
}

async function hechosInstagram(): Promise<Hallazgo[]> {
  const { data: c } = await supabase.from("instagram_configuracion").select("*").maybeSingle();
  const token = descifrar(c);
  if (!token || !c?.ig_user_id) return [];
  // Hay tokens que solo valen en graph.instagram.com y otros solo en graph.facebook.com: es "vencido" solo si fallan los dos.
  const enInstagram = await consultar(`${GRAPH_INSTAGRAM}/${c.ig_user_id}?fields=id`, token);
  if (enInstagram.ok) return [];
  const enFacebook = await consultar(`${GRAPH}/${c.ig_user_id}?fields=id`, token);
  const estado = enFacebook.ok ? "ok" : enInstagram.codigoError === 190 && enFacebook.codigoError === 190 ? "vencido" : "desconocido";
  return evaluarTokenCanal("Instagram", estado);
}

async function hechosWebhooks(): Promise<Hallazgo[]> {
  const desde = new Date(Date.now() - HORAS_FIRMA * 3600000).toISOString();
  const { data } = await supabase.from("logs_errores").select("origen").like("origen", "webhook-%:firma").gte("created_at", desde).limit(500);
  const porCanal: Record<string, number> = {};
  for (const f of data || []) {
    const origen = String(f.origen);
    const canal = origen.includes("ig") ? "Instagram" : origen.includes("messenger") ? "Messenger" : "WhatsApp";
    porCanal[canal] = (porCanal[canal] || 0) + 1;
  }
  return evaluarWebhooks(porCanal);
}

async function trabajoDeLaEmpresa(req: Request): Promise<Response> {
  try {
    // Cada revisión es independiente: si una falla no se pierden las demás.
    const resultados = await Promise.allSettled([hechosWhatsapp(), hechosMessenger(), hechosInstagram(), hechosWebhooks()]);
    const hallazgos: Hallazgo[] = [];
    for (const r of resultados) {
      if (r.status === "fulfilled") hallazgos.push(...r.value);
      else registrarError("cron/salud-integraciones", r.reason);
    }
    if (hallazgos.length === 0) return Response.json({ ok: true, hallazgos: 0, avisos: 0 });

    const { data: admins } = await supabase.from("perfiles").select("id").overlaps("roles", ["admin", "director"]).eq("activo", true);
    let avisos = 0;
    for (const h of hallazgos) {
      const tipo = `salud_${h.clave}`;
      for (const a of admins || []) {
        const { data: previa } = await supabase.from("alertas").select("created_at").eq("destinatario_id", a.id).eq("tipo", tipo).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (!debeAvisar(previa?.created_at, Date.now(), HORAS_ENTRE_AVISOS)) continue;
        await crearAlerta(supabase, a.id, h.titulo, { mensaje: h.mensaje, link: h.link, tipo, prioridad: h.gravedad === "critica" ? "alta" : "media" });
        avisos++;
      }
    }
    return Response.json({ ok: true, hallazgos: hallazgos.length, avisos, claves: hallazgos.map((h) => h.clave) });
  } catch (err) {
    registrarError("cron/salud-integraciones", err);
    return Response.json({ error: "No se pudo revisar la salud de las integraciones." }, { status: 500 });
  }
}


// Las tareas automáticas recorren todas las empresas activas; cada una corre con sus datos, su horario y su zona horaria.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) return new Response("Unauthorized", { status: 401 });
  const empresas = await paraCadaEmpresa(async () => (await trabajoDeLaEmpresa(req)).json());
  return Response.json({ ok: true, empresas });
}
