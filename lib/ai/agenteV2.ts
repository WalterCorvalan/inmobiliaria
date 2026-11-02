import { z } from "zod";
import { supabaseEmpresa as supabase } from "@/lib/empresa/db";
import { chatJsonV2 } from "@/lib/ai/indexV2";
import { buildSystemPromptV2, SEPARADOR_MENSAJES, type EmpresaParaBot, type SucursalInfo } from "@/lib/ai/promptsV2";

// Agente de los canales (WhatsApp, Instagram, Messenger y chat de la web). Solo razona con el texto de la charla y con lo que
// la empresa cargó (nombre, qué hace, respuestas fijas, sucursales): nunca escribe la conversación, eso lo hace el webhook que
// lo llama. No busca ni muestra catálogos: atiende, califica, junta datos, agenda visitas y deriva a una persona.

export const AgentReplySchemaV2 = z.object({
  reply: z.string(),
  handoff: z.boolean(),
  pausar_sin_notificar: z.boolean().optional(),
  resumen_handoff: z.string().nullable(),
  intencion: z.enum(["CONSULTA", "VISITA", "NEGOCIAR", "HABLAR_CON_ASESOR", "OTRA_CONSULTA"]).nullable(),
  calificacion: z.enum(["caliente", "tibio", "frio"]).nullable(),
  datos_detectados: z.object({
    nombre: z.string().nullable(),
    email: z.string().nullable(),
    telefono: z.string().nullable(),
    interes: z.string().nullable().optional(),
    presupuesto: z.string().nullable().optional(),
    plazo: z.string().nullable().optional(),
    zona: z.string().nullable().optional() /* identificador (slug) de la sucursal elegida */,
    dia_visita: z.string().nullable().optional(),
    horario_visita: z.string().nullable().optional(),
  }),
});

export type AgentReplyV2 = z.infer<typeof AgentReplySchemaV2>;
export type HistorialMensaje = { role: "user" | "assistant"; content: string };

// Tope de mensajes por conversación: evita charlas eternas (costo de IA y asesores esperando la derivación).
// SUAVE: el prompt empieza a sugerir cerrar rápido. DURO: se corta sin llamar a la IA y se deriva con un mensaje fijo.
const LIMITE_MENSAJES_SUAVE = 50;
const LIMITE_MENSAJES_DURO = 70;

function respuestaLimiteAlcanzado(): AgentReplyV2 {
  return {
    reply: "Veo que ya llevamos bastante conversación. Para no hacerte esperar más, en este momento te comunico con una persona del equipo que sigue con todo esto.",
    handoff: true,
    resumen_handoff: "Charla larga (tope de mensajes): revisar el historial del chat para el contexto completo.",
    intencion: null,
    calificacion: null,
    datos_detectados: { nombre: null, email: null, telefono: null },
  };
}

// El prompt separa "reply" en varias burbujas con SEPARADOR_MENSAJES; los canales mandan cada parte como un mensaje aparte.
export function dividirRespuestaEnMensajes(reply: string): string[] {
  return reply.split(SEPARADOR_MENSAJES).map((s) => s.trim()).filter(Boolean);
}

async function cargarEmpresa(): Promise<EmpresaParaBot> {
  const [{ data: cfg }, { data: memoria }] = await Promise.all([
    supabase.from("configuracion_empresa").select("branding_nombre, bot_descripcion").maybeSingle(),
    supabase.from("whatsapp_memoria").select("categoria, respuesta").eq("activo", true).order("orden"),
  ]);
  return {
    nombre: cfg?.branding_nombre?.trim() || "la empresa",
    descripcion: cfg?.bot_descripcion ?? null,
    conocimiento: ((memoria ?? []) as { categoria: string; respuesta: string }[]).filter((m) => !["fuera_horario", "apertura"].includes(m.categoria)),
  };
}

async function cargarSucursales(): Promise<SucursalInfo[]> {
  const { data } = await supabase.from("sucursales").select("nombre, slug, direccion, telefono_encargado, google_maps_url, encargado_nombre, horario_texto").order("nombre");
  return (data ?? []) as SucursalInfo[];
}

export async function generarRespuestaAgenteV2(
  historial: HistorialMensaje[],
  canal: string = "whatsapp-v2",
  opciones: { nombreBot?: string; tono?: string | null; esInstagram?: boolean; esWeb?: boolean } = {},
): Promise<{ ok: true; data: AgentReplyV2 } | { ok: false; error: string }> {
  const mensajesCliente = historial.filter((h) => h.role === "user").length;
  if (mensajesCliente > LIMITE_MENSAJES_DURO) return { ok: true, data: respuestaLimiteAlcanzado() };

  const [empresa, sucursales] = await Promise.all([cargarEmpresa(), cargarSucursales()]);
  const result = await chatJsonV2(AgentReplySchemaV2, [
    { role: "system", content: buildSystemPromptV2({ empresa, nombreBot: opciones.nombreBot, sucursales, sugerirCierre: mensajesCliente >= LIMITE_MENSAJES_SUAVE, tono: opciones.tono, esInstagram: opciones.esInstagram, esWeb: opciones.esWeb }) },
    ...historial,
  ], { origen: canal });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data };
}
