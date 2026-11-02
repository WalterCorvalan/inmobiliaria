"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { registrarEvento } from "@/lib/conversiones";

// Mide los toques a WhatsApp y a teléfonos en todo el sitio público con un solo oyente, en vez de agregar código en
// cada uno de los enlaces (hay decenas y aparecen nuevos). También avisa al Pixel de Meta cuando se cambia de página
// sin recargar (Analytics ya lo detecta solo). En el panel no mide nada: ahí los enlaces son del equipo.
// Plan: docs/marketing/medicion.md.

const WHATSAPP = /^(https?:\/\/(wa\.me|api\.whatsapp\.com|(web|www)\.whatsapp\.com)\/|whatsapp:)/i;

/** Dónde estaba el enlace: la página y, si tiene, la sección (data-medicion o el id de la sección). */
export function ubicacionDelEnlace(enlace: Element, ruta: string): string {
  const marcada = enlace.closest("[data-medicion]")?.getAttribute("data-medicion");
  if (marcada) return `${ruta} · ${marcada}`;
  const seccion = enlace.closest("section[id]")?.id;
  return seccion ? `${ruta}#${seccion}` : ruta;
}

export default function MedicionClics() {
  const ruta = usePathname();
  const primera = useRef(true);

  useEffect(() => {
    const alTocar = (e: MouseEvent) => {
      if (window.location.pathname.startsWith("/panel")) return;
      const enlace = (e.target as Element | null)?.closest?.("a[href]");
      if (!enlace) return;
      const href = enlace.getAttribute("href") || "";
      if (WHATSAPP.test(href)) registrarEvento({ tipo: "whatsapp", ubicacion: ubicacionDelEnlace(enlace, window.location.pathname) });
      else if (/^tel:/i.test(href)) registrarEvento({ tipo: "llamada", ubicacion: ubicacionDelEnlace(enlace, window.location.pathname) });
    };
    // En la fase de captura: corre aunque el enlace frene la propagación del click.
    document.addEventListener("click", alTocar, true);
    return () => document.removeEventListener("click", alTocar, true);
  }, []);

  useEffect(() => {
    if (primera.current) { primera.current = false; return; }
    if (ruta.startsWith("/panel")) return;
    const fbq = (window as Window & { fbq?: (...args: unknown[]) => void }).fbq;
    if (typeof fbq === "function") fbq("track", "PageView");
  }, [ruta]);

  return null;
}
