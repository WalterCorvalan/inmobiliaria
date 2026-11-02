import { describe, expect, it } from "vitest";
import { costoFilaIaUsd, costoIaUsd } from "./costoIa";
// El mismo valor que ORIGEN_IA_COTIZACION de estimarPrecioMercado.ts (importarlo acá arranca el cliente de Supabase).
const ORIGEN_IA_COTIZACION = "panel-v2/cotizacion-mercado";

describe("costo de la IA", () => {
  it("cobra Haiku por defecto: 1 USD por millón de entrada y 5 por millón de salida", () => {
    expect(costoFilaIaUsd({ origen: "panel-v2/webhooks/whatsapp", input_tokens: 1_000_000, output_tokens: 1_000_000 })).toBe(6);
  });

  it("la cotización de mercado se cobra con la tarifa de Sonnet 5", () => {
    expect(costoFilaIaUsd({ origen: ORIGEN_IA_COTIZACION, input_tokens: 1_000_000, output_tokens: 1_000_000 })).toBe(12);
  });

  it("la lectura del DNI se cobra igual que la de la cédula", () => {
    expect(costoFilaIaUsd({ origen: "panel-v2/ocr-dni", input_tokens: 1_000_000, output_tokens: 1_000_000 })).toBeCloseTo(0.6);
  });

  it("la lectura de la cédula verde se cobra con la tarifa de su modelo", () => {
    expect(costoFilaIaUsd({ origen: "panel-v2/ocr-cedula", input_tokens: 1_000_000, output_tokens: 1_000_000 })).toBeCloseTo(0.6);
  });

  it("con el modelo anotado se cobra la tarifa de ese modelo, sea cual sea el origen", () => {
    expect(costoFilaIaUsd({ origen: "panel-v2/webhooks/whatsapp", modelo: "claude-haiku-5-5", input_tokens: 1_000_000, output_tokens: 1_000_000 })).toBeCloseTo(0.6);
    expect(costoFilaIaUsd({ origen: "panel-v2/webhooks/whatsapp", modelo: "claude-haiku-4-5-20251001", input_tokens: 1_000_000, output_tokens: 1_000_000 })).toBe(6);
    expect(costoFilaIaUsd({ origen: ORIGEN_IA_COTIZACION, modelo: "claude-sonnet-5", input_tokens: 1_000_000, output_tokens: 1_000_000 })).toBe(12);
  });

  it("las filas viejas sin modelo siguen con la tarifa de antes (cambiar de modelo no reescribe el gasto pasado)", () => {
    expect(costoFilaIaUsd({ origen: "gerente_dashboard", modelo: null, input_tokens: 1_000_000, output_tokens: 0 })).toBe(1);
  });

  it("cuenta las búsquedas en internet de la cotización (US$ 10 cada 1.000) y la caché", () => {
    expect(costoFilaIaUsd({ origen: ORIGEN_IA_COTIZACION, modelo: "claude-sonnet-5", input_tokens: 0, output_tokens: 0, busquedas_web: 6 })).toBeCloseTo(0.06);
    expect(costoFilaIaUsd({ modelo: "claude-sonnet-5", cache_escritura_tokens: 1_000_000 })).toBeCloseTo(2.5);
    expect(costoFilaIaUsd({ modelo: "claude-sonnet-5", cache_lectura_tokens: 1_000_000 })).toBeCloseTo(0.2);
  });

  it("suma filas y tolera tokens vacíos", () => {
    expect(costoIaUsd([{ input_tokens: 500_000, output_tokens: null }, { origen: null, input_tokens: null, output_tokens: 200_000 }])).toBeCloseTo(1.5);
  });
});
