import { describe, it, expect } from "vitest";
import {
  autosValidos, contarPorVendedor, estadoObjetivo, objetivosParaAvisar, primerDiaDelMes, puedeCargarObjetivo, textoAvisoObjetivo, ultimoDiaDelMes, vendedoresACargo, type PerfilEquipo,
} from "./objetivosVendedor";

// El equipo real (Walter, 26/10/2026): Gabriel encargado de Casa Central con Fede y Julián; Lucas encargado de
// Don Torcuato (Panamericana).
const CENTRAL = "central", DT = "dt";
const gabriel: PerfilEquipo = { id: "gabriel", nombre: "Gabriel", roles: ["encargado", "ventas"], sucursal_id: CENTRAL };
const lucas: PerfilEquipo = { id: "lucas", nombre: "Lucas", roles: ["encargado", "ventas"], sucursal_id: DT };
const fede: PerfilEquipo = { id: "fede", nombre: "Fede", roles: ["ventas"], sucursal_id: CENTRAL };
const julian: PerfilEquipo = { id: "julian", nombre: "Julián", roles: ["ventas"], sucursal_id: CENTRAL };
const walter: PerfilEquipo = { id: "walter", nombre: "Walter", roles: ["admin", "ventas"], sucursal_id: CENTRAL };
const baja: PerfilEquipo = { id: "baja", nombre: "Ex", roles: ["ventas"], sucursal_id: CENTRAL, activo: false };
const todos = [gabriel, lucas, fede, julian, walter, baja];

describe("vendedoresACargo", () => {
  it("Gabriel tiene a Fede y Julián; no a sí mismo, ni a Lucas, ni al admin, ni a uno dado de baja", () => {
    expect(vendedoresACargo(todos, gabriel).map((p) => p.id)).toEqual(["fede", "julian"]);
  });
  it("Lucas no tiene vendedores en Don Torcuato", () => {
    expect(vendedoresACargo(todos, lucas)).toEqual([]);
  });
  it("un vendedor o un encargado sin sucursal no tiene a nadie a cargo", () => {
    expect(vendedoresACargo(todos, fede)).toEqual([]);
    expect(vendedoresACargo(todos, { ...gabriel, sucursal_id: null })).toEqual([]);
  });
  it("puedeCargarObjetivo sigue la misma regla", () => {
    expect(puedeCargarObjetivo(gabriel, julian)).toBe(true);
    expect(puedeCargarObjetivo(lucas, julian)).toBe(false);
    expect(puedeCargarObjetivo(gabriel, walter)).toBe(false);
  });
});

describe("fechas y valores", () => {
  it("mes y último día", () => {
    expect(primerDiaDelMes("2026-10-26")).toBe("2026-10-01");
    expect(ultimoDiaDelMes("2026-10-01")).toBe("2026-10-31");
    expect(ultimoDiaDelMes("2026-02")).toBe("2026-02-28");
  });
  it("objetivo válido: entero de 1 a 100; vacío o 0 lo saca", () => {
    expect(autosValidos(6)).toBe(6);
    expect(autosValidos("4")).toBe(4);
    expect(autosValidos(null)).toBeNull();
    expect(autosValidos("")).toBeNull();
    expect(autosValidos(0)).toBeNull();
    expect(autosValidos(2.5)).toBe("invalido");
    expect(autosValidos(500)).toBe("invalido");
  });
});

describe("estado y aviso", () => {
  it("cumplido, al ritmo y sin objetivo", () => {
    expect(estadoObjetivo(6, 6, 20, 31)).toMatchObject({ cumplido: true, ritmo: "alcanza" });
    expect(estadoObjetivo(2, 6, 15, 30)).toMatchObject({ cumplido: false, proyeccion: 4, ritmo: "no_alcanza" });
    expect(estadoObjetivo(3, null, 10, 31)).toMatchObject({ cumplido: false, ritmo: "sin_meta" });
  });
  it("avisa solo los cumplidos que no se avisaron", () => {
    const vendidos = contarPorVendedor([{ vendedor_id: "fede" }, { vendedor_id: "fede" }, { vendedor_id: "julian" }, { vendedor_id: null }]);
    const objetivos = [
      { id: "1", vendedor_id: "fede", mes: "2026-10-01", autos: 2, aviso_cumplido_en: null },
      { id: "2", vendedor_id: "julian", mes: "2026-10-01", autos: 3, aviso_cumplido_en: null },
      { id: "3", vendedor_id: "fede", mes: "2026-10-01", autos: 1, aviso_cumplido_en: "2026-10-20T10:00:00Z" },
    ];
    expect(objetivosParaAvisar(objetivos, vendidos).map((o) => o.id)).toEqual(["1"]);
  });
  it("texto del aviso", () => {
    expect(textoAvisoObjetivo("Julián", "2026-10-01", 6, 6)).toBe("Julián cumplió el objetivo de octubre: 6 de 6 autos. Tenelo en cuenta antes de liquidar.");
  });
});
