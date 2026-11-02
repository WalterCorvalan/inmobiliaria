"use client";

import { useState, useMemo } from "react";
import { supabase2 } from "@/lib/supabase/client";
import { Filter, Search, Bot, User } from "lucide-react";
import LeadDetailModal from "@/components/panel/conversaciones/LeadDetailModal";
import SelectorWeb from "@/components/ui/SelectorWeb";

interface Perfil { id: string; nombre: string; roles: string[] }

const ESTADOS: { value: string; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "asignado", label: "Asignados" },
  { value: "calificando", label: "Calificando" },
  { value: "nuevo", label: "Nuevos" },
  { value: "convertido", label: "Convertidos" },
  { value: "perdido", label: "Perdidos" },
];

const ESTADO_COLOR: Record<string, string> = {
  nuevo: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  asignado: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300",
  calificando: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  convertido: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  perdido: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
};
const CALIFICACION_DOT: Record<string, string> = { caliente: "bg-rose-500", tibio: "bg-amber-500", frio: "bg-slate-300" };

export default function RodiLeadsTab({ conversacionesIniciales, vendedores, miId }: { conversacionesIniciales: any[]; vendedores: Perfil[]; miId: string }) {
  const [conversaciones, setConversaciones] = useState(conversacionesIniciales);
  const [filtro, setFiltro] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [detalleId, setDetalleId] = useState<string | null>(null);

  const actualizarUno = (id: string, patch: any) => setConversaciones((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const filtrados = useMemo(() => {
    let l = conversaciones;
    if (filtro !== "todos") l = l.filter((c) => c.estado_lead === filtro);
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      l = l.filter((c) => [c.nombre_contacto, c.telefono_contacto, c.email_contacto, c.vendedor?.nombre].filter(Boolean).join(" ").toLowerCase().includes(q));
    }
    return l;
  }, [conversaciones, filtro, busqueda]);

  const reasignar = async (conversacionId: string, vendedorId: string) => {
    const nuevoId = vendedorId || null;
    await supabase2.from("rodi_conversaciones").update({ vendedor_id: nuevoId }).eq("id", conversacionId);
    const vendedor = vendedores.find((v) => v.id === nuevoId) || null;
    setConversaciones((prev) => prev.map((c) => (c.id === conversacionId ? { ...c, vendedor_id: nuevoId, vendedor } : c)));
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        {ESTADOS.map((e) => (
          <button key={e.value} onClick={() => setFiltro(e.value)} className={`px-3 py-1.5 text-xs font-bold rounded-full whitespace-nowrap transition-colors ${filtro === e.value ? "bg-[#0145F2] text-white" : "bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10"}`}>
            {e.label}
          </button>
        ))}
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre, teléfono, email, vendedor..." className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none" />
      </div>

      {filtrados.length === 0 ? (
        <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl py-16 flex flex-col items-center justify-center text-center shadow-sm">
          <Bot className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Sin leads del chat web{filtro !== "todos" ? "" : " todavía"}.</p>
          {filtro === "todos" && <p className="text-xs text-slate-400 mt-1 max-w-sm">Cuando un visitante del sitio le escriba al chat, va a aparecer acá. El round-robin asigna inicialmente al vendedor; desde acá podés reasignar.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtrados.map((c) => (
            <button key={c.id} onClick={() => setDetalleId(c.id)} className="text-left bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-rose-300 dark:hover:border-rose-500/40 transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${CALIFICACION_DOT[c.calificacion] || "bg-slate-300"}`} />
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{c.nombre_contacto || "Visitante anónimo"}</p>
                </div>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 ${ESTADO_COLOR[c.estado_lead] || ESTADO_COLOR.nuevo}`}>{c.estado_lead || "nuevo"}</span>
              </div>
              <p className="text-xs text-slate-400 mb-1">{[c.telefono_contacto, c.email_contacto].filter(Boolean).join(" · ") || "Sin datos de contacto todavía"}</p>
              {c.origen_pagina && <p className="text-[10px] text-slate-400 mb-3">📍 {c.origen_pagina}</p>}
              <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <div className="flex-1"><SelectorWeb valor={c.vendedor_id || ""} etiquetaActual={c.vendedor?.nombre} onCambio={(v) => reasignar(c.id, v)} claseBoton="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs font-semibold outline-none" claseFlecha="w-3 h-3" opciones={[{ valor: "", etiqueta: "Sin asignar" }, ...vendedores.map((v) => ({ valor: v.id, etiqueta: v.nombre }))]} /></div>
              </div>
            </button>
          ))}
        </div>
      )}

      {detalleId && (
        <LeadDetailModal key={detalleId} leadId={detalleId} origen="rodi" miId={miId} vendedores={vendedores} onClose={() => setDetalleId(null)} onActualizado={actualizarUno} />
      )}
    </div>
  );
}
