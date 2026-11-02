import { describe, it, expect } from "vitest";
import { convertirMonto, totalEnMoneda } from "./moneda";

describe("convertirMonto", () => {
  it("convierte USD a ARS y ARS a USD con la cotización", () => {
    expect(convertirMonto(100, "USD", "ARS", 1000)).toBe(100000);
    expect(convertirMonto(100000, "ARS", "USD", 1000)).toBe(100);
  });
  it("misma moneda: devuelve el monto sin tocar la cotización", () => {
    expect(convertirMonto(500, "ARS", "ARS", null)).toBe(500);
  });
  it("sin cotización no inventa una equivalencia: devuelve 0", () => {
    expect(convertirMonto(100, "USD", "ARS", null)).toBe(0);
    expect(convertirMonto(100, "USD", "ARS", 0)).toBe(0);
  });
  it("acepta strings y valores vacíos", () => {
    expect(convertirMonto("100", "USD", "ARS", "1000")).toBe(100000);
    expect(convertirMonto(null, "USD", "ARS", 1000)).toBe(0);
    expect(convertirMonto(undefined, "ARS", "USD", 1000)).toBe(0);
  });
});

describe("totalEnMoneda", () => {
  it("suma pagos en distintas monedas expresados en una sola", () => {
    const pagos = [{ monto: 100, moneda: "USD" as const }, { monto: 50000, moneda: "ARS" as const }];
    expect(totalEnMoneda(pagos, "USD", 1000)).toBe(150);
    expect(totalEnMoneda(pagos, "ARS", 1000)).toBe(150000);
  });
});

import { faltaCotizacion } from "./moneda";

describe("faltaCotizacion", () => {
  it("todo en la moneda de destino: no hace falta cotización", () => {
    expect(faltaCotizacion([{ monto: 100, moneda: "ARS" }], "ARS", null)).toBe(false);
  });
  it("monto en otra moneda sin cotización: falta", () => {
    expect(faltaCotizacion([{ monto: 100, moneda: "USD" }], "ARS", null)).toBe(true);
    expect(faltaCotizacion([{ monto: 100, moneda: "USD" }], "ARS", 0)).toBe(true);
  });
  it("con cotización cargada, o con el monto en cero, no falta", () => {
    expect(faltaCotizacion([{ monto: 100, moneda: "USD" }], "ARS", 1000)).toBe(false);
    expect(faltaCotizacion([{ monto: 0, moneda: "USD" }, { monto: null, moneda: "USD" }], "ARS", null)).toBe(false);
  });
});
