import { describe, expect, it } from "vitest";
import { sugerirVehiculosDelTexto } from "./sugerenciaVehiculoLead";

const stock = [
  { id: "1", marca: "Toyota", modelo: "COROLLA 2.0 SEG CVT" },
  { id: "2", marca: "Toyota", modelo: "HILUX SRX" },
  { id: "3", marca: "Volkswagen", modelo: "GOLF 1.4L TSI" },
  { id: "4", marca: "Mercedes-Benz", modelo: "SPRINTER 415" },
];

describe("sugerencia del vehículo de interés en la ficha del lead", () => {
  it("sugiere el auto del stock que nombra el resumen (marca y modelo)", () => {
    expect(sugerirVehiculosDelTexto("Jorge quiere dejar en consignación su Toyota Corolla 2025", stock).map((v) => v.id)).toEqual(["1"]);
  });
  it("no sugiere solo por la marca", () => {
    expect(sugerirVehiculosDelTexto("Busca un Toyota usado", stock)).toEqual([]);
  });
  it("acepta marcas compuestas y sin texto no sugiere nada", () => {
    expect(sugerirVehiculosDelTexto("consulta por la mercedes benz sprinter", stock).map((v) => v.id)).toEqual(["4"]);
    expect(sugerirVehiculosDelTexto(null, stock)).toEqual([]);
  });
});
