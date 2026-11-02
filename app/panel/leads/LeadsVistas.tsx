"use client";

import { useMemo, useState } from "react";
import { Bot, User, Flame } from "lucide-react";
import { IconoWhatsapp, IconoInstagram, IconoMessenger } from "@/components/ui/IconosCanales";
import { supabase2 } from "@/lib/supabase/client";
import { m } from "framer-motion";
import { Cascada, CURVA } from "@/components/ui/movimiento";
import { avisar } from "@/components/panel/Dialogos";
import SelectorWeb from "@/components/ui/SelectorWeb";

// Vistas extra del módulo Leads (pedido 3/10/2026, mismas ideas que los tabs de Clientes):
// Pipeline (tablero por estado), Ingresos (cuántos leads entran, por día y por canal) y Ranking (por vendedor).
// Trabajan sobre la lista unificada que arma leads/page.tsx (las 4-5 fuentes ya normalizadas) -- no consultan nada propio,
// salvo mover un lead de columna en el Pipeline, que actualiza la tabla de su canal igual que LeadDetailModal.

type Origen = "whatsapp" | "instagram" | "messenger" | "rodi" | "manual";
export interface LeadVista {
  id: string; origen: Origen; nombre: string; vendedor_id: string | null; calificacion: string | null; estado_lead: string;
  canal_origen: string | null; created_at: string; esBasuraFinal: boolean; sinRespuesta: boolean;
}
interface Perfil { id: string; nombre: string }

const TABLA_POR_ORIGEN: Record<Origen, string> = { whatsapp: "whatsapp_conversaciones", instagram: "instagram_conversaciones", messenger: "messenger_conversaciones", rodi: "rodi_conversaciones", manual: "leads_manuales" };
const FK_POR_ORIGEN: Record<Origen, string> = { whatsapp: "whatsapp_conversacion_id", instagram: "instagram_conversacion_id", messenger: "messenger_conversacion_id", rodi: "rodi_conversacion_id", manual: "leads_manuales_id" };
const ORIGEN_LABEL: Record<Origen, string> = { whatsapp: "WhatsApp", instagram: "Instagram", messenger: "Messenger", rodi: "Chat web", manual: "Manual" };
const ORIGEN_ICON: Record<Origen, any> = { whatsapp: IconoWhatsapp, instagram: IconoInstagram, messenger: IconoMessenger, rodi: Bot, manual: User };
const ORIGEN_COLOR: Record<Origen, string> = { whatsapp: "text-[#25D366]", instagram: "text-[#E4405F]", messenger: "text-[#0084FF]", rodi: "text-indigo-500", manual: "text-slate-400" };
const ORIGEN_BARRA: Record<Origen, string> = { whatsapp: "bg-emerald-500", instagram: "bg-pink-500", messenger: "bg-blue-500", rodi: "bg-indigo-500", manual: "bg-slate-400" };
const CALIFICACION_DOT: Record<string, string> = { caliente: "bg-rose-500", tibio: "bg-amber-500", frio: "bg-slate-300" };

const COLUMNAS: { estado: string; label: string; color: string }[] = [
  { estado: "nuevo", label: "Nuevos", color: "border-t-sky-400" },
  { estado: "asignado", label: "Contactados", color: "border-t-indigo-400" },
  { estado: "calificando", label: "Interesados", color: "border-t-amber-400" },
  { estado: "convertido", label: "Clientes", color: "border-t-emerald-500" },
  { estado: "perdido", label: "Perdidos", color: "border-t-rose-400" },
];

