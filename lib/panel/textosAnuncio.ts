// Textos para el anuncio de un auto (pestaña Marketing de la ficha, pedido de Walter del 15/10/2026). Sin IA: una
// plantilla fija con los datos reales del auto, con la estructura de docs/marketing/aprendizajes-videos-2026-10.md:
// gancho (financiación o producto), desarrollo corto, cierre con una sola acción, y el mensaje automático de WhatsApp
// que repite el auto y el anticipo para que la consulta llegue sabiendo de qué se trata.
// El anticipo lo carga a mano quien arma el anuncio (decisión de Walter): sin anticipo no hay gancho de financiación.

export interface DatosAnuncio {
  marca: string;
  modelo: string;
  anio: number | null;
  km: number | null; // null = no se sabe; 0 = 0 km
  combustible?: string | null;
  transmision?: string | null;
  sucursal?: string | null;
}

export interface TextosAnuncio {
  ganchoFinanciacion: string | null;
  ganchoProducto: string;
  desarrollo: string;
  cierre: string;
  mensajeWhatsapp: string;
  anuncioCompleto: string;
}

const MAYUS = (t: string) => t.trim().replace(/\s+/g, " ");

// "FORD RANGER DC 4X2 XL" se ve gritado en un anuncio: se pasa a "Ford Ranger DC 4X2 XL" (siglas y números quedan).
export function nombreLegible(marca: string, modelo: string, anio: number | null): string {
  const palabra = (p: string) => (/\d/.test(p) || p.length <= 2 ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
  const texto = `${MAYUS(marca)} ${MAYUS(modelo)}`.split(" ").map(palabra).join(" ");
  return anio ? `${texto} ${anio}` : texto;
}

export function formatoMonto(monto: number, moneda: string): string {
  const n = Math.round(monto).toLocaleString("es-AR");
  return moneda === "USD" ? `USD ${n}` : `$${n}`;
}

const textoKm = (km: number | null) => (km === null ? null : km === 0 ? "0 km" : `${km.toLocaleString("es-AR")} km`);

export function armarTextosAnuncio(d: DatosAnuncio, anticipo: { monto: number; moneda: string } | null): TextosAnuncio {
  const nombre = nombreLegible(d.marca, d.modelo, d.anio);
  const km = textoKm(d.km);
  const anticipoTexto = anticipo && anticipo.monto > 0 ? formatoMonto(anticipo.monto, anticipo.moneda) : null;

  const ganchoFinanciacion = anticipoTexto ? `Con ${anticipoTexto} de anticipo te llevás este ${nombre}.` : null;
  const ganchoProducto = km === "0 km" ? `${nombre} 0 km, listo para entregar.` : km && (d.km ?? 0) <= 60000 ? `${nombre} con solo ${km}.` : km ? `${nombre} con ${km}.` : `${nombre}.`;

  const atributos = [d.combustible, d.transmision].map((x) => (x ? x.trim() : "")).filter(Boolean);
  const desarrollo = `${atributos.length ? `${atributos.join(", ")}. ` : ""}Tomamos tu usado como parte de pago.`;
  const cierre = `Escribinos y te contamos cómo llevártelo${d.sucursal ? `, o vení a verlo a ${d.sucursal}` : ""}.`;

  const detalle = [km, anticipoTexto ? `anticipo ${anticipoTexto}` : null].filter(Boolean).join(", ");
  const mensajeWhatsapp = `Hola, me interesa el ${nombre}${detalle ? ` (${detalle})` : ""}. ¿Sigue disponible?`;

  const anuncioCompleto = [ganchoFinanciacion ?? ganchoProducto, ganchoFinanciacion && km ? `Tiene ${km}.` : null, desarrollo, cierre].filter(Boolean).join(" ");
  return { ganchoFinanciacion, ganchoProducto, desarrollo, cierre, mensajeWhatsapp, anuncioCompleto };
}
