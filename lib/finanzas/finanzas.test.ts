import { describe, expect, it } from "vitest";
import { comision, convertir, diasParaVencer, estadoVisible, margen, montoTexto, porCategoria, porMes, rangoDelMes, totalVigente, totalesPorMoneda, type Movimiento } from "./finanzas";

const mov = (fecha: string, tipo: "ingreso" | "egreso", monto: number, moneda: "USD" | "ARS", categoria = "Otros"): Movimiento => ({ id: fecha + monto, fecha, tipo, categoria, descripcion: null, monto, moneda });

describe("finanzas simples", () => {
  const movs = [
    mov("2026-11-02", "ingreso", 18500, "USD", "Venta"),
    mov("2026-11-03", "egreso", 450000, "ARS", "Sueldos"),
    mov("2026-11-10", "egreso", 120000, "ARS", "Publicidad"),
    mov("2026-11-12", "egreso", 300, "USD", "Taller"),
    mov("2026-10-30", "ingreso", 900000, "ARS", "Venta"),
  ];

  it("separa dólares y pesos y nunca los mezcla", () => {
    const t = totalesPorMoneda(movs, "2026-11-01", "2026-11-30");
    expect(t.USD).toEqual({ ingresos: 18500, egresos: 300, neto: 18200 });
    expect(t.ARS).toEqual({ ingresos: 0, egresos: 570000, neto: -570000 });
  });

  it("ignora montos negativos o raros en vez de restarlos dos veces", () => {
    expect(totalesPorMoneda([mov("2026-11-01", "egreso", -50, "USD"), mov("2026-11-01", "egreso", NaN, "USD")]).USD.egresos).toBe(0);
  });

  it("arma los últimos meses del más viejo al actual, cruzando el año", () => {
    const m = porMes(movs, "2026-11-26", 3);
    expect(m.map((x) => x.mes)).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(m[1].ARS.ingresos).toBe(900000);
    expect(porMes([], "2026-01-15", 2).map((x) => x.mes)).toEqual(["2025-12", "2026-01"]);
  });

  it("calcula bien el último día del mes, también en febrero bisiesto", () => {
    expect(rangoDelMes("2028-02-10")).toEqual({ desde: "2028-02-01", hasta: "2028-02-29" });
    expect(rangoDelMes("2026-11-26").hasta).toBe("2026-11-30");
  });

  it("agrupa por categoría de mayor a menor", () => {
    expect(porCategoria(movs, "egreso", "ARS")).toEqual([{ categoria: "Sueldos", monto: 450000 }, { categoria: "Publicidad", monto: 120000 }]);
  });

  it("sin cotización no convierte (devuelve null)", () => {
    expect(convertir(100, "USD", "ARS", null)).toBeNull();
    expect(convertir(100, "USD", "ARS", 0)).toBeNull();
    expect(convertir(100, "USD", "ARS", 1200)).toBe(120000);
    expect(convertir(120000, "ARS", "USD", 1200)).toBe(100);
    expect(convertir(5, "ARS", "ARS", null)).toBe(5);
  });

  it("comisión y margen", () => {
    expect(comision(150000, 3)).toBe(4500);
    expect(comision(0, 3)).toBe(0);
    expect(margen(2500, 20000)).toBe(12.5);
    expect(margen(null, 20000)).toBeNull();
  });

  it("una seña vigente con la fecha pasada se ve vencida", () => {
    expect(estadoVisible({ estado: "vigente", vence_el: "2026-11-20" }, "2026-11-26")).toBe("vencida");
    expect(estadoVisible({ estado: "vigente", vence_el: "2026-11-26" }, "2026-11-26")).toBe("vigente");
    expect(estadoVisible({ estado: "convertida", vence_el: "2026-11-01" }, "2026-11-26")).toBe("convertida");
    expect(diasParaVencer("2026-11-29", "2026-11-26")).toBe(3);
    expect(diasParaVencer(null, "2026-11-26")).toBeNull();
  });

  it("suma solo la plata de señas vigentes, por moneda", () => {
    expect(totalVigente([
      { estado: "vigente", monto: 500, moneda: "USD" }, { estado: "vigente", monto: 200000, moneda: "ARS" }, { estado: "devuelta", monto: 1000, moneda: "USD" },
    ])).toEqual({ USD: 500, ARS: 200000 });
  });

  it("escribe los montos como en Argentina", () => {
    expect(montoTexto(18500, "USD")).toBe("USD 18.500");
    expect(montoTexto(-570000, "ARS")).toBe("-$ 570.000");
    expect(montoTexto(null, "USD")).toBe("-");
  });
});

