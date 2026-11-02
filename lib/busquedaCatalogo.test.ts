import { describe, expect, it } from "vitest";
import { COLUMNAS_BUSQUEDA, filtroOrPorPalabra, palabrasDeBusqueda, terminosDePalabra } from "./busquedaCatalogo";

describe("palabrasDeBusqueda", () => {
  it("separa marca y modelo en palabras", () => {
    expect(palabrasDeBusqueda("Toyota Corolla")).toEqual(["Toyota", "Corolla"]);
    expect(palabrasDeBusqueda("  toyota   hilux  4x4 ")).toEqual(["toyota", "hilux", "4x4"]);
  });

  it("saca los caracteres que rompen el filtro de PostgREST", () => {
    expect(palabrasDeBusqueda("toyota, corolla")).toEqual(["toyota", "corolla"]);
    expect(palabrasDeBusqueda("hilux (2020)")).toEqual(["hilux", "2020"]);
    expect(palabrasDeBusqueda("100% nuevo_")).toEqual(["100", "nuevo"]);
  });

  it("conserva puntos y guiones de modelos como 2.0 o T-Cross", () => {
    expect(palabrasDeBusqueda("T-Cross 1.4")).toEqual(["T-Cross", "1.4"]);
  });

  it("junta 'pick up' y 'todo terreno' en una sola palabra", () => {
    expect(palabrasDeBusqueda("pick up diesel")).toEqual(["pickup", "diesel"]);
    expect(palabrasDeBusqueda("Pick-Up")).toEqual(["pickup"]);
    expect(palabrasDeBusqueda("todo terreno")).toEqual(["todoterreno"]);
  });

  it("devuelve vacío si solo hay símbolos o espacios", () => {
    expect(palabrasDeBusqueda("")).toEqual([]);
    expect(palabrasDeBusqueda(" , () % ")).toEqual([]);
  });

  it("limita la cantidad de palabras", () => {
    expect(palabrasDeBusqueda("a b c d e f g h")).toHaveLength(6);
  });
});

describe("terminosDePalabra", () => {
  it("'camioneta' también busca pickups y SUV", () => {
    expect(terminosDePalabra("camioneta")).toEqual(expect.arrayContaining(["camioneta", "pickup", "suv"]));
    expect(terminosDePalabra("Camionetas")).toEqual(expect.arrayContaining(["camioneta", "pickup", "suv"]));
  });

  it("'pickup' no trae SUV", () => {
    const t = terminosDePalabra("pickup");
    expect(t).toEqual(expect.arrayContaining(["pickup", "camioneta"]));
    expect(t).not.toContain("suv");
  });

  it("'diesel' / 'diésel' también encuentran los cargados como Gasoil", () => {
    expect(terminosDePalabra("diesel")).toEqual(expect.arrayContaining(["gasoil", "di_sel"]));
    expect(terminosDePalabra("Diésel")).toEqual(expect.arrayContaining(["gasoil"]));
    expect(terminosDePalabra("gasoil")).toEqual(expect.arrayContaining(["gasoil", "di_sel"]));
  });

  it("una palabra sin sinónimos se busca tal cual", () => {
    expect(terminosDePalabra("hilux")).toEqual(["hilux"]);
  });

  it("encuentra con y sin tilde lo que en Stock se guarda con tilde", () => {
    expect(terminosDePalabra("diesel")).toContain("di_sel");
    expect(terminosDePalabra("diésel")).toContain("di_sel");
    expect(terminosDePalabra("automática")).toContain("autom_tica");
    expect(terminosDePalabra("camión")).toContain("cam_on");
  });

  it("no pierde marcas que terminan en s", () => {
    expect(terminosDePalabra("Cross")).toEqual(expect.arrayContaining(["cros", "cross"]));
  });
});

