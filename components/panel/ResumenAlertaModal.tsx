"use client";

import { X, ArrowRight } from "lucide-react";
import { textoVerAlerta } from "./alertaMeta";
import { parsearResumen, type SeccionResumen } from "@/lib/panel/parsearResumen";

// Modal de detalle para alertas de "resumen" (mi_resumen_diario, resumen_diario, mi_resumen_semanal, informe de
// marketing...). El texto lo arma el cron ("EMOJI Título: valor" por línea, y listas con "•"); lib/panel/parsearResumen.ts
// lo separa y acá se dibuja ordenado.
//
// Historia: 1/10 pasó de texto crudo a una fila por línea con el título en negrita; 5/10 se simplificó (sin degradé
// ni tarjeta por renglón). 16/10 (Walter, con el informe de marketing): la información estaba bien pero se leía como
// un párrafo largo. Ahora cada dato muestra el título chico arriba y el valor grande abajo, los canales o términos van
// como etiquetas, y las listas (sugerencias, qué revisar afuera) van en un bloque aparte. El contenido no cambia.
interface AlertaResumen {
  tipo: string;
  titulo: string;
  mensaje: string | null;
  link: string | null;
}

// Extrae "4/10" del título ("Resumen del día — 4/10") para mostrarlo más grande arriba.
function extraerFecha(titulo: string): { base: string; fecha: string | null } {
  const partes = titulo.split("—").map((p) => p.trim());
  if (partes.length === 2 && /^\d{1,2}\/\d{1,2}$/.test(partes[1])) return { base: partes[0], fecha: partes[1] };
  return { base: titulo, fecha: null };
}

// Un valor corto ("32", "0", "1 agendada…") se lee grande; una frase larga, en tamaño normal.
const esCorto = (t: string) => t.length <= 48;

function Dato({ s }: { s: SeccionResumen }) {
  return (
    <div className="flex items-start gap-3 py-3.5">
      <span className="w-8 h-8 shrink-0 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center text-base leading-none">{s.emoji}</span>
      <div className="min-w-0 flex-1">
        {s.titulo && <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{s.titulo}</p>}
        {s.principal && (
          <p className={esCorto(s.principal) ? "text-base font-bold text-slate-900 dark:text-white mt-0.5" : "text-sm text-slate-700 dark:text-slate-200 leading-snug mt-0.5"}>
            {s.principal}
          </p>
        )}
        {s.chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {s.chips.map((c, i) => (
              <span key={i} className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200">{c}</span>
            ))}
          </div>
        )}
        {s.detalle && <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug mt-1.5">{s.detalle}</p>}
      </div>
    </div>
  );
}

// Sugerencias en ámbar (hay que hacer algo); lo demás (qué revisar afuera) en gris.
function Lista({ s }: { s: SeccionResumen }) {
  const sugerencia = /sugerencia/i.test(s.titulo || "");
  return (
    <div className={`rounded-xl p-4 mt-3 ${sugerencia ? "bg-amber-50 dark:bg-amber-500/10" : "bg-slate-50 dark:bg-white/[0.03]"}`}>
      <p className={`text-xs font-bold flex items-center gap-1.5 ${sugerencia ? "text-amber-800 dark:text-amber-300" : "text-slate-600 dark:text-slate-300"}`}>
        <span className="text-sm leading-none">{s.emoji}</span> {s.titulo || s.principal}
      </p>
      <ul className="mt-2.5 space-y-2.5">
        {s.items.map((it, i) => (
          <li key={i} className="text-sm leading-snug text-slate-700 dark:text-slate-200">
            {it.titulo && <span className="block font-semibold text-slate-900 dark:text-white">{it.titulo}</span>}
            <span className={it.titulo ? "text-slate-600 dark:text-slate-300" : ""}>{it.texto.charAt(0).toUpperCase() + it.texto.slice(1)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ResumenAlertaModal({ alerta, onClose, onVerMas }: { alerta: AlertaResumen; onClose: () => void; onVerMas: () => void }) {
  const { base, fecha } = extraerFecha(alerta.titulo);
  const secciones = alerta.mensaje ? parsearResumen(alerta.mensaje) : [];
  const datos = secciones.filter((s) => s.items.length === 0);
  const listas = secciones.filter((s) => s.items.length > 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 dark:border-white/10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 pb-3 border-b border-slate-100 dark:border-white/5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-300">{base}</p>
            {fecha && <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{fecha}</p>}
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="p-1.5 -mt-1 -mr-1 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-600 dark:hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 pb-4 max-h-[65vh] overflow-y-auto">
          {secciones.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Sin novedades para mostrar.</p>
          ) : (
            <>
              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {datos.map((s, i) => <Dato key={i} s={s} />)}
              </div>
              {listas.map((s, i) => <Lista key={i} s={s} />)}
            </>
          )}
        </div>

        {alerta.link && (
          <div className="px-5 pt-3 pb-5 border-t border-slate-100 dark:border-white/5">
            <button onClick={onVerMas} className="flex items-center justify-center gap-1.5 w-full py-3 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors">
              {textoVerAlerta(alerta.tipo, alerta.link, "Ver más")} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
