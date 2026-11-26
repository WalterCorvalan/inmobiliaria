"use client";

// Piezas de las vistas de detalle con el diseño nuevo (estilo Material, aprobado por Walter el 10/11/2026 para Ventas y
// Leads): mismos nombres que components/panel/detalle/DetalleUI.tsx, con tarjeta blanca muy redondeada, cada bloque en un
// recuadro gris suave, filas "nombre a la izquierda, dato a la derecha", etiquetas en píldora e íconos de color del menú.
// Los demás módulos siguen con DetalleUI.tsx hasta que se pasen de a uno.
// Las clases "detalle-…" no dibujan nada: son para que el estilo SaaS (app/panel/stock/estiloStockMinimal.ts) las encuentre.

import { X, type LucideIcon } from "lucide-react";
import IconoPanel, { type NombreIconoPanel } from "@/components/panel/IconoPanel";

/** Ícono de una sección: uno de color del menú (por nombre) o uno de línea. */
export type IconoSeccion = LucideIcon | NombreIconoPanel;


export const BTN = {
  primario: "flex-1 flex items-center justify-center gap-2 bg-[#0145F2] hover:bg-[#0138c9] text-white shadow-sm font-semibold text-[15px] h-12 px-4 rounded-2xl transition-colors disabled:opacity-50",
  exito: "flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[15px] h-12 px-4 rounded-2xl transition-colors disabled:opacity-50",
  whatsapp: "flex-1 flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebe5a] text-white font-semibold text-[15px] h-12 px-4 rounded-2xl transition-colors",
  secundario: "flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-slate-100 font-semibold text-[15px] h-12 px-4 rounded-2xl transition-colors disabled:opacity-50",
  sena: "flex-1 flex items-center justify-center gap-2 bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 font-semibold text-[15px] h-12 px-4 rounded-2xl transition-colors disabled:opacity-50",
  peligro: "flex-1 flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/15 text-rose-600 font-semibold text-[15px] h-12 px-4 rounded-2xl transition-colors disabled:opacity-50",
  icono: "w-12 h-12 shrink-0 grid place-items-center rounded-2xl bg-slate-100 dark:bg-white/10 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/15 transition-colors disabled:opacity-50",
};

const TONOS = {
  neutro: "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300",
  exito: "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  alerta: "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300",
  peligro: "bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300",
  info: "bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300",
};
export type TonoDetalle = keyof typeof TONOS;

// Las etiquetas que vienen con clase propia (con borde) se quedan sin borde, como píldora.
export function Etiqueta({ children, tono = "neutro", clase }: { children: React.ReactNode; tono?: TonoDetalle; clase?: string }) {
  return <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full !border-0 ${clase || TONOS[tono]}`}>{children}</span>;
}

export function DetalleShell({ onClose, ancho = "max-w-xl", encabezado, pie, children, z = "z-[100]" }: {
  onClose: () => void; ancho?: string; encabezado: React.ReactNode; pie?: React.ReactNode; children: React.ReactNode; z?: string;
}) {
  return (
    <div className={`diseno-material fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] ${z} flex items-end sm:items-center justify-center p-0 sm:p-4`} onClick={() => onClose()}>
      <div className={`detalle-ventana bg-white dark:bg-[#17181c] w-full ${ancho} max-h-[92vh] sm:max-h-[90vh] flex flex-col rounded-t-[28px] sm:rounded-[28px] shadow-[0_20px_60px_rgba(15,23,42,0.25)] ring-1 ring-black/5 dark:ring-white/10 overflow-y-auto sm:overflow-hidden`} onClick={(e) => e.stopPropagation()}>
        {encabezado}
        <div className="px-4 sm:px-5 pb-5 space-y-3 sm:overflow-y-auto flex-1 sm:min-h-0">{children}</div>
        {pie && <div className="detalle-pie sticky bottom-0 sm:static shrink-0 px-4 sm:px-5 pt-3 pb-4 space-y-2 bg-white dark:bg-[#17181c] border-t border-slate-100 dark:border-white/10">{pie}</div>}
      </div>
    </div>
  );
}

