import { describe, it, expect } from "vitest";
import { memoriaInicial, memoriaQueFalta } from "./memoriaInicial";

describe("memoria inicial del bot", () => {
  it("trae una respuesta por categoría con el nombre del negocio", () => {
    const m = memoriaInicial("Propiedades del Sur");
    expect(new Set(m.map((f) => f.categoria)).size).toBe(m.length);
    expect(m.find((f) => f.categoria === "saludo")?.respuesta).toContain("Propiedades del Sur");
  });
  it("no repite las categorías que ya están cargadas", () => {
    const falta = memoriaQueFalta([{ categoria: "saludo" }, { categoria: "apertura" }], "X");
    expect(falta.map((f) => f.categoria)).not.toContain("saludo");
    expect(falta).toHaveLength(4);
  });
});
