// Conexión del simulador con el bot: el MISMO prompt y el MISMO formato de salida que usan los webhooks de WhatsApp,
// Instagram y Messenger (lib/ai/promptsV2.ts, AgentReplySchemaV2), pero con la empresa de ejemplo del rubro y sin base:
// no guarda la charla ni el uso de IA en Supabase. Usa su propia clave (DEMO_ANTHROPIC_API_KEY), de un espacio de trabajo
// de Anthropic con tope de USD 5 por mes, para que la demo nunca gaste la plata del bot real.
import Anthropic from "@anthropic-ai/sdk";
import { AgentReplySchemaV2, dividirRespuestaEnMensajes, type AgentReplyV2 } from "@/lib/ai/agenteV2";
import { buildSystemPromptV2 } from "@/lib/ai/promptsV2";
import { extractJson } from "@/lib/ai/indexV2";
import { costoFilaIaUsd, MODELO_BOTS } from "@/lib/ai/costoIa";
import type { CanalDemo, MensajeDemo, RubroDemo } from "./tipos";

export function demoConfigurada(): boolean {
  return !!process.env.DEMO_ANTHROPIC_API_KEY;
}

export function promptDemo(rubro: RubroDemo, canal: CanalDemo): string {
  return buildSystemPromptV2({
    empresa: { nombre: rubro.nombreNegocio, descripcion: rubro.descripcion, conocimiento: rubro.conocimiento },
    nombreBot: rubro.nombreBot,
    sucursales: rubro.sucursales,
    esInstagram: canal === "instagram",
  });
}

export type RespuestaDemo = { ok: true; data: AgentReplyV2; mensajes: string[]; costoUsd: number } | { ok: false; error: string; costoUsd: number };

export async function responderDemo(rubro: RubroDemo, canal: CanalDemo, historial: MensajeDemo[]): Promise<RespuestaDemo> {
  const cliente = new Anthropic({ apiKey: process.env.DEMO_ANTHROPIC_API_KEY || "" });
  const system = promptDemo(rubro, canal);
  let costoUsd = 0;
  let ultimoError = "";
  for (let intento = 0; intento < 2; intento++) {
    const mensajes = intento === 0 ? historial : [...historial, { role: "user" as const, content: "IMPORTANTE: tu respuesta anterior no era JSON válido. Respondé ÚNICAMENTE con el JSON." }];
    try {
      const r = await cliente.messages.create(
        // Instrucciones en caché: en una charla de demo se repiten en cada mensaje y leerlas de la caché sale 10 veces menos.
        { model: MODELO_BOTS, max_tokens: 3000, output_config: { effort: "low" }, system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }], messages: mensajes },
        { timeout: 20000, maxRetries: 0 },
      );
      costoUsd += costoFilaIaUsd({
        modelo: MODELO_BOTS, input_tokens: r.usage.input_tokens, output_tokens: r.usage.output_tokens,
        cache_escritura_tokens: r.usage.cache_creation_input_tokens ?? 0, cache_lectura_tokens: r.usage.cache_read_input_tokens ?? 0,
      });
      let texto = "";
      for (const b of r.content) if (b.type === "text") texto += b.text;
      const data = AgentReplySchemaV2.parse(JSON.parse(extractJson(texto)));
      return { ok: true, data, mensajes: dividirRespuestaEnMensajes(data.reply), costoUsd };
    } catch (err) {
      ultimoError = err instanceof Error ? err.message : "Error desconocido";
    }
  }
  return { ok: false, error: ultimoError, costoUsd };
}
