"use client";

import { useEffect } from "react";

// Gesto de "atrás" del celular = cerrar la ventana que está abierta, no salir del módulo.
//
// Las ventanas del panel (editar un auto, nuevo cliente, avisos de confirmación...) no son páginas: no agregan nada
// al historial del navegador. Por eso, al hacer "atrás" con una abierta, el navegador volvía a la pantalla anterior
// (por ejemplo, el Dashboard) y la ventana se perdía.
//
// Acá, cuando aparece una ventana (cualquier `div.fixed.inset-0` con algo para tocar adentro) se agrega una entrada
// al historial; si el usuario hace "atrás", se cierra la ventana de más arriba tocando su fondo o su botón de cerrar.
// Si la ventana se cierra por otro lado (botón X, Guardar), la entrada se saca sola. Solo en pantallas de celular.
// Una ventana puede quedar afuera con el atributo `data-sin-atras`.

const MARCA = "__atrasModal";
const ANCHO_CELULAR = "(max-width: 767px)";

type Abierta = { el: HTMLElement; id: string; cerradaPorAtras: boolean };
// Ventana cerrada por un botón (no por "atrás") cuya entrada del historial todavía está arriba de todo.
type Pendiente = { id: string; url: string; timer: number };

// Cuánto se espera antes de sacar la entrada de una ventana cerrada: si en ese tiempo la dirección cambió, la ventana se
// cerró para navegar a otra pantalla (router.push puede tardar) y sacarla deshacería esa navegación.
const ESPERA_SACAR_ENTRADA_MS = 2000;

export function esVentana(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (el.hasAttribute("data-sin-atras")) return false;
  // Una ventana tiene algo para tocar; un fondo de "cargando" no.
  return !!el.querySelector("button, a, input, select, textarea");
}

const TEXTO_CERRAR = /^(cerrar|cancelar|volver|entendido|no)$/i;

function cerrar(el: HTMLElement) {
  // 1) tocar el fondo (lo que hace el usuario al tocar afuera); si el fondo no es un hijo aparte, la ventana misma.
  const fondo = el.querySelector<HTMLElement>(":scope > .absolute.inset-0");
  (fondo ?? el).click();
  // 2) si no se cerró, buscar el botón de cerrar.
  window.setTimeout(() => {
    if (!el.isConnected) return;
    const botones = Array.from(el.querySelectorAll<HTMLElement>("button"));
    const boton =
      botones.find((b) => /cerrar|close/i.test(`${b.getAttribute("aria-label") ?? ""} ${b.title}`)) ??
      botones.find((b) => b.querySelector("svg.lucide-x")) ??
      botones.find((b) => TEXTO_CERRAR.test((b.textContent ?? "").trim()));
    boton?.click();
  }, 150);
}

export default function AtrasCierraModales() {
  useEffect(() => {
    const pila: Abierta[] = [];
    let ignorar = 0; // "atrás" que hicimos nosotros mismos para sacar una entrada
    let pendiente = false;
    let cerradaReciente: Pendiente | null = null;

    const volverAtras = () => { ignorar++; window.history.back(); };

    const revisar = () => {
      pendiente = false;

      // Ventanas que se cerraron por un botón: se saca su entrada del historial, pero con calma y solo si sigue siendo la de
      // arriba y la dirección no cambió (ver ESPERA_SACAR_ENTRADA_MS).
      for (let i = pila.length - 1; i >= 0; i--) {
        const v = pila[i];
        if (v.el.isConnected) continue;
        pila.splice(i, 1);
        if (v.cerradaPorAtras || window.history.state?.[MARCA] !== v.id) continue;
        if (cerradaReciente) window.clearTimeout(cerradaReciente.timer);
        const url = window.location.href;
        const timer = window.setTimeout(() => {
          const sigueArriba = window.history.state?.[MARCA] === v.id && window.location.href === url;
          cerradaReciente = null;
          if (sigueArriba) volverAtras();
        }, ESPERA_SACAR_ENTRADA_MS);
        cerradaReciente = { id: v.id, url, timer };
      }

      if (!window.matchMedia(ANCHO_CELULAR).matches) return;
      document.querySelectorAll("div.fixed.inset-0").forEach((el) => {
        if (!esVentana(el) || pila.some((v) => v.el === el)) return;
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        pila.push({ el, id, cerradaPorAtras: false });
        window.history.pushState({ [MARCA]: id }, "");
      });
    };

    const programar = () => {
      if (pendiente) return;
      pendiente = true;
      window.requestAnimationFrame(revisar);
    };

    const alVolverAtras = () => {
      if (ignorar > 0) { ignorar--; return; }
      const arriba = [...pila].reverse().find((v) => v.el.isConnected);
      if (arriba) {
        arriba.cerradaPorAtras = true;
        pila.splice(pila.indexOf(arriba), 1);
        cerrar(arriba.el);
        return;
      }
      // Sin ventana abierta. Si justo se acababa de cerrar una por botón y el usuario hizo "atrás" antes de que se saque su
      // entrada, se cayó en la misma pantalla: se salta esa copia para que un solo "atrás" alcance.
      if (cerradaReciente) {
        const { id, url, timer } = cerradaReciente;
        window.clearTimeout(timer);
        cerradaReciente = null;
        if (window.location.href === url && window.history.state?.[MARCA] !== id) { volverAtras(); return; }
      }
      // Parados sobre una entrada vieja de una ventana: se salta, para que "atrás" no parezca no hacer nada.
      if (window.history.state?.[MARCA]) volverAtras();
    };

    const observador = new MutationObserver(programar);
    observador.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("popstate", alVolverAtras);
    programar();
    return () => {
      if (cerradaReciente) window.clearTimeout(cerradaReciente.timer);
      observador.disconnect();
      window.removeEventListener("popstate", alVolverAtras);
    };
  }, []);

  return null;
}
