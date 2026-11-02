"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { Car, X, ArrowRight, Sparkles } from "lucide-react";
import { supabase2 } from "@/lib/supabase/client";
import { CURVA } from "@/components/ui/movimiento";

// Cartel de "Nuevo ingreso" para el equipo comercial (pedido de Walter 9/10): cuando entra un auto al stock
// (alta nueva, o pasa de "en preparación" a "disponible") aparece una tarjeta con foto y un botón a su ficha.
// Es decorativo, además de la alerta: no se guarda nada. Llega por tiempo real de `vehiculos`
// (migraciones/sql_realtime_panel.sql). A quien lo cargó no se le muestra.

type Ingreso = { id: string; marca: string; modelo: string; anio: number | null; foto: string | null; sucursal: string | null };
type FilaVehiculo = { id: string; marca: string; modelo: string; anio: number | null; fotos: string[] | null; estado: string; creado_por?: string | null; sucursal_id?: string | null };

const DURACION_MS = 14000;

export default function NuevoIngresoAviso({ miId }: { miId: string | null }) {
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const vistos = useRef(new Set<string>());
  const reducido = useReducedMotion();

  useEffect(() => {
    const mostrar = async (v: FilaVehiculo) => {
      if (vistos.current.has(v.id) || (miId && v.creado_por === miId)) return;
      vistos.current.add(v.id);
      let sucursal: string | null = null;
      if (v.sucursal_id) {
        const { data } = await supabase2.from("sucursales").select("nombre").eq("id", v.sucursal_id).maybeSingle();
        sucursal = data?.nombre ?? null;
      }
      setIngresos((l) => [{ id: v.id, marca: v.marca, modelo: v.modelo, anio: v.anio, foto: v.fotos?.[0] ?? null, sucursal }, ...l].slice(0, 3));
      setTimeout(() => setIngresos((l) => l.filter((x) => x.id !== v.id)), DURACION_MS);
    };
    const canal = supabase2
      .channel(`nuevo-ingreso-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "vehiculos" }, (p) => { void mostrar(p.new as FilaVehiculo); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "vehiculos" }, (p) => {
        const nuevo = p.new as FilaVehiculo;
        const viejo = p.old as Partial<FilaVehiculo>;
        // Solo cuando sale de preparación y queda a la venta (si la base no manda el estado anterior, no se avisa).
        if (nuevo.estado === "disponible" && viejo?.estado === "en_preparacion") void mostrar(nuevo);
      })
      .subscribe();
    return () => { supabase2.removeChannel(canal); };
  }, [miId]);

  const cerrar = (id: string) => setIngresos((l) => l.filter((x) => x.id !== id));

  return (
    <div className="fixed top-20 right-4 z-[90] flex flex-col gap-3 w-[min(22rem,calc(100vw-2rem))] pointer-events-none" aria-live="polite">
      <AnimatePresence>
        {ingresos.map((v) => (
          <m.div
            key={v.id}
            layout
            initial={reducido ? { opacity: 0 } : { opacity: 0, x: 40, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={reducido ? { opacity: 0 } : { opacity: 0, x: 40 }}
            transition={{ duration: reducido ? 0 : 0.35, ease: CURVA }}
            className="pointer-events-auto overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#141414] shadow-2xl"
          >
            <div className="relative h-32 bg-slate-100 dark:bg-white/5">
              {v.foto
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={v.foto} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-600"><Car className="w-12 h-12" /></div>}
              <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#0145F2] px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow">
                <Sparkles className="w-3 h-3" /> Nuevo ingreso
              </span>
              <button onClick={() => cerrar(v.id)} title="Cerrar" className="absolute right-2 top-2 rounded-full bg-black/45 p-1.5 text-white hover:bg-black/65"><X className="w-3.5 h-3.5" /></button>
              {!reducido && (
                <m.div className="absolute bottom-0 left-0 h-1 bg-[#0145F2]" initial={{ width: "100%" }} animate={{ width: "0%" }} transition={{ duration: DURACION_MS / 1000, ease: "linear" }} />
              )}
            </div>
            <div className="flex items-center justify-between gap-3 p-3.5">
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-900 dark:text-white truncate">{v.marca} {v.modelo}{v.anio ? ` ${v.anio}` : ""}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{v.sucursal ? `Entró en ${v.sucursal}` : "Entró al stock"}</p>
              </div>
              <Link href={`/panel/stock?vehiculo=${v.id}`} onClick={() => cerrar(v.id)} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#0145F2] px-3 py-2 text-xs font-bold text-white hover:bg-[#0138c9]">
                Ver ficha <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </m.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
