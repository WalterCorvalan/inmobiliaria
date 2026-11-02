"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { destinoAlerta } from "@/lib/panel/destinoAlerta";
import { CheckCircle2, XCircle, Info, X, ArrowRight } from "lucide-react";
import type { ToastTipo } from "@/lib/toast";
import { textoVerAlerta, IconoAlerta, colorIconoAlerta } from "./alertaMeta";
import { reproducirSonidoNotificacion } from "@/lib/panel/sonidoNotificacion";

interface Toast {
  id: number;
  mensaje: string;
  tipo: ToastTipo | "alerta";
  link?: string | null;
  // Solo para tipo "alerta" -- el resto de los toasts (guardar, borrar, etc.
  // vía lib/toast.ts) no tienen esta info porque son acciones puntuales del
  // usuario, no avisos de otra persona.
  titulo?: string;
  tipoAlerta?: string;
  prioridad?: string;
  contador?: number;
}

const ICONO: Record<Exclude<Toast["tipo"], "alerta">, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const COLOR: Record<Exclude<Toast["tipo"], "alerta">, string> = {
  success: "bg-emerald-600 text-white",
  error: "bg-rose-600 text-white",
  info: "bg-slate-800 dark:bg-white/10 text-white",
};

// Acento por prioridad (alertas.prioridad) -- independiente del color por
// tipo (TIPO_COLOR, que identifica DE QUÉ MÓDULO viene). Esto identifica
// QUÉ TAN URGENTE es, con un borde lateral en vez de repintar todo el toast.
const BORDE_PRIORIDAD: Record<string, string> = {
  alta: "border-l-4 border-l-rose-500",
  media: "border-l-4 border-l-amber-500",
  baja: "border-l-4 border-l-slate-400",
  novedad: "border-l-4 border-l-indigo-500",
};
const BARRA_PRIORIDAD: Record<string, string> = {
  alta: "bg-rose-500",
  media: "bg-amber-500",
  baja: "bg-slate-400",
  novedad: "bg-indigo-500",
};

const DURACION_MS: Record<Toast["tipo"], number> = {
  success: 12000,
  error: 12000,
  info: 12000,
  alerta: 12000,
};

let contador = 0;

