import { describe, expect, it } from "vitest";
import { estadoCobroVenta, remanenteVenta, ventaCubierta } from "./remanenteVenta";

const base = { precio: 0, transferencia: 0, senas: 0, financiera: 0, efectivo: 0, transferenciaCobrada: 0, permutas: 0, conCuotasPropias: false };

describe("remanente de una venta (21/10/2026)", () => {
  it("caso del sistema viejo: Ranger con seña, prenda, efectivo y permuta da 0", () => {
    const r = remanenteVenta({ ...base, precio: 34_410_000, senas: 500_000, financiera: 11_960_000, efectivo: 6_950_000, permutas: 15_000_000 });
    expect(r.saldo).toBe(21_950_000);
    expect(r.remanente).toBe(0);
    expect(ventaCubierta(r.remanente)).toBe(true);
  });

  it("la transferencia suma al total; si falta plata, el remanente lo dice", () => {
    const r = remanenteVenta({ ...base, precio: 13_500, transferencia: 1_200, efectivo: 14_000 });
    expect(r.total).toBe(14_700);
    expect(r.remanente).toBe(700);
    expect(ventaCubierta(r.remanente)).toBe(false);
  });

  it("la transferencia cobrada aparte (caja de Gestoría) cubre su parte", () => {
    const r = remanenteVenta({ ...base, precio: 13_500, transferencia: 1_200, efectivo: 13_500, transferenciaCobrada: 1_200 });
    expect(r.remanente).toBe(0);
  });

  it("con cuotas propias, lo que queda va a las cuotas", () => {
    const r = remanenteVenta({ ...base, precio: 10_000, efectivo: 4_000, conCuotasPropias: true });
    expect(r.enCuotas).toBe(6_000);
    expect(r.remanente).toBe(0);
  });

  it("si se cargó de más, el remanente queda negativo y tampoco imprime", () => {
    const r = remanenteVenta({ ...base, precio: 10_000, efectivo: 11_000 });
    expect(r.remanente).toBe(-1_000);
    expect(ventaCubierta(r.remanente)).toBe(false);
  });
});

describe("estado de cobro en la lista de Ventas", () => {
  const sinConvertir = (items: { monto: number | string | null }[]) => items.reduce((a, x) => a + (Number(x.monto) || 0), 0);
  const venta = {
    precio_venta: 10_000, moneda_venta: "USD", tipo_cambio: null, metodo_pago: "Contado", monto_financiacion: null, prenda_monto: null, cuotas_plazo: null,
    pago_efectivo_ars: null, pago_efectivo_usd: 9_000, extra_cobrado_monto: null, extra_cobrado_moneda: null, extra_cobrado_cuenta_id: null,
  };
  it("falta cobrar lo que no entró", () => {
    expect(estadoCobroVenta(venta, [], [], sinConvertir)).toEqual({ tipo: "falta", monto: 1_000 });
  });
  it("con la seña, cobrada", () => {
    expect(estadoCobroVenta(venta, [{ monto: 1_000, moneda: "USD" }], [], sinConvertir)).toEqual({ tipo: "cobrada" });
  });
  it("financiada con cuotas propias: en cuotas", () => {
    expect(estadoCobroVenta({ ...venta, metodo_pago: "Financiado", cuotas_plazo: 12 }, [], [], sinConvertir)).toEqual({ tipo: "en_cuotas", monto: 1_000 });
  });
});
