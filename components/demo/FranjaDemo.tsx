"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { MODULOS_DEMO } from "@/lib/demo/modulos";

// Franja arriba del panel en el MODO DEMO: avisa que todo es de ejemplo y deja saltar a cada módulo con su nombre
// (la barra lateral solo tiene íconos). Walter, 23/11/2026: "quiero ver todos los módulos".
export default function FranjaDemo() {
  const ruta = usePathname();
  return (
    <div className="sticky top-0 z-30 border-b border-amber-300/60 bg-amber-50 px-3 py-2 text-[13px] text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/60 dark:text-amber-100 print:hidden">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <p className="font-semibold">Demo con datos de ejemplo <span className="font-normal opacity-75">· probá todo, los cambios no se guardan</span></p>
        <Link href="/demo" className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-900 px-3 py-1 font-medium text-white hover:bg-amber-800">
          <MessageCircle size={14} /> Chatear con el bot
        </Link>
      </div>
      <nav aria-label="Módulos de la demo" className="-mx-1 mt-1.5 flex gap-1 overflow-x-auto pb-0.5">
        {MODULOS_DEMO.map((m) => {
          const activo = ruta === m.href || ruta.startsWith(m.href + "/");
          return (
            <Link key={m.href} href={m.href}
              className={`shrink-0 rounded-full px-2.5 py-1 font-medium ${activo ? "bg-amber-900 text-white" : "bg-white/70 text-amber-950 hover:bg-white dark:bg-white/10 dark:text-amber-100"}`}>
              {m.nombre}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