export function DetalleEncabezado({ numero, etiquetas, foto, icono: Icono, titulo, subtitulo, importe, nota, onClose }: {
  numero?: React.ReactNode; etiquetas?: React.ReactNode; foto?: string | null; icono?: LucideIcon;
  titulo: React.ReactNode; subtitulo?: React.ReactNode; importe?: React.ReactNode; nota?: React.ReactNode; onClose: () => void;
}) {
  return (
    <div className="shrink-0 px-4 sm:px-5 pt-4 pb-3">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          {numero != null && numero !== "" && <span className="text-[13px] font-semibold text-slate-900 dark:text-white">{numero}</span>}
          {etiquetas}
        </div>
        <button onClick={onClose} aria-label="Cerrar" className="w-9 h-9 grid place-items-center rounded-full text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 shrink-0"><X className="w-5 h-5" /></button>
      </div>
      {/* El bloque principal, como "Pay with" del ejemplo: recuadro gris con la foto, el auto y el precio grande. */}
      <div className="detalle-cabecera rounded-[22px] bg-slate-50 dark:bg-white/[0.05] p-3.5 flex gap-3.5">
        {(foto !== undefined || Icono) && (
          <div className="w-24 h-[72px] sm:w-28 sm:h-20 shrink-0 rounded-2xl overflow-hidden bg-white dark:bg-white/5 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {foto ? <img src={foto} alt="" className="w-full h-full object-cover" /> : Icono ? <Icono className="w-7 h-7 text-slate-300 dark:text-slate-600" /> : null}
          </div>
        )}
        <div className="min-w-0 flex-1 flex flex-col justify-between">
          <div>
            <p className="text-[15px] font-semibold text-slate-900 dark:text-white leading-snug">{titulo}</p>
            {subtitulo && <div className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 min-w-0">{subtitulo}</div>}
          </div>
          {(importe || nota) && (
            <div className="flex items-end justify-between gap-2 mt-1.5 flex-wrap">
              {importe && <p className="text-[26px] sm:text-[30px] leading-none font-medium tracking-tight text-slate-900 dark:text-white whitespace-nowrap">{importe}</p>}
              {nota && <div className="text-[12px] text-slate-500 flex items-center gap-1">{nota}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function TituloSeccion({ children, icono: Icono, accion }: { children: React.ReactNode; icono?: IconoSeccion; accion?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-1.5">
      <p className="text-[14px] font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
        {typeof Icono === "string" ? <span className="detalle-icono-seccion w-8 h-8 rounded-xl bg-white dark:bg-white/10 grid place-items-center shadow-[0_1px_2px_rgba(15,23,42,0.06)]"><IconoPanel nombre={Icono} medida="md" /></span> : Icono ? <Icono className="w-4 h-4 text-slate-500" /> : null}
        {children}
      </p>
      {accion}
    </div>
  );
}

// Cada sección es un recuadro gris suave con su nombre chico arriba.
export function Seccion({ titulo, icono, accion, children }: { titulo: React.ReactNode; icono?: IconoSeccion; accion?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="detalle-seccion rounded-[22px] bg-slate-50 dark:bg-white/[0.05] px-4 pt-3.5 pb-3">
      <TituloSeccion icono={icono} accion={accion}>{titulo}</TituloSeccion>
      {children}
    </div>
  );
}

// Fila: nombre a la izquierda, dato a la derecha (como "Transaction type · Matcha Auto"). Los vacíos no se muestran.
export function Dato({ label, valor, ancho = false, destacado = false }: { label: string; valor: React.ReactNode; ancho?: boolean; destacado?: boolean }) {
  if (valor === null || valor === undefined || valor === "" || valor === false) return null;
  return (
    <div className={`flex ${ancho ? "flex-col gap-0.5" : "items-baseline justify-between gap-4"} py-2 border-t first:border-t-0 border-slate-200/70 dark:border-white/[0.07]`}>
      <p className="text-[13px] text-slate-500 dark:text-slate-400 shrink-0">{label}</p>
      <div className={`whitespace-pre-wrap ${ancho ? "" : "text-right"} ${destacado ? "text-[15px] font-semibold text-slate-900 dark:text-white" : "text-[14px] font-medium text-slate-900 dark:text-slate-100"}`}>{valor}</div>
    </div>
  );
}

export function DatosGrid({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col">{children}</div>;
}

export function BloqueDestacado({ children, tono = "azul" }: { children: React.ReactNode; tono?: "azul" | "ambar" }) {
  const fondo = tono === "ambar" ? "bg-amber-50 dark:bg-amber-500/10" : "bg-blue-50 dark:bg-blue-500/10";
  return <div className={`text-[14px] leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap rounded-2xl px-4 py-3 ${fondo}`}>{children}</div>;
}

// Un ítem dentro de una sección (una permuta): tarjeta blanca sobre el gris.
export function Tarjeta({ titulo, icono: Icono, derecha, children }: { titulo: React.ReactNode; icono?: LucideIcon; derecha?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-white/[0.05] ring-1 ring-black/[0.04] dark:ring-white/10 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
        <div className="text-[14px] font-semibold text-slate-900 dark:text-white flex items-center gap-2 min-w-0">{Icono && <Icono className="w-4 h-4 text-indigo-500 shrink-0" />}<span className="truncate">{titulo}</span></div>
        {derecha && <div className="text-right shrink-0">{derecha}</div>}
      </div>
      {children && <div className="px-4 pb-2">{children}</div>}
    </div>
  );
}

// Importes: recuadros grises con el nombre chico y el número grande (como "You receive").
export function Importes({ items }: { items: { label: string; valor: React.ReactNode; tono?: "normal" | "exito" | "alerta" }[] }) {
  const visibles = items.filter((i) => i.valor !== null && i.valor !== undefined && i.valor !== "");
  if (visibles.length === 0) return null;
  return (
    <div className={`grid gap-2 ${visibles.length >= 3 ? "grid-cols-2 sm:grid-cols-3" : visibles.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
      {visibles.map((i, n) => (
        <div key={i.label} className={`detalle-importe rounded-[22px] px-4 py-3 ${i.tono === "exito" ? "bg-emerald-50 dark:bg-emerald-500/10" : i.tono === "alerta" ? "bg-amber-50 dark:bg-amber-500/10" : "bg-slate-50 dark:bg-white/[0.05]"} ${visibles.length === 3 && n === 2 ? "col-span-2 sm:col-span-1" : ""}`}>
          <p className={`text-[13px] ${i.tono === "exito" ? "text-emerald-700 dark:text-emerald-300" : i.tono === "alerta" ? "text-amber-700 dark:text-amber-300" : "text-slate-500 dark:text-slate-400"}`}>{i.label}</p>
          {/* El monto siempre en un renglón (antes "ARS" quedaba arriba y "5.000.000" abajo). En el celular la letra es un poco
              más chica; un monto largo ("ARS 143.500.000") va más chico también en la computadora (Walter, 12/11/2026). */}
          <p className={`${typeof i.valor === "string" && i.valor.length > 14 ? "text-[14px]" : "text-[16px]"} ${typeof i.valor === "string" && i.valor.length > 12 ? "sm:text-[16px]" : "sm:text-[19px]"} whitespace-nowrap font-medium tracking-tight mt-1 ${i.tono === "exito" ? "text-emerald-600 dark:text-emerald-400" : i.tono === "alerta" ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-white"}`}>{i.valor}</p>
        </div>
      ))}
    </div>
  );
}

export function LineaTiempo({ items }: { items: { titulo: React.ReactNode; detalle?: React.ReactNode; tono?: "exito" | "peligro" | "neutro" | "info" }[] }) {
  if (items.length === 0) return null;
  const color = (t?: string) => (t === "exito" ? TONOS.exito : t === "peligro" ? TONOS.peligro : t === "info" ? TONOS.info : TONOS.neutro);
  return (
    <ol className="space-y-0">
      {items.map((it, i) => (
        <li key={i} className="flex items-center justify-between gap-3 py-2 border-t first:border-t-0 border-slate-200/70 dark:border-white/[0.07]">
          <span className={`inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-full ${color(it.tono)}`}><span className="w-1.5 h-1.5 rounded-full bg-current" />{it.titulo}</span>
          {it.detalle && <span className="text-[12px] text-slate-500 text-right">{it.detalle}</span>}
        </li>
      ))}
    </ol>
  );
}
