import { describe, expect, it } from "vitest";
import { OrigenWebSchema, columnasDeOrigen } from "./origenWeb";

describe("columnasDeOrigen", () => {
  it("arma las columnas con el canal y la campaña", () => {
    expect(columnasDeOrigen({ canalOrigen: "Meta Ads", utmSource: "facebook", utmMedium: "ads", utmCampaign: "hilux" })).toEqual({
      canal_origen: "Meta Ads", utm_source: "facebook", utm_medium: "ads", utm_campaign: "hilux",
    });
  });

  it("en Rodi el canal va en canal_entrada", () => {
    expect(columnasDeOrigen({ canalOrigen: "Google (orgánico)" }, "canal_entrada")).toEqual({
      canal_entrada: "Google (orgánico)", utm_source: null, utm_medium: null, utm_campaign: null,
    });
  });

  it("sin ningún dato no actualiza nada", () => {
    expect(columnasDeOrigen({ canalOrigen: "  ", utmSource: null })).toBeNull();
    expect(columnasDeOrigen(undefined)).toBeNull();
  });

  it("el esquema acepta que el origen no venga", () => {
    expect(OrigenWebSchema.safeParse({}).success).toBe(true);
    expect(OrigenWebSchema.safeParse({ canalOrigen: "x".repeat(81) }).success).toBe(false);
  });
});
