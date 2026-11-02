"use client";

import { useEffect, useState } from "react";

// En el celular, true mientras hay un campo de texto con el cursor (o sea, con el teclado en pantalla). Sirve para
// esconder la barra de abajo: con el teclado abierto no sirve para nada y deja una franja en blanco encima de las teclas.
// Los campos de fecha/hora, casillas y selectores no abren teclado de texto, así que no cuentan.
const SIN_TECLADO = ["checkbox", "radio", "button", "submit", "reset", "file", "range", "color", "image", "date", "datetime-local", "time", "month", "week"];

export function esCampoDeTexto(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return !SIN_TECLADO.includes(el.type);
  return el instanceof HTMLElement && el.isContentEditable;
}

export function useTecladoAbierto(): boolean {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    const actualizar = () => setAbierto(window.matchMedia("(max-width: 767px)").matches && esCampoDeTexto(document.activeElement));
    // Al pasar de un campo a otro, el foco sale un instante: se espera un poco para no parpadear.
    const alSalir = () => { window.setTimeout(actualizar, 60); };
    document.addEventListener("focusin", actualizar);
    document.addEventListener("focusout", alSalir);
    return () => {
      document.removeEventListener("focusin", actualizar);
      document.removeEventListener("focusout", alSalir);
    };
  }, []);

  return abierto;
}
