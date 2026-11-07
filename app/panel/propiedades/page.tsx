import { createClient } from "@/lib/supabase/server";
import PropiedadesClient from "./PropiedadesClient";
import type { Propiedad } from "@/lib/propiedades/propiedades";

export default async function PropiedadesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [propiedades, { data: sucursales }, { data: asesores }] = await Promise.all([
    supabase.from("propiedades").select("*, propiedad_fotos ( id, url, orden, es_portada )").order("created_at", { ascending: false }).limit(1000),
    supabase.from("sucursales").select("id, nombre").order("nombre"),
    supabase.from("perfiles").select("id, nombre").eq("activo", true).order("nombre"),
  ]);

  // Si la tabla todavía no existe (falta correr migraciones/sql_009_propiedades.sql), se avisa en pantalla en vez de dejarla vacía.
  const aviso = propiedades.error ? `No se pudieron cargar las propiedades (${propiedades.error.message}). Si es la primera vez, falta correr la migración sql_009_propiedades.sql en Supabase.` : null;
  if (propiedades.error) console.error("[propiedades] no se pudo cargar:", propiedades.error.message);

  return (
    <PropiedadesClient
      iniciales={(propiedades.data as Propiedad[] | null) ?? []}
      sucursales={sucursales ?? []}
      asesores={asesores ?? []}
      miId={user?.id ?? ""}
      aviso={aviso}
    />
  );
}
