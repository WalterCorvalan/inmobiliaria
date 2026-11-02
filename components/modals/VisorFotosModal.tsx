"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Loader2, Minus, Plus, X } from "lucide-react";
import { VISTA_INICIAL, ZOOM_MAX, limitarDesplazamiento, zoomEnPunto, type Vista } from "@/lib/zoomImagen";

// Visor de fotos a pantalla completa con zoom (pedido de Walter del 13/10/2026: ver el auto en detalle desde el
// catálogo). Muestra la foto ORIGINAL, no la achicada de la galería, para no perder calidad al agrandar.
// Se agranda con la rueda del mouse, doble clic, los botones + y −, o pellizcando en el celular; agrandada se arrastra.
// Sin zoom, se pasa de foto con las flechas, el teclado o deslizando. Las cuentas están en lib/zoomImagen.ts.
const PASO_BOTON = 1.6;
const ZOOM_DOBLE_CLIC = 2.5;
const UMBRAL_SWIPE = 50;

// Punto de la pantalla medido desde el centro del visor.
function desdeCentro(el: HTMLElement, x: number, y: number) {
  const r = el.getBoundingClientRect();
  return { x: x - r.left - r.width / 2, y: y - r.top - r.height / 2 };
}

export default function VisorFotosModal({ imagenes, inicio, altText, onClose }: { imagenes: string[]; inicio: number; altText: string; onClose: (indice: number) => void }) {
  const [indice, setIndice] = useState(inicio);
  const [vista, setVista] = useState<Vista>(VISTA_INICIAL);
  const [cargando, setCargando] = useState(true);
  // Mientras hay un dedo o el mouse apretado la foto sigue al gesto sin animación.
  const [arrastrando, setArrastrando] = useState(false);
  const escenario = useRef<HTMLDivElement>(null);
  const foto = useRef<HTMLImageElement>(null);
  // Dedos o mouse apoyados: para arrastrar, pellizcar o deslizar.
  const punteros = useRef(new Map<number, { x: number; y: number }>());
  const gesto = useRef<{ inicio: { x: number; y: number }; vista: Vista; distancia: number; centro: { x: number; y: number } } | null>(null);

  const ajustar = useCallback((v: Vista) => {
    if (!foto.current || !escenario.current) return v;
    return limitarDesplazamiento(v, { ancho: foto.current.offsetWidth, alto: foto.current.offsetHeight }, { ancho: escenario.current.clientWidth, alto: escenario.current.clientHeight });
  }, []);

  const irA = useCallback((i: number) => {
    setIndice((i + imagenes.length) % imagenes.length);
    setVista(VISTA_INICIAL);
    setCargando(true);
  }, [imagenes.length]);
  const zoomBoton = (factor: number) => setVista((v) => ajustar(zoomEnPunto(v, v.escala * factor, { x: 0, y: 0 })));

  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(indice);
      else if (e.key === "ArrowRight" && imagenes.length > 1) irA(indice + 1);
      else if (e.key === "ArrowLeft" && imagenes.length > 1) irA(indice - 1);
      else if (e.key === "+" || e.key === "=") setVista((v) => ajustar(zoomEnPunto(v, v.escala * PASO_BOTON, { x: 0, y: 0 })));
      else if (e.key === "-") setVista((v) => ajustar(zoomEnPunto(v, v.escala / PASO_BOTON, { x: 0, y: 0 })));
    };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = anterior; window.removeEventListener("keydown", onKey); };
  }, [indice, imagenes.length, irA, onClose, ajustar]);

  // La rueda se escucha a mano para poder frenar el scroll de la página (React la registra como pasiva).
  useEffect(() => {
    const el = escenario.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const punto = desdeCentro(escenario.current!, e.clientX, e.clientY);
      setVista((v) => ajustar(zoomEnPunto(v, v.escala * Math.exp(-e.deltaY * 0.0015), punto)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [ajustar]);

  const distanciaYCentro = () => {
    const [a, b] = [...punteros.current.values()];
    return { distancia: Math.hypot(a.x - b.x, a.y - b.y), centro: desdeCentro(escenario.current!, (a.x + b.x) / 2, (a.y + b.y) / 2) };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    escenario.current?.setPointerCapture(e.pointerId);
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const dos = punteros.current.size === 2 ? distanciaYCentro() : { distancia: 0, centro: { x: 0, y: 0 } };
    gesto.current = { inicio: { x: e.clientX, y: e.clientY }, vista, ...dos };
    setArrastrando(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!punteros.current.has(e.pointerId) || !gesto.current) return;
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesto.current;
    if (punteros.current.size === 2 && g.distancia > 0) {
      const { distancia, centro } = distanciaYCentro();
      const v = zoomEnPunto(g.vista, g.vista.escala * (distancia / g.distancia), g.centro);
      setVista(ajustar({ ...v, x: v.x + centro.x - g.centro.x, y: v.y + centro.y - g.centro.y }));
    } else if (punteros.current.size === 1 && g.vista.escala > 1) {
      setVista(ajustar({ ...g.vista, x: g.vista.x + e.clientX - g.inicio.x, y: g.vista.y + e.clientY - g.inicio.y }));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesto.current;
    const eraUnSoloDedo = punteros.current.size === 1;
    punteros.current.delete(e.pointerId);
    if (g && eraUnSoloDedo && g.vista.escala === 1 && vista.escala === 1 && imagenes.length > 1) {
      const dx = e.clientX - g.inicio.x;
      if (dx > UMBRAL_SWIPE) irA(indice - 1);
      else if (dx < -UMBRAL_SWIPE) irA(indice + 1);
    }
    // Si queda un dedo apoyado después de pellizcar, sigue arrastrando desde donde está.
    const [resto] = [...punteros.current.values()];
    gesto.current = resto ? { inicio: resto, vista, distancia: 0, centro: { x: 0, y: 0 } } : null;
    if (!resto) setArrastrando(false);
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const punto = desdeCentro(escenario.current!, e.clientX, e.clientY);
    setVista((v) => (v.escala > 1 ? VISTA_INICIAL : ajustar(zoomEnPunto(v, ZOOM_DOBLE_CLIC, punto))));
  };

  const boton = "w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/15 disabled:opacity-30";

  return createPortal(
    <div className="fixed inset-0 z-[200] bg-black flex flex-col select-none" role="dialog" aria-modal="true" aria-label={`Fotos de ${altText}`}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
        <span className="text-sm font-bold tabular-nums">{indice + 1} / {imagenes.length}</span>
        <div className="flex items-center gap-2">
          <button onClick={() => zoomBoton(1 / PASO_BOTON)} disabled={vista.escala <= 1} className={boton} aria-label="Achicar"><Minus className="w-5 h-5" /></button>
          <button onClick={() => zoomBoton(PASO_BOTON)} disabled={vista.escala >= ZOOM_MAX} className={boton} aria-label="Agrandar"><Plus className="w-5 h-5" /></button>
          <button onClick={() => onClose(indice)} className={boton} aria-label="Cerrar"><X className="w-5 h-5" /></button>
        </div>
      </div>

      <div
        ref={escenario}
        className={`relative flex-1 overflow-hidden flex items-center justify-center ${vista.escala > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"}`}
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
      >
        {cargando && <Loader2 className="absolute w-8 h-8 text-white/60 animate-spin" />}
        {/* eslint-disable-next-line @next/next/no-img-element -- la original sin pasar por el optimizador: es lo que se agranda */}
        <img
          ref={foto}
          key={imagenes[indice]}
          src={imagenes[indice]}
          alt={`${altText} - Foto ${indice + 1}`}
          draggable={false}
          onLoad={() => setCargando(false)}
          className={`max-w-full max-h-full object-contain will-change-transform ${cargando ? "opacity-0" : "opacity-100"}`}
          style={{ transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.escala})`, transition: arrastrando ? "none" : "transform 0.15s ease-out" }}
        />

        {imagenes.length > 1 && vista.escala === 1 && (
          <>
            <button onPointerDown={(e) => e.stopPropagation()} onClick={() => irA(indice - 1)} className={`${boton} absolute left-4 top-1/2 -translate-y-1/2 hidden sm:flex`} aria-label="Foto anterior"><ChevronLeft className="w-6 h-6" /></button>
            <button onPointerDown={(e) => e.stopPropagation()} onClick={() => irA(indice + 1)} className={`${boton} absolute right-4 top-1/2 -translate-y-1/2 hidden sm:flex`} aria-label="Foto siguiente"><ChevronRight className="w-6 h-6" /></button>
          </>
        )}
      </div>

      <p className="text-center text-[11px] text-white/50 px-4 py-3">
        <span className="hidden sm:inline">Rueda del mouse o doble clic para agrandar · arrastrá para moverte · Esc para cerrar</span>
        <span className="sm:hidden">Pellizcá o tocá dos veces para agrandar · deslizá para cambiar de foto</span>
      </p>
    </div>,
    document.body,
  );
}
