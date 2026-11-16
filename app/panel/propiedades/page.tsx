import { createClient } from "@/lib/supabase/server";
import PropiedadesClient from "./PropiedadesClient";

export const metadata = { title: "Propiedades" };

export default async function PropiedadesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [propiedades, sucursales, equipo, perfil] = await Promise.all([
    supabase.from("propiedades").select("*").order("created_at", { ascending: false }).limit(1000),
    supabase.from("sucursales").select("id, nombre").order("nombre"),
    supabase.from("perfiles").select("id, nombre").eq("activo", true).order("nombre"),
    supabase.from("perfiles").select("roles").eq("id", user?.id ?? "").maybeSingle(),
  ]);
  const roles: string[] = perfil.data?.roles ?? [];
  return (
    <PropiedadesClient
      propiedadesIniciales={propiedades.data ?? []}
      errorCarga={propiedades.error ? "No se pudieron cargar las propiedades. Probá recargar la página." : null}
      sucursales={sucursales.data ?? []}
      equipo={equipo.data ?? []}
      miId={user?.id ?? ""}
      puedeBorrar={roles.includes("admin") || roles.includes("encargado")}
    />
  );
}
