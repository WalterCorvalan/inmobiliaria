import { describe, expect, it } from "vitest";
import { etiquetaDeFrase } from "./formatoResumen";

describe("resumen con el nombre de cada dato", () => {
  it("separa el nombre del dato de su valor", () => {
    expect(etiquetaDeFrase("Anticipo: $ 4.000.000 para entregar.")).toEqual({ etiqueta: "Anticipo", resto: "$ 4.000.000 para entregar." });
    expect(etiquetaDeFrase("Pendiente: que un asesor la contacte.")).toEqual({ etiqueta: "Pendiente", resto: "que un asesor la contacte." });
  });

  it("una frase común no tiene nombre de dato", () => {
    expect(etiquetaDeFrase("Quiere comprar un auto y consultó la financiación.")).toBeNull();
    expect(etiquetaDeFrase("Llamar a las 10:30 mañana.")).toBeNull();
  });
});
