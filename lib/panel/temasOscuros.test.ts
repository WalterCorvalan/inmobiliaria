import { describe, expect, it } from "vitest";
import { clasesModoOscuro, clasesTemaOscuro, temaOscuroValido, TEMAS_OSCUROS } from "./temasOscuros";

describe("temas del modo oscuro (21/10/2026)", () => {
  it("un valor desconocido o vacío cae en el negro de siempre (27/10/2026)", () => {
    expect(temaOscuroValido(null)).toBe("negro");
    expect(temaOscuroValido("violeta")).toBe("negro");
    expect(temaOscuroValido("softcars")).toBe("negro");
    expect(temaOscuroValido("gris")).toBe("gris");
    expect(temaOscuroValido("petroleo")).toBe("petroleo");
  });

  it("el negro de siempre no lleva clases; el resto, tema-oscuro y la suya", () => {
    expect(clasesTemaOscuro("negro")).toEqual([]);
    expect(clasesTemaOscuro("azul_marino")).toEqual(["tema-oscuro", "tema-azul-marino"]);
    expect(clasesTemaOscuro("noche_oro")).toEqual(["tema-oscuro", "tema-noche-oro"]);
  });

  it("son los 8 que eligió Walter (Softcars clásico pasó a ser el modo claro)", () => {
    expect(TEMAS_OSCUROS.map((t) => t.id)).toEqual(["negro", "gris", "azul_marino", "noche_oro", "oceano", "softcars_oscuro", "petroleo", "bosque"]);
  });
});

describe("clasesModoOscuro", () => {
  it("los oscuros llevan dark y su clase", () => {
    expect(clasesModoOscuro("negro")).toBe("dark");
    expect(clasesModoOscuro("azul_marino")).toBe("dark tema-oscuro tema-azul-marino");
    expect(clasesModoOscuro("softcars_oscuro")).toBe("dark tema-oscuro tema-softcars-oscuro");
  });
});
