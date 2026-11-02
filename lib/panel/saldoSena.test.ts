import { describe, expect, it } from "vitest";
import { calcularSaldoSena, faltaCotizacionSena, prendaParaBoleto } from "./saldoSena";

const base = {
  venta: 10_000_000, monedaVenta: "ARS" as const, sena: { monto: 1_000_000, moneda: "ARS" as const }, tipoCambio: null,
  patentamiento: { monto: 500_000, moneda: "ARS" as const }, patentamientoIncluido: false, prendaReal: 0,
};

describe("saldo de la seña", () => {
  it("el patentamiento se suma, salvo que esté incluido en el precio", () => {
    expect(calcularSaldoSena(base).saldo).toBe(9_500_000);
    expect(calcularSaldoSena({ ...base, patentamientoIncluido: true }).saldo).toBe(9_000_000);
  });

  it("el boleto usa el valor para el boleto si hay valor extra, si no el real", () => {
    expect(prendaParaBoleto(6_000_000, 4_000_000)).toBe(4_000_000);
    expect(prendaParaBoleto(6_000_000, null)).toBe(6_000_000);
    expect(prendaParaBoleto(6_000_000, "")).toBe(6_000_000);
    const conExtra = calcularSaldoSena({ ...base, patentamiento: { monto: 0, moneda: "ARS" }, prendaReal: 6_000_000, prendaBoleto: 4_000_000 });
    expect(conExtra.saldo).toBe(5_000_000);
  });

  it("efectivo y permuta bajan el remanente", () => {
    const r = calcularSaldoSena({ ...base, efectivo: [{ monto: 2_000_000, moneda: "ARS" }], permutaTasado: 3_000_000 });
    expect(r).toEqual({ saldo: 9_500_000, remanente: 4_500_000 });
  });

  it("venta en dólares: los montos en pesos se convierten con el tipo de cambio", () => {
    const r = calcularSaldoSena({
      venta: 20_000, monedaVenta: "USD", sena: { monto: 1_000, moneda: "USD" }, tipoCambio: 1_000,
      patentamiento: { monto: 500_000, moneda: "ARS" }, patentamientoIncluido: false, prendaReal: 6_000_000, prendaBoleto: 4_000_000,
      efectivo: [{ monto: 2_000, moneda: "USD" }],
    });
    expect(r).toEqual({ saldo: 20_000 + 500 - 1_000 - 4_000, remanente: 15_500 - 2_000 });
  });
});

describe("patentamiento en dólares (caso del BMW 320i, 19/10/2026)", () => {
  const bmw = { venta: 13_500, monedaVenta: "USD" as const, sena: { monto: 0, moneda: "USD" as const }, tipoCambio: 1_250, patentamientoIncluido: false, prendaReal: 0 };
  it("US$ 1.500 se suman directo y da US$ 15.000", () => {
    expect(calcularSaldoSena({ ...bmw, patentamiento: { monto: 1_500, moneda: "USD" } }).saldo).toBe(15_000);
  });
  it("el mismo monto en pesos, al tipo de cambio, da lo mismo", () => {
    expect(calcularSaldoSena({ ...bmw, patentamiento: { monto: 1_875_000, moneda: "ARS" } }).saldo).toBe(15_000);
  });
});

describe("tipo de cambio que falta", () => {
  it("avisa si hay montos en otra moneda sin tipo de cambio", () => {
    expect(faltaCotizacionSena({ ...base, sena: { monto: 1_000, moneda: "USD" } })).toBe(true);
    expect(faltaCotizacionSena({ ...base, sena: { monto: 1_000, moneda: "USD" }, tipoCambio: 1_000 })).toBe(false);
    expect(faltaCotizacionSena(base)).toBe(false);
  });
});
