// Operaciones cerradas de la inmobiliaria (ventas y alquileres) y sus honorarios. Las pantallas llaman a esto; no repiten
// la cuenta. Los honorarios se calculan como porcentaje del valor (venta: típico 3%; alquiler: 100% = un mes) salvo que se
// cargue el monto a mano. Del total, una parte es del asesor y el resto queda para la inmobiliaria.
import { comision, type MonedaFin } from "./finanzas";

export const TIPOS_OPERACION = ["venta", "alquiler"] as const;
export type TipoOperacion = (typeof TIPOS_OPERACION)[number];
/** Honorarios sugeridos al cargar una operación nueva (se pueden cambiar). */
export const HONORARIOS_SUGERIDOS: Record<TipoOperacion, number> = { venta: 3, alquiler: 100 };
export const PARTE_ASESOR_SUGERIDA = 30;

export interface OperacionCerrada {
  id: string;
  fecha: string;
  tipo: TipoOperacion;
  propiedad_id: string | null;
  propiedad_descripcion: string | null;
  reserva_id: string | null;
  cliente_nombre: string;
  cliente_telefono: string | null;
  /** Precio de venta, o alquiler mensual. */
  valor: number;
  moneda: MonedaFin;
  honorarios_pct: number | null;
  /** Si se cargó a mano, manda sobre el porcentaje. */
  honorarios_monto: number | null;
  asesor_id: string | null;
  /** Porcentaje de los honorarios que le toca al asesor. */
  asesor_pct: number | null;
  notas: string | null;
}

/** Honorarios cobrados por la operación, en su moneda. */
export function honorarios(o: Pick<OperacionCerrada, "valor" | "honorarios_pct" | "honorarios_monto">): number {
  if (o.honorarios_monto !== null && o.honorarios_monto !== undefined && Number.isFinite(o.honorarios_monto) && o.honorarios_monto >= 0) return o.honorarios_monto;
  return comision(o.valor, o.honorarios_pct ?? 0);
}

/** Lo que le toca al asesor y lo que queda para la inmobiliaria. */
export function repartoHonorarios(o: Pick<OperacionCerrada, "valor" | "honorarios_pct" | "honorarios_monto" | "asesor_pct">): { total: number; asesor: number; inmobiliaria: number } {
  const total = honorarios(o);
  const asesor = comision(total, Math.min(100, Math.max(0, o.asesor_pct ?? 0)));
  return { total, asesor, inmobiliaria: Math.round((total - asesor) * 100) / 100 };
}

export interface ResumenOperaciones { cantidad: number; ventas: number; alquileres: number; honorarios: Record<MonedaFin, number>; paraLaInmobiliaria: Record<MonedaFin, number> }

/** Operaciones, honorarios y lo que queda para la inmobiliaria (por moneda) entre dos fechas incluidas. */
export function resumenOperaciones(ops: OperacionCerrada[], desde?: string, hasta?: string): ResumenOperaciones {
  const r: ResumenOperaciones = { cantidad: 0, ventas: 0, alquileres: 0, honorarios: { USD: 0, ARS: 0 }, paraLaInmobiliaria: { USD: 0, ARS: 0 } };
  for (const o of ops) {
    if ((desde && o.fecha < desde) || (hasta && o.fecha > hasta)) continue;
    r.cantidad++;
    if (o.tipo === "venta") r.ventas++; else r.alquileres++;
    const h = repartoHonorarios(o);
    r.honorarios[o.moneda] += h.total;
    r.paraLaInmobiliaria[o.moneda] += h.inmobiliaria;
  }
  return r;
}

/** Ranking de asesores por cantidad de operaciones cerradas. */
export function rankingAsesores(ops: Pick<OperacionCerrada, "asesor_id">[]): { asesor_id: string | null; cantidad: number }[] {
  const m = new Map<string | null, number>();
  for (const o of ops) m.set(o.asesor_id, (m.get(o.asesor_id) ?? 0) + 1);
  return [...m.entries()].map(([asesor_id, cantidad]) => ({ asesor_id, cantidad })).sort((a, b) => b.cantidad - a.cantidad);
}
