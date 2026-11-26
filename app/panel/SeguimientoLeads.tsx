"use client";

import Link from "next/link";
import { useState } from "react";
import IconoPanel from "@/components/panel/IconoPanel";

// Seguimiento de leads de la pantalla de Inicio (rediseño 26/11/2026, con las capturas de referencia de Walter): pestañas
// Todos / Calientes / Tibios / Nuevos y, en cada lead, los botones para seguirlo sin entrar a la ficha.
export interface LeadSeguimiento {
  id: string;
  canal: string;
  nombre: string;
  calificacion: string | null;
  estado: string;
  detalle: string;
  telefono: string | null;
  sinLeer: number;
}

const PESTANAS = [
  { id: "todos", texto: "Todos" },
  { id: "caliente", texto: "Calientes" },
  { id: "tibio", texto: "Tibios" },
  { id: "nuevo", texto: "Nuevos" },
] as const;

const TEMP: Record<string, { texto: string; clase: string }> = {
  caliente: { texto: "Caliente", clase: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30" },
  tibio: { texto: "Tibio", clase: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30" },
  frio: { texto: "Frío", clase: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30" },
};

const COLORES_AVATAR = ["#E0E7FF:#3730A3", "#FCE7F3:#9D174D", "#DCFCE7:#166534", "#FEF3C7:#92400E", "#E0F2FE:#075985", "#EDE9FE:#5B21B6"];
function avatar(nombre: string) {
  let h = 0;
  for (const c of nombre) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [fondo, letra] = COLORES_AVATAR[h % COLORES_AVATAR.length].split(":");
  const ini = nombre.replace("@", "").split(/[\s._]+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
  return { fondo, letra, ini: ini || "?" };
}

export default function SeguimientoLeads({ leads, rutaAgendar }: { leads: LeadSeguimiento[]; rutaAgendar: string }) {
  const [pestana, setPestana] = useState<(typeof PESTANAS)[number]["id"]>("todos");
  const cuenta = (id: string) => (id === "todos" ? leads.length : id === "nuevo" ? leads.filter((l) => l.estado === "nuevo").length : leads.filter((l) => l.calificacion === id).length);
  const visibles = leads.filter((l) => pestana === "todos" || (pestana === "nuevo" ? l.estado === "nuevo" : l.calificacion === pestana)).slice(0, 4);

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1.5 px-4 md:px-5 pt-3 overflow-x-auto [scrollbar-width:none]" role="tablist" aria-label="Filtrar leads">
        {PESTANAS.map((p) => (
          <button key={p.id} type="button" role="tab" aria-selected={pestana === p.id} onClick={() => setPestana(p.id)}
            className={`shrink-0 h-7 px-2.5 rounded-md text-[12px] font-semibold transition-colors ${pestana === p.id ? "menu-activo text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300"}`}>
            {p.texto} <span className="opacity-70 tabular-nums">({cuenta(p.id)})</span>
          </button>
        ))}
      </div>
      {visibles.length === 0 ? (
        <p className="px-5 py-10 text-center text-[13px] text-slate-400">No hay leads en esta pestaña.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-white/[0.06] mt-2">
          {visibles.map((l) => {
            const a = avatar(l.nombre);
            const t = TEMP[l.calificacion || ""];
            const ficha = `/panel/leads?lead=${l.id}&origen=${l.canal}`;
            return (
              <li key={`${l.canal}-${l.id}`} className="px-4 md:px-5 py-3">
                <div className="flex items-start gap-3">
                  <span className="relative shrink-0 w-9 h-9 rounded-full grid place-items-center text-[12px] font-bold" style={{ background: a.fondo, color: a.letra }}>
                    {a.ini}
                    {l.sinLeer > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold grid place-items-center ring-2 ring-white dark:ring-[#131316]">{l.sinLeer}</span>}
                  </span>
                  <Link href={ficha} className="min-w-0 flex-1 group">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[13.5px] font-semibold text-slate-900 dark:text-white group-hover:underline">{l.nombre}</span>
                      {t && <span className={`shrink-0 rounded-full px-2 py-px text-[10.5px] font-semibold ring-1 ring-inset ${t.clase}`}>{t.texto}</span>}
                    </span>
                    <span className="block truncate text-[12px] text-slate-500 dark:text-slate-400">{l.detalle}</span>
                  </Link>
                </div>
                <div className="mt-2 ml-12 flex gap-1">
                  {l.telefono && (
                    <a href={`https://wa.me/${l.telefono.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-[#E2E5EA] dark:border-white/10 text-[12px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5">
                      <IconoPanel src="/icons/panel/whatsapp.png" alt="" className="w-3.5 h-3.5" /> WhatsApp
                    </a>
                  )}
                  <Link href={ficha} className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-[#E2E5EA] dark:border-white/10 text-[12px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5">
                    <IconoPanel src="/icons/panel/mensajes.png" alt="" className="w-3.5 h-3.5" /> Responder
                  </Link>
                  <Link href={rutaAgendar} className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-[#E2E5EA] dark:border-white/10 text-[12px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5">
                    <IconoPanel src="/icons/panel/calendario.png" alt="" className="w-3.5 h-3.5" /> Agendar
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
