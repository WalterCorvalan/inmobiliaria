"use client";

import { useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";

// Índice de pasos de los formularios largos del panel (nació en
// NuevaVentaModal.tsx). Tres piezas que se usan juntas:
//
//   const p = usePasosFormulario(pasos, "sena");
//   <BarraPasos pasos={pasos} activo={p.pasoActivo} onIr={p.irAPaso} />
//   <div ref={p.cuerpoRef} onScroll={p.alScrollear} className="... overflow-y-auto">
//     <TituloPaso prefijo="sena" id="datos" n={p.nPaso("datos")} titulo="Datos" icono={User} primero />
//
// Es solo presentación: no sabe nada de qué se guarda ni de los cálculos.
// `prefijo` evita que dos formularios abiertos a la vez (o un modal arriba de
// otro) compartan ids de DOM: cada formulario usa el suyo.

export interface PasoFormulario {
  id: string;
  label: string;
  icono: LucideIcon;
}

// T es el elemento que scrollea (por defecto un div; en Stock es el propio <form>).
export function usePasosFormulario<T extends HTMLElement = HTMLDivElement>(pasos: PasoFormulario[], prefijo: string) {
  const cuerpoRef = useRef<T>(null);
  const [pasoActivo, setPasoActivo] = useState(pasos[0]?.id ?? "");

  const idDeDom = (id: string) => `${prefijo}-paso-${id}`;
  const nPaso = (id: string) => pasos.findIndex((x) => x.id === id) + 1;

  // Desplaza el cuerpo del formulario, suave, hasta la sección elegida.
  const irAPaso = (id: string) => {
    const cont = cuerpoRef.current;
    const el = document.getElementById(idDeDom(id));
    if (!cont || !el) return;
    cont.scrollTo({ top: el.getBoundingClientRect().top - cont.getBoundingClientRect().top + cont.scrollTop - 8, behavior: "smooth" });
  };

  // Resalta el paso en el que está el usuario mientras scrollea. Al llegar al
  // final del cuerpo queda marcado el último, aunque su título no alcance el tope.
  const alScrollear = () => {
    const cont = cuerpoRef.current;
    if (!cont || pasos.length === 0) return;
    const tope = cont.getBoundingClientRect().top + 60;
    let actual = pasos[0].id;
    for (const x of pasos) {
      const el = document.getElementById(idDeDom(x.id));
      if (el && el.getBoundingClientRect().top <= tope) actual = x.id;
    }
    if (cont.scrollTop + cont.clientHeight >= cont.scrollHeight - 4) actual = pasos[pasos.length - 1].id;
    if (actual !== pasoActivo) setPasoActivo(actual);
  };

  return { cuerpoRef, pasoActivo, nPaso, irAPaso, alScrollear };
}

// Barra de chips numerados con ícono, arriba del formulario.
export function BarraPasos({ pasos, activo, onIr }: { pasos: PasoFormulario[]; activo: string; onIr: (id: string) => void }) {
  return (
    <nav className="flex gap-1 px-6 pb-3 overflow-x-auto shrink-0 [scrollbar-width:none]">
      {pasos.map((x, i) => {
        const Icono = x.icono;
        return (
          <button key={x.id} type="button" onClick={() => onIr(x.id)} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors ${activo === x.id ? "bg-[#0145F2]/10 text-[#0145F2]" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"}`}>
            <span className={`w-4 h-4 rounded-full text-[9px] flex items-center justify-center ${activo === x.id ? "bg-[#0145F2] text-white" : "bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-slate-300"}`}>{i + 1}</span>
            <Icono className="w-3.5 h-3.5 hidden sm:block" /> {x.label}
          </button>
        );
      })}
    </nav>
  );
}

// Título de cada sección: número + ícono + título + línea divisoria.
export function TituloPaso({ prefijo, id, n, titulo, icono: Icono, primero }: { prefijo: string; id: string; n: number; titulo: string; icono: LucideIcon; primero?: boolean }) {
  return (
    <div id={`${prefijo}-paso-${id}`} className={`flex items-center gap-2.5 ${primero ? "" : "pt-4"}`}>
      <span className="w-6 h-6 rounded-full bg-[#0145F2]/10 text-[#0145F2] text-[11px] font-black flex items-center justify-center shrink-0">{n}</span>
      <p className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5 whitespace-nowrap"><Icono className="w-4 h-4 text-slate-400" /> {titulo}</p>
      <div className="flex-1 h-px bg-slate-200 dark:bg-white/10" />
    </div>
  );
}
