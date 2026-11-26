import type { ReactNode } from "react";

export interface KpiDato { icono: ReactNode; titulo: string; valor: string | number; nota?: string; etiqueta?: string; tono?: "ok" | "mal" | "neutro"; color?: string }

// Colores del cuadradito del ícono, en orden, si el dato no trae el suyo (como la franja de Stock del panel completo).
const COLORES = [
  "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
  "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
  "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
];

/** Números de arriba en una sola franja con separadores (diseño nuevo, 26/11/2026). En el celular la franja se desliza. */
export default function KpiFila({ datos }: { datos: KpiDato[] }) {
  return (
    <div className="flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-white dark:bg-[#111] border border-[#E8E9ED] dark:border-white/10 rounded-xl divide-x divide-[#EEEFF2] dark:divide-white/[0.07] mb-4">
      {datos.map((d, i) => (
        <div key={d.titulo} className="shrink-0 min-w-[150px] md:min-w-0 md:flex-1 px-4 py-3">
          <span className="flex items-center gap-2 whitespace-nowrap text-[12px] font-medium text-slate-600 dark:text-slate-300">
            <span className={`w-5 h-5 rounded-md grid place-items-center [&>svg]:w-3 [&>svg]:h-3 ${d.color ?? COLORES[i % COLORES.length]}`}>{d.icono}</span>{d.titulo}
          </span>
          <span className="mt-1.5 flex items-baseline gap-2 whitespace-nowrap">
            <span className="text-[22px] font-semibold leading-tight tracking-tight tabular-nums text-slate-900 dark:text-white">{d.valor}</span>
            {d.nota && <span className="text-[11.5px] text-slate-500 dark:text-slate-400">{d.nota}</span>}
            {d.etiqueta && <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${d.tono === "ok" ? "bg-emerald-50 text-emerald-700" : d.tono === "mal" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"}`}>{d.etiqueta}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
