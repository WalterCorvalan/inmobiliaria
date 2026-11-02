// Regla de conversión compartida para operaciones con montos en ARS y USD
// (señas, ventas, recibos). Antes cada pantalla sumaba/restaba los campos
// "_ars" ignorando los "_usd" (o viceversa), así que una seña/pago en la
// moneda que no coincidía con la de la operación se contaba como $0.

export type Moneda = "ARS" | "USD";

/** Convierte un monto entre ARS y USD usando la cotización cargada.
 * Sin cotización no hay forma confiable de convertir: devuelve 0 en vez de
 * inventar una equivalencia. */
export function convertirMonto(
  monto: number | string | null | undefined,
  monedaOrigen: Moneda,
  monedaDestino: Moneda,
  tipoCambio: number | string | null | undefined
): number {
  const m = Number(monto) || 0;
  if (!m || monedaOrigen === monedaDestino) return m;
  const tc = Number(tipoCambio) || 0;
  if (!tc) return 0;
  return monedaOrigen === "USD" ? m * tc : m / tc;
}

/** Suma una lista de pagos (cada uno en su propia moneda) expresados en una
 * única moneda destino. */
export function totalEnMoneda(
  pagos: { monto: number | string | null | undefined; moneda: Moneda }[],
  monedaDestino: Moneda,
  tipoCambio: number | string | null | undefined
): number {
  return pagos.reduce((acc, p) => acc + convertirMonto(p.monto, p.moneda, monedaDestino, tipoCambio), 0);
}

export function simboloMoneda(moneda: Moneda): string {
  return moneda === "USD" ? "US$" : "$";
}

/** Dice si hay algún monto en una moneda distinta a la de destino SIN cotización cargada: en ese caso convertirMonto devuelve 0 y el
 * total queda incompleto en silencio. Toda pantalla que sume pagos en distintas monedas tiene que usar esto para frenar o avisar. */
export function faltaCotizacion(
  pagos: { monto: number | string | null | undefined; moneda: Moneda }[],
  monedaDestino: Moneda,
  tipoCambio: number | string | null | undefined
): boolean {
  if (Number(tipoCambio) > 0) return false;
  return pagos.some((p) => (Number(p.monto) || 0) > 0 && p.moneda !== monedaDestino);
}
