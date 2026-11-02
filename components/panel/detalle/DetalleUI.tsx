"use client";

import { X, type LucideIcon } from "lucide-react";

// Piezas del diseño de las vistas de detalle del panel (pedido de Walter,
// 6/10: "el mismo diseño que la cotización en todas las vistas"). Arriba un
// encabezado con foto/ícono, título e importe grandes; abajo datos en dos
// columnas sin renglones vacíos, títulos de sección chicos, bloques
// destacados y línea de tiempo; las acciones fijas al pie. Sobrio: sin
// gradientes ni animaciones. Si cambiás algo acá, cambia en todas las vistas.

export const BTN = {
  primario: "flex-1 flex items-center justify-center gap-2 bg-[#0145F2] hover:bg-[#0138c9] text-white font-bold text-sm py-2.5 px-3 rounded-xl transition-colors disabled:opacity-50",
  exito: "flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm py-2.5 px-3 rounded-xl transition-colors disabled:opacity-50",
  whatsapp: "flex-1 flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebe5a] text-white font-bold text-sm py-2.5 px-3 rounded-xl transition-colors",
  secundario: "flex-1 flex items-center justify-center gap-2 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 font-semibold text-sm py-2.5 px-3 rounded-xl transition-colors disabled:opacity-50",
  // Seña (pedido de Walter, 16/10): ámbar, para distinguirla de Venta (verde) y de las acciones neutras.
  sena: "flex-1 flex items-center justify-center gap-2 border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 font-semibold text-sm py-2.5 px-3 rounded-xl transition-colors disabled:opacity-50",
  peligro: "flex-1 flex items-center justify-center gap-2 border border-rose-200 dark:border-rose-500/30 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-rose-600 font-semibold text-sm py-2.5 px-3 rounded-xl transition-colors disabled:opacity-50",
  icono: "p-2 rounded-lg border border-slate-200 dark:border-white/10 text-slate-400 hover:text-rose-600 hover:border-rose-200 dark:hover:border-rose-500/30 transition-colors disabled:opacity-50",
};

const TONOS = {
  neutro: "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10",
  exito: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20",
  alerta: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/20",
  peligro: "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/20",
  info: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/20",
};
export type TonoDetalle = keyof typeof TONOS;

