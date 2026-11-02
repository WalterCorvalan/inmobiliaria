import { describe, expect, it } from "vitest";
import { repartirEnCuotas, sumarMeses, planDeCuotas, planDesdePrimerVencimiento } from "./cuotas";

describe("sumarMeses", () => {
  it("conserva el día cuando el mes lo tiene", () => {
    expect(sumarMeses("2026-10-15", 1)).toBe("2026-11-15");
    expect(sumarMeses("2026-10-15", 3)).toBe("2027-01-15");
  });
  it("si el mes de destino es más corto, queda en su último día (no desborda al mes siguiente)", () => {
    expect(sumarMeses("2026-01-31", 1)).toBe("2026-02-28");
    expect(sumarMeses("2026-01-31", 2)).toBe("2026-03-31");
    expect(sumarMeses("2026-03-31", 1)).toBe("2026-04-30");
    expect(sumarMeses("2028-01-31", 1)).toBe("2028-02-29");
  });
  it("cruza de año y acepta meses 0 y grandes", () => {
    expect(sumarMeses("2026-11-30", 2)).toBe("2027-01-30");
    expect(sumarMeses("2026-06-10", 0)).toBe("2026-06-10");
    expect(sumarMeses("2026-06-10", 24)).toBe("2028-06-10");
  });
});

describe("repartirEnCuotas", () => {
  it("la suma de las cuotas da exactamente el total", () => {
    for (const [total, n] of [[100, 3], [1_000_000, 7], [999.99, 12], [10_000_000, 36]] as const) {
      const cuotas = repartirEnCuotas(total, n);
      expect(cuotas).toHaveLength(n);
      expect(Math.round(cuotas.reduce((a, c) => a + c, 0) * 100) / 100).toBe(total);
    }
  });
  it("la última absorbe la diferencia", () => {
    expect(repartirEnCuotas(100, 3)).toEqual([33.33, 33.33, 33.34]);
  });
  it("sin saldo o sin cuotas no inventa montos", () => {
    expect(repartirEnCuotas(0, 3)).toEqual([0, 0, 0]);
    expect(repartirEnCuotas(100, 0)).toEqual([]);
  });
});

describe("planDeCuotas", () => {
  it("sin saldo para financiar no arma cuotas en cero", () => {
    expect(planDeCuotas(0, 36, "2026-10-11")).toEqual([]);
    expect(planDeCuotas(-50, 12, "2026-10-11")).toEqual([]);
  });
  it("arma número, monto y vencimiento mes a mes", () => {
    expect(planDeCuotas(300, 3, "2026-01-31")).toEqual([
      { cuota_actual: 1, cuota_total: 3, monto: 100, vencimiento: "2026-02-28" },
      { cuota_actual: 2, cuota_total: 3, monto: 100, vencimiento: "2026-03-31" },
      { cuota_actual: 3, cuota_total: 3, monto: 100, vencimiento: "2026-04-30" },
    ]);
  });
});

describe("planDesdePrimerVencimiento (Plan automático de cuotas a cobrar)", () => {
  it("la primera cuota vence el día elegido y las demás cada mes, sumando exacto el total", () => {
    const plan = planDesdePrimerVencimiento(1000, 3, "2026-01-31");
    expect(plan.map((c) => c.vencimiento)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
    expect(plan.map((c) => c.monto)).toEqual([333.33, 333.33, 333.34]);
    expect(plan.map((c) => `${c.cuota_actual}/${c.cuota_total}`)).toEqual(["1/3", "2/3", "3/3"]);
  });
  it("respeta la frecuencia (bimestral, anual)", () => {
    expect(planDesdePrimerVencimiento(200, 2, "2026-10-10", 2).map((c) => c.vencimiento)).toEqual(["2026-10-10", "2026-12-10"]);
    expect(planDesdePrimerVencimiento(200, 2, "2026-10-10", 12).map((c) => c.vencimiento)).toEqual(["2026-10-10", "2027-10-10"]);
  });
  it("sin total, sin cantidad válida o sin fecha no arma nada", () => {
    expect(planDesdePrimerVencimiento(0, 3, "2026-10-10")).toEqual([]);
    expect(planDesdePrimerVencimiento(100, 0, "2026-10-10")).toEqual([]);
    expect(planDesdePrimerVencimiento(100, 2.5, "2026-10-10")).toEqual([]);
    expect(planDesdePrimerVencimiento(100, 3, "")).toEqual([]);
  });
});
