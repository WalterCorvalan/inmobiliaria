import { describe, expect, it } from "vitest";
import { estaVacia, normalizarProspeccion, resumenProspeccion } from "./prospeccionLead";

describe("calificación del lead", () => {
  it("sin dato guardado queda vacía", () => {
    expect(estaVacia(normalizarProspeccion(null))).toBe(true);
    expect(estaVacia(normalizarProspeccion({ usado: { marca: " ", modelo: "" }, anticipo: { monto: 0 } }))).toBe(true);
  });

  it("descarta valores desconocidos y ordena las formas de pago", () => {
    const p = normalizarProspeccion({ formasPago: ["permuta", "cheque", "financiado"], cuando: "mañana" });
    expect(p.formasPago).toEqual(["financiado", "permuta"]);
    expect(p.cuando).toBeNull();
  });

  it("lee montos escritos con puntos de miles", () => {
    const p = normalizarProspeccion({ anticipo: { monto: "5.000.000", moneda: "ARS" }, usado: { marca: "VW", modelo: "Gol Trend", anio: "2015", km: "90.000" } });
    expect(p.anticipo).toEqual({ monto: 5000000, moneda: "ARS" });
    expect(p.usado).toEqual({ marca: "VW", modelo: "Gol Trend", anio: 2015, km: 90000 });
  });

  it("arma una línea para el historial", () => {
    const p = normalizarProspeccion({ formasPago: ["financiado", "permuta"], usado: { marca: "VW", modelo: "Gol Trend", anio: 2015, km: 90000 }, anticipo: { monto: 8000, moneda: "USD" }, cuando: "este_mes" });
    expect(resumenProspeccion(p)).toBe("Financiado + Permuta · Usado: VW Gol Trend 2015, 90.000 km · Anticipo US$ 8.000 · Compra: este mes");
    expect(resumenProspeccion(normalizarProspeccion(null))).toBe("sin datos");
  });
});
