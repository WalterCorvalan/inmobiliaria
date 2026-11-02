"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { destinoAlerta } from "@/lib/panel/destinoAlerta";
import { supabase2 } from "@/lib/supabase/client";
import { Bell, Check, ExternalLink } from "lucide-react";
import { TIPOS_RESUMEN, IconoAlerta, colorIconoAlerta } from "./alertaMeta";
import { agruparAlertas, type AlertaAgrupada } from "@/lib/panel/agruparAlertas";
import { alertaApagada } from "@/lib/panel/nivelesAlertas";
import ResumenAlertaModal from "./ResumenAlertaModal";
import { primerRenglon } from "@/components/panel/VistaPreviaResumen";

interface AlertaRaw {
  id: string; tipo: string; prioridad: string; titulo: string; mensaje: string | null; link: string | null; leida: boolean; created_at: string;
}
type Alerta = AlertaAgrupada<AlertaRaw>;

function tiempoRelativo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

export default function NotificationBell({ miId }: { miId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [sinLeer, setSinLeer] = useState(0);
  const [alertaModal, setAlertaModal] = useState<Alerta | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // El contador va aparte de la lista visible (limitada a 8): si hay más de
  // 8 alertas mezcladas entre leídas y no leídas, contar solo sobre las 8
  // más recientes podía mostrar un número más bajo que el real.
  // Lo que la persona apagó en Mi perfil → Notificaciones no se muestra ni se cuenta (27/10/2026): las alertas que crea
  // la base (mensajes, derivaciones) se guardan igual, así que se filtran acá.
  const apagadas = useRef<string[]>([]);
  const cargar = async () => {
    if (!miId) return;
    const [{ data }, { data: noLeidas }, { data: prefs }] = await Promise.all([
      supabase2.from("alertas").select("*").eq("destinatario_id", miId).order("created_at", { ascending: false }).limit(40),
      supabase2.from("alertas").select("tipo").eq("destinatario_id", miId).eq("leida", false).limit(1000),
      supabase2.from("espacio_notif_prefs").select("desactivadas").eq("perfil_id", miId).maybeSingle(),
    ]);
    apagadas.current = prefs?.desactivadas || [];
    setAlertas(agruparAlertas((data || []).filter((a) => !alertaApagada(a.tipo, apagadas.current)).slice(0, 8)));
    setSinLeer((noLeidas || []).filter((a) => !alertaApagada(a.tipo, apagadas.current)).length);
  };

  useEffect(() => { cargar(); }, [miId]);

  useEffect(() => {
    if (!miId) return;
    const canal = supabase2
      .channel(`bell-${miId}-${Math.random().toString(36).slice(2)}`)
      // INSERT aparte de "*" -- una alerta nueva de verdad dispara además un
      // toast visible (ToastHost), no solo el número de la campana. Un
      // UPDATE (ej: marcar leída) no debe volver a mostrar el toast.
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alertas", filter: `destinatario_id=eq.${miId}` }, (payload: any) => {
        const nueva = payload.new;
        // Antes solo se mandaba "titulo" (ej: "Nueva cotización — Juan
        // Pérez") y el toast se quedaba corto -- casi todas las alertas ya
        // traen el detalle explicativo en "mensaje" (ej: "Fede creó una
        // cotización por USD 15.000"), pero nunca llegaba al toast. Se manda
        // todo lo que el toast necesita para verse completo.
        if (nueva?.titulo && !alertaApagada(nueva.tipo, apagadas.current)) {
          window.dispatchEvent(new CustomEvent("app-toast-alerta", {
            detail: { id: nueva.id, titulo: nueva.titulo, mensaje: nueva.mensaje, link: nueva.link, tipo: nueva.tipo, prioridad: nueva.prioridad },
          }));
        }
        cargar();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "alertas", filter: `destinatario_id=eq.${miId}` }, cargar)
      .subscribe();
    return () => { supabase2.removeChannel(canal); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miId]);

  useEffect(() => {
    if (!open) return;
    const onClickFuera = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClickFuera);
    return () => document.removeEventListener("mousedown", onClickFuera);
  }, [open]);

  const marcarTodas = async () => {
    setAlertas((prev) => prev.map((a) => ({ ...a, leida: true })));
    setSinLeer(0);
    await supabase2.from("alertas").update({ leida: true }).eq("destinatario_id", miId).eq("leida", false);
  };

  const abrirAlerta = async (a: Alerta) => {
    if (!a.leida) {
      setAlertas((prev) => prev.map((x) => (x.id === a.id ? { ...x, leida: true } : x)));
      setSinLeer((n) => Math.max(0, n - a.idsGrupo.length));
      await supabase2.from("alertas").update({ leida: true }).in("id", a.idsGrupo);
    }
    setOpen(false);
    // Mismo criterio que AlertasClient.tsx (Centro de Alertas): las de
    // resumen (día/semana/mes) traen todo el contenido en su propio
    // "mensaje" -- clickearlas acá navegaba directo al link sin mostrarlo,
    // a diferencia del Centro de Alertas que ya abre un modal.
    if (TIPOS_RESUMEN.has(a.tipo)) { setAlertaModal(a); return; }
    if (a.link) router.push(destinoAlerta(a.link) ?? a.link);
  };

  const irAlDetalleDesdeModal = (a: Alerta) => {
    setAlertaModal(null);
    if (a.link) router.push(destinoAlerta(a.link) ?? a.link);
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-300 shrink-0" title="Notificaciones">
        <Bell className="w-4 h-4" />
        {sinLeer > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#0145F2] text-white text-[9px] font-bold flex items-center justify-center">
            {sinLeer}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-2xl shadow-[0_12px_40px_rgb(0,0,0,0.15)] z-50 overflow-hidden animate-toastIn">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 dark:border-white/10 bg-gradient-to-r from-slate-50 to-white dark:from-white/[0.03] dark:to-transparent">
            <span className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white">
              <span className="w-7 h-7 rounded-full bg-[#0145F2]/10 text-[#0145F2] dark:bg-[#0145F2]/20 flex items-center justify-center"><Bell className="w-3.5 h-3.5" /></span>
              Notificaciones {sinLeer > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#0145F2] text-white">{sinLeer}</span>}
            </span>
            {sinLeer > 0 && <button onClick={marcarTodas} className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-rose-600 transition-colors"><Check className="w-3 h-3" /> Marcar todas</button>}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {alertas.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 px-4">
                <span className="w-11 h-11 rounded-full bg-slate-100 dark:bg-white/5 text-slate-300 dark:text-slate-500 flex items-center justify-center"><Bell className="w-5 h-5" /></span>
                <p className="text-xs font-semibold text-slate-400">Estás al día</p>
                <p className="text-[11px] text-slate-400 text-center">No tenés notificaciones nuevas.</p>
              </div>
            ) : (
              alertas.map((a) => {
                const color = colorIconoAlerta(a.tipo, a.link);
                return (
                  <button key={a.id} onClick={() => abrirAlerta(a)} className={`relative w-full flex items-start gap-3 px-4 py-3.5 text-left border-b border-slate-50 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors ${!a.leida ? "bg-slate-50/60 dark:bg-white/[0.03]" : ""}`}>
                    {!a.leida && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#0145F2]" />}
                    <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ring-4 ring-white dark:ring-[#1A1A1A] shadow-sm ${color}`}><IconoAlerta tipo={a.tipo} link={a.link} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className={`text-xs truncate ${!a.leida ? "font-bold text-slate-900 dark:text-white" : "font-semibold text-slate-700 dark:text-slate-300"}`}>{a.titulo}</span>
                        {a.contador > 1 && <span className="shrink-0 text-[10px] font-bold px-1.5 rounded-full bg-[#0145F2] text-white">x{a.contador}</span>}
                      </span>
                      {a.mensaje && <span className="block text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5 line-clamp-2">{TIPOS_RESUMEN.has(a.tipo) ? primerRenglon(a.mensaje) : a.mensaje}</span>}
                      <span className="block text-[10px] text-slate-400 mt-1 font-medium">{tiempoRelativo(a.created_at)}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <a href="/panel/alertas" onClick={() => setOpen(false)} className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 border-t border-slate-100 dark:border-white/10 transition-colors">
            Ver Centro de Alertas <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {alertaModal && (
        <ResumenAlertaModal alerta={alertaModal} onClose={() => setAlertaModal(null)} onVerMas={() => irAlDetalleDesdeModal(alertaModal)} />
      )}
    </div>
  );
}
