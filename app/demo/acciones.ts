"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { rateLimit } from "@/lib/rateLimit";
import { demoConfigurada, responderDemo } from "@/lib/simulador/botDemo";
import { contadorGasto, MAX_CARACTERES_MENSAJE, MAX_PEDIDOS_POR_HORA, revisarLimites } from "@/lib/simulador/limites";
import { rubroDemo } from "@/lib/simulador/rubros";
import { CANALES_DEMO, type Calificacion, type DatosLead } from "@/lib/simulador/tipos";

// Simulador de canales: recibe la charla entera (vive solo en el navegador) y devuelve la respuesta del bot.
// No guarda nada en la base ni manda mensajes reales. Es una acción de servidor y no una ruta de app/api porque no
// pertenece a ninguna empresa (las rutas de app/api tienen que correr dentro de una: lib/empresa/guardia.test.ts).

const Pedido = z.object({
  rubro: z.string().max(40),
  canal: z.enum(CANALES_DEMO),
  historial: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) })).min(1).max(80),
});

export type RespuestaChatDemo = { mensajes: string[]; handoff?: boolean; calificacion?: Calificacion | null; datos?: DatosLead };

export async function chatDemo(entrada: unknown): Promise<RespuestaChatDemo> {
  const pedido = Pedido.safeParse(entrada);
  if (!pedido.success) return { mensajes: ["Perdón, no te entendí. ¿Me lo repetís?"] };
  const { canal, historial } = pedido.data;
  const ultimo = historial[historial.length - 1];
  if (ultimo.role !== "user" || ultimo.content.length > MAX_CARACTERES_MENSAJE) return { mensajes: ["Ese mensaje es muy largo para la demo."] };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const limite = await rateLimit(ip ? `demo:${ip}` : null, { limite: MAX_PEDIDOS_POR_HORA, ventanaMs: 60 * 60 * 1000, proyecto: "v2" });
  if (!limite.ok) return { mensajes: ["Mandaste muchos mensajes seguidos. Probá de nuevo en un rato."] };

  const control = revisarLimites({ mensajesCliente: historial.filter((m) => m.role === "user").length, gastoMesUsd: contadorGasto.delMes() });
  if (!control.ok) return { mensajes: [control.mensaje] };
  if (!demoConfigurada()) return { mensajes: ["La demo todavía no tiene la IA configurada (falta ANTHROPIC_API_KEY)."] };

  const r = await responderDemo(rubroDemo(pedido.data.rubro), canal, historial);
  contadorGasto.sumar(r.costoUsd);
  if (!r.ok) {
    console.error("[demo] el bot no respondió:", r.error);
    return { mensajes: ["Perdón, se me cortó la conexión. ¿Me lo repetís?"] };
  }
  return { mensajes: r.mensajes, handoff: r.data.handoff, calificacion: r.data.calificacion, datos: r.data.datos_detectados };
}
