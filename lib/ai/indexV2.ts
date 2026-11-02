import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { registrarUsoAnthropicV2, usoDeRespuesta } from "./usageLoggerV2";
import { avisarSaldoAgotado } from "./saldoIa";
import { MODELO_BOTS } from "./costoIa";

// Cuánto razona el modelo antes de contestar. "low" para los bots (probado con 16 charlas); "medium" para el gerente
// y el buscador, que en "low" se equivocaron una vez (el buscador puso "Utilitarios" a "auto chico para empezar").
export type EsfuerzoIa = "low" | "medium";

// Fork de lib/ai/index.ts para panel-v2 — mismo motor (Claude Haiku, con
// respaldo OpenRouter), pero el conteo de uso va a la base nova, no a v1.

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });
// 14/10/2026 (Walter): de Claude Haiku 4.5 a Haiku 5.5, unas 10 veces más barato. Probado antes con charlas de prueba:
// no inventó autos ni horarios, clasificó mejor y separó pesos de dólares en el gerente. Razona antes de contestar,
// así que lleva más margen de tokens y de tiempo que el 4.5.
const MODELO_ANTHROPIC = MODELO_BOTS;

export function isAiConfiguredV2(): boolean {
  return !!process.env.ANTHROPIC_API_KEY || !!process.env.OPENROUTER_API_TOKEN;
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function extractJson(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) return text.slice(start, end + 1);
  return text;
}

async function intentarAnthropic(
  systemMsg: string,
  conversationMsgs: { role: "user" | "assistant"; content: string }[],
  intentoCorreccion: boolean,
  origen: string,
  esfuerzo: EsfuerzoIa
): Promise<string> {
  const finalMsgs = !intentoCorreccion
    ? conversationMsgs
    : [...conversationMsgs, { role: "user" as const, content: "IMPORTANTE: tu respuesta anterior no era JSON válido. Respondé ÚNICAMENTE con el JSON, sin texto extra ni backticks." }];

  const response = await anthropic.messages.create(
    // 1500, no 1000: una respuesta con un listado de 3-4 autos + el resto de
    // los campos del JSON puede acercarse al límite viejo y cortar la
    // respuesta a mitad de frase (visto en pruebas reales).
    // 6000 (antes 1500 con el 4.5): el 5.5 razona antes de contestar y eso también cuenta como salida.
    // 15 s (antes 8): en la prueba algunas respuestas tardaron casi 8 s; las rutas que lo usan tienen 60 s de máximo.
    { model: MODELO_ANTHROPIC, max_tokens: 6000, output_config: { effort: esfuerzo }, system: systemMsg, messages: finalMsgs },
    { timeout: 15000, maxRetries: 0 }
  );

  registrarUsoAnthropicV2(origen, usoDeRespuesta(response.usage), MODELO_ANTHROPIC);
  if (response.stop_reason === "refusal") throw new Error("La IA no quiso responder este mensaje.");

  let content = "";
  for (const block of response.content) if (block.type === "text") content += block.text;
  return content;
}

async function intentarOpenRouter(systemMsg: string, conversationMsgs: { role: "user" | "assistant"; content: string }[]): Promise<string> {
  const res = await fetch(`${process.env.OPENROUTER_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.OPENROUTER_MODEL, messages: [{ role: "system", content: systemMsg }, ...conversationMsgs] }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`OpenRouter respondió ${res.status}: ${await res.text().catch(() => "")}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export async function chatJsonV2<T>(
  schema: z.ZodType<T>,
  messages: ChatMessage[],
  opts?: { maxRetries?: number; origen?: string; esfuerzo?: EsfuerzoIa }
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const origen = opts?.origen ?? "desconocido";
  if (!isAiConfiguredV2()) return { ok: false, error: "No hay ninguna IA configurada (ni ANTHROPIC_API_KEY ni OPENROUTER_API_TOKEN)" };

  const maxRetries = opts?.maxRetries ?? 2;
  let lastError = "";
  const systemMsg = messages.find((m) => m.role === "system")?.content ?? "";
  const conversationMsgs = messages.filter((m) => m.role !== "system") as { role: "user" | "assistant"; content: string }[];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    for (const proveedor of ["anthropic", "openrouter"] as const) {
      if (proveedor === "anthropic" && !process.env.ANTHROPIC_API_KEY) continue;
      if (proveedor === "openrouter" && !process.env.OPENROUTER_API_TOKEN) continue;
      try {
        const content = proveedor === "anthropic" ? await intentarAnthropic(systemMsg, conversationMsgs, attempt > 0, origen, opts?.esfuerzo ?? "low") : await intentarOpenRouter(systemMsg, conversationMsgs);
        const parsed = JSON.parse(extractJson(content));
        const validated = schema.parse(parsed);
        return { ok: true, data: validated };
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Error desconocido";
        // Anthropic rechaza con "credit balance is too low" cuando se acabó el saldo: aviso real a los admin (no repite por 6 hs).
        if (proveedor === "anthropic" && /credit balance|billing|insufficient (funds|credit)/i.test(lastError)) avisarSaldoAgotado();
      }
    }
  }
  return { ok: false, error: lastError };
}
