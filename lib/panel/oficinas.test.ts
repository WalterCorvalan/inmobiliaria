import { describe, it, expect } from "vitest";
import { slugDeNombre, textoHorario } from "./oficinas";

describe("oficinas", () => {
  it("arma el identificador sin tildes ni espacios", () => {
    expect(slugDeNombre("Lomas de Zamora")).toBe("lomas-de-zamora");
    expect(slugDeNombre("  Núñez / Saavedra ")).toBe("nunez-saavedra");
  });
  it("escribe el horario", () => {
    expect(textoHorario({ diaDesde: 1, diaHasta: 5, horaDesde: 9, horaHasta: 18 })).toBe("lunes a viernes de 9 a 18");
    expect(textoHorario({ diaDesde: 6, diaHasta: 6, horaDesde: 9.5, horaHasta: 13 })).toBe("sábado de 9:30 a 13");
  });
});
