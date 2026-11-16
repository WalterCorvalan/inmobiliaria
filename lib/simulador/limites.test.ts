import { describe, expect, it } from "vitest";
import { crearContadorGasto, MAX_MENSAJES_POR_CHARLA, MENSAJE_TOPE_CHARLA, MENSAJE_TOPE_GASTO, revisarLimites, TOPE_GASTO_USD } from "./limites";

describe("revisarLimites", () => {
  it("deja pasar una charla normal", () => {
    expect(revisarLimites({ mensajesCliente: 3, gastoMesUsd: 0.2 })).toEqual({ ok: true });
  });
  it("corta al llegar al tope de gasto", () => {
    expect(revisarLimites({ mensajesCliente: 1, gastoMesUsd: TOPE_GASTO_USD })).toEqual({ ok: false, mensaje: MENSAJE_TOPE_GASTO });
  });
  it("corta cuando la charla pasa el máximo de mensajes", () => {
    expect(revisarLimites({ mensajesCliente: MAX_MENSAJES_POR_CHARLA, gastoMesUsd: 0 })).toEqual({ ok: true });
    expect(revisarLimites({ mensajesCliente: MAX_MENSAJES_POR_CHARLA + 1, gastoMesUsd: 0 })).toEqual({ ok: false, mensaje: MENSAJE_TOPE_CHARLA });
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
