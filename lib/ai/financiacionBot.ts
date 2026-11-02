// Lo que el bot (WhatsApp, Instagram, Messenger y Rodi) puede decir de financiación. Sale de agenteV2.ts para poder
// probarlo sin la base ni la IA.
//
// Decisión de Walter del 12/10/2026 (captura de una charla de WhatsApp y audio):
// - A cualquier pregunta de financiación o crédito, sea del porcentaje que sea: sí financiamos, se habla por acá, y se
//   piden el nombre completo y el CUIL juntos, diciendo para qué (chequear qué monto ofrece el banco).
// - Respuesta general: los topes propios (50-65% según el año en usados, 70% en 0 km, de Financiaciones →
//   Configuración) y el pedido de nombre y CUIL. Nada más: sin "¿querés que lo calculemos juntos?".
// - Si preguntan por el 100%: sí, contamos con todas las financiaciones del mercado (crédito prendario, Banco Nación,
//   Banco Provincia), y nombre completo y CUIL.
// - La tasa (TNA) no se da nunca.
import type { FinanciacionInfo } from "./promptsV2";

/** Créditos bancarios con los que se llega al 100% (dicho por Walter el 12/10/2026). */
export const CREDITOS_BANCARIOS = "crédito prendario, Banco Nación y Banco Provincia";
export const TOPE_CREDITO_BANCARIO_PCT = 100;

export const PEDIDO_NOMBRE_Y_CUIL =
  "Para darte más información, pasame tu nombre completo y tu CUIL, así chequeamos qué monto te ofrece el banco.";

/**
 * Instagram y Messenger (Walter, 17/10/2026): el nombre ya está en el perfil de la cuenta, así que ahí solo se pide el
 * CUIL. WhatsApp y Rodi siguen pidiendo nombre completo y CUIL.
 */
export const PEDIDO_SOLO_CUIL = "Para darte más información, pasame tu CUIL, así chequeamos qué monto te ofrece el banco.";
export const pedidoDatosFinanciacion = (esRedSocial = false) => (esRedSocial ? PEDIDO_SOLO_CUIL : PEDIDO_NOMBRE_Y_CUIL);

export function rangoTopesUsados(financiacion: FinanciacionInfo): string {
  const pcts = financiacion.topes.map((t) => t.pct);
  const min = Math.min(...pcts);
  const max = Math.max(...pcts);
  return min === max ? `${min}%` : `entre el ${min}% y el ${max}%`;
}

/** El cliente pregunta por financiar el total del auto. */
export function preguntaPorCienPorCiento(texto: string): boolean {
  return /\b100\s?%|\b100\s*por\s*ciento|cien\s*por\s*ciento|financiad[oa]s?\s+(al\s+)?100|\btotal(idad)?\s+del\s+(auto|veh[ií]culo)/i.test(texto);
}

// Red de seguridad: el prompt ya dice qué contestar, pero un modelo chico a veces redondea un número, lo repite de
// memoria o nombra la tasa. Salta si la respuesta habla de financiación y menciona la tasa o un % que no es de los
// reales. Solo mira respuestas que tocan el tema, para no saltar con un % de otro contexto.
export function respuestaMencionaFinanciacionInventada(reply: string, financiacion: FinanciacionInfo): boolean {
  if (!/financi|cuota|tna|tasa|cr[ée]dito|tope de|entrega inicial/i.test(reply)) return false;
  if (/\btna\b|\btasas?\b/i.test(reply)) return true;
  const porcentajesReply = Array.from(reply.matchAll(/(\d{1,3})\s?%/g)).map((m) => Number(m[1]));
  if (porcentajesReply.length === 0) return false;

  const porcentajesReales = new Set<number>([
    ...financiacion.topes.map((t) => t.pct),
    financiacion.tope0km,
    financiacion.gastosPct,
    TOPE_CREDITO_BANCARIO_PCT,
  ]);
  return porcentajesReply.some((n) => !porcentajesReales.has(n));
}

// Respuesta armada en código cuando se descarta la de la IA: la general, o la del 100% si eso preguntó el cliente.
export function respuestaSeguraConFinanciacionReal(financiacion: FinanciacionInfo, ultimoMensajeCliente = "", esRedSocial = false): string {
  const pedido = pedidoDatosFinanciacion(esRedSocial);
  if (preguntaPorCienPorCiento(ultimoMensajeCliente)) {
    return `Sí, financiamos hasta el ${TOPE_CREDITO_BANCARIO_PCT}%: contamos con todas las financiaciones del mercado (${CREDITOS_BANCARIOS}). ${pedido}`;
  }
  return `Sí, financiamos hasta ${rangoTopesUsados(financiacion)} del valor en usados, según el año del auto, y hasta el ${financiacion.tope0km}% en 0 km. ${pedido}`;
}

// ── Solo Paffy, el chat de la web (Walter, 31/10/2026) ──────────────────────────────────────────────────────────────
// El mensaje de antes "no se entiende" y mandaba a la web. WhatsApp, Instagram y Messenger siguen como arriba (andan
// bien); en Paffy va en dos pasos:
//  1) A la primera pregunta: topes propios, el 100% con créditos bancarios y "¿Qué auto te gustaría financiar?". Sin link.
//  2) Cuando dice el auto (alcanza con el modelo): nombre completo, teléfono y CUIL, y un asesor arma los números y lo
//     contacta. Con los datos en mano el bot marca handoff y el vendedor asignado recibe el aviso.
export const PREGUNTA_AUTO_A_FINANCIAR = "¿Qué auto te gustaría financiar?";
export const PEDIDO_DATOS_WEB = "Pasame tu nombre completo, tu teléfono y tu CUIL, y un asesor te arma los números y te contacta.";

export function respuestaFinanciacionWeb(financiacion: FinanciacionInfo): string {
  const rango = rangoTopesUsados(financiacion);
  return `Sí, tenemos financiación propia: en usados, ${rango.startsWith("entre") ? rango : `hasta el ${rango}`} del valor según el año, y en 0 km hasta el ${financiacion.tope0km}%. Con créditos bancarios (${CREDITOS_BANCARIOS}) se puede llegar al ${TOPE_CREDITO_BANCARIO_PCT}%. ${PREGUNTA_AUTO_A_FINANCIAR}`;
}

/**
 * Paso 2 asegurado en código: si el mensaje anterior del bot fue "¿Qué auto te gustaría financiar?" y la respuesta nueva
 * no pide el CUIL (pasa cuando muestra stock: las reglas de stock le ganan al prompt), se cambia el cierre por el pedido
 * de datos. Si el cierre era una pregunta ("¿Cuál te interesa?"), se saca para no hacer dos preguntas juntas.
 */
export function asegurarPedidoDeDatosWeb(reply: string, ultimoMensajeBot: string | null | undefined): string {
  if (!ultimoMensajeBot?.includes(PREGUNTA_AUTO_A_FINANCIAR)) return reply;
  if (/\bCUIL\b/i.test(reply)) return reply;
  const parrafos = reply.trim().split(/\n\s*\n/);
  if (parrafos.length > 1 && parrafos[parrafos.length - 1].includes("?")) parrafos.pop();
  return `${parrafos.join("\n\n")}\n\n${PEDIDO_DATOS_WEB}`;
}
