import { describe, expect, it } from "vitest";
import { fotosConsignacionValidas, MIN_FOTOS_CONSIGNACION, MAX_FOTOS_CONSIGNACION } from "./fotosConsignacion";

const lista = (n: number) => Array.from({ length: n }, (_, i) => `https://x.test/${i}.jpg`);

describe("fotosConsignacionValidas", () => {
  it("pide al menos el mínimo", () => {
    expect(fotosConsignacionValidas(lista(MIN_FOTOS_CONSIGNACION - 1))).toBe(false);
    expect(fotosConsignacionValidas(lista(MIN_FOTOS_CONSIGNACION))).toBe(true);
  });
  it("tiene un tope", () => {
    expect(fotosConsignacionValidas(lista(MAX_FOTOS_CONSIGNACION))).toBe(true);
    expect(fotosConsignacionValidas(lista(MAX_FOTOS_CONSIGNACION + 1))).toBe(false);
  });
  it("sin lista no vale", () => {
    expect(fotosConsignacionValidas(undefined)).toBe(false);
    expect(fotosConsignacionValidas(null)).toBe(false);
  });
});
