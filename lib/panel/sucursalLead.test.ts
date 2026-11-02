import { describe, expect, it } from "vitest";
import { vendedoresSugeridosPorSucursal, type PerfilSucursal } from "./sucursalLead";

const OFICINA_1 = "s-central";
const OFICINA_2 = "s-torcuato";
const perfiles: PerfilSucursal[] = [
  { id: "encargado-2", nombre: "Encargado 2", roles: ["encargado", "ventas"], sucursal_id: OFICINA_2 },
  { id: "asesor-2", nombre: "Asesor 2", roles: ["ventas"], sucursal_id: OFICINA_1 },
  { id: "asesor-1", nombre: "Asesor 1", roles: ["ventas"], sucursal_id: OFICINA_1 },
  { id: "gaby", nombre: "Gaby", roles: ["admin", "encargado"], sucursal_id: OFICINA_1 },
];

describe("a quién pasarle el lead según la sucursal del auto", () => {
  it("auto de la oficina 2 asignado a alguien de la oficina 1: sugiere a Encargado 2", () => {
    expect(vendedoresSugeridosPorSucursal({ sucursalAutoId: OFICINA_2, vendedorActualId: "asesor-1", perfiles })).toEqual([{ id: "encargado-2", nombre: "Encargado 2" }]);
  });
  it("auto de la oficina 1 asignado a Encargado 2: sugiere a los vendedores de la oficina 1 (no a quien no tiene el rol ventas)", () => {
    expect(vendedoresSugeridosPorSucursal({ sucursalAutoId: OFICINA_1, vendedorActualId: "encargado-2", perfiles }).map((p) => p.id)).toEqual(["asesor-2", "asesor-1"]);
  });
  it("si ya lo tiene alguien de la sucursal del auto, no muestra nada", () => {
    expect(vendedoresSugeridosPorSucursal({ sucursalAutoId: OFICINA_1, vendedorActualId: "asesor-2", perfiles })).toEqual([]);
  });
  it("sin vendedor asignado también sugiere", () => {
    expect(vendedoresSugeridosPorSucursal({ sucursalAutoId: OFICINA_2, vendedorActualId: null, perfiles }).map((p) => p.id)).toEqual(["encargado-2"]);
  });
  it("auto sin sucursal o sucursal sin vendedores: no muestra nada", () => {
    expect(vendedoresSugeridosPorSucursal({ sucursalAutoId: null, vendedorActualId: "asesor-1", perfiles })).toEqual([]);
    expect(vendedoresSugeridosPorSucursal({ sucursalAutoId: "otra", vendedorActualId: "asesor-1", perfiles })).toEqual([]);
  });
});
