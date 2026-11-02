import { describe, it, expect } from "vitest";
import { filtrarPorVendedorAsignado, filtrarVendedoresAsignables } from "./permisosModulos";

// Regresión del pedido del 1/10: un vendedor solo ve los leads que le
// tocaron; encargado y admin ven todo. Antes los 5 módulos mandaban la
// bandeja entera de la agencia a cualquier vendedor.
describe("filtrarPorVendedorAsignado", () => {
  const leads = [
    { id: "a", vendedor_id: "fede" },
    { id: "b", vendedor_id: "julian" },
    { id: "c", vendedor_id: "lucas" },
    { id: "d", vendedor_id: null },
  ];

  it("un vendedor ve los suyos y los que todavía no tienen vendedor, no los de otros", () => {
    const ids = filtrarPorVendedorAsignado(leads, { soyAdmin: false, soyEncargado: false, miId: "julian" }).map((l) => l.id);
    expect(ids).toEqual(["b", "d"]);
  });

  it("el encargado ve todos", () => {
    expect(filtrarPorVendedorAsignado(leads, { soyAdmin: false, soyEncargado: true, miId: "lucas" })).toHaveLength(4);
  });

  const perfiles = [
    { id: "gabriel", sucursal_id: "central" }, { id: "fede", sucursal_id: "central" },
    { id: "julian", sucursal_id: "central" }, { id: "lucas", sucursal_id: "torcuato" },
  ];

  it("el encargado ve lo de su sucursal, aunque sea admin (21/10/2026)", () => {
    const deGabriel = filtrarPorVendedorAsignado(leads, { soyAdmin: true, soyEncargado: true, miId: "gabriel", miSucursalId: "central", perfiles }).map((l) => l.id);
    expect(deGabriel).toEqual(["a", "b", "d"]);
    const deLucas = filtrarPorVendedorAsignado(leads, { soyAdmin: false, soyEncargado: true, miId: "lucas", miSucursalId: "torcuato", perfiles }).map((l) => l.id);
    expect(deLucas).toEqual(["c", "d"]);
  });

  it("el admin ve todos", () => {
    expect(filtrarPorVendedorAsignado(leads, { soyAdmin: true, soyEncargado: false, miId: "x" })).toHaveLength(4);
  });

  it("si no hay id de usuario no ve los leads de nadie (solo los sin vendedor)", () => {
    const ids = filtrarPorVendedorAsignado(leads, { soyAdmin: false, soyEncargado: false, miId: "" }).map((l) => l.id);
    expect(ids).toEqual(["d"]);
  });
});

describe("filtrarVendedoresAsignables", () => {
  const perfiles = [
    { id: "v1", roles: ["ventas"], sucursal_id: "s1" },
    { id: "v2", roles: ["ventas"], sucursal_id: "s2" },
    { id: "e1", roles: ["encargado"], sucursal_id: "s1" },
    { id: "e2", roles: ["encargado"], sucursal_id: "s2" },
    { id: "ad", roles: ["admin"], sucursal_id: null },
    { id: "g1", roles: ["gestoria"], sucursal_id: "s1" },
    { id: "sin", roles: null, sucursal_id: null },
  ];
  const ids = (r: typeof perfiles) => r.map((p) => p.id);

  it("vendedores y encargados asignan a cualquier vendedor o encargado, de cualquier sucursal (21/10/2026)", () => {
    expect(ids(filtrarVendedoresAsignables(perfiles, { soyAdmin: false, soyEncargado: false, miSucursalId: "s1" }))).toEqual(["v1", "v2", "e1", "e2"]);
    expect(ids(filtrarVendedoresAsignables(perfiles, { soyAdmin: false, soyEncargado: true, miSucursalId: "s1" }))).toEqual(["v1", "v2", "e1", "e2"]);
  });

  it("el admin asigna a vendedores, encargados y admins, pero no a gestoría", () => {
    expect(ids(filtrarVendedoresAsignables(perfiles, { soyAdmin: true, soyEncargado: false, miSucursalId: null }))).toEqual(["v1", "v2", "e1", "e2", "ad"]);
  });
});

describe("rol taller", () => {
  it("solo taller = taller sin ningún rol de oficina", async () => {
    const { esSoloTaller, MODULOS_ROL_TALLER } = await import("./permisosModulos");
    expect(esSoloTaller(["taller"])).toBe(true);
    expect(esSoloTaller(["taller", "ventas"])).toBe(false);
    expect(esSoloTaller(["admin", "taller"])).toBe(false);
    expect(esSoloTaller(["ventas"])).toBe(false);
    expect(esSoloTaller(null)).toBe(false);
    expect(MODULOS_ROL_TALLER).toEqual(["stock", "taller", "calendario"]);
  });
});
