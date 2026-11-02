import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/panel/logger", () => ({ registrarError: vi.fn() }));

import { datosQueFaltan, mismoTelefono, telefonoComparable } from "./visitaRepetida";

describe("visitas repetidas", () => {
  it("el mismo teléfono escrito distinto es la misma persona (caso Lucas, 29/10/2026)", () => {
    expect(mismoTelefono("3781609287", "5493781609287")).toBe(true);
    expect(mismoTelefono("+54 9 11 5555-0000", "011 5555-0000")).toBe(true);
    expect(mismoTelefono("1155550000", "1155550001")).toBe(false);
  });

  it("sin teléfono no se compara (Instagram sin número: 'sin dato')", () => {
    expect(telefonoComparable("sin dato")).toBeNull();
    expect(mismoTelefono("sin dato", "sin dato")).toBe(false);
  });

  it("completa solo lo que falta, nunca pisa", () => {
    expect(datosQueFaltan({ vehiculo_marca: null, vehiculo_modelo: null }, { vehiculo_marca: "Volkswagen", vehiculo_modelo: "Gol Trend" }))
      .toEqual({ vehiculo_marca: "Volkswagen", vehiculo_modelo: "Gol Trend" });
    expect(datosQueFaltan({ vehiculo_marca: "Fiat", vehiculo_modelo: "Cronos" }, { vehiculo_marca: "Volkswagen", vehiculo_modelo: "Gol" })).toEqual({});
  });
});