export function Etiqueta({ children, tono = "neutro", clase }: { children: React.ReactNode; tono?: TonoDetalle; clase?: string }) {
  return <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${clase || TONOS[tono]}`}>{children}</span>;
}

// Contenedor: fondo, tarjeta con encabezado fijo, cuerpo con scroll y pie fijo.
export function DetalleShell({ onClose, ancho = "max-w-xl", encabezado, pie, children, z = "z-[100]" }: {
  onClose: () => void; ancho?: string; encabezado: React.ReactNode; pie?: React.ReactNode; children: React.ReactNode; z?: string;
}) {
  return (
    <div className={`fixed inset-0 bg-slate-900/50 backdrop-blur-sm ${z} flex items-center justify-center p-4`} onClick={() => onClose()}>
      <div className={`bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 rounded-2xl w-full ${ancho} max-h-[90vh] flex flex-col shadow-2xl overflow-hidden`} onClick={(e) => e.stopPropagation()}>
        {encabezado}
        <div className="px-5 py-5 space-y-6 overflow-y-auto flex-1 min-h-0">{children}</div>
        {pie && <div className="shrink-0 border-t border-slate-100 dark:border-white/10 px-5 py-4 space-y-2 bg-white dark:bg-[#111]">{pie}</div>}
      </div>
    </div>
  );
}

// Encabezado: N°/etiquetas arriba, foto o ícono a la izquierda, título y
// subtítulo, e importe grande abajo a la izquierda con una nota a la derecha.
export function DetalleEncabezado({ numero, etiquetas, foto, icono: Icono, titulo, subtitulo, importe, nota, onClose }: {
  numero?: React.ReactNode; etiquetas?: React.ReactNode; foto?: string | null; icono?: LucideIcon;
  titulo: React.ReactNode; subtitulo?: React.ReactNode; importe?: React.ReactNode; nota?: React.ReactNode; onClose: () => void;
}) {
  return (
    <div className="shrink-0 px-5 pt-5 pb-4 border-b border-slate-100 dark:border-white/10">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          {numero != null && numero !== "" && <span className="font-mono text-xs font-bold text-slate-400">{numero}</span>}
          {etiquetas}
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 -m-1 rounded-lg shrink-0"><X className="w-5 h-5" /></button>
      </div>
      <div className="flex gap-4">
        {(foto !== undefined || Icono) && (
          <div className="w-28 h-20 sm:w-32 sm:h-24 shrink-0 rounded-xl overflow-hidden bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center">
            {foto ? <img src={foto} alt="" className="w-full h-full object-cover" /> : Icono ? <Icono className="w-8 h-8 text-slate-300 dark:text-slate-600" /> : null}
          </div>
        )}
        <div className="min-w-0 flex-1 flex flex-col justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">{titulo}</h2>
            {subtitulo && <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5 min-w-0">{subtitulo}</div>}
          </div>
          {(importe || nota) && (
            <div className="flex items-end justify-between gap-2 mt-2 flex-wrap">
              {importe && <p className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{importe}</p>}
              {nota && <div className="text-[11px] text-slate-400 flex items-center gap-1">{nota}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function TituloSeccion({ children, icono: Icono, accion }: { children: React.ReactNode; icono?: LucideIcon; accion?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2.5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">{Icono && <Icono className="w-3.5 h-3.5" />}{children}</p>
      {accion}
    </div>
  );
}

export function Seccion({ titulo, icono, accion, children }: { titulo: React.ReactNode; icono?: LucideIcon; accion?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <TituloSeccion icono={icono} accion={accion}>{titulo}</TituloSeccion>
      {children}
    </div>
  );
}

// Dato suelto: etiqueta chica arriba, valor abajo. Los vacíos no se muestran.
export function Dato({ label, valor, ancho = false, destacado = false }: { label: string; valor: React.ReactNode; ancho?: boolean; destacado?: boolean }) {
  if (valor === null || valor === undefined || valor === "" || valor === false) return null;
  return (
    <div className={ancho ? "col-span-2" : ""}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <div className={`mt-0.5 whitespace-pre-wrap ${destacado ? "text-sm font-bold text-slate-900 dark:text-white" : "text-[13px] font-medium text-slate-800 dark:text-slate-100"}`}>{valor}</div>
    </div>
  );
}

export function DatosGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-6 gap-y-3.5">{children}</div>;
}

// Texto importante (condiciones, observaciones): bloque con borde azul.
export function BloqueDestacado({ children, tono = "azul" }: { children: React.ReactNode; tono?: "azul" | "ambar" }) {
  const borde = tono === "ambar" ? "border-amber-400" : "border-[#0145F2]";
  return <div className={`text-[13px] leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap border-l-2 ${borde} bg-slate-50 dark:bg-white/[0.03] rounded-r-xl px-4 py-3`}>{children}</div>;
}

// Tarjeta para un ítem dentro de una sección (una permuta, un pago, un documento).
export function Tarjeta({ titulo, icono: Icono, derecha, children }: { titulo: React.ReactNode; icono?: LucideIcon; derecha?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden">
      <div className={`flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 dark:bg-white/[0.03] ${children ? "border-b border-slate-100 dark:border-white/10" : ""}`}>
        <div className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2 min-w-0">{Icono && <Icono className="w-4 h-4 text-indigo-500 shrink-0" />}<span className="truncate">{titulo}</span></div>
        {derecha && <div className="text-right shrink-0">{derecha}</div>}
      </div>
      {children && <div className="px-4 py-3 space-y-3">{children}</div>}
    </div>
  );
}

// Resumen de importes en cajitas (ej. venta / seña / saldo).
export function Importes({ items }: { items: { label: string; valor: React.ReactNode; tono?: "normal" | "exito" | "alerta" }[] }) {
  const visibles = items.filter((i) => i.valor !== null && i.valor !== undefined && i.valor !== "");
  if (visibles.length === 0) return null;
  return (
    <div className={`grid gap-2 ${visibles.length >= 4 ? "grid-cols-2 sm:grid-cols-4" : visibles.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
      {visibles.map((i) => (
        <div key={i.label} className="rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{i.label}</p>
          <p className={`text-sm font-bold mt-0.5 ${i.tono === "exito" ? "text-emerald-600 dark:text-emerald-400" : i.tono === "alerta" ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-white"}`}>{i.valor}</p>
        </div>
      ))}
    </div>
  );
}

export function LineaTiempo({ items }: { items: { titulo: React.ReactNode; detalle?: React.ReactNode; tono?: "exito" | "peligro" | "neutro" | "info" }[] }) {
  if (items.length === 0) return null;
  const color = (t?: string) => (t === "exito" ? "bg-emerald-500" : t === "peligro" ? "bg-rose-500" : t === "info" ? "bg-[#0145F2]" : "bg-slate-300 dark:bg-slate-500");
  return (
    <ol className="relative border-l border-slate-200 dark:border-white/10 ml-1.5 space-y-3">
      {items.map((it, i) => (
        <li key={i} className="pl-4 relative">
          <span className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full ${color(it.tono)}`} />
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">{it.titulo}</div>
          {it.detalle && <div className="text-[10px] text-slate-400">{it.detalle}</div>}
        </li>
      ))}
    </ol>
  );
}