// Montado una vez en el layout del panel -- escucha el evento global
// "app-toast" (lib/toast.ts) para acciones puntuales del usuario (guardar,
// borrar, etc.) y también "app-toast-alerta" (NotificationBell) para avisar
// en el momento que llega una notificación nueva, no solo cuando el usuario
// mira la campana y ve el número cambiado.
export default function ToastHost() {
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const agregar = (mensaje: string, tipo: Toast["tipo"], extra?: Partial<Toast>) => {
      const id = ++contador;
      setToasts((prev) => [...prev, { id, mensaje, tipo, ...extra }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), DURACION_MS[tipo]);
    };

    const onToast = (e: Event) => {
      const { mensaje, tipo } = (e as CustomEvent).detail || {};
      if (mensaje) agregar(mensaje, tipo || "info");
    };
    // NotificationBell se monta 2 veces (topbar mobile + desktop) y ambas
    // instancias escuchan el mismo INSERT de Supabase Realtime -- sin este
    // dedupe por id de alerta, cada notificación nueva mostraba 2 toasts.
    const idsMostrados = new Set<string>();
    const onAlerta = (e: Event) => {
      const { id: idAlerta, titulo, mensaje, link, tipo: tipoAlerta, prioridad } = (e as CustomEvent).detail || {};
      if (!titulo) return;
      if (idAlerta) {
        if (idsMostrados.has(idAlerta)) return;
        idsMostrados.add(idAlerta);
      }
      reproducirSonidoNotificacion();
      // Si llegan varias alertas del mismo tipo casi juntas (ej: 3 leads
      // nuevos seguidos), agrupar en un solo toast con contador en vez de
      // apilar uno por cada una -- mismo criterio que la campana
      // (agruparAlertas.ts), pero acá alcanza con mirar los toasts ya
      // visibles en vez de volver a consultar la base.
      setToasts((prev) => {
        const yaVisible = prev.find((t) => t.tipo === "alerta" && t.tipoAlerta === tipoAlerta && t.titulo === titulo);
        if (yaVisible) {
          return prev.map((t) => (t.id === yaVisible.id ? { ...t, contador: (t.contador || 1) + 1, link } : t));
        }
        const id = ++contador;
        setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), DURACION_MS.alerta);
        return [...prev, { id, mensaje: mensaje || titulo, tipo: "alerta", titulo, tipoAlerta, prioridad, link }];
      });
    };

    window.addEventListener("app-toast", onToast);
    window.addEventListener("app-toast-alerta", onAlerta);
    return () => {
      window.removeEventListener("app-toast", onToast);
      window.removeEventListener("app-toast-alerta", onAlerta);
    };
  }, []);

  const cerrar = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));
  const ir = (t: Toast) => { if (t.link) { router.push(destinoAlerta(t.link) ?? t.link); cerrar(t.id); } };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => {
        if (t.tipo === "alerta") {
          const colorIcono = colorIconoAlerta(t.tipoAlerta, t.link);
          const borde = BORDE_PRIORIDAD[t.prioridad || "novedad"] || BORDE_PRIORIDAD.novedad;
          return (
            <div key={t.id} className={`relative overflow-hidden pointer-events-auto flex items-start gap-3 px-4 pt-3.5 pb-3 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] animate-toastIn bg-white/95 dark:bg-[#1A1A1A]/95 backdrop-blur-sm border border-slate-200 dark:border-white/10 ${borde}`}>
              <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ring-4 ring-white dark:ring-[#1A1A1A] shadow-sm ${colorIcono}`}><IconoAlerta tipo={t.tipoAlerta} link={t.link} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate flex-1">{t.titulo}</p>
                  {(t.contador || 1) > 1 && <span className="shrink-0 text-[10px] font-bold px-1.5 rounded-full bg-[#0145F2] text-white">x{t.contador}</span>}
                </div>
                {t.mensaje && t.mensaje !== t.titulo && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-1 line-clamp-2">{t.mensaje}</p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  {t.link && (
                    <button onClick={() => ir(t)} className="flex items-center gap-1 text-[11px] font-bold text-[#0145F2] dark:text-sky-400 hover:underline">
                      {textoVerAlerta(t.tipoAlerta, t.link, "Ver")} <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                  <span className="text-[10px] text-slate-400">recién</span>
                </div>
              </div>
              <button onClick={() => cerrar(t.id)} className="shrink-0 p-1 -m-1 rounded-md text-slate-300 hover:text-slate-500 dark:hover:text-slate-300 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
              <div className={`absolute bottom-0 left-0 h-[3px] opacity-70 animate-toastBar ${BARRA_PRIORIDAD[t.prioridad || "novedad"] || BARRA_PRIORIDAD.novedad}`} style={{ animationDuration: `${DURACION_MS.alerta}ms` }} />
            </div>
          );
        }

        const Icon = ICONO[t.tipo];
        return (
          <div
            key={t.id}
            onClick={() => ir(t)}
            className={`relative overflow-hidden pointer-events-auto flex items-start gap-3 px-4 pt-3 pb-3 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.16)] animate-toastIn ${COLOR[t.tipo]} ${t.link ? "cursor-pointer" : ""}`}
          >
            <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-white/15">
              <Icon className="w-4 h-4" />
            </span>
            <p className="text-xs font-semibold leading-snug flex-1 pt-1">{t.mensaje}</p>
            <button onClick={(e) => { e.stopPropagation(); cerrar(t.id); }} className="shrink-0 p-1 -m-1 rounded-md opacity-70 hover:opacity-100 transition-opacity">
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="absolute bottom-0 left-0 h-[3px] bg-white/40 animate-toastBar" style={{ animationDuration: `${DURACION_MS[t.tipo]}ms` }} />
          </div>
        );
      })}
    </div>
  );
}
