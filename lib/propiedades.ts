// Propiedades: listas cerradas, formato de precio y limpieza del formulario. Funciones puras, con test.
// Los valores coinciden con los CHECK de la tabla `propiedades` (migraciones/sql_009_propiedades.sql).

export const OPERACIONES = { venta: "Venta", alquiler: "Alquiler", alquiler_temporario: "Alquiler temporario" } as const;
export const TIPOS = {
  casa: "Casa", departamento: "Departamento", ph: "PH", terreno: "Terreno", local: "Local", oficina: "Oficina",
  cochera: "Cochera", campo: "Campo", galpon: "Galpón", otro: "Otro",
} as const;
export const ESTADOS = { disponible: "Disponible", reservada: "Reservada", vendida: "Vendida", alquilada: "Alquilada", no_disponible: "No disponible" } as const;
export const MONEDAS = ["USD", "ARS"] as const;

export type Operacion = keyof typeof OPERACIONES;
export type TipoPropiedad = keyof typeof TIPOS;
export type EstadoPropiedad = keyof typeof ESTADOS;
export type Moneda = (typeof MONEDAS)[number];

/** Estados en los que la propiedad se puede ofrecer (bot, catálogo). */
export const ESTADOS_OFRECIBLES: EstadoPropiedad[] = ["disponible", "reservada"];

/** "Vendida" solo para ventas; "alquilada" solo para alquileres. */
export function estadosPermitidos(operacion: Operacion): EstadoPropiedad[] {
  return operacion === "venta"
    ? ["disponible", "reservada", "vendida", "no_disponible"]
    : ["disponible", "reservada", "alquilada", "no_disponible"];
}

