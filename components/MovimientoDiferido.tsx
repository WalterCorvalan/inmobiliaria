"use client";

import { LazyMotion } from "framer-motion";

// Velocidad de la web (PENDIENTES 4a, 15/10/2026): framer-motion pesaba unos 138 KB en el JavaScript que la portada
// baja antes de dibujar. Ahora todos los componentes usan `m.div` (la versión liviana) y las funciones que animan se
// bajan aparte, recién después de la primera carga. Mientras tanto los elementos se ven en su estado final o inicial,
// igual que antes de que se hidratara la página.
//
// Va en el layout raíz para que valga en la web y en el panel. `domMax` y no `domAnimation` porque el panel usa
// animaciones de posición compartida (layoutId del menú lateral y el "morph" de components/ui/movimiento.tsx).
// Un componente nuevo tiene que usar `m.` y no `motion.`: `motion.` vuelve a meter la librería entera en la portada.
const cargarFunciones = () => import("@/lib/movimientoFunciones").then((mod) => mod.default);

export default function MovimientoDiferido({ children }: { children: React.ReactNode }) {
  return <LazyMotion features={cargarFunciones}>{children}</LazyMotion>;
}
