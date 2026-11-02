"use client";

import { useEffect, useState } from "react";
import { MapPin, UserCheck } from "lucide-react";
import { supabase2 } from "@/lib/supabase/client";
import { vendedoresSugeridosPorSucursal, type PerfilSucursal } from "@/lib/panel/sucursalLead";

// Aviso en la ficha del lead (14/10/2026, Walter): si el auto del que habla el cliente está en otra sucursal que la
// del vendedor asignado, recomienda pasárselo a quien atiende esa sucursal (Casa Central: Julián y Fede; Don Torcuato:
// Lucas), con un botón por cada uno. No reasigna solo. Lo usan LeadDetailModal.tsx y FichaLeads.tsx.
export default function AvisoSucursalLead({ sucursalAutoId, sucursalAutoNombre, vendedorActualId, guardando, onAsignar }: {
  sucursalAutoId: string | null | undefined;
  sucursalAutoNombre: string | null | undefined;
  vendedorActualId: string | null | undefined;
  guardando: boolean;
  onAsignar: (vendedorId: string) => void;
}) {
  const [perfiles, setPerfiles] = useState<PerfilSucursal[]>([]);

  useEffect(() => {
    if (!sucursalAutoId) return;
    let vivo = true;
    supabase2.from("perfiles").select("id, nombre, roles, sucursal_id").eq("activo", true).eq("sucursal_id", sucursalAutoId)
      .then(({ data }) => { if (vivo) setPerfiles((data as PerfilSucursal[]) || []); });
    return () => { vivo = false; };
  }, [sucursalAutoId]);

  const sugeridos = vendedoresSugeridosPorSucursal({ sucursalAutoId, vendedorActualId, perfiles });
  if (sugeridos.length === 0) return null;

  return (
    <div className="mt-2.5 rounded-lg border border-sky-200 dark:border-sky-500/20 bg-sky-50 dark:bg-sky-500/10 px-2.5 py-2">
      <p className="flex items-start gap-1.5 text-[11px] font-bold text-sky-800 dark:text-sky-200">
        <MapPin className="w-3.5 h-3.5 shrink-0 mt-px" />
        <span>Este auto está en {sucursalAutoNombre || "otra sucursal"}: conviene pasarle el lead a {sugeridos.map((s) => s.nombre).join(" o ")}.</span>
      </p>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {sugeridos.map((s) => (
          <button key={s.id} type="button" disabled={guardando} onClick={() => onAsignar(s.id)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#0145F2] hover:bg-[#0138c9] text-white disabled:opacity-50">
            <UserCheck className="w-3.5 h-3.5" /> Pasarle a {s.nombre}
          </button>
        ))}
      </div>
    </div>
  );
}
