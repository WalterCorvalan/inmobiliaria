import { describe, expect, it } from "vitest";
import { frasesDelResumen, resaltarFrase, telefonoEnTexto } from "./resaltarResumen";

const mel = "Melanie consultó por el Ford Fiesta que vio exhibido en la sucursal de Torcuato y pidió precio. Ofrece en permuta su Fiat Palio Fire 2016 1.4 nafta GNC, 5 puertas, blanco, con 170.000 km, y busca un auto chico de 5 puertas, año 2016 o posterior. Dejó su teléfono 01123916007 y quedó pendiente que el asesor la contacte.";

const marcados = (f: string) => resaltarFrase(f).filter((t) => t.tipo).map((t) => `${t.tipo}:${t.texto}`);

describe("resumen de la IA resaltado", () => {
  it("una frase por renglón, sin partir números con punto", () => {
    const frases = frasesDelResumen(mel);
    expect(frases).toHaveLength(3);
    expect(frases[1]).toContain("1.4 nafta");
    expect(frases[1]).toContain("170.000 km");
  });
  it("marca autos, kilómetros, años y teléfono", () => {
    const [a, b, c] = frasesDelResumen(mel);
    expect(marcados(a)).toEqual(["auto:Ford Fiesta"]);
    expect(marcados(b)).toEqual(["auto:Fiat Palio Fire 2016 1.4", "dato:170.000 km", "dato:2016"]);
    expect(marcados(c)).toEqual(["telefono:01123916007"]);
  });
  it("saca el teléfono del texto sin confundirlo con años o kilómetros", () => {
    expect(telefonoEnTexto(mel)).toBe("01123916007");
    expect(telefonoEnTexto("mi cel es 11 2391-6007")).toBe("11 2391-6007");
    expect(telefonoEnTexto("tengo un palio 2016 170000 km")).toBeNull();
    expect(telefonoEnTexto("ofrezco 1.500.000 de anticipo")).toBeNull();
  });
  it("plata y el texto completo se conserva", () => {
    const f = "Tiene US$ 5.000 de anticipo y 3 millones de pesos.";
    expect(marcados(f)).toEqual(["dato:US$ 5.000"]);
    expect(resaltarFrase(f).map((t) => t.texto).join("")).toBe(f);
  });
});
