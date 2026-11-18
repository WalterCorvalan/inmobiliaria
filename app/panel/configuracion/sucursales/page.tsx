import { createClient } from "@/lib/supabase/server";
import { duenoOSalir, AvisoSoloDueno } from "../soloDueno";
import OficinasClient, { type Oficina } from "./OficinasClient";

export default async function OficinasPage() {
  if (!(await duenoOSalir())) return <AvisoSoloDueno />;
  const supabase = await createClient();
  const { data, error } = await supabase.from("sucursales")
    .select("id, nombre, slug, direccion, telefono_encargado, encargado_nombre, google_maps_url, horario_texto, horario_dia_desde, horario_dia_hasta, horario_hora_desde, horario_hora_hasta")
    .order("nombre");
  return <OficinasClient iniciales={(data as Oficina[] | null) ?? []} aviso={error ? `No se pudieron cargar las oficinas (${error.message}).` : null} />;
}
