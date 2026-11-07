// Propiedades: nombres, formatos y filtros. Funciones puras (sin base ni pantalla), usables en el servidor y en el navegador.
// La tabla es `propiedades` (migraciones/sql_009_propiedades.sql).

export const TIPOS = ["departamento", "casa", "ph", "local", "oficina", "terreno", "cochera", "otro"] as const;
export const OPERACIONES = ["venta", "alquiler"] as const;
export const ESTADOS = ["disponible", "reservada", "vendida", "alquilada", "pausada"] as const;
export const MONEDAS = ["USD", "ARS"] as const;

export type TipoPropiedad = (typeof TIPOS)[number];
export type Operacion = (typeof OPERACIONES)[number];
export type EstadoPropiedad = (typeof ESTADOS)[number];
export type Moneda = (typeof MONEDAS)[number];

export const TIPO_LABEL: Record<TipoPropiedad, string> = {
  departamento: "Departamento", casa: "Casa", ph: "PH", local: "Local", oficina: "Oficina", terreno: "Terreno", cochera: "Cochera", otro: "Otro",
};
// Plural para las pestañas ("Departamentos", "Locales").
export const TIPO_PLURAL: Record<TipoPropiedad, string> = {
  departamento: "Departamentos", casa: "Casas", ph: "PHs", local: "Locales", oficina: "Oficinas", terreno: "Terrenos", cochera: "Cocheras", otro: "Otros",
};
export const OPERACION_LABEL: Record<Operacion, string> = { venta: "Venta", alquiler: "Alquiler" };
export const ESTADO_LABEL: Record<EstadoPropiedad, string> = {
  disponible: "Disponible", reservada: "Reservada", vendida: "Vendida", alquilada: "Alquilada", pausada: "Pausada",
};

export interface FotoPropiedad { id: string; url: string; orden: number; es_portada: boolean }

export interface Propiedad {
  id: string;
  codigo: string | null;
  titulo: string;
  tipo: TipoPropiedad;
  operacion: Operacion;
  estado: EstadoPropiedad;
  precio: number | null;
  moneda: Moneda;
  expensas: number | null;
  direccion: string | null;
  barrio: string | null;
  ciudad: string | null;
  ambientes: number | null;
  dormitorios: number | null;
  banos: number | null;
  cocheras: number | null;
  superficie_total: number | null;
  superficie_cubierta: number | null;
  descripcion: string | null;
  sucursal_id: string | null;
  asesor_id: string | null;
  created_at: string;
  propiedad_fotos?: FotoPropiedad[] | null;
}

const miles = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

/** "USD 148.000" en venta; "$ 780.000" + "/mes" en alquiler en pesos. Sin precio: "Consultar". */
export function formatearPrecio(p: Pick<Propiedad, "precio" | "moneda" | "operacion">): { monto: string; sufijo: string } {
  const sufijo = p.operacion === "alquiler" ? "/mes" : "";
  if (p.precio === null || p.precio === undefined || Number(p.precio) <= 0) return { monto: "Consultar", sufijo: "" };
  const n = miles.format(Number(p.precio));
  return { monto: p.moneda === "USD" ? `USD ${n}` : `$ ${n}`, sufijo };
}

/** Datos cortos de la ficha: "2 amb.", "1 baño", "48 m²". Solo los que están cargados. */
export function especificaciones(p: Pick<Propiedad, "ambientes" | "banos" | "cocheras" | "superficie_total" | "superficie_cubierta">): string[] {
  const out: string[] = [];
  if (p.ambientes) out.push(`${p.ambientes} amb.`);
  if (p.banos) out.push(p.banos === 1 ? "1 baño" : `${p.banos} baños`);
  if (p.cocheras) out.push(p.cocheras === 1 ? "1 cochera" : `${p.cocheras} cocheras`);
  const m2 = p.superficie_cubierta || p.superficie_total;
  if (m2) out.push(`${miles.format(Number(m2))} m²`);
  return out;
}

/** "Honduras 4800, Palermo". Con lo que haya. */
export function ubicacion(p: Pick<Propiedad, "direccion" | "barrio" | "ciudad">): string {
  return [p.direccion, p.barrio || p.ciudad].filter(Boolean).join(", ");
}

/** La foto de portada: la marcada, o la primera por orden. Sin fotos: null. */
export function fotoPortada(p: Pick<Propiedad, "propiedad_fotos">): string | null {
  const fotos = [...(p.propiedad_fotos || [])].sort((a, b) => a.orden - b.orden);
  return (fotos.find((f) => f.es_portada) || fotos[0])?.url ?? null;
}

export interface FiltroPropiedades { tipo?: TipoPropiedad | "todas"; operacion?: Operacion | "todas"; estado?: EstadoPropiedad | "todas"; texto?: string }

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function filtrarPropiedades<T extends Propiedad>(lista: T[], f: FiltroPropiedades): T[] {
  const texto = f.texto ? sinTildes(f.texto.trim()) : "";
  return lista.filter((p) => {
    if (f.tipo && f.tipo !== "todas" && p.tipo !== f.tipo) return false;
    if (f.operacion && f.operacion !== "todas" && p.operacion !== f.operacion) return false;
    if (f.estado && f.estado !== "todas" && p.estado !== f.estado) return false;
    if (texto) {
      const pajar = sinTildes([p.titulo, p.codigo, p.direccion, p.barrio, p.ciudad].filter(Boolean).join(" "));
      if (!pajar.includes(texto)) return false;
    }
    return true;
  });
}

/** Cuántas hay de cada tipo, para los números de las pestañas. */
export function contarPorTipo(lista: Pick<Propiedad, "tipo">[]): Record<TipoPropiedad, number> {
  const c = Object.fromEntries(TIPOS.map((t) => [t, 0])) as Record<TipoPropiedad, number>;
  for (const p of lista) c[p.tipo] = (c[p.tipo] || 0) + 1;
  return c;
}

/** Resumen para la fila de números de arriba. */
export function resumenCartera(lista: Pick<Propiedad, "estado" | "operacion">[]) {
  const activas = lista.filter((p) => p.estado === "disponible" || p.estado === "reservada");
  return {
    total: lista.length,
    disponibles: lista.filter((p) => p.estado === "disponible").length,
    reservadas: lista.filter((p) => p.estado === "reservada").length,
    enVenta: activas.filter((p) => p.operacion === "venta").length,
    enAlquiler: activas.filter((p) => p.operacion === "alquiler").length,
  };
}