// Día de Argentina (UTC-3) de una fecha ISO, como "AAAA-MM-DD".
const diaAR = (ms: number) => new Date(ms - 3 * 3600000).toISOString().slice(0, 10);
const hoyAR = () => diaAR(Date.now());
function restarDias(dia: string, n: number) { const d = new Date(`${dia}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); }
function fechaCorta(dia: string) { const [, m, d] = dia.split("-"); return `${d}/${m}`; }

// ============================== PIPELINE ==============================
export function PipelineLeads({ leads, vendedores, miId, onAbrir, onMovido }: {
  leads: LeadVista[]; vendedores: Perfil[]; miId: string;
  onAbrir: (id: string, origen: Origen) => void;
  onMovido: (id: string, patch: { estado_lead: string }) => void;
}) {
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [columnaSobre, setColumnaSobre] = useState<string | null>(null);
  const [moviendoId, setMoviendoId] = useState<string | null>(null);
  const [verTodos, setVerTodos] = useState<Record<string, boolean>>({});
  const nombreVendedor = (id: string | null) => (id ? vendedores.find((v) => v.id === id)?.nombre || "—" : "Sin asignar");

  const porColumna = useMemo(() => {
    const m: Record<string, LeadVista[]> = {};
    COLUMNAS.forEach((c) => { m[c.estado] = []; });
    leads.filter((l) => !l.esBasuraFinal).forEach((l) => { (m[l.estado_lead] || m.nuevo).push(l); });
    return m;
  }, [leads]);

  const mover = async (lead: LeadVista, estado: string) => {
    if (estado === lead.estado_lead) return;
    // Perdido pide elegir un motivo de cierre: eso se hace en el detalle del lead.
    if (estado === "perdido") { avisar("Para marcarlo como perdido hay que elegir un motivo. Te abro el lead."); onAbrir(lead.id, lead.origen); return; }
    setMoviendoId(lead.id);
    const { error } = await supabase2.from(TABLA_POR_ORIGEN[lead.origen]).update({ estado_lead: estado }).eq("id", lead.id);
    if (error) { avisar("No se pudo mover el lead."); setMoviendoId(null); return; }
    const etiqueta = COLUMNAS.find((c) => c.estado === estado)?.label || estado;
    await supabase2.from("eventos_lead").insert({ [FK_POR_ORIGEN[lead.origen]]: lead.id, tipo: "estado", descripcion: `Estado cambiado a "${etiqueta}" (desde el tablero)`, creado_por: miId });
    onMovido(lead.id, { estado_lead: estado });
    setMoviendoId(null);
  };

  return (
    <div className="flex-1 min-h-0 overflow-auto p-3 sm:p-4">
      <p className="text-[11px] text-slate-400 mb-3">Arrastrá un lead a otra columna para cambiar su estado (en el celular, usá el selector de la tarjeta). Los leads basura no aparecen acá.</p>
      <div className="flex gap-3 min-w-max md:min-w-0 md:grid md:grid-cols-5 items-start">
        {COLUMNAS.map((col, indiceCol) => {
          const lista = porColumna[col.estado];
          const limite = verTodos[col.estado] ? lista.length : 40;
          return (
            <m.div
              key={col.estado}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: CURVA, delay: indiceCol * 0.06 }}
              onDragOver={(e) => { e.preventDefault(); setColumnaSobre(col.estado); }}
              onDragLeave={() => setColumnaSobre((c) => (c === col.estado ? null : c))}
              onDrop={() => {
                setColumnaSobre(null);
                const lead = leads.find((l) => l.id === arrastrando);
                setArrastrando(null);
                if (lead) mover(lead, col.estado);
              }}
              className={`w-[260px] md:w-auto shrink-0 md:shrink rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 border-t-4 ${col.color} ${columnaSobre === col.estado ? "ring-2 ring-sky-300 dark:ring-sky-500/50" : ""}`}
            >
              <div className="px-3 py-2 flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-wide text-slate-600 dark:text-slate-300">{col.label}</p>
                <span className="text-[11px] font-bold text-slate-400">{lista.length}</span>
              </div>
              <div className="px-2 pb-2 space-y-1.5 max-h-[70vh] overflow-y-auto">
                {lista.slice(0, limite).map((l) => {
                  const Icono = ORIGEN_ICON[l.origen];
                  return (
                    <div
                      key={`${l.origen}-${l.id}`}
                      draggable
                      onDragStart={() => setArrastrando(l.id)}
                      onDragEnd={() => { setArrastrando(null); setColumnaSobre(null); }}
                      onClick={() => onAbrir(l.id, l.origen)}
                      className={`bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-lg p-2.5 cursor-pointer hover:shadow-sm ${moviendoId === l.id ? "opacity-50" : ""} ${arrastrando === l.id ? "opacity-40" : ""}`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Icono className={`w-3.5 h-3.5 shrink-0 ${ORIGEN_COLOR[l.origen]}`} />
                        <p className="text-[13px] font-bold text-slate-800 dark:text-white truncate flex-1">{l.nombre}</p>
                        {l.sinRespuesta && <Flame className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
                        <span className={`w-2 h-2 rounded-full shrink-0 ${CALIFICACION_DOT[l.calificacion || ""] || "bg-slate-200 dark:bg-white/20"}`} title={l.calificacion || "Sin calificar"} />
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1.5">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{nombreVendedor(l.vendedor_id)}</span>
                        <div className="shrink-0" onClick={(e) => e.stopPropagation()}><SelectorWeb ariaLabel="Mover a otra columna" valor={l.estado_lead} onCambio={(v) => mover(l, v)} deshabilitado={moviendoId === l.id} claseBoton="text-[10px] bg-slate-50 dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded px-1 py-0.5 outline-none" claseFlecha="w-3 h-3" opciones={COLUMNAS.map((c) => ({ valor: c.estado, etiqueta: c.label }))} /></div>
                      </div>
                    </div>
                  );
                })}
                {lista.length === 0 && <p className="text-[11px] text-slate-400 text-center py-4">Sin leads</p>}
                {lista.length > limite && (
                  <button onClick={() => setVerTodos((p) => ({ ...p, [col.estado]: true }))} className="w-full text-[11px] font-bold text-sky-600 dark:text-sky-300 py-1.5">Ver los {lista.length - limite} restantes</button>
                )}
              </div>
            </m.div>
          );
        })}
      </div>
    </div>
  );
}

// ============================== INGRESOS ==============================
const PERIODOS = [
  { key: "hoy", label: "Hoy", dias: 0 },
  { key: "ayer", label: "Ayer", dias: 1 },
  { key: "7", label: "7 días", dias: 6 },
  { key: "30", label: "30 días", dias: 29 },
] as const;

export function IngresosLeads({ leads, vendedores }: { leads: LeadVista[]; vendedores: Perfil[] }) {
  const [periodo, setPeriodo] = useState<(typeof PERIODOS)[number]["key"]>("7");
  const hoy = hoyAR();

  const { desde, hasta } = useMemo(() => {
    if (periodo === "hoy") return { desde: hoy, hasta: hoy };
    if (periodo === "ayer") { const a = restarDias(hoy, 1); return { desde: a, hasta: a }; }
    const p = PERIODOS.find((x) => x.key === periodo)!;
    return { desde: restarDias(hoy, p.dias), hasta: hoy };
  }, [periodo, hoy]);

  const delPeriodo = useMemo(() => leads.filter((l) => { const d = diaAR(new Date(l.created_at).getTime()); return d >= desde && d <= hasta; }), [leads, desde, hasta]);

  // Cantidad por día de los últimos 14 días (el gráfico no depende del período elegido, da contexto)
  const porDia = useMemo(() => {
    const mapa: Record<string, number> = {};
    leads.forEach((l) => { const d = diaAR(new Date(l.created_at).getTime()); mapa[d] = (mapa[d] || 0) + 1; });
    return Array.from({ length: 14 }, (_, i) => { const d = restarDias(hoy, 13 - i); return { dia: d, n: mapa[d] || 0 }; });
  }, [leads, hoy]);
  const maxDia = Math.max(1, ...porDia.map((d) => d.n));

  const contar = (clave: (l: LeadVista) => string) => {
    const m: Record<string, number> = {};
    delPeriodo.forEach((l) => { const k = clave(l); m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  };
  const porCanal = contar((l) => l.origen);
  const porFuente = contar((l) => l.canal_origen || "Sin dato");
  const porVendedor = contar((l) => l.vendedor_id || "sin");
  const total = delPeriodo.length;
  const maxCanal = Math.max(1, ...porCanal.map(([, n]) => n));

  const Barra = ({ etiqueta, n, max, clase = "bg-[#0145F2]" }: { etiqueta: string; n: number; max: number; clase?: string }) => (
    <div className="text-xs">
      <div className="flex items-center justify-between gap-2 mb-0.5"><span className="text-slate-600 dark:text-slate-300 truncate">{etiqueta}</span><span className="font-bold text-slate-500 shrink-0">{n} <span className="text-slate-400 font-normal">({total ? Math.round((n / total) * 100) : 0}%)</span></span></div>
      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden"><div className={`h-full rounded-full ${clase}`} style={{ width: `${(n / max) * 100}%` }} /></div>
    </div>
  );

  return (
    <Cascada className="flex-1 min-h-0 overflow-auto p-3 sm:p-4 space-y-4 max-w-5xl">
      <div className="flex items-center gap-1.5 flex-wrap">
        {PERIODOS.map((p) => (
          <button key={p.key} onClick={() => setPeriodo(p.key)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${periodo === p.key ? "bg-slate-800 dark:bg-white text-white dark:text-slate-900 border-transparent" : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300"}`}>{p.label}</button>
        ))}
        <span className="ml-auto text-xs text-slate-400">{fechaCorta(desde)}{desde !== hasta ? ` al ${fechaCorta(hasta)}` : ""}</span>
      </div>

      <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-2xl p-4">
        <p className="text-[10px] font-bold uppercase text-slate-400">Leads que entraron</p>
        <p className="text-3xl font-black text-slate-900 dark:text-white font-mono">{total}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">Incluye todos los canales y los que se marcaron como basura.</p>
      </div>

      <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-2xl p-4">
        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-3">Últimos 14 días</p>
        <div className="flex items-end gap-1 h-28">
          {porDia.map((d) => (
            <div key={d.dia} className="flex-1 flex flex-col items-center justify-end h-full gap-1 min-w-0" title={`${fechaCorta(d.dia)}: ${d.n}`}>
              <span className="text-[9px] text-slate-400">{d.n || ""}</span>
              <div className={`w-full rounded-t ${d.dia >= desde && d.dia <= hasta ? "bg-[#0145F2]" : "bg-slate-200 dark:bg-white/15"}`} style={{ height: `${Math.max(d.n ? 4 : 1, (d.n / maxDia) * 80)}px` }} />
              <span className="text-[9px] text-slate-400 hidden sm:block">{d.dia.slice(8)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-2xl p-4 space-y-2.5">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Por canal</p>
          {porCanal.length === 0 ? <p className="text-xs text-slate-400">Sin leads en este período.</p> : porCanal.map(([k, n]) => <Barra key={k} etiqueta={ORIGEN_LABEL[k as Origen] || k} n={n} max={maxCanal} clase={ORIGEN_BARRA[k as Origen] || "bg-[#0145F2]"} />)}
        </div>
        <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-2xl p-4 space-y-2.5">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Por origen (anuncio, web, etc.)</p>
          {porFuente.length === 0 ? <p className="text-xs text-slate-400">Sin leads en este período.</p> : porFuente.slice(0, 8).map(([k, n]) => <Barra key={k} etiqueta={k} n={n} max={porFuente[0][1]} />)}
        </div>
        <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-2xl p-4 space-y-2.5">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Por vendedor</p>
          {porVendedor.length === 0 ? <p className="text-xs text-slate-400">Sin leads en este período.</p> : porVendedor.slice(0, 8).map(([k, n]) => <Barra key={k} etiqueta={k === "sin" ? "Sin asignar" : vendedores.find((v) => v.id === k)?.nombre || "—"} n={n} max={porVendedor[0][1]} />)}
        </div>
      </div>
    </Cascada>
  );
}

// ============================== RANKING ==============================
export function RankingLeads({ leads, vendedores }: { leads: LeadVista[]; vendedores: Perfil[] }) {
  const filas = useMemo(() => {
    const m = new Map<string, { id: string | null; nombre: string; total: number; sinContactar: number; contactados: number; interesados: number; clientes: number; perdidos: number; sinRespuesta: number}>();
    const get = (id: string | null) => {
      const k = id || "sin";
      if (!m.has(k)) m.set(k, { id, nombre: id ? vendedores.find((v) => v.id === id)?.nombre || "—" : "Sin asignar", total: 0, sinContactar: 0, contactados: 0, interesados: 0, clientes: 0, perdidos: 0, sinRespuesta: 0 });
      return m.get(k)!;
    };
    leads.filter((l) => !l.esBasuraFinal).forEach((l) => {
      const f = get(l.vendedor_id);
      f.total += 1;
      if (l.estado_lead === "nuevo") f.sinContactar += 1;
      else if (l.estado_lead === "asignado") f.contactados += 1;
      else if (l.estado_lead === "calificando") f.interesados += 1;
      else if (l.estado_lead === "convertido") f.clientes += 1;
      else if (l.estado_lead === "perdido") f.perdidos += 1;
      if (l.sinRespuesta) f.sinRespuesta += 1;
    });
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [leads, vendedores]);

  return (
    <Cascada className="flex-1 min-h-0 overflow-auto p-3 sm:p-4 max-w-5xl space-y-3">
      <p className="text-[11px] text-slate-400">Por vendedor, sobre todos los leads cargados (sin los marcados como basura).</p>
      <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-[9px] sm:text-[10px] uppercase tracking-tight sm:tracking-widest text-slate-400 bg-slate-50 dark:bg-white/[0.03]">
              <th className="px-2 sm:px-3 py-2 font-bold">Vendedor</th>
              <th className="px-1 sm:px-3 py-2 font-bold text-right">Leads</th>
              <th className="px-1 sm:px-3 py-2 font-bold text-right">Sin contac.</th>
              <th className="px-1 sm:px-3 py-2 font-bold text-right hidden sm:table-cell">Perdidos</th>
              <th className="px-1 sm:px-3 py-2 font-bold text-right">Sin resp.</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id || "sin"} className="border-t border-slate-100 dark:border-white/5">
                <td className="px-2 sm:px-3 py-2 font-bold text-slate-700 dark:text-slate-200">{f.nombre}</td>
                <td className="px-1 sm:px-3 py-2 text-right font-mono">{f.total}</td>
                <td className={`px-1 sm:px-3 py-2 text-right font-mono ${f.sinContactar > 0 ? "text-amber-600 font-bold" : ""}`}>{f.sinContactar}</td>
                <td className="px-1 sm:px-3 py-2 text-right font-mono hidden sm:table-cell">{f.perdidos}</td>
                <td className={`px-1 sm:px-3 py-2 text-right font-mono ${f.sinRespuesta > 0 ? "text-rose-600 font-bold" : ""}`}>{f.sinRespuesta}</td>
              </tr>
            ))}
            {filas.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">Todavía no hay leads.</td></tr>}
          </tbody>
        </table>
      </div>
    </Cascada>
  );
}
