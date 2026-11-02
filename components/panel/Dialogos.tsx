"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { AlertTriangle, MessageSquareText, Info } from "lucide-react";
import { CURVA } from "@/components/ui/movimiento";

// Ventanas propias del panel en lugar de confirm() / prompt() / alert() del
// navegador (pedido de Walter, 8/10: "no puede aparecer el mensaje traído del
// navegador"). Se llaman desde cualquier lado, como las nativas, pero
// devuelven una promesa:
//
//   if (!(await confirmar({ mensaje: "¿Eliminar...?", peligro: true }))) return;
//   const motivo = await pedirTexto({ mensaje: "Motivo (opcional):" }); // null si cancela
//   await avisar("No se pudo guardar.");
//
// <DialogosHost /> va montado una sola vez en el layout raíz (app/layout.tsx), así funciona en el panel y en la web. Animación:
// fundido + leve escala con la curva del kit de movimiento, sin resorte
// (en el panel no, ver components/ui/movimiento.tsx).

type Pedido =
  | { tipo: "confirmar"; titulo?: string; mensaje: string; textoConfirmar?: string; textoCancelar?: string; peligro?: boolean; resolver: (v: boolean) => void }
  | { tipo: "texto"; titulo?: string; mensaje: string; placeholder?: string; valorInicial?: string; textoConfirmar?: string; resolver: (v: string | null) => void }
  | { tipo: "aviso"; titulo?: string; mensaje: string; resolver: () => void };

let cola: Pedido[] = [];
const oyentes = new Set<() => void>();
const avisarCambio = () => oyentes.forEach((f) => f());
function encolar(p: Pedido) { cola = [...cola, p]; avisarCambio(); }

export function confirmar(o: { mensaje: string; titulo?: string; textoConfirmar?: string; textoCancelar?: string; peligro?: boolean }): Promise<boolean> {
  return new Promise((resolver) => encolar({ tipo: "confirmar", ...o, resolver }));
}
export function pedirTexto(o: { mensaje: string; titulo?: string; placeholder?: string; valorInicial?: string; textoConfirmar?: string }): Promise<string | null> {
  return new Promise((resolver) => encolar({ tipo: "texto", ...o, resolver }));
}
export function avisar(mensaje: string, titulo?: string): Promise<void> {
  return new Promise((resolver) => encolar({ tipo: "aviso", mensaje, titulo, resolver }));
}

export default function DialogosHost() {
  const [, setVersion] = useState(0);
  const reducido = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const f = () => setVersion((v) => v + 1);
    oyentes.add(f);
    return () => { oyentes.delete(f); };
  }, []);

  const actual = cola[0];

  useEffect(() => {
    if (!actual) return;
    if (actual.tipo === "texto") setTimeout(() => inputRef.current?.focus(), 50);
    else setTimeout(() => botonRef.current?.focus(), 50);
  }, [actual]);

  const cerrar = (aceptar: boolean) => {
    if (!actual) return;
    if (actual.tipo === "confirmar") actual.resolver(aceptar);
    else if (actual.tipo === "texto") actual.resolver(aceptar ? (inputRef.current?.value ?? "") : null);
    else actual.resolver();
    cola = cola.slice(1);
    avisarCambio();
  };

  useEffect(() => {
    if (!actual) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") cerrar(false); };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  const Icono = actual?.tipo === "texto" ? MessageSquareText : actual?.tipo === "aviso" ? Info : AlertTriangle;
  const peligro = actual?.tipo === "confirmar" && actual.peligro;
  const duracion = reducido ? 0 : 0.18;

  return (
    <AnimatePresence>
      {actual && (
        <m.div
          key="fondo"
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: duracion, ease: CURVA }}
          onClick={() => cerrar(false)}
        >
          <m.div
            key={cola.length + actual.mensaje}
            role="dialog" aria-modal="true"
            className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-sm p-5"
            initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 4 }}
            transition={{ duration: reducido ? 0 : 0.22, ease: CURVA }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${peligro ? "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400" : actual.tipo === "confirmar" ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-[#0145F2]/10 text-[#0145F2]"}`}>
                <Icono className="w-[18px] h-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">{actual.titulo || (actual.tipo === "confirmar" ? "Confirmar" : actual.tipo === "texto" ? "Completar" : "Aviso")}</h2>
                <p className="text-[13px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed whitespace-pre-line">{actual.mensaje}</p>
              </div>
            </div>
            {actual.tipo === "texto" && (
              <input
                ref={inputRef} defaultValue={actual.valorInicial || ""}
                onKeyDown={(e) => { if (e.key === "Enter") cerrar(true); }}
                placeholder={actual.placeholder}
                className="mt-4 w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#0145F2] text-slate-900 dark:text-white"
              />
            )}
            <div className="flex gap-2 justify-end mt-5">
              {actual.tipo !== "aviso" && (
                <button onClick={() => cerrar(false)} className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors">{(actual.tipo === "confirmar" && actual.textoCancelar) || "Cancelar"}</button>
              )}
              <button
                ref={botonRef} onClick={() => cerrar(true)}
                className={`px-4 py-2 text-xs font-bold text-white rounded-xl transition-colors ${peligro ? "bg-rose-600 hover:bg-rose-700" : "bg-[#0145F2] hover:bg-[#0138c9]"}`}
              >
                {actual.tipo === "aviso" ? "Entendido" : (actual.textoConfirmar || "Confirmar")}
              </button>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
