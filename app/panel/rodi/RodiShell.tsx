"use client";

import { useState } from "react";
import RodiBandeja from "./RodiBandeja";
import RodiLeadsTab from "./RodiLeadsTab";
import { Crossfade } from "@/components/ui/movimiento";

interface Perfil { id: string; nombre: string; roles: string[] }

export default function RodiShell({ conversacionesIniciales, vendedores, miId }: { conversacionesIniciales: any[]; vendedores: Perfil[]; miId: string }) {
  const [tab, setTab] = useState<"bandeja" | "leads">("bandeja");
  const leadsConConversacion = conversacionesIniciales.filter((c) => c.estado_lead && c.estado_lead !== "nuevo").length;

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-white dark:bg-[#0A0A0A]">
      {/* Misma barra que WhatsApp, Instagram y Messenger (ConversacionesShell.tsx; Walter, 27/10/2026). */}
      <div className="px-4 py-2 border-b border-slate-200 dark:border-white/10 shrink-0 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          {[{ v: "bandeja" as const, l: "Bandeja" }, { v: "leads" as const, l: "Leads" }].map((t) => (
            <button key={t.v} onClick={() => setTab(t.v)} className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${tab === t.v ? "bg-slate-900 dark:bg-white/10 text-white" : "bg-white dark:bg-transparent border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"}`}>
              {t.l}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <p className="text-[10px] text-slate-400 shrink-0 hidden sm:block">{leadsConConversacion} lead{leadsConConversacion === 1 ? "" : "s"} con conversación</p>
          <h1 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 shrink-0">
            <img src="/icons/panel/rodi.png" alt="" className="w-4 h-4 object-contain shrink-0" /> Paffy (chat web)
          </h1>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <Crossfade id={tab} className="h-full" classNameInterno="h-full">
        {tab === "bandeja" ? <RodiBandeja conversacionesIniciales={conversacionesIniciales} vendedores={vendedores} miId={miId} /> : <RodiLeadsTab conversacionesIniciales={conversacionesIniciales} vendedores={vendedores} miId={miId} />}
        </Crossfade>
      </div>
    </div>
  );
}
