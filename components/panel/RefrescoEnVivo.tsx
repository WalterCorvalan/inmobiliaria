"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase2 } from "@/lib/supabase/client";
import { escucharTablas } from "@/lib/panel/escucharTablas";

// Panel en tiempo real (pedido de Walter, 9/10/2026: "cargué un auto y en la otra PC tuve que recargar"). Escucha los
// cambios de las tablas indicadas (Supabase Realtime) y vuelve a pedir los datos de la página con router.refresh():
// lo que se carga en otra computadora aparece solo, sin recargar y sin perder lo que el usuario tiene abierto (modales,
// filtros, lo que está escribiendo). Va en el layout.tsx de cada módulo que arma sus datos en el servidor.
//
// - Varios cambios seguidos (una venta toca ventas, vehiculos y caja) se juntan en un solo refresco.
// - Con la pestaña oculta no refresca: lo hace una vez al volver a ella, si hubo cambios.
// - Las tablas tienen que estar en la publicación supabase_realtime (migraciones/sql_realtime_panel.sql) y la RLS
//   decide qué cambios le llegan a cada usuario.
export default function RefrescoEnVivo({ tablas, demoraMs = 600 }: { tablas: string[]; demoraMs?: number }) {
  const router = useRouter();
  const clave = tablas.join(",");

  useEffect(() => {
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    let pendienteAlVolver = false;

    const refrescar = () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        if (document.visibilityState === "visible") router.refresh();
        else pendienteAlVolver = true;
      }, demoraMs);
    };
    const alVolver = () => {
      if (document.visibilityState === "visible" && pendienteAlVolver) {
        pendienteAlVolver = false;
        router.refresh();
      }
    };

    const dejarDeEscuchar = escucharTablas(supabase2, clave.split(","), refrescar);
    document.addEventListener("visibilitychange", alVolver);

    return () => {
      clearTimeout(temporizador);
      document.removeEventListener("visibilitychange", alVolver);
      dejarDeEscuchar();
    };
  }, [clave, demoraMs, router]);

  return null;
}
