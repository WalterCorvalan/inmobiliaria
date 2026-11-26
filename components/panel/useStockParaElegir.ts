"use client";

import { useEffect, useState } from "react";
import { supabase2 } from "@/lib/supabase/client";
import { filtroOrPorPalabra, limpiarParaFiltro, palabrasDeBusqueda } from "@/lib/busquedaCatalogo";

// Lista de autos del stock para elegir en un formulario (Walter, 14/10/2026: "que en todos los campos donde haya que
// cargar un vehículo aparezcan precargados"). Sin escribir nada ya muestra el stock; con 2 letras o más busca en la base
// palabra por palabra ("toyota corolla", "AB123", "hilux 4x4"), así no depende de una lista cargada al abrir la página.

export const COLUMNAS_AUTO_PARA_ELEGIR = "id, marca, modelo, version, anio, patente, km, color, estado";
const COLUMNAS_BUSQUEDA_AUTO = ["marca", "modelo", "version", "patente"] as const;

export type AutoParaElegir = {
  id: string; marca: string; modelo: string; version: string | null; anio: number | null;
  patente: string | null; km: number | null; color: string | null; estado: string;
};

export function useStockParaElegir<T extends { id: string } = AutoParaElegir>(
  texto: string,
  {
    select = COLUMNAS_AUTO_PARA_ELEGIR,
    /** Estados que se ofrecen. Sin esto: todo el stock menos los vendidos (o también esos, con incluirVendidos). */
    estados,
    incluirVendidos = false,
    activo = true,
    limite = 40,
  }: { select?: string; estados?: readonly string[]; incluirVendidos?: boolean; activo?: boolean; limite?: number } = {},
) {
  const q = limpiarParaFiltro(texto);
  const clave = q.length >= 2 ? q : "";
  const estadosClave = estados?.join(",") ?? "";
  const [resultado, setResultado] = useState<{ clave: string; filas: T[] } | null>(null);

  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    const t = setTimeout(async () => {
      let consulta = supabase2.from("vehiculos").select(select);
      if (estadosClave) consulta = consulta.in("estado", estadosClave.split(","));
      else if (!incluirVendidos) consulta = consulta.neq("estado", "vendido");
      for (const p of palabrasDeBusqueda(clave)) consulta = consulta.or(filtroOrPorPalabra(p, COLUMNAS_BUSQUEDA_AUTO));
      const { data } = await consulta.order("marca").order("modelo").limit(limite);
      if (vivo) setResultado({ clave, filas: (data as unknown as T[]) || [] });
    }, clave ? 300 : 0);
    return () => { vivo = false; clearTimeout(t); };
  }, [clave, activo, select, estadosClave, incluirVendidos, limite]);

  const listo = resultado?.clave === clave;
  let filas = resultado?.filas ?? [];
  // Con una sola letra se filtra lo que ya está en pantalla, sin ir a la base.
  if (q.length === 1 && resultado?.clave === "") {
    const l = q.toLowerCase();
    filas = filas.filter((v) => {
      const a = v as unknown as Partial<AutoParaElegir>;
      return `${a.marca ?? ""} ${a.modelo ?? ""} ${a.patente ?? ""}`.toLowerCase().includes(l);
    });
  }
  return { filas, buscando: activo && !listo, listo };
}

/** "Toyota Corolla XEI 2019 · AB123CD" */
export function nombreAuto(a: { marca?: string | null; modelo?: string | null; version?: string | null; anio?: number | string | null }) {
  return [a.marca, a.modelo, a.version, a.anio].filter(Boolean).join(" ");
}
