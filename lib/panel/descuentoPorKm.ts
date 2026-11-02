// Escala de descuento sobre el precio que el cliente dice esperar por su
// auto, según los km — reemplaza la estimación con IA (buscaba comparables
// de mercado) por una regla fija que el equipo definió.
const TRAMOS = [
  { hasta: 50_000, pct: 8 },
  { hasta: 80_000, pct: 10 },
  { hasta: 100_000, pct: 12 },
  { hasta: 120_000, pct: 14 },
  { hasta: 180_000, pct: 16 },
  { hasta: Infinity, pct: 20 },
];

export function descuentoPctPorKm(km: number): number {
  const tramo = TRAMOS.find((t) => km <= t.hasta);
  return tramo ? tramo.pct : 20;
}

/**
 * Precio al que tomaríamos el auto que el cliente cotizó en la web (Walter, 20/10/2026: "no le podemos ofrecer más de lo
 * que el cliente pide"). La media de mercado es el punto de partida:
 *  - si el cliente pide menos que la media, se parte del promedio entre la media y lo que pide;
 *  - si pide igual o más (o no dijo), se parte de la media, como antes;
 * a eso se le saca el descuento por km, y nunca queda por encima de lo que pide.
 */
export function precioQueTomamos({ media, pide, descuentoPct }: { media: number; pide: number | null; descuentoPct: number }): {
  precio: number; base: "promedio" | "media"; topeCliente: boolean;
} {
  const pidio = pide != null && pide > 0 ? pide : null;
  const base = pidio != null && pidio < media ? "promedio" : "media";
  const desde = base === "promedio" ? (media + (pidio as number)) / 2 : media;
  const conDescuento = Math.round(desde * (1 - descuentoPct / 100));
  if (pidio != null && conDescuento > pidio) return { precio: pidio, base, topeCliente: true };
  return { precio: conDescuento, base, topeCliente: false };
}

/** Texto corto de cómo salió el precio, para el detalle de la cotización. */
export function explicacionTomamos(r: ReturnType<typeof precioQueTomamos>, descuentoPct: number): string {
  if (r.topeCliente) return "Lo que pide el cliente (no ofrecemos más)";
  return r.base === "promedio" ? `Promedio entre media y lo que pide, -${descuentoPct}% por km` : `Media -${descuentoPct}% por km`;
}

export function calcularOferta(precioEsperado: number, km: number): { descuentoPct: number; oferta: number } {
  const descuentoPct = descuentoPctPorKm(km);
  const oferta = Math.round(precioEsperado * (1 - descuentoPct / 100));
  return { descuentoPct, oferta };
}
