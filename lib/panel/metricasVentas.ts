// Métricas de la pantalla Mis ventas (ritmo del mes, variación contra el mes
// anterior, ticket promedio). Sin conversión de moneda a propósito: cada
// moneda se calcula por separado, así una venta en otra moneda nunca se
// descarta ni se mezcla con una cotización inventada.

// Variación porcentual de actual contra anterior. null si no hay base para comparar.
export function variacionPorcentual(actual: number, anterior: number): number | null {
  if (!Number.isFinite(actual) || !Number.isFinite(anterior) || anterior <= 0) return null;
  return Math.round(((actual - anterior) / anterior) * 100);
}

// Cuántas ventas va a tener el mes si se mantiene el ritmo de lo que va. Antes
// del primer día transcurrido no hay ritmo que medir.
export function proyeccionDeCierre(ventasHastaHoy: number, diaDelMes: number, diasEnElMes: number): number {
  if (!(diaDelMes > 0) || !(diasEnElMes > 0) || ventasHastaHoy < 0) return 0;
  return Math.round((ventasHastaHoy / Math.min(diaDelMes, diasEnElMes)) * diasEnElMes * 10) / 10;
}

export type EstadoRitmo = "alcanza" | "justo" | "no_alcanza" | "sin_meta";

// Compara la proyección con la meta (ventas que pide el siguiente nivel).
// "justo" = hasta un 15% por debajo de la meta.
export function estadoRitmo(proyeccion: number, meta: number | null): EstadoRitmo {
  if (meta == null || meta <= 0) return "sin_meta";
  if (proyeccion >= meta) return "alcanza";
  if (proyeccion >= meta * 0.85) return "justo";
  return "no_alcanza";
}

// Ticket promedio por moneda (precio total ÷ cantidad de ventas de esa moneda).
export function ticketPromedioPorMoneda(ventas: { precio: number; moneda: string }[]): Record<string, number> {
  const suma: Record<string, number> = {};
  const cantidad: Record<string, number> = {};
  for (const v of ventas) {
    if (!Number.isFinite(v.precio)) continue;
    suma[v.moneda] = (suma[v.moneda] || 0) + v.precio;
    cantidad[v.moneda] = (cantidad[v.moneda] || 0) + 1;
  }
  const promedio: Record<string, number> = {};
  for (const m of Object.keys(suma)) promedio[m] = suma[m] / cantidad[m];
  return promedio;
}

// Variación del total facturado: solo cuando hay una única moneda en los dos
// períodos y es la misma. Con más de una no se compara (no se puede sin cotización).
export function variacionFacturado(actual: Record<string, number>, anterior: Record<string, number>): number | null {
  const ma = Object.keys(actual);
  const mb = Object.keys(anterior);
  if (ma.length !== 1 || mb.length !== 1 || ma[0] !== mb[0]) return null;
  return variacionPorcentual(actual[ma[0]], anterior[mb[0]]);
}

export interface FilaRanking { vendedor_id?: string; nombre?: string; ventas_equivalentes?: number | string | null; consignaciones?: number | string | null }

// Total de ventas equivalentes (las compartidas cuentan parcial) del ranking de un período.
export function sumarVentasEquivalentes(filas: FilaRanking[]): number {
  return filas.reduce((total, f) => total + (Number(f.ventas_equivalentes) || 0), 0);
}

// El vendedor con más ventas del período; null si nadie vendió (ranking[0] solo es el primero de la lista).
export function mejorVendedor(filas: FilaRanking[]): { nombre: string; ventas: number } | null {
  let mejor: { nombre: string; ventas: number } | null = null;
  for (const f of filas) {
    const ventas = Number(f.ventas_equivalentes) || 0;
    if (ventas > 0 && (mejor === null || ventas > mejor.ventas)) mejor = { nombre: f.nombre || "—", ventas };
  }
  return mejor;
}
