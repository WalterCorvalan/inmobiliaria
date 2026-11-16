import { describe, expect, it } from "vitest";
import { estadosPermitidos, formatearPrecio, limpiarPropiedad, parsearNumero, resumenCaracteristicas } from "./propiedades";

describe("parsearNumero", () => {
  it("entiende el formato argentino", () => {
    expect(parsearNumero("120.000")).toBe(120000);
    expect(parsearNumero("1.234.567")).toBe(1234567);
    expect(parsearNumero("1.234,5")).toBe(1234.5);
    expect(parsearNumero("12,5")).toBe(12.5);
    expect(parsearNumero("85")).toBe(85);
    expect(parsearNumero("USD 95.000")).toBe(95000);
    expect(parsearNumero("$ 450.000")).toBe(450000);
  });
  it("vacío o inválido da null", () => {
    expect(parsearNumero("")).toBeNull();
    expect(parsearNumero(null)).toBeNull();
    expect(parsearNumero("mucho")).toBeNull();
    expect(parsearNumero("-5")).toBeNull();
  });
});

describe("formatearPrecio", () => {
  it("lleva la moneda y no convierte", () => {
    expect(formatearPrecio(120000, "USD")).toBe("USD 120.000");
    expect(formatearPrecio(450000, "ARS")).toBe("ARS 450.000");
  });
  it("sin precio dice Consultar", () => {
    expect(formatearPrecio(null, "USD")).toBe("Consultar");
  });
});

describe("limpiarPropiedad", () => {
  const base = { titulo: " Casa en Palermo ", operacion: "venta", tipo: "casa" };
  it("limpia espacios, parsea números y pone valores por defecto", () => {
    const r = limpiarPropiedad({ ...base, precio: "250.000", ambientes: "4", m2_cubiertos: "120,5", m2_totales: "300", codigo: " " });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.datos).toMatchObject({ titulo: "Casa en Palermo", precio: 250000, ambientes: 4, m2_cubiertos: 120.5, m2_totales: 300, codigo: null, estado: "disponible", moneda: "USD", publicada: true, fotos: [] });
    }
  });
  it("pide lo obligatorio", () => {
    const r = limpiarPropiedad({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores).toEqual(expect.arrayContaining(["Falta el título.", "Elegí si es venta o alquiler.", "Elegí el tipo de propiedad."]));
  });
  it("una venta no puede estar alquilada y un alquiler no puede estar vendido", () => {
    expect(limpiarPropiedad({ ...base, estado: "alquilada" }).ok).toBe(false);
    expect(limpiarPropiedad({ ...base, operacion: "alquiler", estado: "vendida" }).ok).toBe(false);
    expect(limpiarPropiedad({ ...base, operacion: "alquiler", estado: "alquilada" }).ok).toBe(true);
    expect(estadosPermitidos("venta")).not.toContain("alquilada");
  });
  it("rechaza números inválidos y m² cubiertos mayores a los totales", () => {
    const r = limpiarPropiedad({ ...base, precio: "caro", m2_cubiertos: "200", m2_totales: "100" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores).toEqual(expect.arrayContaining(["El precio no es un número válido.", "Los m² cubiertos no pueden ser más que los totales."]));
  });
});

describe("resumenCaracteristicas", () => {
  it("arma el texto corto", () => {
    expect(resumenCaracteristicas({ ambientes: 3, dormitorios: 2, banios: 1, m2_cubiertos: 85 })).toBe("3 amb · 2 dorm · 1 baño · 85 m²");
    expect(resumenCaracteristicas({})).toBe("");
  });
});
