import { describe, it, expect } from "vitest";
import { bloquePropiedades, lineaPropiedad, propiedadesOfrecibles, MAX_PROPIEDADES_BOT, type PropiedadParaBot } from "./propiedades";
import { buildSystemPromptV2 } from "../promptsV2";

const base: PropiedadParaBot = {
  codigo: "A103", titulo: "2 ambientes luminoso", tipo: "departamento", operacion: "alquiler", estado: "disponible",
  precio: 780000, moneda: "ARS", expensas: 95000, direccion: "Cabildo 2300", barrio: "Belgrano", ciudad: "CABA",
  ambientes: 2, banos: 1, cocheras: null, superficie_total: 52, superficie_cubierta: 48, descripcion: "Balcón al frente.",
};

describe("propiedades para el bot", () => {
  it("arma la línea con código, precio, expensas y ubicación", () => {
    const l = lineaPropiedad(base);
    expect(l).toContain("[A103]");
    expect(l).toContain("$ 780.000/mes + expensas $ 95.000");
    expect(l).toContain("Cabildo 2300, Belgrano");
    expect(l).toContain("2 amb.");
  });

  it("no ofrece vendidas, alquiladas ni pausadas; marca las reservadas", () => {
    const lista = [
      { ...base, codigo: "R1", estado: "reservada" as const },
      { ...base, codigo: "V1", estado: "vendida" as const },
      { ...base, codigo: "P1", estado: "pausada" as const },
      { ...base, codigo: "D1" },
    ];
    const ofr = propiedadesOfrecibles(lista);
    expect(ofr.map((p) => p.codigo)).toEqual(["D1", "R1"]);
    expect(bloquePropiedades(lista)).toContain("RESERVADA");
    expect(bloquePropiedades(lista)).not.toContain("[V1]");
  });

  it("pone un tope de propiedades en el prompt", () => {
    const muchas = Array.from({ length: MAX_PROPIEDADES_BOT + 20 }, (_, i) => ({ ...base, codigo: `X${i}` }));
    expect(propiedadesOfrecibles(muchas)).toHaveLength(MAX_PROPIEDADES_BOT);
  });

  it("sin propiedades el bloque queda vacío y el prompt no las menciona", () => {
    expect(bloquePropiedades([])).toBe("");
    const p = buildSystemPromptV2({ empresa: { nombre: "Inmo" } });
    expect(p).not.toContain("CÓMO OFRECER PROPIEDADES");
  });

  it("el prompt incluye la cartera cuando se la pasan", () => {
    const p = buildSystemPromptV2({ empresa: { nombre: "Inmo" }, propiedades: [base] });
    expect(p).toContain("CÓMO OFRECER PROPIEDADES");
    expect(p).toContain("[A103]");
    expect(p).toContain("propiedad_codigo");
  });
});
