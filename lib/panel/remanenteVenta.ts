// Cuánto le falta cubrir al cliente en una venta (Walter, 21/10/2026, como el sistema viejo): el boleto no se imprime
// si el remanente no da $ 0. Todos los montos ya vienen en la moneda de la venta (convertir antes con lib/moneda.ts).
//   total     = precio del auto + transferencia (aparte o incluida; si la hace el cliente, 0)
//   saldo     = total − señas − lo que pone la financiera / prenda
//   remanente = saldo − efectivo − transferencia cobrada (entra a la caja de Gestoría) − permutas − cuotas propias
// La transferencia se cobra aparte del efectivo del auto (Walter, 21/10/2026): el efectivo es solo la plata del auto.
// Con plan de cuotas propio, lo que queda va a las cuotas: el remanente es 0 y "enCuotas" dice cuánto.
export type DatosRemanente = {
  precio: number;
  transferencia: number;
  senas: number;
  financiera: number;
  efectivo: number;
  transferenciaCobrada: number;
  permutas: number;
  conCuotasPropias: boolean;
};

const redondear = (n: number) => Math.round(n * 100) / 100;

export function remanenteVenta(d: DatosRemanente): { total: number; saldo: number; enCuotas: number; remanente: number } {
  const total = redondear(d.precio + d.transferencia);
  const saldo = redondear(total - d.senas - d.financiera);
  const resto = redondear(saldo - d.efectivo - d.transferenciaCobrada - d.permutas);
  const enCuotas = d.conCuotasPropias && resto > 0 ? resto : 0;
  return { total, saldo, enCuotas, remanente: redondear(resto - enCuotas) };
}

// Se puede imprimir el boleto solo con todo cubierto (ni falta ni sobra).
export function ventaCubierta(remanente: number): boolean {
  return Math.abs(remanente) < 0.01;
}

export type EstadoCobro = { tipo: "cobrada" } | { tipo: "en_cuotas"; monto: number } | { tipo: "falta"; monto: number };

type VentaParaCobro = {
  precio_venta: number | string | null; moneda_venta: string | null; tipo_cambio: number | string | null;
  metodo_pago: string | null; monto_financiacion: number | string | null; prenda_monto: number | string | null; cuotas_plazo: number | string | null;
  pago_efectivo_ars: number | string | null; pago_efectivo_usd: number | string | null;
  extra_cobrado_monto: number | string | null; extra_cobrado_moneda: string | null; extra_cobrado_cuenta_id: string | null;
};

/** Lista de Ventas (Walter, 21/10/2026): "Cobrada" o "Falta cobrar $ X" según lo que pagó el cliente, no la comisión. */
export function estadoCobroVenta(
  v: VentaParaCobro,
  senas: { monto: number | string; moneda: string }[],
  permutas: { monto: number | string; moneda: string }[],
  convertir: (items: { monto: number | string | null; moneda: string }[], moneda: string, tipoCambio: number | string | null) => number
): EstadoCobro {
  const moneda = v.moneda_venta || "ARS";
  const enVenta = (items: { monto: number | string | null; moneda: string }[]) => convertir(items, moneda, v.tipo_cambio);
  const transferencia = v.extra_cobrado_monto ? enVenta([{ monto: v.extra_cobrado_monto, moneda: v.extra_cobrado_moneda || moneda }]) : 0;
  const financiado = v.metodo_pago === "Financiado";
  const r = remanenteVenta({
    precio: Number(v.precio_venta) || 0,
    transferencia,
    senas: enVenta(senas),
    financiera: financiado ? Number(v.monto_financiacion) || Number(v.prenda_monto) || 0 : 0,
    efectivo: enVenta([{ monto: v.pago_efectivo_ars, moneda: "ARS" }, { monto: v.pago_efectivo_usd, moneda: "USD" }]),
    transferenciaCobrada: v.extra_cobrado_cuenta_id ? transferencia : 0,
    permutas: enVenta(permutas),
    conCuotasPropias: financiado && Number(v.cuotas_plazo) > 0,
  });
  if (r.remanente > 0.01) return { tipo: "falta", monto: r.remanente };
  if (r.enCuotas > 0) return { tipo: "en_cuotas", monto: r.enCuotas };
  return { tipo: "cobrada" };
}
