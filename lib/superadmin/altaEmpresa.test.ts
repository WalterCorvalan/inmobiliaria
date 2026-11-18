import { describe, it, expect } from "vitest";
import { validarAltaEmpresa } from "./altaEmpresa";

describe("alta de empresa", () => {
  it("arma el identificador desde el nombre si no viene", () => {
    const r = validarAltaEmpresa({ nombre: "Propiedades del Sur", duenoNombre: "Laura", duenoEmail: "LAURA@sur.com" });
    expect(r).toEqual({ ok: true, datos: { nombre: "Propiedades del Sur", slug: "propiedades-del-sur", duenoNombre: "Laura", duenoEmail: "laura@sur.com" } });
  });
  it("rechaza identificadores y emails inválidos", () => {
    expect(validarAltaEmpresa({ nombre: "X Y", slug: "con espacio", duenoNombre: "Ana", duenoEmail: "a@b.com" }).ok).toBe(false);
    expect(validarAltaEmpresa({ nombre: "X Y", duenoNombre: "Ana", duenoEmail: "nada" }).ok).toBe(false);
  });
});
