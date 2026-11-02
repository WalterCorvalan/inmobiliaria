"use client";

import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { Children, isValidElement, useLayoutEffect, useRef, type ReactNode } from "react";

// Kit de movimiento compartido por el panel y la web pública (pedido de Walter, 3/10/2026), así todo se mueve igual:
//  - Crossfade: al cambiar de pestaña lo viejo se desvanece mientras lo nuevo aparece, AL MISMO TIEMPO (sin salto).
//  - CascadaItem: los elementos de un grupo entran uno detrás de otro, con una décima de segundo entre cada uno.
// Todo es corto (menos de 0,4 s) y respeta "reducir movimiento" del teléfono: con esa opción activada no se anima nada.

// Arranca rápido y frena suave (curva tipo "easeOutQuint"): nada se mueve a velocidad constante.
export const CURVA = [0.22, 1, 0.36, 1] as const;

// Resorte: solo en la web pública (en el panel no, pedido de Walter). Rebota un poquito al llegar, como algo con peso real.
export const RESORTE = { type: "spring", stiffness: 420, damping: 18, mass: 0.8 } as const;


export function Crossfade({
  id, children, className = "", classNameInterno = "", duracion = 0.2,
}: {
  /** Cambia cuando cambia la pestaña/vista: es lo que dispara el cruce. */
  id: string | number;
  children: ReactNode;
  /** Clases del contenedor (ej: "flex-1 min-h-0 flex flex-col" para que encaje en un layout de pantalla completa). */
  className?: string;
  /** Clases de cada vista que entra/sale (por defecto ocupa el ancho del contenedor). */
  classNameInterno?: string;
  duracion?: number;
}) {
  const reducido = useReducedMotion();
  return (
    <div className={`relative ${className}`}>
      {/* popLayout: lo que sale deja de ocupar lugar y se desvanece encima mientras lo nuevo ya aparece -- por eso no hay salto de altura. */}
      <AnimatePresence initial={false} mode="popLayout">
        <m.div
          key={id}
          className={classNameInterno}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducido ? 0 : duracion, ease: CURVA }}
        >
          {children}
        </m.div>
      </AnimatePresence>
    </div>
  );
}

export function CascadaItem({
  children, i = 0, className = "", paso = 0.06, max = 12,
}: {
  children: ReactNode;
  /** Posición dentro del grupo: define cuánto espera para entrar. */
  i?: number;
  className?: string;
  /** Segundos entre un elemento y el siguiente (0,06 ≈ una décima de segundo). */
  paso?: number;
  /** Del elemento N en adelante todos entran juntos, para que una lista larga no tarde en terminar de aparecer. */
  max?: number;
}) {
  // En CSS (.cascada-item en app/globals.css), no con framer-motion: arranca apenas llega el HTML, sin esperar al
  // JavaScript. Antes las tarjetas venían invisibles del servidor hasta que cargaba framer (en un celular, segundos:
  // la primera foto del catálogo tardaba 5,6 s en verse). "Reducir movimiento" lo apaga el mismo CSS.
  return (
    <div className={`cascada-item ${className}`} style={{ animationDelay: `${Math.min(i, max) * paso}s` }}>
      {children}
    </div>
  );
}

/** Envuelve a cada hijo directo en CascadaItem: los bloques de una pantalla entran uno detrás de otro, de arriba hacia abajo. */
export function Cascada({ children, className = "", paso, max }: { children: ReactNode; className?: string; paso?: number; max?: number }) {
  return (
    <div className={className}>
      {Children.toArray(children).map((hijo, i) => (
        <CascadaItem key={isValidElement(hijo) && hijo.key != null ? hijo.key : i} i={i} paso={paso} max={max}>{hijo}</CascadaItem>
      ))}
    </div>
  );
}

/**
 * Elemento compartido: el MISMO título aparece en la lista (origen) y en el detalle (destino, prop `destino`) con el mismo `id`.
 * Al abrir el detalle, una copia del título viaja volando desde su lugar en la lista hasta su lugar en el detalle, así el ojo lo
 * sigue y no se pierde. La copia vive afuera del detalle (en el body), por eso se ve aunque el detalle recorte su contenido.
 * Si el origen no se ve (ej: celular, donde la lista se esconde) o la persona pidió reducir movimiento, no se anima nada.
 */
export function Compartido({ id, como = "span", destino = false, className, children }: { id: string; como?: "span" | "p" | "h1"; destino?: boolean; className?: string; children: ReactNode }) {
  const reducido = useReducedMotion();
  const ref = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const dest = ref.current;
    if (!destino || !dest || reducido || typeof document === "undefined") return;
    const origen = Array.from(document.querySelectorAll<HTMLElement>(`[data-compartido-origen="${id}"]`)).find((e) => e !== dest);
    if (!origen) return;
    const a = origen.getBoundingClientRect();
    const b = dest.getBoundingClientRect();
    if (a.width === 0 || a.height === 0 || b.width === 0) return;
    const eo = getComputedStyle(origen);
    const ed = getComputedStyle(dest);
    const clon = document.createElement("div");
    clon.textContent = dest.textContent;
    Object.assign(clon.style, {
      position: "fixed", left: `${a.left}px`, top: `${a.top}px`, margin: "0", zIndex: "10000", pointerEvents: "none", whiteSpace: "nowrap",
      fontFamily: ed.fontFamily, fontWeight: eo.fontWeight, lineHeight: ed.lineHeight, letterSpacing: ed.letterSpacing,
    });
    document.body.appendChild(clon);
    dest.style.opacity = "0";
    const animacion = clon.animate(
      [
        { transform: "translate(0px, 0px)", fontSize: eo.fontSize, color: eo.color },
        { transform: `translate(${b.left - a.left}px, ${b.top - a.top}px)`, fontSize: ed.fontSize, color: ed.color },
      ],
      { duration: 340, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" }
    );
    const limpiar = () => { dest.style.opacity = ""; clon.remove(); };
    animacion.onfinish = limpiar;
    animacion.oncancel = limpiar;
    return limpiar;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const Etiqueta = como as "span";
  return (
    <Etiqueta
      ref={ref as React.Ref<HTMLSpanElement>}
      className={className}
      {...(destino ? {} : { "data-compartido-origen": id })}
    >
      {children}
    </Etiqueta>
  );
}

/**
 * Resorte de entrada (solo web): aparece desde chico y rebota un poco al llegar a su tamaño.
 * Para avisos de éxito, íconos de confirmación y todo lo que "aparece" y merece un toque de vida.
 */
export function Resorte({ children, className, retraso = 0, desde = 0.5 }: { children: ReactNode; className?: string; retraso?: number; desde?: number }) {
  const reducido = useReducedMotion();
  return (
    <m.div
      initial={reducido ? false : { scale: desde, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ ...RESORTE, delay: retraso }}
      className={className}
    >
      {children}
    </m.div>
  );
}
