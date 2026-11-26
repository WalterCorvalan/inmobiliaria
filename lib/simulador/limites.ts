// Control de gasto de la demo (dental-bot docs/simulador.md, sección 4). Tres capas:
// 1) Tope de Anthropic: por ahora un solo espacio de trabajo para todo (Walter, 16/11/2026); el límite de gasto de ese
//    espacio cubre a la demo y al bot real juntos.
// 2) Este contador: al llegar al tope del producto (topeGastoUsd) la demo deja de llamar a la IA. Vive en la memoria del servidor (cada
//    instancia cuenta lo suyo y se reinicia con cada deploy), así que es aproximado.
// 3) Límites por visita: mensajes por charla y charlas por hora desde la misma conexión.

// Tope por producto (Walter, 16/11/2026): los USD 5 de demos se reparten entre DentalBot, Inmobiliaria y Automotora.
// Cada producto tiene su propio contador; por defecto USD 1,50 (3 x 1,50 = 4,50, con margen). Se cambia con DEMO_TOPE_USD.
export const TOPE_GASTO_POR_DEFECTO_USD = 1.5;
export function topeGastoUsd(valor = process.env.DEMO_TOPE_USD): number {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? n : TOPE_GASTO_POR_DEFECTO_USD;
}
export const MAX_MENSAJES_POR_CHARLA = 30;
export const MAX_PEDIDOS_POR_HORA = 60;
export const MAX_CARACTERES_MENSAJE = 600;

export const MENSAJE_TOPE_GASTO = "La demo llegó a su límite por este mes. Escribinos y te la mostramos en vivo.";
export const MENSAJE_TOPE_CHARLA = "Llegaste al máximo de mensajes de esta demo. Tocá \"Reiniciar demo\" para empezar otra charla.";

export type ResultadoLimite = { ok: true } | { ok: false; mensaje: string };

export function revisarLimites(o: { mensajesCliente: number; gastoMesUsd: number; topeUsd?: number }): ResultadoLimite {
  if (o.gastoMesUsd >= (o.topeUsd ?? topeGastoUsd())) return { ok: false, mensaje: MENSAJE_TOPE_GASTO };
  if (o.mensajesCliente > MAX_MENSAJES_POR_CHARLA) return { ok: false, mensaje: MENSAJE_TOPE_CHARLA };
  return { ok: true };
}

/** Contador de gasto por mes calendario (UTC). Se crea uno por proceso; en los tests se crea uno nuevo para cada caso. */
export function crearContadorGasto() {
  let mes = "";
  let total = 0;
  const claveMes = (d: Date) => `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
  const alDia = (d: Date) => { const k = claveMes(d); if (k !== mes) { mes = k; total = 0; } };
  return {
    sumar(usd: number, ahora = new Date()) { alDia(ahora); total += Math.max(0, usd); },
    delMes(ahora = new Date()) { alDia(ahora); return total; },
  };
}

export const contadorGasto = crearContadorGasto();
