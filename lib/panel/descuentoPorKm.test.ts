import { describe, expect, it } from "vitest";
import { precioQueTomamos } from "./descuentoPorKm";

describe("precio al que tomamos el auto de la web", () => {
  it("el ejemplo de Walter: Clio con media 7.800.000 y pide 5.800.000", () => {
    expect(precioQueTomamos({ media: 7_800_000, pide: 5_800_000, descuentoPct: 20 })).toEqual({ precio: 5_440_000, base: "promedio", topeCliente: false });
  });

  it("nunca más de lo que pide, aunque el descuento por km sea chico", () => {
    expect(precioQueTomamos({ media: 7_800_000, pide: 5_800_000, descuentoPct: 5 })).toEqual({ precio: 5_800_000, base: "promedio", topeCliente: true });
  });

  it("si pide más que la media, o no dijo, se parte de la media como antes", () => {
    expect(precioQueTomamos({ media: 7_800_000, pide: 9_000_000, descuentoPct: 20 }).precio).toBe(6_240_000);
    expect(precioQueTomamos({ media: 7_800_000, pide: null, descuentoPct: 20 }).precio).toBe(6_240_000);
    expect(precioQueTomamos({ media: 7_800_000, pide: 0, descuentoPct: 20 }).precio).toBe(6_240_000);
  });
});
