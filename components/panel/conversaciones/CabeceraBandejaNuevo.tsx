"use client";

// Cabecera de las bandejas (WhatsApp, Instagram, Messenger y el chat de la web) con el diseño Nuevo de Mi Perfil
// (lib/panel/disenoPanel.ts). Con Softcars se sigue viendo la barra de siempre de cada Shell.
// Las bandejas son una sola pantalla para los dos diseños (Walter, 11/11/2026): solo cambia el aspecto.

import IconoPanel, { type NombreIconoPanel } from "@/components/panel/IconoPanel";

// enColumna: en la compu va arriba de la lista de charlas, con su mismo ancho, y el chat y los detalles llegan hasta
// arriba (Walter, 11/11/2026). En el celular sigue arriba de todo, con sus márgenes.
// plano: WhatsApp con el diseño de la referencia (19/11/2026): una franja blanca con el título y una línea abajo, sin
// tarjeta redondeada (como "Open Inbox").
export default function CabeceraBandejaNuevo<T extends string>({ icono, titulo, subtitulo, pestanas, activa, onCambiar, enColumna = false, plano = false }: {
  icono: NombreIconoPanel; titulo: string; subtitulo: string;
  pestanas: { v: T; l: string }[]; activa: T; onCambiar: (v: T) => void; enColumna?: boolean; plano?: boolean;
}) {
  if (plano) {
    return (
      <div className="h-[52px] px-4 shrink-0 flex items-center justify-between gap-3 bg-white dark:bg-[#111] border-b border-[#E8E9ED] dark:border-white/10">
        <h1 className="text-[16px] font-semibold tracking-tight text-slate-900 dark:text-white">{titulo}</h1>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{subtitulo}</p>
      </div>
    );
  }
  return (
    <div className={`${enColumna ? "" : "mx-2 mt-2 "}rounded-[24px] bg-white dark:bg-[#111] ring-1 ring-black/[0.04] dark:ring-white/10 shadow-[0_1px_3px_rgba(15,23,42,0.05)] px-3 py-2 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-8 h-8 shrink-0 rounded-xl bg-[#F3F4F7] dark:bg-white/10 grid place-items-center"><IconoPanel nombre={icono} medida="md" /></span>
        <div className="min-w-0">
          <h1 className="text-[17px] font-semibold tracking-tight text-slate-900 dark:text-white leading-tight">{titulo}</h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{subtitulo}</p>
        </div>
      </div>
      {pestanas.length > 1 && (
      <div className="inline-flex self-start sm:self-auto rounded-full bg-[#F3F4F7] dark:bg-white/[0.07] p-1" role="group" aria-label="Sección">
        {pestanas.map((t) => (
          <button key={t.v} onClick={() => onCambiar(t.v)} aria-pressed={activa === t.v} className={`px-4 py-1.5 text-[13px] font-semibold rounded-full transition-colors whitespace-nowrap ${activa === t.v ? "bg-white dark:bg-white/15 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}>{t.l}</button>
        ))}
      </div>
      )}
    </div>
  );
}

// Estilos del diseño Nuevo dentro de las bandejas: el tema claro Softcars cambia grises y títulos (se vuelven a los de
// siempre, como en las otras pantallas Nuevo) y los controles de la lista y de "Detalles" pasan a píldoras y campos grises.
export const ESTILO_BANDEJA_NUEVO = `
  .tema-softcars .diseno-material {
    --color-slate-50: oklch(98.4% 0.003 247.858); --color-slate-100: oklch(96.8% 0.007 247.896); --color-slate-200: oklch(92.9% 0.013 255.508);
    --color-slate-300: oklch(86.9% 0.022 252.894); --color-slate-400: oklch(70.4% 0.04 256.788); --color-slate-500: oklch(55.4% 0.046 257.417);
    --color-slate-600: oklch(44.6% 0.043 257.281); --color-slate-700: oklch(37.2% 0.044 257.287); --color-slate-800: oklch(27.9% 0.041 260.031);
    --color-slate-900: oklch(20.8% 0.042 265.755);
  }
  .tema-softcars .diseno-material h1, .tema-softcars .diseno-material h2, .tema-softcars .diseno-material h3, .tema-softcars .diseno-material h4 { color: var(--color-slate-900); }
  .tema-softcars .diseno-material label { color: inherit; }
  .chat-nuevo-lista input[type=text] { border-radius: 9999px; border-color: transparent; background-color: #F3F4F7; padding-top: 8px; padding-bottom: 8px; }
  .dark .chat-nuevo-lista input[type=text] { background-color: rgba(255,255,255,0.07); }
  .chat-nuevo-lista .rounded-lg, .chat-nuevo-lista .rounded-md { border-radius: 9999px; }
  .chat-nuevo form.rounded-xl { border-radius: 9999px; border-color: transparent; padding-left: 8px; }
  .chat-nuevo form.rounded-xl button[type=submit] { border-radius: 9999px; background-color: #0145F2; }
  .chat-nuevo-detalles .border-b { border-color: var(--color-slate-100); }
  .dark .chat-nuevo-detalles .border-b { border-color: rgba(255,255,255,0.06); }
  .chat-nuevo-detalles h4 { text-transform: none; letter-spacing: 0; font-size: 13px; font-weight: 600; color: var(--color-slate-600); }
  .dark .chat-nuevo-detalles h4 { color: var(--color-slate-300); }
  .chat-nuevo-detalles select, .chat-nuevo-detalles textarea, .chat-nuevo-detalles input { border-radius: 16px; border-color: #CBD2DD; background-color: #ffffff; }
  .dark .chat-nuevo-detalles select, .dark .chat-nuevo-detalles textarea, .dark .chat-nuevo-detalles input { background-color: rgba(255,255,255,0.03); border-color: rgba(255,255,255,0.24); }
  .chat-nuevo-detalles button.rounded-lg { border-radius: 9999px; border-color: transparent; background-color: #F3F4F7; }
  .dark .chat-nuevo-detalles button.rounded-lg { background-color: rgba(255,255,255,0.07); }
`;
