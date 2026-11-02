// Calificación de un lead: cómo paga, si entrega un usado, cuánto tiene para el anticipo y cuándo quiere comprar
// (pedido de Walter del 16/10/2026, a partir del "proceso comercial" de docs/marketing/aprendizajes-videos-2026-10.md).
// Se guarda en la columna jsonb `prospeccion` de cada tabla de leads (migraciones/sql_lead_prospeccion.sql).
// Todo es opcional: el vendedor carga lo que sabe.

export const FORMAS_PAGO = [
  { value: "contado", label: "Contado" },
  { value: "financiado", label: "Financiado" },
  { value: "permuta", label: "Permuta" },
] as const;

export const CUANDO_COMPRA = [
  { value: "ya", label: "Ya" },
  { value: "este_mes", label: "Este mes" },
  { value: "mas_adelante", label: "Más adelante" },
] as const;

export type FormaPago = (typeof FORMAS_PAGO)[number]["value"];
export type CuandoCompra = (typeof CUANDO_COMPRA)[number]["value"];

export interface UsadoLead {
  marca: string;
  modelo: string;
  anio: number | null;
  km: number | null;
}

export interface ProspeccionLead {
  formasPago: FormaPago[];
  usado: UsadoLead | null;
  anticipo: { monto: number; moneda: "ARS" | "USD" } | null;
  cuando: CuandoCompra | null;
}

export const PROSPECCION_VACIA: ProspeccionLead = { formasPago: [], usado: null, anticipo: null, cuando: null };

const numero = (x: unknown): number | null => {
  const n = typeof x === "number" ? x : typeof x === "string" && x.trim() !== "" ? Number(x.replace(/\./g, "").replace(",", ".")) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const texto = (x: unknown) => (typeof x === "string" ? x.trim().slice(0, 60) : "");

/** Limpia lo que viene de la base o del formulario: descarta valores desconocidos y un usado o anticipo vacío. */
export function normalizarProspeccion(raw: unknown): ProspeccionLead {
  if (!raw || typeof raw !== "object") return { ...PROSPECCION_VACIA };
  const r = raw as Record<string, unknown>;
  const formas = Array.isArray(r.formasPago) ? r.formasPago : [];
  const formasPago = FORMAS_PAGO.map((f) => f.value).filter((v) => formas.includes(v));

  const u = (r.usado && typeof r.usado === "object" ? r.usado : null) as Record<string, unknown> | null;
  const usado = u ? { marca: texto(u.marca), modelo: texto(u.modelo), anio: numero(u.anio), km: numero(u.km) } : null;
  const usadoValido = usado && (usado.marca || usado.modelo || usado.anio !== null || usado.km !== null) ? usado : null;

  const a = (r.anticipo && typeof r.anticipo === "object" ? r.anticipo : null) as Record<string, unknown> | null;
  const monto = a ? numero(a.monto) : null;
  const anticipo = monto && monto > 0 ? { monto, moneda: a?.moneda === "USD" ? ("USD" as const) : ("ARS" as const) } : null;

  const cuando = CUANDO_COMPRA.some((c) => c.value === r.cuando) ? (r.cuando as CuandoCompra) : null;
  return { formasPago, usado: usadoValido, anticipo, cuando };
}

export function estaVacia(p: ProspeccionLead): boolean {
  return p.formasPago.length === 0 && !p.usado && !p.anticipo && !p.cuando;
}

export function textoUsado(u: UsadoLead): string {
  const nombre = [u.marca, u.modelo, u.anio ?? ""].filter(Boolean).join(" ");
  return [nombre, u.km !== null ? `${u.km.toLocaleString("es-AR")} km` : ""].filter(Boolean).join(", ");
}

export function textoAnticipo(a: { monto: number; moneda: string }): string {
  return `${a.moneda === "USD" ? "US$ " : "$ "}${Math.round(a.monto).toLocaleString("es-AR")}`;
}

/** Una línea para el historial del lead: "Financiado + Permuta · Usado: Gol Trend 2015, 90.000 km · Anticipo $ 5.000.000 · Compra: este mes". */
export function resumenProspeccion(p: ProspeccionLead): string {
  const partes: string[] = [];
  if (p.formasPago.length) partes.push(p.formasPago.map((f) => FORMAS_PAGO.find((x) => x.value === f)?.label).join(" + "));
  if (p.usado) partes.push(`Usado: ${textoUsado(p.usado)}`);
  if (p.anticipo) partes.push(`Anticipo ${textoAnticipo(p.anticipo)}`);
  if (p.cuando) partes.push(`Compra: ${CUANDO_COMPRA.find((c) => c.value === p.cuando)?.label.toLowerCase()}`);
  return partes.join(" · ") || "sin datos";
}
