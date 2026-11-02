import { describe, expect, it } from "vitest";
import { faltaEnClienteSena } from "./datosClienteSena";

describe("datos del cliente que exige la seña", () => {
  const hoy = "2026-10-19";
  it("completo pasa", () => {
    expect(faltaEnClienteSena({ fechaNacimiento: "1985-03-02", sexo: "Masculino" }, hoy)).toBeNull();
  });
  it("dice qué falta", () => {
    expect(faltaEnClienteSena({ fechaNacimiento: "", sexo: "" }, hoy)).toBe("Cargá la fecha de nacimiento y el sexo del cliente.");
    expect(faltaEnClienteSena({ fechaNacimiento: "1985-03-02", sexo: "" }, hoy)).toBe("Cargá el sexo del cliente.");
    expect(faltaEnClienteSena({ fechaNacimiento: "", sexo: "Femenino" }, hoy)).toBe("Cargá la fecha de nacimiento del cliente.");
  });
  it("no acepta una fecha de hoy o del futuro", () => {
    expect(faltaEnClienteSena({ fechaNacimiento: "2026-10-19", sexo: "Femenino" }, hoy)).toMatch(/futuro/);
  });
});