/** Número escrito a la argentina: "120.000" = 120000, "1.234,5" = 1234.5, "12,5" = 12.5. Vacío o inválido da null. */
export function parsearNumero(texto: string | null | undefined): number | null {
  if (texto == null) return null;
  let t = String(texto).replace(/[\s$]/g, "").replace(/^(USD|ARS|U\$S)/i, "");
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** "USD 120.000", "ARS 450.000" o "Consultar" si no tiene precio. No convierte entre monedas. */
export function formatearPrecio(precio: number | null | undefined, moneda: Moneda | string | null | undefined): string {
  if (precio == null || !Number.isFinite(Number(precio))) return "Consultar";
  return `${moneda === "ARS" ? "ARS" : "USD"} ${Number(precio).toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
}

export type FormularioPropiedad = Partial<Record<
  "codigo" | "titulo" | "operacion" | "tipo" | "estado" | "direccion" | "barrio" | "localidad" | "provincia" | "precio" | "moneda" | "expensas" |
  "ambientes" | "dormitorios" | "banios" | "cocheras" | "m2_cubiertos" | "m2_totales" | "antiguedad_anios" | "descripcion" | "sucursal_id" | "vendedor_id" | "notas_internas",
  string
>> & { publicada?: boolean; fotos?: string[] };

export type PropiedadParaGuardar = {
  codigo: string | null; titulo: string; operacion: Operacion; tipo: TipoPropiedad; estado: EstadoPropiedad;
  direccion: string | null; barrio: string | null; localidad: string | null; provincia: string | null;
  precio: number | null; moneda: Moneda; expensas: number | null;
  ambientes: number | null; dormitorios: number | null; banios: number | null; cocheras: number | null;
  m2_cubiertos: number | null; m2_totales: number | null; antiguedad_anios: number | null;
  descripcion: string | null; sucursal_id: string | null; vendedor_id: string | null; notas_internas: string | null;
  publicada: boolean; fotos: string[];
};

const texto = (v: string | undefined) => { const t = (v ?? "").trim(); return t ? t : null; };
const entero = (v: string | undefined): number | null => { const n = parsearNumero(v); return n == null ? null : Math.round(n); };

/** Valida y limpia lo que escribió la persona. Devuelve los errores en español (uno por problema) o la fila lista para guardar. */
export function limpiarPropiedad(f: FormularioPropiedad): { ok: true; datos: PropiedadParaGuardar } | { ok: false; errores: string[] } {
  const errores: string[] = [];
  const titulo = (f.titulo ?? "").trim();
  if (!titulo) errores.push("Falta el título.");
  const operacion = (f.operacion ?? "") as Operacion;
  if (!(operacion in OPERACIONES)) errores.push("Elegí si es venta o alquiler.");
  const tipo = (f.tipo ?? "") as TipoPropiedad;
  if (!(tipo in TIPOS)) errores.push("Elegí el tipo de propiedad.");
  const estado = ((f.estado ?? "disponible") || "disponible") as EstadoPropiedad;
  if (!(estado in ESTADOS)) errores.push("El estado no es válido.");
  else if (operacion in OPERACIONES && !estadosPermitidos(operacion).includes(estado)) {
    errores.push(operacion === "venta" ? "Una propiedad en venta no puede figurar como alquilada." : "Un alquiler no puede figurar como vendido.");
  }
  const moneda = ((f.moneda ?? "USD") || "USD") as Moneda;
  if (!MONEDAS.includes(moneda)) errores.push("La moneda tiene que ser USD o ARS.");

  const numero = (v: string | undefined, nombre: string): number | null => {
    if (!(v ?? "").trim()) return null;
    const n = parsearNumero(v);
    if (n == null) errores.push(`${nombre} no es un número válido.`);
    return n;
  };
  const precio = numero(f.precio, "El precio");
  const expensas = numero(f.expensas, "Las expensas");
  const m2c = numero(f.m2_cubiertos, "Los m² cubiertos");
  const m2t = numero(f.m2_totales, "Los m² totales");
  if (m2c != null && m2t != null && m2c > m2t) errores.push("Los m² cubiertos no pueden ser más que los totales.");
  const enteros = {
    ambientes: entero(f.ambientes), dormitorios: entero(f.dormitorios), banios: entero(f.banios),
    cocheras: entero(f.cocheras), antiguedad_anios: entero(f.antiguedad_anios),
  };
  for (const [k, nombre] of [["ambientes", "Los ambientes"], ["dormitorios", "Los dormitorios"], ["banios", "Los baños"], ["cocheras", "Las cocheras"], ["antiguedad_anios", "La antigüedad"]] as const) {
    if ((f[k] ?? "").trim() && enteros[k] == null) errores.push(`${nombre} no es un número válido.`);
  }
  if (errores.length) return { ok: false, errores };

  return {
    ok: true,
    datos: {
      codigo: texto(f.codigo), titulo, operacion, tipo, estado,
      direccion: texto(f.direccion), barrio: texto(f.barrio), localidad: texto(f.localidad), provincia: texto(f.provincia),
      precio, moneda, expensas, ...enteros, m2_cubiertos: m2c, m2_totales: m2t,
      descripcion: texto(f.descripcion), sucursal_id: texto(f.sucursal_id), vendedor_id: texto(f.vendedor_id), notas_internas: texto(f.notas_internas),
      publicada: f.publicada ?? true, fotos: (f.fotos ?? []).filter(Boolean),
    },
  };
}

/** Texto corto con lo principal: "3 amb · 2 dorm · 1 baño · 85 m²". */
export function resumenCaracteristicas(p: { ambientes?: number | null; dormitorios?: number | null; banios?: number | null; m2_cubiertos?: number | null; m2_totales?: number | null }): string {
  const partes: string[] = [];
  if (p.ambientes) partes.push(`${p.ambientes} amb`);
  if (p.dormitorios) partes.push(`${p.dormitorios} dorm`);
  if (p.banios) partes.push(`${p.banios} ${p.banios === 1 ? "baño" : "baños"}`);
  const m2 = p.m2_cubiertos ?? p.m2_totales;
  if (m2) partes.push(`${Number(m2).toLocaleString("es-AR")} m²`);
  return partes.join(" · ");
}

/** Tipos de imagen que se aceptan para las fotos, con su extensión. */
export const TIPOS_FOTO: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
