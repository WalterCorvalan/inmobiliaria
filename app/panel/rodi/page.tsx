import { createClient } from "@/lib/supabase/server";
import RodiShell from "./RodiShell";
import { filtrarVendedoresAsignables, filtrarPorVendedorAsignado } from "@/lib/panel/permisosModulos";

export const metadata = { title: "Paffy | Pfaffen Cars" };

export default async function RodiPage() {
  const supabase = await createClient();

  const [{ data: { user } }, convRes, vendedoresRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("rodi_conversaciones")
      .select("*, vendedor:perfiles!rodi_conversaciones_vendedor_id_fkey ( id, nombre )")
      .order("last_message_at", { ascending: false, nullsFirst: false }),
    supabase.from("perfiles").select("id, nombre, roles, sucursal_id").eq("activo", true).order("nombre"),
  ]);
  const { data: miPerfil } = user?.id ? await supabase.from("perfiles").select("roles, sucursal_id").eq("id", user.id).maybeSingle() : { data: null };

  const soyAdmin = miPerfil?.roles?.some((r: string) => r === "admin" || r === "director") ?? false;
  const soyEncargado = miPerfil?.roles?.includes("encargado") ?? false;
  const miSucursalId = miPerfil?.sucursal_id ?? null;
  const vendedores = filtrarVendedoresAsignables(vendedoresRes.data || [], { soyAdmin, soyEncargado, miSucursalId });
  const conversacionesVisibles = filtrarPorVendedorAsignado(convRes.data || [], { soyAdmin, soyEncargado, miId: user?.id || "", miSucursalId, perfiles: vendedoresRes.data || [] });

  return (
    <RodiShell
      conversacionesIniciales={conversacionesVisibles}
      vendedores={vendedores}
      miId={user?.id || ""}
    />
  );
}
