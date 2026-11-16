// Control de gasto de la demo (dental-bot docs/simulador.md, sección 4). Tres capas:
// 1) Tope duro en Anthropic: la clave DEMO_ANTHROPIC_API_KEY sale de un espacio de trabajo propio con límite de USD 5 por mes.
// 2) Este contador: al llegar a TOPE_GASTO_USD la demo deja de llamar a la IA. Vive en la memoria del servidor (cada
//    instancia cuenta lo suyo y se reinicia con cada deploy): es una red extra, el tope que manda es el de Anthropic.
// 3) Límites por visita: mensajes por charla y charlas por hora desde la misma conexión.

export const TOPE_GASTO_USD = 4.5;
export const MAX_MENSAJES_POR_CHARLA = 30;
export const MAX_PEDIDOS_POR_HORA = 60;
export const MAX_CARACTERES_MENSAJE = 600;

export const MENSAJE_TOPE_GASTO = "La demo llegó a su límite por este mes. Escribinos y te la mostramos en vivo.";
export const MENSAJE_TOPE_CHARLA = "Llegaste al máximo de mensajes de esta demo. Tocá \"Reiniciar demo\" para empezar otra charla.";

export type ResultadoLimite = { ok: true } | { ok: false; mensaje: string };

export function revisarLimites(o: { mensajesCliente: number; gastoMesUsd: number }): ResultadoLimite {
  if (o.gastoMesUsd >= TOPE_GASTO_USD) return { ok: false, mensaje: MENSAJE_TOPE_GASTO };
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
