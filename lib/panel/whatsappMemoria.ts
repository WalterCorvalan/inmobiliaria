import { SupabaseClient } from "@supabase/supabase-js";

// "Memoria" del bot: respuestas fijas por palabra clave, sin llamar a la IA
// (mismo criterio que /api/buscar-ia: DB/memoria primero, IA solo si no
// matchea nada). Categorías configurables desde Configuración → WhatsApp →
// Memoria del bot.

const REGEX_DIACRITICOS = new RegExp("[̀-ͯ]", "g");

function normalizar(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(REGEX_DIACRITICOS, ""); // saca tildes: "cómo llego" -> "como llego"
}

export async function buscarRespuestaMemoria(supabase: SupabaseClient, textoCliente: string): Promise<string | null> {
  const texto = normalizar(textoCliente);
  const { data } = await supabase
    .from("whatsapp_memoria")
    .select("respuesta, palabras_clave")
    .eq("activo", true)
    .not("categoria", "in", "(fuera_horario,apertura)")
    .order("orden", { ascending: true });

  for (const fila of data ?? []) {
    const match = (fila.palabras_clave as string[]).some((p) => texto.includes(normalizar(p)));
    if (match) return fila.respuesta;
  }
  return null;
}

export async function buscarRespuestaFueraHorario(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase
    .from("whatsapp_memoria")
    .select("respuesta")
    .eq("categoria", "fuera_horario")
    .eq("activo", true)
    .order("orden", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.respuesta ?? null;
}

// Lo que el cliente escribió desde nuestra última respuesta (puede ser más de un mensaje seguido).
export function textoPendienteDelCliente(historial: { role: "user" | "assistant"; content: string }[]): string {
  const pendientes: string[] = [];
  for (let i = historial.length - 1; i >= 0 && historial[i].role === "user"; i--) pendientes.unshift(historial[i].content);
  return pendientes.join("\n");
}

// Si el cliente pregunta por un auto (stock, precio, financiación, vender el suyo), la respuesta fija de la Memoria
// no alcanza: "¿tienen el Fox? ¿dónde están?" contestaba solo la ubicación y nunca el Fox. En ese caso contesta la IA.
export const REGEX_CONSULTA_AUTO = /\b(tien[eé]n?|ten[eé]s|hay|stock|disponible|precio|cu[aá]nto|vale|sale|0 ?km|usad[oa]s?|modelo|auto|camioneta|pick ?up|suv|sed[aá]n|financ\w*|cuotas?|permut\w*|vend\w*|consign\w*|segur\w*)\b/i;
