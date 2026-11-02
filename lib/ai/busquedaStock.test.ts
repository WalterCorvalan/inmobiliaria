import { describe, expect, it } from "vitest";
import { compactar, marcasQueCoinciden, modelosQueCoinciden, sacarAnio } from "./busquedaStock";

const MARCAS = ["Mercedes Benz", "FORD", "Renault", "Volkswagen", "Chevrolet", "Peugeot", "Toyota", "Citroën", "Fiat"];
const MODELOS = ["SPRINTER 411 CDI/F 3250 STREET V1", "SPRINTER 415 CDI 3250 MIXTO 4 1", "HILUX SRV 4X4", "COROLLA CROSS XEI", "RANGER XL 3.0", "208 ACTIVE"];

describe("compactar", () => {
  it("iguala mayúsculas, tildes, guiones y espacios", () => {
    expect(compactar("Mercedes-Benz")).toBe(compactar("MERCEDES BENZ"));
    expect(compactar("Citroën")).toBe("citroen");
  });
});

describe("marcasQueCoinciden", () => {
  it("caso Fran Arias: Mercedes-Benz encuentra la Mercedes Benz cargada", () => {
    expect(marcasQueCoinciden("Mercedes-Benz", MARCAS)).toEqual(["Mercedes Benz"]);
    expect(marcasQueCoinciden("mercedes", MARCAS)).toEqual(["Mercedes Benz"]);
  });
  it("no importan mayúsculas ni tildes", () => {
    expect(marcasQueCoinciden("ford", MARCAS)).toEqual(["FORD"]);
    expect(marcasQueCoinciden("citroen", MARCAS)).toEqual(["Citroën"]);
  });
  it("entiende errores de tipeo y apodos comunes", () => {
    expect(marcasQueCoinciden("Renol", MARCAS)).toEqual(["Renault"]);
    expect(marcasQueCoinciden("Reanult", MARCAS)).toEqual(["Renault"]);
    expect(marcasQueCoinciden("Wolsvagen", MARCAS)).toEqual(["Volkswagen"]);
    expect(marcasQueCoinciden("VW", MARCAS)).toEqual(["Volkswagen"]);
    expect(marcasQueCoinciden("Chevy", MARCAS)).toEqual(["Chevrolet"]);
    expect(marcasQueCoinciden("Peugot", MARCAS)).toEqual(["Peugeot"]);
  });
  it("una marca que no está no se confunde con otra", () => {
    expect(marcasQueCoinciden("Honda", MARCAS)).toEqual([]);
    expect(marcasQueCoinciden("Kia", MARCAS)).toEqual([]);
    expect(marcasQueCoinciden("BMW", MARCAS)).toEqual([]);
  });
});

describe("modelosQueCoinciden", () => {
  it("caso Fran Arias: 'la sprinter 2018' encuentra las Sprinter", () => {
    expect(modelosQueCoinciden("sprinter 2018", MODELOS)).toEqual(["SPRINTER 411 CDI/F 3250 STREET V1", "SPRINTER 415 CDI 3250 MIXTO 4 1"]);
  });
  it("no importan guiones ni errores de tipeo", () => {
    expect(modelosQueCoinciden("Hi-Lux", MODELOS)).toEqual(["HILUX SRV 4X4"]);
    expect(modelosQueCoinciden("Corola", MODELOS)).toEqual(["COROLLA CROSS XEI"]);
    expect(modelosQueCoinciden("corolla cross", MODELOS)).toEqual(["COROLLA CROSS XEI"]);
  });
  it("un modelo que no está no trae otro", () => {
    expect(modelosQueCoinciden("Amarok", MODELOS)).toEqual([]);
    expect(modelosQueCoinciden("Cronos", MODELOS)).toEqual([]);
  });
});

describe("sacarAnio", () => {
  it("separa el año del modelo", () => {
    expect(sacarAnio("sprinter 2018")).toEqual({ texto: "sprinter", anio: 2018 });
    expect(sacarAnio("Hilux")).toEqual({ texto: "Hilux", anio: null });
  });
  it("no confunde números del modelo con años", () => {
    expect(sacarAnio("208 active").anio).toBeNull();
    expect(sacarAnio("Sprinter 411").anio).toBeNull();
  });
});
