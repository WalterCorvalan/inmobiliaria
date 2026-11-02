import { describe, expect, it } from "vitest";
import { vendedoresSugeridosPorSucursal, type PerfilSucursal } from "./sucursalLead";

const CENTRAL = "s-central";
const TORCUATO = "s-torcuato";
const perfiles: PerfilSucursal[] = [
  { id: "lucas", nombre: "Lucas", roles: ["encargado", "ventas"], sucursal_id: TORCUATO },
  { id: "julian", nombre: "Julián", roles: ["ventas"], sucursal_id: CENTRAL },
  { id: "fede", nombre: "Fede", roles: ["ventas"], sucursal_id: CENTRAL },
  { id: "gaby", nombre: "Gaby", roles: ["admin", "encargado"], sucursal_id: CENTRAL },
];

describe("a quién pasarle el lead según la sucursal del auto", () => {
  it("auto de Don Torcuato asignado a alguien de Casa Central: sugiere a Lucas", () => {
    expect(vendedoresSugeridosPorSucursal({ sucursalAutoId: TORCUATO, vendedorActualId: "fede", perfiles })).toEqual([{ id: "lucas", nombre: "Lucas" }]);
  });
  it("auto de Casa Central asignado a Lucas: sugiere a los vendedores de Casa Central (no a quien no tiene el rol ventas)", () => {
    expect(vendedoresSugeridosPorSucursal({ sucursalAutoId: CENTRAL, vendedorActualId: "lucas", perfiles }).map((p) => p.id)).toEqual(["julian", "fede"]);
  });
  it("si ya lo tiene alguien de la sucursal del auto, no muestra nada", () => {
    expect(vendedoresSugeridosPorSucursal({ sucursalAutoId: CENTRAL, vendedorActualId: "julian", perfiles })).toEqual([]);
  });
  it("sin vendedor asignado también sugiere", () => {
    expect(vendedoresSugeridosPorSucursal({ sucursalAutoId: TORCUATO, vendedorActualId: null, perfiles }).map((p) => p.id)).toEqual(["lucas"]);
  });
  it("auto sin sucursal o sucursal sin vendedores: no muestra nada", () => {
    expect(vendedoresSugeridosPorSucursal({ sucursalAutoId: null, vendedorActualId: "fede", perfiles })).toEqual([]);
    expect(vendedoresSugeridosPorSucursal({ sucursalAutoId: "otra", vendedorActualId: "fede", perfiles })).toEqual([]);
  });
});
