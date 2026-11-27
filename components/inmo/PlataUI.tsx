import Link from "next/link";
import type { ReactNode } from "react";
import IconoPanel from "@/components/panel/IconoPanel";

// Piezas de las pantallas de plata (Reservas, Operaciones, Finanzas; 26/11/2026). Mismo estilo que el Inicio: tarjetas blancas con
// borde fino, números grandes y los dibujos en color (nada de íconos de línea).

export function Tarjeta({ titulo, icono, extra, href, verTodo, className = "", children }: { titulo: string; icono?: string; extra?: ReactNode; href?: string; verTodo?: string; className?: string; children: ReactNode }) {
  return (
    <section className={`overflow-hidden rounded-xl bg-white border border-[#E7E9EE] shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:bg-[#131316] dark:border-white/[0.08] ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 md:px-5 dark:border-white/[0.06]">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold text-slate-900 dark:text-white">{icono && <IconoPanel src={icono} alt="" className="w-[18px] h-[18px]" />}{titulo}</h2>
        <div className="flex items-center gap-3">
          {extra}
          {href && verTodo && <Link href={href} className="shrink-0 text-[12.5px] font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">{verTodo} →</Link>}
        </div>
      </div>
      {children}
    </section>
  );
}

/** Número grande con su dibujo en un cuadradito de color y una línea de detalle abajo. */
export function Cifra({ icono, fondo, titulo, valor, detalle, tono, extra }: { icono: string; fondo: string; titulo: string; valor: ReactNode; detalle?: ReactNode; tono?: "ok" | "mal"; extra?: ReactNode }) {
  return (
    <div className="rounded-xl bg-white p-4 md:p-5 border border-[#E7E9EE] shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:bg-[#131316] dark:border-white/[0.08] min-w-0">
      <div className="flex items-start gap-3">
        <span className={`hidden sm:flex w-10 h-10 shrink-0 items-center justify-center rounded-lg ${fondo}`}><IconoPanel src={icono} alt="" className="w-[22px] h-[22px]" /></span>
        <div className="min-w-0 flex-1">
          <span className={`sm:hidden mb-2 flex w-8 h-8 items-center justify-center rounded-lg ${fondo}`}><IconoPanel src={icono} alt="" className="w-[18px] h-[18px]" /></span>
          <p className={`text-[19px] sm:text-[24px] font-semibold leading-none tracking-tight tabular-nums whitespace-nowrap ${tono === "mal" ? "text-rose-600 dark:text-rose-400" : tono === "ok" ? "text-emerald-700 dark:text-emerald-400" : "text-slate-900 dark:text-white"}`}>{valor}</p>
          <p className="mt-1.5 text-[12.5px] font-medium leading-snug text-slate-500 dark:text-slate-400 line-clamp-2">{titulo}</p>
        </div>
      </div>
      {(detalle || extra) && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-end justify-between gap-2 min-h-[28px]">
          <p className="line-clamp-2 sm:truncate text-[12px] text-slate-500 dark:text-slate-400">{detalle}</p>
          {extra && <span className="hidden sm:block">{extra}</span>}
        </div>
      )}
    </div>
  );
}

const PILL: Record<string, string> = {
  verde: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
  ambar: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
  rojo: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30",
  azul: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30",
  gris: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-white/10 dark:text-slate-300 dark:ring-white/10",
};
export function Pill({ color, children }: { color: keyof typeof PILL; children: ReactNode }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset whitespace-nowrap ${PILL[color]}`}>{children}</span>;
}

export function Vacio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="px-5 py-12 text-center">
      <p className="text-[14px] font-semibold text-slate-800 dark:text-slate-100">{titulo}</p>
      <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto">{texto}</p>
    </div>
  );
}

/** Pestañas subrayadas con su número. */
export function Pestanas<T extends string>({ valor, opciones, onCambio, etiqueta }: { valor: T; opciones: { id: T; texto: string; n?: number }[]; onCambio: (v: T) => void; etiqueta: string }) {
  return (
    <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] border-b border-slate-100 dark:border-white/[0.06] px-3 md:px-4" role="tablist" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button key={o.id} type="button" role="tab" aria-selected={valor === o.id} onClick={() => onCambio(o.id)}
          className={`shrink-0 -mb-px px-3 py-2.5 text-[13px] font-semibold border-b-2 transition-colors ${valor === o.id ? "border-[var(--marca)] text-slate-900 dark:text-white" : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"}`}>
          {o.texto}{o.n !== undefined && <span className="ml-1.5 text-[11px] font-medium tabular-nums text-slate-400">{o.n}</span>}
        </button>
      ))}
    </div>
  );
}

export const FONDOS = {
  azul: "bg-sky-50 dark:bg-sky-500/15",
  verde: "bg-emerald-50 dark:bg-emerald-500/15",
  ambar: "bg-amber-50 dark:bg-amber-500/15",
  rosa: "bg-rose-50 dark:bg-rose-500/15",
  violeta: "bg-violet-50 dark:bg-violet-500/15",
  gris: "bg-slate-100 dark:bg-white/10",
};
