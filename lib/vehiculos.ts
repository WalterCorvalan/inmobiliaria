const REGEX_DIACRITICOS = new RegExp("[̀-ͯ]", "g");

// Compara nombres de marca contra el valor real de vehiculos.marca sin
// depender de que coincidan letra a letra (tildes, mayúsculas, "Citroën" vs
// "Citroen", etc.) — deja solo letras/números en minúscula sin acentos.
export function normalizarMarca(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(REGEX_DIACRITICOS, "")
    .replace(/[^a-z0-9]/g, "");
}

// Columnas públicas de "vehiculos" para queries del lado público. Nunca incluir
// precio_costo_ars/usd, observaciones_internas ni vendedor_asignado_id — son
// internos y no deben viajar al cliente (select("*") los expone sin querer).
export const CAMPOS_VEHICULO_PUBLICO =
  "id, marca, modelo, anio, km, tipo, categoria, segmento, estado, slug, precio_publicado_ars, precio_publicado_usd, traccion, potencia_cv, cantidad_plazas, transmision, combustible, destacado, fotos, sucursales!vehiculos_sucursal_id_fkey ( nombre )" as const;

// Ficha de auto (/catalogo/[slug]): igual que arriba + datos de contacto de la sucursal.
export const CAMPOS_VEHICULO_DETALLE =
  "id, marca, modelo, anio, km, tipo, categoria, segmento, estado, slug, precio_publicado_ars, precio_publicado_usd, traccion, potencia_cv, cantidad_plazas, transmision, combustible, destacado, fotos, sucursales!vehiculos_sucursal_id_fkey ( nombre, direccion, telefono:telefono_encargado )" as const;
// Imagen para un auto sin fotos cargadas (pedido de Walter, 9/10/2026): el logo de Pfaffen Automotores en vez de un
// recuadro vacío, "Sin imagen" o el logo chico. Toda tarjeta, ficha o lista del sitio público usa fotoPrincipal().
export const FOTO_SIN_IMAGEN = "/pfaffen-automotores-icono.webp";

/** Primera foto del auto, o la imagen de Pfaffen si no tiene ninguna (también si la lista trae vacíos). */
export function fotoPrincipal(fotos: unknown): string {
  if (!Array.isArray(fotos)) return FOTO_SIN_IMAGEN;
  const primera = fotos.find((f): f is string => typeof f === "string" && f.trim() !== "");
  return primera ?? FOTO_SIN_IMAGEN;
}

// 0 km se decide por los KILÓMETROS (decisión de Walter, 9/10/2026; el campo "condición" se eliminó de todo el
// sistema y de la base porque confundía). Solo es 0 km si tiene cargado exactamente 0. Kilómetros VACÍOS quieren
// decir "no sabemos": no es 0 km (un auto 2013 sin km cargados no puede aparecer como nuevo), no va a /0km y no se
// muestran los km.
const sinKm = (km: number | string | null | undefined) => km == null || String(km).trim() === "";
export function esCeroKm(v: { km?: number | string | null }): boolean {
  return !sinKm(v.km) && Number(v.km) === 0;
}
/** "0 km", "45.000 km" o null si los kilómetros no están cargados (no se muestran). */
export function textoKm(v: { km?: number | string | null }): string | null {
  if (sinKm(v.km)) return null;
  const n = Number(v.km);
  return n === 0 ? "0 km" : `${n.toLocaleString("es-AR")} km`;
}
/** Filtros de PostgREST (.or()) con la misma regla que esCeroKm(). Usados incluye los km vacíos. */
export const FILTRO_0KM = "km.eq.0";
export const FILTRO_USADOS = "km.is.null,km.gt.0";
