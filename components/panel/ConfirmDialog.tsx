"use client";

import { AlertTriangle } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { CURVA } from "@/components/ui/movimiento";

interface Props {
  abierto: boolean;
  titulo?: string;
  mensaje: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}

// Reemplazo del confirm() nativo del navegador, controlado por estado
// (abierto/onConfirmar). Para llamarlo desde una función sin estado propio
// está confirmar() en components/panel/Dialogos.tsx; los dos se ven y se
// animan igual (fundido + leve escala, sin resorte).
export default function ConfirmDialog({ abierto, titulo = "Confirmar", mensaje, textoConfirmar = "Confirmar", textoCancelar = "Cancelar", onConfirmar, onCancelar }: Props) {
  const reducido = useReducedMotion();
  return (
    <AnimatePresence>
      {abierto && (
        <m.div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: reducido ? 0 : 0.18, ease: CURVA }}
          onClick={onCancelar}
        >
          <m.div
            role="dialog" aria-modal="true"
            className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-sm p-5"
            initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 4 }}
            transition={{ duration: reducido ? 0 : 0.22, ease: CURVA }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-[18px] h-[18px]" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">{titulo}</h2>
                <p className="text-[13px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed whitespace-pre-line">{mensaje}</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button onClick={onCancelar} className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors">
                {textoCancelar}
              </button>
              <button onClick={onConfirmar} autoFocus className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-colors">
                {textoConfirmar}
              </button>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
