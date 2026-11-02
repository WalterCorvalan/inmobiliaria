// Publicar un auto en el feed de Instagram desde la ficha del auto (Stock → ficha → Marketing), pedido de Walter del
// 26/10/2026. Una foto sale como publicación común; de 2 a 10, como carrusel. El texto se arma con los datos del auto
// y se puede corregir antes de publicar. Nada se publica sin que alguien toque "Publicar" y lo confirme.

import { formatoMonto, nombreLegible } from "./textosAnuncio";

// Límites de Instagram para una publicación del feed.
export const MAX_FOTOS_INSTAGRAM = 10;
export const MAX_CARACTERES_INSTAGRAM = 2200;
export const MAX_HASHTAGS_INSTAGRAM = 30;

/** Quién puede publicar en la cuenta de la empresa: lo que sale ahí lo ve todo el mundo. */
export function puedePublicarEnInstagram(roles: string[] | null | undefined): boolean {
  return (roles ?? []).some((r) => r === "admin" || r === "director" || r === "encargado");
}

export interface DatosPublicacion {
  marca: string;
  modelo: string;
  anio: number | null;
  km: number | null;
  combustible?: string | null;
  transmision?: string | null;
  sucursal?: string | null;
  precioArs?: number | null;
  precioUsd?: number | null;
}

// "Mercedes-Benz" -> "MercedesBenz": un hashtag no admite espacios, guiones ni puntos.
const hashtag = (t: string) => {
  const limpio = t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]/g, "");
  return limpio ? `#${limpio.charAt(0).toUpperCase()}${limpio.slice(1).toLowerCase()}` : null;
};

/** Texto sugerido para la publicación: auto, datos, precio si está publicado, financiación y permuta, y a dónde escribir. */
export function armarTextoInstagram(d: DatosPublicacion): string {
  const nombre = nombreLegible(d.marca, d.modelo, d.anio);
  const km = d.km === null ? null : d.km === 0 ? "0 km" : `${d.km.toLocaleString("es-AR")} km`;
  const datos = [km, d.combustible?.trim(), d.transmision?.trim()].filter(Boolean).join(" · ");
  const precio = d.precioArs ? formatoMonto(d.precioArs, "ARS") : d.precioUsd ? formatoMonto(d.precioUsd, "USD") : null;
  const etiquetas = ["#PfaffenCars", hashtag(d.marca), hashtag(d.modelo.split(" ")[0] ?? ""), d.km === 0 ? "#0km" : "#Usados", "#ZonaNorte"];
  return [
    nombre,
    datos || null,
    precio ? `Precio: ${precio}` : null,
    "",
    "Financiación y tomamos tu usado como parte de pago.",
    `Escribinos por mensaje directo o por WhatsApp${d.sucursal ? `, o vení a verlo a ${d.sucursal}` : ""}.`,
    "",
    [...new Set(etiquetas.filter(Boolean))].join(" "),
  ]
    .filter((linea) => linea !== null)
    .join("\n");
}

/**
 * Revisa lo que se va a publicar. Devuelve el motivo si no se puede, o null si está bien. Las fotos tienen que ser
 * del auto (no se acepta cualquier dirección que mande el navegador).
 */
export function revisarPublicacion(fotosElegidas: string[], fotosDelAuto: string[], texto: string): string | null {
  if (fotosElegidas.length === 0) return "Elegí al menos una foto.";
  if (fotosElegidas.length > MAX_FOTOS_INSTAGRAM) return `Instagram acepta hasta ${MAX_FOTOS_INSTAGRAM} fotos por publicación.`;
  if (new Set(fotosElegidas).size !== fotosElegidas.length) return "Hay una foto repetida.";
  const delAuto = new Set(fotosDelAuto);
  if (fotosElegidas.some((f) => !delAuto.has(f))) return "Una de las fotos no es de este auto.";
  if (texto.length > MAX_CARACTERES_INSTAGRAM) return `El texto tiene ${texto.length} caracteres; Instagram acepta hasta ${MAX_CARACTERES_INSTAGRAM}.`;
  const hashtags = texto.match(/#[^\s#]+/g)?.length ?? 0;
  if (hashtags > MAX_HASHTAGS_INSTAGRAM) return `El texto tiene ${hashtags} hashtags; Instagram acepta hasta ${MAX_HASHTAGS_INSTAGRAM}.`;
  return null;
}

/** Instagram solo acepta fotos JPG para el feed: las demás (PNG, WEBP) las rechaza al publicar. */
export function esFotoJpg(url: string): boolean {
  return /\.jpe?g($|[?#])/i.test(url);
}
