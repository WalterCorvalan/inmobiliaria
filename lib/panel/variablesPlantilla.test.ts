import { describe, expect, it } from "vitest";
import { countVariables, renderBody, validateBodyVariables } from "./variablesPlantilla";
import { PLANTILLAS_SUGERIDAS } from "./plantillasSugeridas";

describe("datos de las plantillas de WhatsApp", () => {
  it("cuenta y completa varios datos", () => {
    const cuerpo = "Hola {{1}}, encontramos un {{2}} como el que buscabas. Respondé este mensaje.";
    expect(countVariables(cuerpo)).toBe(2);
    expect(renderBody(cuerpo, ["Laura", "Corolla"])).toBe("Hola Laura, encontramos un Corolla como el que buscabas. Respondé este mensaje.");
    expect(renderBody("Hola {{1}}, gracias.", "Juan")).toBe("Hola Juan, gracias.");
  });
  it("rechaza lo que Meta no aprueba", () => {
    expect(validateBodyVariables("Hola {{1}}, tu {{3}} está listo.")).toMatch(/de corrido/);
    expect(validateBodyVariables("{{1}}, tu auto está listo.")).toMatch(/empezar ni terminar/);
    expect(validateBodyVariables("Tu auto está listo, {{1}}.")).toMatch(/empezar ni terminar/);
    expect(validateBodyVariables("Hola {{1}}, tu {{2}} está listo.")).toBeNull();
  });
  it("las 10 sugeridas (7 de casos reales + cumpleaños, cumpleaños con renovación y fin de pago) son válidas y traen un ejemplo y una explicación por dato", () => {
    expect(PLANTILLAS_SUGERIDAS).toHaveLength(7);
    for (const p of PLANTILLAS_SUGERIDAS) {
      expect(validateBodyVariables(p.cuerpo)).toBeNull();
      expect(p.ejemplos).toHaveLength(countVariables(p.cuerpo));
      expect(p.datos).toHaveLength(countVariables(p.cuerpo));
      expect(p.nombre).toMatch(/^[a-z0-9_]+$/);
    }
  });
});

describe("plantillas de ejemplo de Meta", () => {
  it("reconoce las que Meta no deja borrar", async () => {
    const { esPlantillaDeEjemploMeta } = await import("./variablesPlantilla");
    expect(esPlantillaDeEjemploMeta("hello_world")).toBe(true);
    expect(esPlantillaDeEjemploMeta("jaspers_market_order_confirmation_v1")).toBe(true);
    expect(esPlantillaDeEjemploMeta("resumen_diario")).toBe(false);
  });
});
