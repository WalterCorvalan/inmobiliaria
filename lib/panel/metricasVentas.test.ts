import { describe, it, expect } from "vitest";
import { variacionPorcentual, proyeccionDeCierre, estadoRitmo, ticketPromedioPorMoneda, variacionFacturado, sumarVentasEquivalentes, mejorVendedor } from "./metricasVentas";

describe("variacionPorcentual", () => {
  it("calcula suba y baja redondeada", () => {
    expect(variacionPorcentual(12, 10)).toBe(20);
    expect(variacionPorcentual(8, 10)).toBe(-20);
    expect(variacionPorcentual(10, 10)).toBe(0);
  });
  it("sin base de comparación devuelve null", () => {
    expect(variacionPorcentual(5, 0)).toBeNull();
    expect(variacionPorcentual(5, NaN)).toBeNull();
  });
});

describe("proyeccionDeCierre", () => {
  it("proyecta al ritmo actual", () => {
    expect(proyeccionDeCierre(3, 10, 30)).toBe(9);
    expect(proyeccionDeCierre(1, 15, 30)).toBe(2);
  });
  it("sin días transcurridos o datos inválidos devuelve 0", () => {
    expect(proyeccionDeCierre(3, 0, 30)).toBe(0);
    expect(proyeccionDeCierre(-1, 10, 30)).toBe(0);
  });
  it("el día no pasa del largo del mes", () => {
    expect(proyeccionDeCierre(6, 31, 30)).toBe(6);
  });
});

describe("estadoRitmo", () => {
  it("compara contra la meta", () => {
    expect(estadoRitmo(8, 8)).toBe("alcanza");
    expect(estadoRitmo(7, 8)).toBe("justo");
    expect(estadoRitmo(4, 8)).toBe("no_alcanza");
  });
  it("sin meta no opina", () => {
    expect(estadoRitmo(4, null)).toBe("sin_meta");
    expect(estadoRitmo(4, 0)).toBe("sin_meta");
  });
});

describe("ticketPromedioPorMoneda", () => {
  it("promedia cada moneda por separado, sin descartar ninguna", () => {
    const r = ticketPromedioPorMoneda([
      { precio: 10_000, moneda: "USD" }, { precio: 20_000, moneda: "USD" }, { precio: 5_000_000, moneda: "ARS" },
    ]);
    expect(r).toEqual({ USD: 15_000, ARS: 5_000_000 });
  });
  it("sin ventas devuelve vacío", () => {
    expect(ticketPromedioPorMoneda([])).toEqual({});
  });
});

describe("variacionFacturado", () => {
  it("compara solo si hay una única moneda igual en ambos períodos", () => {
    expect(variacionFacturado({ USD: 120 }, { USD: 100 })).toBe(20);
  });
  it("con monedas mezcladas o distintas no compara", () => {
    expect(variacionFacturado({ USD: 100, ARS: 5 }, { USD: 100 })).toBeNull();
    expect(variacionFacturado({ USD: 100 }, { ARS: 100 })).toBeNull();
    expect(variacionFacturado({ USD: 100 }, {})).toBeNull();
  });
});

describe("sumarVentasEquivalentes / mejorVendedor", () => {
  const filas = [
    { nombre: "Ana", ventas_equivalentes: "2.5" },
    { nombre: "Beto", ventas_equivalentes: 4 },
    { nombre: "Cris", ventas_equivalentes: null },
  ];
  it("suma como número aunque vengan como texto o null", () => {
    expect(sumarVentasEquivalentes(filas)).toBe(6.5);
    expect(sumarVentasEquivalentes([])).toBe(0);
  });
  it("elige al de más ventas y null si nadie vendió", () => {
    expect(mejorVendedor(filas)).toEqual({ nombre: "Beto", ventas: 4 });
    expect(mejorVendedor([{ nombre: "Ana", ventas_equivalentes: 0 }])).toBeNull();
    expect(mejorVendedor([])).toBeNull();
  });
});
