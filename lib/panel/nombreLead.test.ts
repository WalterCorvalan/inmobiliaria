import { describe, expect, it } from "vitest";
import { nombreDelResumen, nombreParaFicha, pareceUsuario } from "./nombreLead";

describe("nombre del lead en la ficha", () => {
  it("un usuario de Instagram o un teléfono no es un nombre", () => {
    expect(pareceUsuario("usuario______900")).toBe(true);
    expect(pareceUsuario("@luzbernat")).toBe(true);
    expect(pareceUsuario("5491123916007")).toBe(true);
    expect(pareceUsuario("luzbernat")).toBe(true);
    expect(pareceUsuario("Luz Bernat")).toBe(false);
    expect(pareceUsuario("Melanie")).toBe(false);
  });

  it("toma el nombre con el que arranca el resumen", () => {
    expect(nombreDelResumen("Luz Bernat consultó por el Ford Ka y pidió precio.")).toBe("Luz Bernat");
    expect(nombreDelResumen("Melanie consultó por el Ford Fiesta.")).toBe("Melanie");
    expect(nombreDelResumen("Luz, de Pilar, pregunta por financiación.")).toBe("Luz");
  });

  it("no inventa un nombre si el resumen no arranca con uno", () => {
    expect(nombreDelResumen("El cliente consultó por un Fiat Cronos.")).toBeNull();
    expect(nombreDelResumen("Consulta por el Peugeot 208.")).toBeNull();
    expect(nombreDelResumen("Ford Ka 2018 con 80.000 km.")).toBeNull();
    expect(nombreDelResumen(null)).toBeNull();
  });

  it("si el contacto ya tiene nombre de persona, se deja ese", () => {
    expect(nombreParaFicha("Luz Bernat", "Luz consultó por el Ka.")).toEqual({ nombre: "Luz Bernat", usuario: null });
    expect(nombreParaFicha("usuario______900", "Luz Bernat consultó por el Ka.")).toEqual({ nombre: "Luz Bernat", usuario: "usuario______900" });
    expect(nombreParaFicha("usuario______900", "El cliente consultó.")).toEqual({ nombre: "usuario______900", usuario: null });
  });
});
