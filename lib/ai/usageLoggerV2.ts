import { createClient } from "@supabase/supabase-js";

// Igual que lib/ai/usageLogger.ts pero escribiendo en la base nueva (nova) —
// panel-v2 tiene su propio uso_ia_anthropic, separado del de v1.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE2_URL!,
  process.env.SUPABASE2_SERVICE_ROLE_KEY!
);

// Uso que informa una respuesta de la API (usage). Las búsquedas en internet y la caché se cobran aparte de los tokens
// (lib/ai/costoIa.ts), así que se guardan también (14/10/2026).
export type UsoIa = { inputTokens: number; outputTokens: number; busquedasWeb?: number; cacheEscrituraTokens?: number; cacheLecturaTokens?: number };

type UsageApi = {
  input_tokens?: number | null; output_tokens?: number | null;
  cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
} | null | undefined;

export function usoDeRespuesta(usage: UsageApi): UsoIa {
  return {
    inputTokens: usage?.input_tokens || 0,
    outputTokens: usage?.output_tokens || 0,
    busquedasWeb: usage?.server_tool_use?.web_search_requests || 0,
    cacheEscrituraTokens: usage?.cache_creation_input_tokens || 0,
    cacheLecturaTokens: usage?.cache_read_input_tokens || 0,
  };
}

// modelo: el que respondió, para cobrar cada fila con su tarifa. Si faltan columnas (migraciones/sql_uso_ia_modelo.sql
// o sql_uso_ia_busquedas.sql sin correr), se vuelve a guardar con las que seguro existen.
export function registrarUsoAnthropicV2(origen: string, uso: UsoIa, modelo?: string) {
  const basico = { origen, input_tokens: uso.inputTokens, output_tokens: uso.outputTokens };
  const completo = {
    ...basico, ...(modelo ? { modelo } : {}),
    busquedas_web: uso.busquedasWeb || 0, cache_escritura_tokens: uso.cacheEscrituraTokens || 0, cache_lectura_tokens: uso.cacheLecturaTokens || 0,
  };
  supabaseAdmin
    .from("uso_ia_anthropic")
    .insert(completo)
    .then(async ({ error }) => {
      if (!error) return;
      if (/column|columna|schema cache/i.test(error.message)) {
        const segundo = await supabaseAdmin.from("uso_ia_anthropic").insert(basico);
        if (!segundo.error) return;
        console.error("[usageLoggerV2] no se pudo registrar el uso de IA:", segundo.error.message);
        return;
      }
      console.error("[usageLoggerV2] no se pudo registrar el uso de IA:", error.message);
    });
}
