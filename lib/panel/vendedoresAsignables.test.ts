import { describe, expect, it } from "vitest";
import { puedeTenerAutosAsignados, sinSoloGestoria, vendedoresAsignables, esDeOtraSucursal } from "./vendedoresAsignables";

describe("vendedoresAsignables", () => {
  const perfiles = [
    { id: "vend", roles: ["ventas"] },
    { id: "enc", roles: ["encargado"] },
    { id: "ambos", roles: ["ventas", "encargado"] },
    { id: "admin", roles: ["admin"] },
    { id: "adminVende", roles: ["admin", "ventas"] },
    { id: "sinRoles", roles: null },
  ];

  it("solo vendedores, encargados o ambos", () => {
    expect(vendedoresAsignables(perfiles).map((p) => p.id)).toEqual(["vend", "enc", "ambos", "adminVende"]);
  });

  it("deja al asignado actual aunque no venda, para que el selector muestre el valor", () => {
    expect(vendedoresAsignables(perfiles, "admin").map((p) => p.id)).toContain("admin");
  });

  it("sin roles no se puede asignar", () => {
    expect(puedeTenerAutosAsignados(null)).toBe(false);
    expect(puedeTenerAutosAsignados([])).toBe(false);
  });
});

describe("sinSoloGestoria", () => {
  it("deja afuera solo a quien es únicamente gestoría", () => {
    const perfiles = [
      { id: "a", roles: ["gestoria"] },
      { id: "b", roles: ["admin", "gestoria"] },
      { id: "c", roles: ["ventas"] },
      { id: "d", roles: [] },
    ];
    expect(sinSoloGestoria(perfiles).map((p) => p.id)).toEqual(["b", "c", "d"]);
  });
});

describe("auto de otra sucursal (21/10/2026)", () => {
  it("frena si la persona y el auto son de sucursales distintas", () => {
    expect(esDeOtraSucursal({ sucursal_id: "central" }, "torcuato")).toBe(true);
    expect(esDeOtraSucursal({ sucursal_id: "torcuato" }, "torcuato")).toBe(false);
    expect(esDeOtraSucursal({ sucursal_id: null }, "torcuato")).toBe(false);
    expect(esDeOtraSucursal({ sucursal_id: "central" }, null)).toBe(false);
  });
});
