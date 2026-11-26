import { describe, expect, it } from "vitest";
import { crearContadorGasto, MAX_MENSAJES_POR_CHARLA, MENSAJE_TOPE_CHARLA, MENSAJE_TOPE_GASTO, revisarLimites, TOPE_GASTO_POR_DEFECTO_USD, topeGastoUsd } from "./limites";

describe("revisarLimites", () => {
  it("deja pasar una charla normal", () => {
    expect(revisarLimites({ mensajesCliente: 3, gastoMesUsd: 0.2 })).toEqual({ ok: true });
  });
  it("corta al llegar al tope de gasto", () => {
    expect(revisarLimites({ mensajesCliente: 1, gastoMesUsd: 1.49, topeUsd: 1.5 })).toEqual({ ok: true });
    expect(revisarLimites({ mensajesCliente: 1, gastoMesUsd: 1.5, topeUsd: 1.5 })).toEqual({ ok: false, mensaje: MENSAJE_TOPE_GASTO });
  });
  it("corta cuando la charla pasa el máximo de mensajes", () => {
    expect(revisarLimites({ mensajesCliente: MAX_MENSAJES_POR_CHARLA, gastoMesUsd: 0 })).toEqual({ ok: true });
    expect(revisarLimites({ mensajesCliente: MAX_MENSAJES_POR_CHARLA + 1, gastoMesUsd: 0 })).toEqual({ ok: false, mensaje: MENSAJE_TOPE_CHARLA });
  });
});

describe("topeGastoUsd", () => {
  it("USD 1,50 por producto si no se configura, o el valor de DEMO_TOPE_USD", () => {
    expect(topeGastoUsd(undefined)).toBe(TOPE_GASTO_POR_DEFECTO_USD);
    expect(topeGastoUsd("1")).toBe(1);
    expect(topeGastoUsd("cualquier cosa")).toBe(TOPE_GASTO_POR_DEFECTO_USD);
    expect(topeGastoUsd("0")).toBe(TOPE_GASTO_POR_DEFECTO_USD);
  });
});

describe("crearContadorGasto", () => {
  it("suma dentro del mes y vuelve a cero al cambiar de mes", () => {
    const c = crearContadorGasto();
    const nov = new Date("2026-11-16T12:00:00Z");
    c.sumar(0.01, nov);
    c.sumar(0.02, nov);
    expect(c.delMes(nov)).toBeCloseTo(0.03);
    expect(c.delMes(new Date("2026-12-01T00:00:00Z"))).toBe(0);
  });
  it("ignora montos negativos", () => {
    const c = crearContadorGasto();
    c.sumar(-5);
    expect(c.delMes()).toBe(0);
  });
});