describe("filtroOrPorPalabra", () => {
  it("busca la palabra en todas las columnas, incluida la categoría", () => {
    const f = filtroOrPorPalabra("corolla");
    expect(f.split(",")).toHaveLength(COLUMNAS_BUSQUEDA.length);
    expect(f).toContain("marca.ilike.%corolla%");
    expect(f).toContain("modelo.ilike.%corolla%");
    expect(f).toContain("categoria.ilike.%corolla%");
  });

  it("'camioneta' llega a la categoría de las pickups", () => {
    const f = filtroOrPorPalabra("camioneta");
    expect(f).toContain("categoria.ilike.%camioneta%");
    expect(f).toContain("categoria.ilike.%pickup%");
    expect(f).toContain("categoria.ilike.%suv%");
  });

  it("nunca mete una coma ni un paréntesis dentro del valor", () => {
    for (const p of palabrasDeBusqueda("foo, (bar) %baz% camioneta diésel pick up")) {
      const f = filtroOrPorPalabra(p);
      expect(f.split(",").every((trozo) => /^[a-z]+\.ilike\.%[^,()%]+%$/.test(trozo))).toBe(true);
    }
  });
});

import { COMBUSTIBLE_A_VALORES, TRACCION_A_VALORES, filtroTipoVehiculo, limpiarParaFiltro, valoresDe } from "./busquedaCatalogo";

describe("limpiarParaFiltro", () => {
  it("saca coma y paréntesis de nombres y teléfonos", () => {
    expect(limpiarParaFiltro("Pérez, Juan")).toBe("Pérez Juan");
    expect(limpiarParaFiltro("(11) 5555-1234")).toBe("11 5555-1234");
    expect(limpiarParaFiltro("  ")).toBe("");
  });
});

describe("filtros del catálogo contra lo que carga Stock", () => {
  it("Diésel también encuentra los cargados como Diesel o Gasoil", () => {
    expect(valoresDe(COMBUSTIBLE_A_VALORES, ["Diésel"])).toEqual(["Diésel", "Diesel", "Gasoil"]);
  });

  it("AWD encuentra el valor viejo 'Integral (AWD)' y 4x2 los viejos Delantera/Trasera", () => {
    expect(valoresDe(TRACCION_A_VALORES, ["AWD"])).toEqual(["AWD", "Integral (AWD)"]);
    expect(valoresDe(TRACCION_A_VALORES, ["4x2"])).toContain("Delantera");
  });

  it("un valor sin equivalencia pasa tal cual", () => {
    expect(valoresDe(COMBUSTIBLE_A_VALORES, ["Hidrógeno"])).toEqual(["Hidrógeno"]);
  });

  it("Pickup mira categoria y carrocería Pick-Up", () => {
    expect(filtroTipoVehiculo(["Pickup"])).toBe("categoria.eq.Pickup/Camioneta,categoria.eq.Camioneta,carroceria.eq.Pick-Up");
  });

  it("Sedán incluye los Auto sin carrocería cargada, y no los hatchback declarados", () => {
    const f = filtroTipoVehiculo(["Sedán"])!;
    expect(f).toContain("carroceria.eq.Sedán");
    expect(f).toContain("and(categoria.eq.Auto,carroceria.is.null)");
    expect(f).not.toContain("Hatchback");
  });

  it("sin tipos no filtra y no repite condiciones", () => {
    expect(filtroTipoVehiculo([])).toBeNull();
    const f = filtroTipoVehiculo(["Sedán", "Hatchback"])!;
    expect(f.match(/and\(categoria\.eq\.Auto,carroceria\.is\.null\)/g)).toHaveLength(1);
  });
});

describe("sinónimos de carrocería", () => {
  it("'pickup' encuentra Pick-Up y 'sedan' encuentra Sedán", () => {
    expect(terminosDePalabra("pickup")).toContain("pick-up");
    expect(terminosDePalabra("sedan")).toContain("sed_n");
    expect(terminosDePalabra("furgon")).toContain("furg_n");
  });
});
