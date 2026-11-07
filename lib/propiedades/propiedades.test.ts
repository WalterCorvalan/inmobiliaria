import { describe, expect, it } from "vitest";
import { contarPorTipo, especificaciones, filtrarPropiedades, formatearPrecio, fotoPortada, resumenCartera, ubicacion, type Propiedad } from "./propiedades";

const base: Propiedad = {
  id: "1", codigo: "PAL-01", titulo: "Depto 2 amb. con balcón", tipo: "departamento", operacion: "venta", estado: "disponible",
  precio: 148000, moneda: "USD", expensas: null, direccion: "Honduras 4800", barrio: "Palermo", ciudad: null,
  ambientes: 2, dormitorios: 1, banos: 1, cocheras: null, superficie_total: 52, superficie_cubierta: 48, descripcion: null,
  sucursal_id: null, asesor_id: null, created_at: "2026-11-07T10:00:00Z",
};
const mk = (o: Partial<Propiedad>): Propiedad => ({ ...base, ...o });

describe("formatearPrecio", () => {
  it("venta en dólares", () => expect(formatearPrecio(base)).toEqual({ monto: "USD 148.000", sufijo: "" }));
  it("alquiler en pesos lleva /mes", () => expect(formatearPrecio(mk({ operacion: "alquiler", moneda: "ARS", precio: 780000 }))).toEqual({ monto: "$ 780.000", sufijo: "/mes" }));
  it("sin precio o en cero dice Consultar", () => {
    expect(formatearPrecio(mk({ precio: null }))).toEqual({ monto: "Consultar", sufijo: "" });
    expect(formatearPrecio(mk({ precio: 0, operacion: "alquiler" }))).toEqual({ monto: "Consultar", sufijo: "" });
  });
});

describe("especificaciones y ubicación", () => {
  it("muestra solo los datos cargados y prefiere los m² cubiertos", () => {
    expect(especificaciones(base)).toEqual(["2 amb.", "1 baño", "48 m²"]);
    expect(especificaciones(mk({ banos: 2, cocheras: 1, superficie_cubierta: null }))).toEqual(["2 amb.", "2 baños", "1 cochera", "52 m²"]);
    expect(especificaciones(mk({ ambientes: null, banos: null, superficie_total: null, superficie_cubierta: null }))).toEqual([]);
  });
  it("arma la dirección con lo que haya", () => {
    expect(ubicacion(base)).toBe("Honduras 4800, Palermo");
    expect(ubicacion(mk({ barrio: null, ciudad: "Tigre" }))).toBe("Honduras 4800, Tigre");
    expect(ubicacion(mk({ direccion: null, barrio: null }))).toBe("");
  });
});

describe("fotoPortada", () => {
  it("elige la marcada como portada, o la primera por orden, o ninguna", () => {
    expect(fotoPortada({ propiedad_fotos: [{ id: "a", url: "u2", orden: 2, es_portada: false }, { id: "b", url: "u1", orden: 1, es_portada: false }] })).toBe("u1");
    expect(fotoPortada({ propiedad_fotos: [{ id: "a", url: "u2", orden: 2, es_portada: true }, { id: "b", url: "u1", orden: 1, es_portada: false }] })).toBe("u2");
    expect(fotoPortada({ propiedad_fotos: [] })).toBeNull();
    expect(fotoPortada({})).toBeNull();
  });
});

describe("filtrarPropiedades", () => {
  const lista = [
    base,
    mk({ id: "2", titulo: "Casa con jardín", tipo: "casa", barrio: "Villa Urquiza", estado: "reservada", codigo: null }),
    mk({ id: "3", titulo: "Local a la calle", tipo: "local", operacion: "alquiler", barrio: "Villa Crespo", estado: "alquilada" }),
  ];
  it("filtra por tipo, operación y estado", () => {
    expect(filtrarPropiedades(lista, { tipo: "casa" }).map((p) => p.id)).toEqual(["2"]);
    expect(filtrarPropiedades(lista, { operacion: "alquiler" }).map((p) => p.id)).toEqual(["3"]);
    expect(filtrarPropiedades(lista, { estado: "reservada" }).map((p) => p.id)).toEqual(["2"]);
    expect(filtrarPropiedades(lista, { tipo: "todas", operacion: "todas", estado: "todas" })).toHaveLength(3);
  });
  it("busca por texto sin importar tildes ni mayúsculas, en título, código y barrio", () => {
    expect(filtrarPropiedades(lista, { texto: "JARDIN" }).map((p) => p.id)).toEqual(["2"]);
    expect(filtrarPropiedades(lista, { texto: "pal-01" }).map((p) => p.id)).toEqual(["1", "3"]);
    expect(filtrarPropiedades(lista, { texto: "crespo" }).map((p) => p.id)).toEqual(["3"]);
    expect(filtrarPropiedades(lista, { texto: "  " })).toHaveLength(3);
  });
});

describe("conteos", () => {
  it("cuenta por tipo y resume la cartera", () => {
    const lista = [base, mk({ id: "2", tipo: "casa", estado: "reservada" }), mk({ id: "3", operacion: "alquiler", estado: "alquilada" }), mk({ id: "4", operacion: "alquiler" })];
    expect(contarPorTipo(lista)).toMatchObject({ departamento: 3, casa: 1, local: 0 });
    expect(resumenCartera(lista)).toEqual({ total: 4, disponibles: 2, reservadas: 1, enVenta: 2, enAlquiler: 1 });
  });
});
