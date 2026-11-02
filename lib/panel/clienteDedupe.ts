import type { SupabaseClient } from "@supabase/supabase-js";

// Equivalente de lib/clienteDedupe.ts (v1) sobre la tabla clientes de nova
// (dni_cuit en vez de dni, telefono en vez de telefono_celular).
export async function buscarClienteDuplicado(
  supabase: SupabaseClient,
  datos: { nombre: string; apellido: string; dni_cuit?: string | null; telefono?: string | null }
) {
  const dni = (datos.dni_cuit || "").trim();
  const telefonoNormalizado = (datos.telefono || "").replace(/\D/g, "");
  const telefonoUltimos8 = telefonoNormalizado.slice(-8);

  if (dni) {
    const { data } = await supabase.from("clientes").select("*").eq("dni_cuit", dni).maybeSingle();
    if (data) return data;
  }

  if (telefonoUltimos8.length >= 8) {
    const { data } = await supabase.from("clientes").select("*").not("telefono", "is", null).ilike("telefono", `%${telefonoUltimos8}`);
    const match = (data || []).find((c: any) => (c.telefono || "").replace(/\D/g, "").endsWith(telefonoUltimos8));
    if (match) return match;
  }

  if (!dni && telefonoUltimos8.length < 8 && datos.nombre.trim() && datos.apellido.trim()) {
    const { data } = await supabase.from("clientes").select("*").ilike("nombre", datos.nombre.trim()).ilike("apellido", datos.apellido.trim()).limit(1).maybeSingle();
    if (data) return data;
  }

  return null;
}
