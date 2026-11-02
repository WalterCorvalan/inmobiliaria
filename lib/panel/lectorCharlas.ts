// Lector de charlas (17/10/2026, Walter): cuando un vendedor contesta, el bot se apaga y nadie vuelve a leer la charla,
// así que el lead se queda sin resumen, sin auto vinculado y sin la permuta que ofreció el cliente (caso Mel González,
// Instagram). El lector lee la charla cuando lleva unos minutos quieta y completa lo que falta en el lead. No le
// contesta nada al cliente, no reactiva el bot, no reasigna y no pisa lo que cargó un vendedor.
//
// Acá viven las reglas, sin base de datos, para poder probarlas. La ruta que las usa es
// app/api/cron/panel/lector-charlas/route.ts.

import { INSTRUCCION_RESUMEN } from "@/lib/panel/formatoResumen";
import { z } from "zod";
import { CUANDO_COMPRA, FORMAS_PAGO, normalizarProspeccion, type ProspeccionLead } from "@/lib/panel/prospeccionLead";
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

export type AutoStock = { id: string; marca: string; modelo: string; anio: number | null; km: number | null; color: string | null };

const normalizar = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ");
// Palabras de modelo que no identifican un auto por sí solas.
const GENERICAS = new Set(["nuevo", "nueva", "doble", "cabina", "simple", "full", "base", "sedan", "pick", "up", "4x2", "4x4", "mt", "at"]);

/**
 * Auto del stock nombrado en lo que escribió el cliente, sin IA: el modelo (su primera palabra con sentido) más la
 * marca o el año. El mensaje automático del catálogo ("Hola, me interesa el Ford Ranger … 2023") cae siempre acá.
 * Devuelve el id solo si hay un único candidato; si hay dudas, decide la IA.
 */
export function autoPorTexto(textosCliente: string[], stock: AutoStock[]): string | null {
  const texto = ` ${normalizar(textosCliente.join(" "))} `;
  const candidatos = stock.filter((v) => {
    const modelo = normalizar(v.modelo).split(" ").find((p) => p.length >= 3 && !GENERICAS.has(p));
    if (!modelo || !texto.includes(` ${modelo} `)) return false;
    const marca = normalizar(v.marca).trim();
    return (marca && texto.includes(` ${marca} `)) || (v.anio !== null && texto.includes(` ${v.anio} `));
  });
  if (candidatos.length === 1) return candidatos[0].id;
  // Varios del mismo modelo: si el año desempata, se queda con ese.
  const conAnio = candidatos.filter((v) => v.anio !== null && texto.includes(` ${v.anio} `));
  return conAnio.length === 1 ? conAnio[0].id : null;
}

/** Completa la calificación del lead solo en lo que está vacío: lo que cargó un vendedor nunca se pisa. */
export function fusionarProspeccion(actual: unknown, nueva: ProspeccionLead): ProspeccionLead {
  const a = normalizarProspeccion(actual);
  return {
    formasPago: a.formasPago.length ? a.formasPago : nueva.formasPago,
    usado: a.usado ?? nueva.usado,
    anticipo: a.anticipo ?? nueva.anticipo,
    cuando: a.cuando ?? nueva.cuando,
  };
}

export const RespuestaLectorSchema = z.object({
  resumen: z.string().max(900),
  vehiculo_id: z.string().nullable(),
  solo_vende_su_auto: z.boolean().default(false),
  formas_pago: z.array(z.string()).default([]),
  usado: z.object({ marca: z.string().nullable(), modelo: z.string().nullable(), anio: z.number().nullable(), km: z.number().nullable() }).nullable(),
  anticipo: z.object({ monto: z.number(), moneda: z.enum(["ARS", "USD"]) }).nullable(),
  cuando: z.string().nullable(),
});
export type RespuestaLector = z.infer<typeof RespuestaLectorSchema>;

/** Pasa la respuesta de la IA a la forma de "Cómo compra" (descarta valores fuera de la lista). */
export function prospeccionDeRespuesta(r: RespuestaLector): ProspeccionLead {
  return normalizarProspeccion({ formasPago: r.formas_pago, usado: r.usado, anticipo: r.anticipo, cuando: r.cuando });
}

export function armarPedidoLector(historial: { direccion: string; texto: string }[], stock: AutoStock[]) {
  const listaStock = stock.map((v) => `${v.id} | ${v.marca} ${v.modelo} ${v.anio ?? ""} | ${v.km != null ? `${v.km} km` : "km sin dato"} | ${v.color ?? ""}`).join("\n");
  const charla = historial.map((m) => `${m.direccion === "in" ? "CLIENTE" : "AGENCIA"}: ${m.texto}`).join("\n");
  const system = [
    "Leés una charla entre un cliente y una concesionaria de autos y devolvés SOLO un JSON con lo que el cliente dijo. No inventes nada: si un dato no está en la charla, va null o lista vacía.",
    "Campos:",
    `- resumen: para el vendedor que retoma la charla, ${INSTRUCCION_RESUMEN}`,
    `- vehiculo_id: el id del auto del STOCK por el que pregunta el cliente, copiado tal cual de la lista. null si no queda claro o si el auto no está en la lista. Nunca uses el auto que el cliente ofrece en permuta.`,
    "- solo_vende_su_auto: true si el cliente quiere vender o dejar en consignación SU auto y no comprar uno del stock (aunque al principio haya preguntado por alguno); false si compra, o si entrega el suyo como parte de pago.",
    `- formas_pago: valores de ${JSON.stringify(FORMAS_PAGO.map((f) => f.value))} que el cliente mencionó (permuta = entrega su auto como parte de pago).`,
    "- usado: el auto que el cliente ofrece entregar (permuta), con marca, modelo, año y km si los dijo; null si no ofrece ninguno.",
    "- anticipo: el monto que el cliente dijo tener para entregar o su presupuesto, con moneda ARS o USD; null si no lo dijo.",
    `- cuando: uno de ${JSON.stringify(CUANDO_COMPRA.map((c) => c.value))} si el cliente dijo cuándo quiere comprar; null si no.`,
  ].join("\n");
  const user = `STOCK (id | auto | km | color):\n${listaStock}\n\nCHARLA:\n${charla}`;
  return [{ role: "system" as const, content: system }, { role: "user" as const, content: user }];
}
