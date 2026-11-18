import { createClient } from "@/lib/supabase/server";
import { duenoOSalir, AvisoSoloDueno } from "./soloDueno";
import EquipoClient, { type Persona } from "./EquipoClient";

export default async function EquipoPage() {
  const miId = await duenoOSalir();
  if (!miId) return <AvisoSoloDueno />;
  const supabase = await createClient();
  const [{ data: perfiles, error }, { data: sucursales }] = await Promise.all([
    supabase.from("perfiles").select("id, nombre, roles, sucursal_id, whatsapp, activo").order("nombre"),
    supabase.from("sucursales").select("id, nombre").order("nombre"),
  ]);
  return <EquipoClient iniciales={(perfiles as Persona[] | null) ?? []} sucursales={sucursales ?? []} miId={miId} aviso={error ? `No se pudo cargar el equipo (${error.message}).` : null} />;
}
