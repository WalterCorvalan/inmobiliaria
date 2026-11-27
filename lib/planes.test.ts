import { describe, expect, it } from "vitest";
import { FUNCIONES, MODULOS_PRO, PLANES, moduloEnPlan, precioTexto } from "./planes";

describe("planes", () => {
  it("precios aprobados, en pesos", () => {
    expect(PLANES.basico.precioMensual).toBe(59900);
    expect(PLANES.pro.precioMensual).toBe(119900);
    expect(precioTexto(119900)).toBe("$ 119.900");
  });
  it("el Pro trae todo lo del Básico", () => {
    for (const f of FUNCIONES) if (f.basico) expect(f.pro).toBeTruthy();
  });
  it("el Básico no trae los módulos marcados como Pro, el Pro sí", () => {
    for (const m of MODULOS_PRO) { expect(moduloEnPlan(m, "basico")).toBe(false); expect(moduloEnPlan(m, "pro")).toBe(true); }
    expect(moduloEnPlan("stock", "basico")).toBe(true);
    expect(moduloEnPlan(undefined, "basico")).toBe(true);
  });
});
