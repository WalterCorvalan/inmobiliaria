"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// Barra fina arriba de la pantalla, solo mobile -- se dispara apenas se
// toca un link del panel (antes de que Next termine de renderizar la
// próxima pantalla) y se apaga sola cuando el pathname cambió. El tap
// visual (:active en globals.css) confirma "toqué"; esto confirma "está
// yendo" mientras la navegación tarda.
export default function MobileNavProgress() {
  const pathname = usePathname();
  const [activa, setActiva] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      const href = link.getAttribute("href") || "";
      if (!href.startsWith("/panel") || href === pathname) return;
      if (link.target === "_blank" || e.metaKey || e.ctrlKey) return;
      setActiva(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      // Fallback si la navegación tarda más que la animación o el pathname
      // no llega a cambiar (ancla a la misma ruta con query distinto, etc).
      timeoutRef.current = setTimeout(() => setActiva(false), 4000);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [pathname]);

  useEffect(() => {
    setActiva(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, [pathname]);

  if (!activa) return null;

  return (
    <div className="md:hidden print:hidden fixed top-0 left-0 right-0 z-[200] h-[3px] bg-transparent pointer-events-none">
      <div className="panel-v2-nav-progress h-full bg-[#0145F2]" />
    </div>
  );
}
