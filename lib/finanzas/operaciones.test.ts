import { describe, expect, it } from "vitest";
import { honorarios, rankingAsesores, repartoHonorarios, resumenOperaciones, type OperacionCerrada } from "./operaciones";

const op = (p: Partial<OperacionCerrada>): OperacionCerrada => ({
  id: "o", fecha: "2026-11-10", tipo: "venta", propiedad_id: null, propiedad_descripcion: null, reserva_id: null, cliente_nombre: "Ana", cliente_telefono: null,
  valor: 150000, moneda: "USD", honorarios_pct: 3, honorarios_monto: null, asesor_id: "a", asesor_pct: 30, notas: null, ...p,
});

describe("operaciones cerradas", () => {
  it("honorarios por porcentaje del valor", () => {
    expect(honorarios(op({}))).toBe(4500);
  });
  it("el monto cargado a mano manda sobre el porcentaje", () => {
    expect(honorarios(op({ honorarios_monto: 5000 }))).toBe(5000);
  });
  it("alquiler al 100%: un mes", () => {
    expect(honorarios(op({ tipo: "alquiler", valor: 650000, moneda: "ARS", honorarios_pct: 100 }))).toBe(650000);
  });
  it("reparte entre asesor e inmobiliaria, sin pasarse del 100%", () => {
    expect(repartoHonorarios(op({}))).toEqual({ total: 4500, asesor: 1350, inmobiliaria: 3150 });
    expect(repartoHonorarios(op({ asesor_pct: 150 })).inmobiliaria).toBe(0);
    expect(repartoHonorarios(op({ asesor_pct: null })).inmobiliaria).toBe(4500);
  });
  it("resume el mes por moneda sin mezclar", () => {
    const r = resumenOperaciones([op({}), op({ tipo: "alquiler", valor: 650000, moneda: "ARS", honorarios_pct: 100, asesor_pct: 0 }), op({ fecha: "2026-10-01" })], "2026-11-01", "2026-11-30");
    expect(r).toEqual({ cantidad: 2, ventas: 1, alquileres: 1, honorarios: { USD: 4500, ARS: 650000 }, paraLaInmobiliaria: { USD: 3150, ARS: 650000 } });
  });
  it("ranking de asesores", () => {
    expect(rankingAsesores([{ asesor_id: "a" }, { asesor_id: "b" }, { asesor_id: "b" }])[0]).toEqual({ asesor_id: "b", cantidad: 2 });
  });
});
