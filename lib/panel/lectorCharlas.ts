// Lector de charlas (17/10/2026, Walter): cuando un vendedor contesta, el bot se apaga y nadie vuelve a leer la charla,
// así que el lead se queda sin resumen (caso real en Instagram). El lector lee la charla cuando lleva unos minutos quieta y completa lo que falta en el lead. No le
// contesta nada al cliente, no reactiva el bot, no reasigna y no pisa lo que cargó un vendedor.
//
// Acá viven las reglas, sin base de datos, para poder probarlas. La ruta que las usa es
// app/api/cron/panel/lector-charlas/route.ts.

import { INSTRUCCION_RESUMEN } from "@/lib/panel/formatoResumen";
import { z } from "zod";
import { telefonoEnTexto } from "@/lib/panel/resaltarResumen";

// telefono: dónde se guarda el teléfono que el cliente deja escrito ("contacto" = columna telefono de la tabla de
// contactos; "conversacion" = columna telefono_contacto de la charla). WhatsApp ya tiene el número.
export const CANALES_LECTOR = [
  { canal: "whatsapp", tabla: "whatsapp_conversaciones", mensajes: "whatsapp_mensajes", fk: "whatsapp_conversacion_id", telefono: null, contactos: null },
  { canal: "instagram", tabla: "instagram_conversaciones", mensajes: "instagram_mensajes", fk: "instagram_conversacion_id", telefono: "contacto", contactos: "instagram_contactos" },
  { canal: "messenger", tabla: "messenger_conversaciones", mensajes: "messenger_mensajes", fk: "messenger_conversacion_id", telefono: "contacto", contactos: "messenger_contactos" },
  { canal: "rodi", tabla: "rodi_conversaciones", mensajes: "rodi_mensajes", fk: "rodi_conversacion_id", telefono: "conversacion", contactos: null },
] as const;

/**
 * Teléfono que el cliente dejó en la charla (17/10/2026, Walter: Mel lo escribió y la ficha seguía "Sin teléfono").
 * Se toma el último mensaje del cliente que tenga un número y, para no confundir otros números, el mensaje tiene que
 * hablar de teléfono/WhatsApp o ser casi solo el número.
 */
export function telefonoDelCliente(textosCliente: string[]): string | null {
  for (const texto of [...textosCliente].reverse()) {
    const tel = telefonoEnTexto(texto);
    if (!tel) continue;
    const hablaDeTelefono = /tel[eé]f|cel|whats|wsp|wpp|n[uú]mero|llam|contact|agend/i.test(texto);
    const casiSoloNumero = tel.replace(/\D/g, "").length >= texto.replace(/\s/g, "").length * 0.6;
    if (hablaDeTelefono || casiSoloNumero) return tel;
  }
  return null;
}

/** Minutos sin mensajes nuevos antes de leer una charla: se lee cuando la conversación se calmó, no a mitad. Con la tarea cada 2 minutos, el resumen está a los 5 minutos como mucho (Walter, 21/10/2026). */
export const MINUTOS_QUIETA = 3;
/** Las charlas que nunca se leyeron se procesan hasta esta antigüedad (Walter, 17/10: solo los últimos 5 días). */
export const DIAS_HACIA_ATRAS = 5;

export function necesitaLectura(d: { ultimoMensaje: string | null; leidoHasta: string | null; ahora: Date }): boolean {
  if (!d.ultimoMensaje) return false;
  const ultimo = Date.parse(d.ultimoMensaje);
  if (d.ahora.getTime() - ultimo < MINUTOS_QUIETA * 60_000) return false; // todavía se está hablando
  return !d.leidoHasta || ultimo > Date.parse(d.leidoHasta);
}

export const RespuestaLectorSchema = z.object({ resumen: z.string().max(900) });
export type RespuestaLector = z.infer<typeof RespuestaLectorSchema>;

export function armarPedidoLector(historial: { direccion: string; texto: string }[]) {
  const charla = historial.map((m) => `${m.direccion === "in" ? "CLIENTE" : "EMPRESA"}: ${m.texto}`).join("\n");
  const system = [
    "Leés una charla entre un cliente y una empresa y devolvés SOLO un JSON con el resumen de lo que el cliente dijo. No inventes nada: si un dato no está en la charla, no lo pongas.",
    "Campos:",
    `- resumen: para la persona que retoma la charla, ${INSTRUCCION_RESUMEN}`,
  ].join("\n");
  return [{ role: "system" as const, content: system }, { role: "user" as const, content: `CHARLA:\n${charla}` }];
}
