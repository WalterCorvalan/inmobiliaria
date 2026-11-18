import { describe, it, expect } from "vitest";
import { claveTemporal, validarAlta } from "./equipo";

describe("alta de equipo", () => {
  it("acepta un alta correcta y normaliza el email", () => {
    const r = validarAlta({ nombre: " Laura Gómez ", email: "Laura@Inmo.com ", rol: "ventas" });
    expect(r).toEqual({ ok: true, datos: { nombre: "Laura Gómez", email: "laura@inmo.com", rol: "ventas", sucursal_id: null, whatsapp: null } });
  });
  it("rechaza email, nombre o rol inválidos", () => {
    expect(validarAlta({ nombre: "Ana", email: "ana", rol: "ventas" }).ok).toBe(false);
    expect(validarAlta({ nombre: "", email: "a@b.com", rol: "ventas" }).ok).toBe(false);
    expect(validarAlta({ nombre: "Ana", email: "a@b.com", rol: "director" }).ok).toBe(false);
  });
  it("genera claves sin caracteres confusos", () => {
    const c = claveTemporal();
    expect(c).toHaveLength(10);
    expect(c).not.toMatch(/[0O1lI]/);
  });
});
