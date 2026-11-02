"use client";

// Selector desplegable con el diseño de la web pública (pedido de Walter del 13/10/2026: el <select> nativo abría la
// lista con el estilo del sistema operativo, azul de Windows y sin bordes, y no combinaba con el sitio). Se usa en
// "Ordenar por" del catálogo, en los formularios de visita y, desde el 2/11/2026, en la ficha de Leads del panel (Walter:
// "mejorá el diseño de los elementos", empezando por esa ficha). La lista se dibuja en el <body> (portal) para que no la
// recorte un modal con scroll; con .dark en <html> (lib/introLoader, TemaPublicoContext) toma el modo oscuro igual. En el
// panel va adentro de .panel-v2-root: ahí viven .dark y los colores del tema, no en <html> (igual que FichaVehiculoModal).
// Teclado: Enter/Espacio/flecha abren, flechas recorren, Enter elige, Escape cierra.
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export type OpcionSelector = { valor: string; etiqueta: string; deshabilitada?: boolean; nota?: string };

export default function SelectorWeb({
  id, valor, onCambio, opciones, placeholder = "Elegir…", deshabilitado = false, claseBoton = "", claseFlecha = "w-4 h-4", ariaLabel, etiquetaActual,
}: {
  id?: string; valor: string; onCambio: (valor: string) => void; opciones: OpcionSelector[]; placeholder?: string;
  deshabilitado?: boolean; claseBoton?: string; claseFlecha?: string; ariaLabel?: string;
  // Texto a mostrar si el valor guardado no está entre las opciones (ej.: un admin asignado cuando la lista solo trae vendedores).
  etiquetaActual?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; arriba: boolean } | null>(null);
  const [contenedor, setContenedor] = useState<Element | null>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const idLista = useId();
  const elegida = opciones.find((o) => o.valor === valor);
  // Un valor guardado que la lista no trae no se esconde detrás del placeholder: el <select> viejo mostraba la primera opción (engañoso) y este mostraba "Elegir…".
  // Sale la etiqueta que pasa quien lo usa o, si el valor es un texto legible (no un id), el mismo texto.
  const esId = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(valor);
  const textoBoton = elegida ? elegida.etiqueta : valor && etiquetaActual ? etiquetaActual : valor && !esId ? valor : placeholder;
  const hayTexto = !!elegida || textoBoton !== placeholder;

  const ubicar = () => {
    const r = boton.current?.getBoundingClientRect();
    if (!r) return;
    const alto = Math.min(288, Math.max(1, opciones.length) * 44 + 12);
    const arriba = r.bottom + alto + 8 > window.innerHeight && r.top > alto + 8;
    setPos({ top: arriba ? r.top - alto - 6 : r.bottom + 6, left: r.left, width: Math.max(r.width, 210), arriba });
  };

  useLayoutEffect(() => {
    if (!abierto) return;
    ubicar();
    const cerrarAfuera = (e: MouseEvent) => {
      if (!boton.current?.contains(e.target as Node) && !lista.current?.contains(e.target as Node)) setAbierto(false);
    };
    window.addEventListener("resize", ubicar);
    window.addEventListener("scroll", ubicar, true);
    document.addEventListener("mousedown", cerrarAfuera);
    return () => {
      window.removeEventListener("resize", ubicar);
      window.removeEventListener("scroll", ubicar, true);
      document.removeEventListener("mousedown", cerrarAfuera);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, opciones.length]);

  useEffect(() => {
    if (abierto && activo >= 0) lista.current?.children[activo]?.scrollIntoView({ block: "nearest" });
  }, [abierto, activo]);

  const abrir = () => {
    if (deshabilitado) return;
    setActivo(Math.max(0, opciones.findIndex((o) => o.valor === valor)));
    setContenedor(boton.current?.closest(".panel-v2-root") ?? document.body);
    setAbierto(true);
  };
  const elegir = (o: OpcionSelector) => {
    if (o.deshabilitada) return;
    onCambio(o.valor);
    setAbierto(false);
    boton.current?.focus();
  };
  const mover = (paso: number) => {
    if (opciones.length === 0) return;
    let i = activo;
    for (let n = 0; n < opciones.length; n++) {
      i = (i + paso + opciones.length) % opciones.length;
      if (!opciones[i].deshabilitada) break;
    }
    setActivo(i);
  };
  const teclado = (e: React.KeyboardEvent) => {
    if (!abierto) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) { e.preventDefault(); abrir(); }
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); setAbierto(false); }
    else if (e.key === "ArrowDown") { e.preventDefault(); mover(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); mover(-1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (opciones[activo]) elegir(opciones[activo]); }
    else if (e.key === "Tab") setAbierto(false);
  };

  return (
    <>
      <button
        ref={boton} id={id} type="button" disabled={deshabilitado} aria-label={ariaLabel}
        aria-haspopup="listbox" aria-expanded={abierto} aria-controls={abierto ? idLista : undefined}
        onClick={() => (abierto ? setAbierto(false) : abrir())} onKeyDown={teclado}
        className={`w-full flex items-center justify-between gap-2 text-left disabled:opacity-50 disabled:cursor-not-allowed ${claseBoton}`}
      >
        <span className={`truncate ${hayTexto ? "" : "text-slate-400 dark:text-slate-500"}`}>{textoBoton}</span>
        <ChevronDown className={`${claseFlecha} shrink-0 text-slate-400 transition-transform ${abierto ? "rotate-180" : ""}`} />
      </button>
      {abierto && pos && contenedor && createPortal(
        <ul
          ref={lista} id={idLista} role="listbox" tabIndex={-1}
          style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
          className="max-h-72 overflow-y-auto custom-scrollbar rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#16161b] shadow-xl shadow-slate-900/10 dark:shadow-black/40 p-1.5"
        >
          {opciones.length === 0 && <li className="px-3 py-2.5 text-sm text-slate-400">Cargando…</li>}
          {opciones.map((o, i) => {
            const sel = o.valor === valor;
            return (
              <li
                key={o.valor || `vacio-${i}`} role="option" aria-selected={sel} aria-disabled={o.deshabilitada || undefined}
                onMouseEnter={() => setActivo(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => elegir(o)}
                className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  o.deshabilitada ? "text-slate-300 dark:text-slate-600 cursor-not-allowed"
                  : i === activo ? "bg-[#0145F2]/10 dark:bg-sky-400/10 text-[#0145F2] dark:text-sky-300 cursor-pointer"
                  : "text-slate-700 dark:text-slate-200 cursor-pointer"
                } ${sel ? "font-bold" : "font-medium"}`}
              >
                <span className="truncate">{o.etiqueta}{o.nota && <span className="ml-1.5 text-[11px] font-semibold text-slate-400">{o.nota}</span>}</span>
                {sel && <Check className="w-4 h-4 shrink-0" />}
              </li>
            );
          })}
        </ul>,
        contenedor,
      )}
    </>
  );
}
