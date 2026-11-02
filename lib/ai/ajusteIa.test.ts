import { describe, expect, it } from "vitest";
import { factorAjusteIa, inicioDeMesUtc, proyeccionFinDeMes } from "./ajusteIa";

describe("ajuste del gasto de IA con los números reales de Anthropic", () => {
  it("si el panel estimó el doble de lo que de verdad se gastó, sus cuentas se reducen a la mitad", () => {
    // Comprado 20, saldo real 15,21: se gastaron 4,79. El panel había estimado 9,58 en ese período.
    expect(factorAjusteIa({ compradoUsd: 20, saldoRealUsd: 15.21, estimadoUsd: 9.58 })).toBeCloseTo(0.5);
  });
  it("sin datos o con datos que no cierran, no ajusta", () => {
    expect(factorAjusteIa({ compradoUsd: null, saldoRealUsd: 15.21, estimadoUsd: 9 })).toBe(1);
    expect(factorAjusteIa({ compradoUsd: 20, saldoRealUsd: 20, estimadoUsd: 9 })).toBe(1);
    expect(factorAjusteIa({ compradoUsd: 20, saldoRealUsd: 15, estimadoUsd: 0 })).toBe(1);
  });
  it("un dato mal cargado no dispara números absurdos", () => {
    expect(factorAjusteIa({ compradoUsd: 1000, saldoRealUsd: 0, estimadoUsd: 1 })).toBe(5);
  });
  it("proyecta el gasto del mes al ritmo de lo que va (4,20 al día 14 de octubre ≈ 9,30)", () => {
    expect(proyeccionFinDeMes(4.2, new Date("2026-10-14T15:00:00Z"))).toBeCloseTo(9.3);
    expect(proyeccionFinDeMes(0, new Date("2026-10-14T15:00:00Z"))).toBe(0);
  });
  it("el mes arranca el día 1 en UTC, como la Consola", () => {
    expect(inicioDeMesUtc(new Date("2026-10-14T02:00:00Z"))).toBe("2026-10-01T00:00:00.000Z");
  });
});
