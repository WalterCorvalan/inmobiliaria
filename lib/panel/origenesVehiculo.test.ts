import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ORIGENES_VEHICULO, normalizarOrigenVehiculo } from "./origenesVehiculo";

describe("origen del vehículo", () => {
  it("la lista es la del CHECK de la base", () => {
    expect(ORIGENES_VEHICULO).toEqual(["Compra", "Consignación", "Permuta", "Otro"]);
  });

  it("'Comprado' (lo que mandaba el selector y la base rechazaba) se guarda como Compra", () => {
    expect(normalizarOrigenVehiculo("Comprado")).toBe("Compra");
  });

  it("acepta variantes y nunca devuelve un valor fuera de la lista", () => {
    expect(normalizarOrigenVehiculo("consignacion")).toBe("Consignación");
    expect(normalizarOrigenVehiculo("Consignado")).toBe("Consignación");
    expect(normalizarOrigenVehiculo("PERMUTA")).toBe("Permuta");
    expect(normalizarOrigenVehiculo("cualquier cosa")).toBe("Otro");
    expect(normalizarOrigenVehiculo("")).toBeNull();
    expect(normalizarOrigenVehiculo(null)).toBeNull();
  });

  it("el selector de vehículos no manda un origen por defecto fuera de la lista", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../../components/panel/VehiculoSelector.tsx"), "utf8");
    const porDefecto = src.match(/origen = "([^"]+)"/)?.[1];
    expect(ORIGENES_VEHICULO as readonly string[]).toContain(porDefecto);
  });
});
