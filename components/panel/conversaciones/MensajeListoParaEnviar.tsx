"use client";

// Pasaron las 24 horas: el mensaje aprobado ("Retomar la charla") ya armado, como un mensaje de WhatsApp que solo falta
// mandar (Walter, 17/11/2026: "que simule que el mensaje está prácticamente listo para enviar"). Misma burbuja verde que
// los mensajes enviados del chat, con "Sin enviar" en el lugar de la hora, y el botón de enviar como el del cuadro para
// escribir. Cómo funciona no cambia (decisión del 16/11 en docs/decisiones.md, "WhatsApp: pasadas las 24 horas").
import { Clock, Loader2, Pencil, Send, ListChecks } from "lucide-react";

export default function MensajeListoParaEnviar({ texto, pedirNombre, nombre, onNombre, puedeCambiarNombre, onCambiarNombre, onOtroMensaje, onEnviar, enviando, puedeEnviar }: {
  texto: string;
  pedirNombre: boolean;
  nombre: string;
  onNombre: (v: string) => void;
  puedeCambiarNombre: boolean;
  onCambiarNombre: () => void;
  onOtroMensaje: () => void;
  onEnviar: () => void;
  enviando: boolean;
  puedeEnviar: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-[#111] shadow-sm p-3 space-y-2.5">
      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-500 dark:text-slate-400">
        <Clock className="w-3.5 h-3.5 shrink-0" /> Pasaron 24 hs. Para seguir la charla, este mensaje ya está listo:
      </p>
      {pedirNombre && (
        <input value={nombre} onChange={(e) => onNombre(e.target.value)} placeholder="Nombre del cliente" aria-label="Nombre del cliente" autoFocus
          className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-2 text-[16px] md:text-sm outline-none focus:border-emerald-500 text-slate-800 dark:text-white" />
      )}
      <div className="flex justify-end">
        <div className="relative max-w-[92%] rounded-[10px] rounded-tr-none bg-[#d9fdd3] dark:bg-[#005c4b] px-3 pt-2 pb-1.5 text-[14.5px] leading-snug text-slate-800 dark:text-white shadow-sm">
          <span className="absolute -right-[7px] top-0 w-0 h-0 border-t-[8px] border-t-[#d9fdd3] dark:border-t-[#005c4b] border-r-[8px] border-r-transparent" aria-hidden />
          <p className="whitespace-pre-wrap">{texto}</p>
          <p className="mt-0.5 text-right text-[10.5px] text-slate-500 dark:text-white/60">Sin enviar</p>
        </div>
      </div>
      <div className="flex items-center gap-0.5 sm:gap-1.5">
        {puedeCambiarNombre && (
          <button type="button" onClick={onCambiarNombre} className="inline-flex items-center gap-1 h-10 px-1.5 sm:px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5">
            <Pencil className="hidden sm:block w-3.5 h-3.5" /> Cambiar nombre
          </button>
        )}
        <button type="button" onClick={onOtroMensaje} className="inline-flex items-center gap-1 h-10 px-1.5 sm:px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5">
          <ListChecks className="hidden sm:block w-3.5 h-3.5" /> Otro mensaje
        </button>
        <button type="button" onClick={onEnviar} disabled={enviando || !puedeEnviar}
          className="ml-auto shrink-0 inline-flex items-center gap-2 h-10 pl-3.5 sm:pl-4 pr-3 sm:pr-3.5 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold shadow-sm disabled:opacity-50">
          Enviar {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
