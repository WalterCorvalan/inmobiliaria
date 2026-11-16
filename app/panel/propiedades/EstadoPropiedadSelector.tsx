"use client";

import { ESTADOS, estadosPermitidos, type EstadoPropiedad, type Operacion } from "@/lib/propiedades";

const COLOR: Record<EstadoPropiedad, string> = {
  disponible: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30",
  reservada: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30",
  vendida: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/5 dark:text-slate-300 dark:border-white/10",
  alquilada: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/5 dark:text-slate-300 dark:border-white/10",
  no_disponible: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30",
};

// Cambia el estado de una propiedad desde la lista, sin abrir el editor. Solo ofrece los estados que corresponden a la operación.
export default function EstadoPropiedadSelector({ estado, operacion, onChange, disabled }: { estado: EstadoPropiedad; operacion: Operacion; onChange: (e: EstadoPropiedad) => void; disabled?: boolean }) {
  const opciones = estadosPermitidos(operacion);
  if (!opciones.includes(estado)) opciones.push(estado);
  return (
    <select
      aria-label="Estado de la propiedad"
      value={estado}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as EstadoPropiedad)}
      onClick={(e) => e.stopPropagation()}
      className={`text-[11px] font-bold rounded-full border px-2 py-1 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0145F2] ${COLOR[estado]}`}
    >
      {opciones.map((o) => <option key={o} value={o}>{ESTADOS[o]}</option>)}
    </select>
  );
}
