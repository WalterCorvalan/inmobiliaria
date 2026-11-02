// Objetivo mensual de autos por vendedor (Walter, 26/10/2026). Lo carga y lo ve el encargado de la sucursal para sus
// vendedores (no los vendedores). Cuando uno llega, se avisa a finanzas y admin antes de liquidar. No toca los bonos.
// Tabla: objetivos_vendedor (migraciones/sql_objetivos_vendedor.sql). Ventas que cuentan: cerradas en el mes, con ese
// vendedor (mismo criterio que el objetivo de la empresa del Cockpit).

import { estadoRitmo, proyeccionDeCierre, type EstadoRitmo } from "./metricasVentas";

export interface PerfilEquipo { id: string; nombre: string; roles: string[] | null; sucursal_id: string | null; activo?: boolean | null }

const esJefe = (roles: string[] | null | undefined) => (roles ?? []).some((r) => r === "encargado" || r === "admin" || r === "director");

/** Los vendedores a cargo de un encargado: los de su sucursal con rol de ventas que no son encargados ni dirección. */
export function vendedoresACargo<T extends PerfilEquipo>(perfiles: T[], encargado: PerfilEquipo): T[] {
  if (!(encargado.roles ?? []).includes("encargado") || !encargado.sucursal_id) return [];
  return perfiles
    .filter((p) => p.id !== encargado.id && p.activo !== false && p.sucursal_id === encargado.sucursal_id && (p.roles ?? []).includes("ventas") && !esJefe(p.roles))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/** Si el encargado puede cargar o ver el objetivo de ese vendedor. */
export function puedeCargarObjetivo(encargado: PerfilEquipo, vendedor: PerfilEquipo): boolean {
  return vendedoresACargo([vendedor], encargado).length === 1;
}

/** Primer día del mes ("AAAA-MM-01") de un día "AAAA-MM-DD" o de un mes "AAAA-MM". */
export const primerDiaDelMes = (dia: string) => `${dia.slice(0, 7)}-01`;

/** Último día del mes ("AAAA-MM-DD"). */
export function ultimoDiaDelMes(mes: string): string {
  const [a, m] = mes.slice(0, 7).split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}

/** Cuántos autos es un objetivo válido: entero entre 1 y 100. null = sacar el objetivo. */
export function autosValidos(valor: unknown): number | null | "invalido" {
  if (valor === null || valor === "" || valor === 0 || valor === "0") return null;
  const n = Number(valor);
  return Number.isInteger(n) && n >= 1 && n <= 100 ? n : "invalido";
}

export interface EstadoObjetivo { vendidos: number; objetivo: number | null; cumplido: boolean; proyeccion: number; ritmo: EstadoRitmo }

export function estadoObjetivo(vendidos: number, objetivo: number | null, diaDelMes: number, diasEnElMes: number): EstadoObjetivo {
  const proyeccion = proyeccionDeCierre(vendidos, diaDelMes, diasEnElMes);
  return { vendidos, objetivo, cumplido: objetivo != null && vendidos >= objetivo, proyeccion, ritmo: objetivo != null && vendidos >= objetivo ? "alcanza" : estadoRitmo(proyeccion, objetivo) };
}

/** Ventas cerradas por vendedor. */
export function contarPorVendedor(ventas: { vendedor_id: string | null }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const v of ventas) if (v.vendedor_id) m.set(v.vendedor_id, (m.get(v.vendedor_id) ?? 0) + 1);
  return m;
}

export interface ObjetivoGuardado { id: string; vendedor_id: string; mes: string; autos: number; aviso_cumplido_en: string | null }

/** Objetivos cumplidos que todavía no se avisaron. */
export function objetivosParaAvisar(objetivos: ObjetivoGuardado[], vendidosPorVendedor: Map<string, number>): ObjetivoGuardado[] {
  return objetivos.filter((o) => !o.aviso_cumplido_en && (vendidosPorVendedor.get(o.vendedor_id) ?? 0) >= o.autos);
}

const nombreMes = (mes: string) => new Date(`${mes.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString("es-AR", { month: "long", timeZone: "UTC" });

export function textoAvisoObjetivo(nombre: string, mes: string, vendidos: number, autos: number): string {
  return `${nombre} cumplió el objetivo de ${nombreMes(mes)}: ${vendidos} de ${autos} autos. Tenelo en cuenta antes de liquidar.`;
}

/** Quién recibe el aviso de objetivo cumplido: finanzas y admin (Walter, 26/10/2026). */
export const ROLES_AVISO_OBJETIVO = ["finanzas", "admin"] as const;
