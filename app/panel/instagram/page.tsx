import { createClient } from "@/lib/supabase/server";
import ConversacionesShell from "@/components/panel/conversaciones/ConversacionesShell";
import { filtrarVendedoresAsignables, filtrarPorVendedorAsignado } from "@/lib/panel/permisosModulos";

export default async function InstagramPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [igRes, vendedoresRes, miPerfilRes, ultimosMensajesRes] = await Promise.all([
    supabase
      .from("instagram_conversaciones")
      .select(`
        id, last_message_at, unread_count, handoff_at, handoff_reason, ai_habilitada, calificacion, origen_ads, notas, estado_pipeline, estado_lead, archivada,
        instagram_contactos ( id, ig_user_id, username, nombre_perfil ), cliente_id, vehiculo_id,
        vendedor_id, vendedor:perfiles!instagram_conversaciones_vendedor_id_fkey ( id, nombre )
      `)
      .order("last_message_at", { ascending: false })
      .limit(3000),
    supabase.from("perfiles").select("id, nombre, roles, sucursal_id").eq("activo", true).order("nombre"),
    user?.id ? supabase.from("perfiles").select("roles, sucursal_id").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    // Mismo criterio que /panel/whatsapp -- ver ese page.tsx.
    supabase.from("instagram_mensajes").select("conversacion_id, texto, tipo, direccion, leido_at, created_at").order("created_at", { ascending: false }).limit(5000),
  ]);
  const ultimoMensajePorConversacion = new Map<string, { texto: string | null; tipo: string; direccion: string; leido_at: string | null }>();
  for (const m of ultimosMensajesRes.data || []) {
    if (!ultimoMensajePorConversacion.has(m.conversacion_id)) ultimoMensajePorConversacion.set(m.conversacion_id, m);
  }
  const conversacionesConUltimoMensaje = (igRes.data || []).map((c) => ({ ...c, ultimo_mensaje: ultimoMensajePorConversacion.get(c.id) || null }));

  const soyAdmin = miPerfilRes.data?.roles?.some((r: string) => r === "admin" || r === "director") ?? false;
  const soyEncargado = miPerfilRes.data?.roles?.includes("encargado") ?? false;
  const miSucursalId = miPerfilRes.data?.sucursal_id ?? null;
  const vendedores = filtrarVendedoresAsignables(vendedoresRes.data || [], { soyAdmin, soyEncargado, miSucursalId });
  const conversacionesVisibles = filtrarPorVendedorAsignado(conversacionesConUltimoMensaje, { soyAdmin, soyEncargado, miId: user?.id || "", miSucursalId, perfiles: vendedoresRes.data || [] });

  return (
    <ConversacionesShell
      canalFijo="instagram"
      backTo="/panel/instagram?tab=leads"
      conversacionesIniciales={[]}
      conversacionesInstagramIniciales={conversacionesVisibles}
      vendedores={vendedores}
      miId={user?.id || ""}
    />
  );
}
