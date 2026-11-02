// Saldo y remanente de una seña: única fuente (NuevaSenaModal, al crear y al editar). Lo que se guarda en
// senas.saldo_abonar_ars / remanente_ars es lo que se imprime en el boleto (en la moneda de la venta).
//
// Reglas (Walter, 19/10/2026):
// - Patentamiento/transferencia: en pesos o en dólares (se convierte con el tipo de cambio); se suma al precio, salvo
//   que esté marcado "incluido en el precio de venta".
// - Prenda: el boleto usa el "valor para el boleto" si se marcó "Valor prenda extra"; si no, el monto real. El real es
//   el que entra a la caja (senas.prenda_monto) y no cambia acá.
// - Todo se convierte a la moneda de la venta con lib/moneda.ts; nunca se suman campos de monedas distintas.

import { convertirMonto, faltaCotizacion, totalEnMoneda, type Moneda } from "@/lib/moneda";

type Monto = number | string | null | undefined;

export type DatosSaldoSena = {
  venta: Monto;
  monedaVenta: Moneda;
  sena: { monto: Monto; moneda: Moneda };
  tipoCambio: Monto;
  patentamiento: { monto: Monto; moneda: Moneda };
  patentamientoIncluido: boolean;
  prendaReal: Monto; // siempre en pesos
  prendaBoleto?: Monto; // pesos; solo si se marcó "Valor prenda extra"
  efectivo?: { monto: Monto; moneda: Moneda }[]; // una sola línea en la seña nueva; las viejas pueden tener pesos y dólares
  permutaTasado?: Monto; // pesos
};

/** El monto de prenda que va al boleto: el valor para el boleto si se cargó, si no el real. */
export function prendaParaBoleto(prendaReal: Monto, prendaBoleto?: Monto): number {
  const boleto = Number(prendaBoleto) || 0;
  return boleto > 0 ? boleto : Number(prendaReal) || 0;
}

/** Montos de la seña en otra moneda que la venta sin tipo de cambio: sin él, el saldo daría mal (convertirMonto da 0). */
export function faltaCotizacionSena(d: DatosSaldoSena): boolean {
  return faltaCotizacion([
    d.sena,
    { monto: d.patentamientoIncluido ? 0 : d.patentamiento.monto, moneda: d.patentamiento.moneda },
    { monto: prendaParaBoleto(d.prendaReal, d.prendaBoleto), moneda: "ARS" },
    ...(d.efectivo ?? []),
    { monto: d.permutaTasado, moneda: "ARS" },
  ], d.monedaVenta, d.tipoCambio);
}

export function calcularSaldoSena(d: DatosSaldoSena): { saldo: number; remanente: number } {
  const venta = Number(d.venta) || 0;
  const sena = convertirMonto(d.sena.monto, d.sena.moneda, d.monedaVenta, d.tipoCambio);
  const patentamiento = d.patentamientoIncluido ? 0 : convertirMonto(d.patentamiento.monto, d.patentamiento.moneda, d.monedaVenta, d.tipoCambio);
  const prenda = convertirMonto(prendaParaBoleto(d.prendaReal, d.prendaBoleto), "ARS", d.monedaVenta, d.tipoCambio);
  const saldo = venta + patentamiento - sena - prenda;
  const efectivo = totalEnMoneda(d.efectivo ?? [], d.monedaVenta, d.tipoCambio);
  const permuta = convertirMonto(d.permutaTasado, "ARS", d.monedaVenta, d.tipoCambio);
  return { saldo, remanente: saldo - efectivo - permuta };
}
