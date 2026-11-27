// Finanzas simples (Walter, 26/11/2026: "dónde puedan ver cuánto gastaron o pagaron en dólares y pesos, un poquito de
// rentabilidad"). Toda la cuenta de plata del módulo vive acá, con test. Dólares y pesos van SIEMPRE por separado: nunca
// se suman entre sí. Si una cuenta necesita pasar de una moneda a otra y no hay cotización, devuelve null (no inventa).

export const MONEDAS_FIN = ["USD", "ARS"] as const;
export type MonedaFin = (typeof MONEDAS_FIN)[number];
export type TipoMovimiento = "ingreso" | "egreso";

export interface Movimiento {
  id: string;
  fecha: string; // AAAA-MM-DD
  tipo: TipoMovimiento;
  categoria: string;
  descripcion: string | null;
  monto: number;
  moneda: MonedaFin;
}

export interface Totales { ingresos: number; egresos: number; neto: number }
const cero = (): Totales => ({ ingresos: 0, egresos: 0, neto: 0 });
const redondear = (n: number) => Math.round(n * 100) / 100;

/** Ingresos, egresos y resultado de cada moneda, entre dos fechas (incluidas). Sin fechas, todo. */
export function totalesPorMoneda(movs: Movimiento[], desde?: string, hasta?: string): Record<MonedaFin, Totales> {
  const r: Record<MonedaFin, Totales> = { USD: cero(), ARS: cero() };
  for (const m of movs) {
    if ((desde && m.fecha < desde) || (hasta && m.fecha > hasta)) continue;
    if (!(m.moneda in r) || !Number.isFinite(m.monto) || m.monto < 0) continue;
    const t = r[m.moneda];
    if (m.tipo === "ingreso") t.ingresos += m.monto; else t.egresos += m.monto;
  }
  for (const k of MONEDAS_FIN) { const t = r[k]; t.ingresos = redondear(t.ingresos); t.egresos = redondear(t.egresos); t.neto = redondear(t.ingresos - t.egresos); }
  return r;
}

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/** Primer y último día del mes de `fecha` (AAAA-MM-DD). */
export function rangoDelMes(fecha: string): { desde: string; hasta: string } {
  const [a, m] = fecha.split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { desde: `${a}-${mm}-01`, hasta: `${a}-${mm}-${String(ultimo).padStart(2, "0")}` };
}

/** Los últimos `meses` meses hasta el de `hoy` (incluido), del más viejo al actual, con los totales de cada moneda. */
export function porMes(movs: Movimiento[], hoy: string, meses = 6): { mes: string; etiqueta: string; USD: Totales; ARS: Totales }[] {
  const [a, m] = hoy.split("-").map(Number);
  const salida = [];
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(a, m - 1 - i, 1));
    const clave = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const { desde, hasta } = rangoDelMes(`${clave}-01`);
    const t = totalesPorMoneda(movs, desde, hasta);
    salida.push({ mes: clave, etiqueta: MESES[d.getUTCMonth()], USD: t.USD, ARS: t.ARS });
  }
  return salida;
}

/** En qué se fue (o de dónde vino) la plata de una moneda, de mayor a menor. */
export function porCategoria(movs: Movimiento[], tipo: TipoMovimiento, moneda: MonedaFin, desde?: string, hasta?: string): { categoria: string; monto: number }[] {
  const suma = new Map<string, number>();
  for (const m of movs) {
    if (m.tipo !== tipo || m.moneda !== moneda || (desde && m.fecha < desde) || (hasta && m.fecha > hasta)) continue;
    suma.set(m.categoria, (suma.get(m.categoria) ?? 0) + m.monto);
  }
  return [...suma.entries()].map(([categoria, monto]) => ({ categoria, monto: redondear(monto) })).sort((x, y) => y.monto - x.monto);
}

/** Pasa un monto de una moneda a otra con la cotización (pesos por dólar). Sin cotización válida devuelve null. */
export function convertir(monto: number, de: MonedaFin, a: MonedaFin, pesosPorDolar: number | null | undefined): number | null {
  if (de === a) return monto;
  if (!pesosPorDolar || !Number.isFinite(pesosPorDolar) || pesosPorDolar <= 0) return null;
  return redondear(de === "USD" ? monto * pesosPorDolar : monto / pesosPorDolar);
}

/** Comisión de una operación: porcentaje sobre el valor. */
export function comision(valor: number, porcentaje: number): number {
  if (!Number.isFinite(valor) || !Number.isFinite(porcentaje) || valor <= 0 || porcentaje <= 0) return 0;
  return redondear((valor * porcentaje) / 100);
}

/** Margen en porcentaje (ganancia sobre precio), con un decimal. Null si no se puede calcular. */
export function margen(ganancia: number | null, precio: number): number | null {
  if (ganancia === null || !precio) return null;
  return Math.round((ganancia / precio) * 1000) / 10;
}

// ---- Señas / reservas -----------------------------------------------------------------------------------------------
export const ESTADOS_SENA = ["vigente", "convertida", "devuelta", "perdida"] as const;
export type EstadoSena = (typeof ESTADOS_SENA)[number];
/** Lo que se muestra: una seña vigente con la fecha de vencimiento pasada se ve "vencida" (hay que llamar al cliente). */
export type EstadoSenaVisible = EstadoSena | "vencida";

export function estadoVisible(s: { estado: EstadoSena; vence_el: string | null }, hoy: string): EstadoSenaVisible {
  return s.estado === "vigente" && s.vence_el && s.vence_el < hoy ? "vencida" : s.estado;
}

/** Plata retenida en señas o reservas vigentes, por moneda. */
export function totalVigente(senas: { estado: EstadoSena; monto: number; moneda: MonedaFin }[]): Record<MonedaFin, number> {
  const r: Record<MonedaFin, number> = { USD: 0, ARS: 0 };
  for (const s of senas) if (s.estado === "vigente" && s.moneda in r) r[s.moneda] = redondear(r[s.moneda] + s.monto);
  return r;
}

/** Días que faltan para el vencimiento (negativo si ya venció). Null si no tiene fecha. */
export function diasParaVencer(venceEl: string | null, hoy: string): number | null {
  if (!venceEl) return null;
  return Math.round((Date.parse(`${venceEl}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) / 86_400_000);
}

/** Un monto con su moneda, como lo lee la gente: "USD 18.500" o "$ 1.250.000". */
export function montoTexto(monto: number | null | undefined, moneda: MonedaFin): string {
  if (monto === null || monto === undefined || !Number.isFinite(monto)) return "-";
  const n = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(Math.abs(Math.round(monto)));
  return `${monto < 0 ? "-" : ""}${moneda === "USD" ? "USD " : "$ "}${n}`;
}

