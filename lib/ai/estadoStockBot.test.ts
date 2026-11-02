import { describe, expect, it } from "vitest";
import { ESTADOS_QUE_VE_EL_BOT, notaDeEstado, referenciaVagaSinAnio, ventasRecientesQueCoinciden } from "./estadoStockBot";

describe("el bot y los autos que no están libres (Walter, 30/10/2026)", () => {
  it("ve los autos en preparación y los señados, no los vendidos ni los fuera de venta", () => {
    expect(ESTADOS_QUE_VE_EL_BOT).toEqual(expect.arrayContaining(["disponible", "reservado", "señado", "en_preparacion"]));
    expect(ESTADOS_QUE_VE_EL_BOT).not.toContain("vendido");
    expect(ESTADOS_QUE_VE_EL_BOT).not.toContain("fuera_de_venta");
  });

  it("en preparación: sin precio, sin visita y derivado al vendedor; señado: ofrecer parecidos", () => {
    expect(notaDeEstado("en_preparacion")).toMatch(/NO digas el precio/);
    expect(notaDeEstado("en_preparacion")).toMatch(/handoff/);
    expect(notaDeEstado("señado")).toMatch(/parecidas/);
    expect(notaDeEstado("reservado")).toMatch(/SEÑADO/);
    expect(notaDeEstado("disponible")).toBeNull();
  });

  it("'el Corolla de la historia' sin año: pide modelo y año (caso @mayagui09)", () => {
    expect(referenciaVagaSinAnio(["Si. Perdon puse las calles. ahi este el corolla de la historia ?"])).toBe(true);
    expect(referenciaVagaSinAnio(["Respondió a tu historia: \"lo tienen?\""])).toBe(true);
    expect(referenciaVagaSinAnio(["¿sigue estando el rojo?"])).toBe(true);
  });

  it("con el año dicho, o sin referencia a algo que vio, sigue normal", () => {
    expect(referenciaVagaSinAnio(["el corolla 2019", "el de la historia"])).toBe(false);
    expect(referenciaVagaSinAnio(["¿tienen Corolla?"])).toBe(false);
  });
});

describe("vendido hace poco (Walter, 2/11/2026, caso Fiat Duna Weekend)", () => {
  const hoy = new Date("2026-11-02T12:00:00Z");
  const ventas = [
    { vehiculo_marca: "Fiat", vehiculo_modelo: "DUNA WEEKEND SX", fecha_cierre: "2026-10-20" },
    { vehiculo_marca: "Fiat", vehiculo_modelo: "Palio", fecha_cierre: "2026-08-01" },
    { vehiculo_marca: "Toyota", vehiculo_modelo: "Corolla", fecha_cierre: null },
  ];

  it("reconoce una venta de los últimos 30 días aunque el modelo venga con la ficha entera", () => {
    expect(ventasRecientesQueCoinciden(ventas, "Fiat", "Duna", hoy)).toHaveLength(1);
    expect(ventasRecientesQueCoinciden(ventas, null, "duna weekend", hoy)).toHaveLength(1);
  });

  it("no cuenta ventas de hace más de 30 días, sin fecha, ni de otra marca", () => {
    expect(ventasRecientesQueCoinciden(ventas, "Fiat", "Palio", hoy)).toHaveLength(0);
    expect(ventasRecientesQueCoinciden(ventas, "Toyota", "Corolla", hoy)).toHaveLength(0);
    expect(ventasRecientesQueCoinciden(ventas, "Ford", "Duna", hoy)).toHaveLength(0);
    expect(ventasRecientesQueCoinciden(ventas, "Fiat", null, hoy)).toHaveLength(0);
  });

  it("la nota del vendido: sin precio, sin visita, con parecidos", () => {
    expect(notaDeEstado("vendido")).toMatch(/ya se vendió/);
    expect(notaDeEstado("vendido")).toMatch(/NO digas precio/);
    expect(notaDeEstado("vendido")).toMatch(/parecidas/);
  });
});
