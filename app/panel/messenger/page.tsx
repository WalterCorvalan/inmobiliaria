import { createClient } from "@/lib/supabase/server";
import ConversacionesShell from "@/components/panel/conversaciones/ConversacionesShell";
import { filtrarPorVendedorAsignado } from "@/lib/panel/permisosModulos";

// Mismo patrón exacto que app/panel/instagram/page.tsx -- construido en
// paralelo (28/9) mientras la verificación de negocio de Meta está
// pendiente, para que quede listo el día que se apruebe el permiso de
// Messenger (ver Configuración > Messenger para cargar las credenciales).
export default async function MessengerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [msgRes, vendedoresRes, miPerfilRes, ultimosMensajesRes] = await Promise.all([
    supabase
      .from("messenger_conversaciones")
      .select(`
        id, last_message_at, unread_count, handoff_at, handoff_reason, ai_habilitada, calificacion, origen_ads, notas, estado_pipeline, estado_lead, archivada,
        messenger_contactos ( id, psid, nombre_perfil ), cliente_id, vehiculo_id,
        vendedor_id, vendedor:perfiles!messenger_conversaciones_vendedor_id_fkey ( id, nombre )
      `)
      .order("last_message_at", { ascending: false })
      .limit(3000),
    supabase.from("perfiles").select("id, nombre, roles, sucursal_id").eq("activo", true).order("nombre"),
    user?.id ? supabase.from("perfiles").select("roles, sucursal_id").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("messenger_mensajes").select("conversacion_id, texto, tipo, direccion, leido_at, created_at").order("created_at", { ascending: false }).limit(5000),
  ]);
  const ultimoMensajePorConversacion = new Map<string, { texto: string | null; tipo: string; direccion: string; leido_at: string | null }>();
  for (const m of ultimosMensajesRes.data || []) {
    if (!ultimoMensajePorConversacion.has(m.conversacion_id)) ultimoMensajePorConversacion.set(m.conversacion_id, m);
  }
  const conversacionesConUltimoMensaje = (msgRes.data || []).map((c) => ({ ...c, ultimo_mensaje: ultimoMensajePorConversacion.get(c.id) || null }));

  const soyAdmin = miPerfilRes.data?.roles?.some((r: string) => r === "admin" || r === "director") ?? false;
  const soyEncargado = miPerfilRes.data?.roles?.includes("encargado") ?? false;
  const miSucursalId = miPerfilRes.data?.sucursal_id ?? null;
  const vendedores = (vendedoresRes.data || []).filter((p) => {
    if (soyAdmin) return p.roles?.includes("ventas") || p.roles?.some((r: string) => r === "admin" || r === "director");
    if (soyEncargado) return p.roles?.includes("ventas") && p.sucursal_id === miSucursalId;
    return p.roles?.includes("ventas");
  });
  const conversacionesVisibles = filtrarPorVendedorAsignado(conversacionesConUltimoMensaje, { soyAdmin, soyEncargado, miId: user?.id || "", miSucursalId, perfiles: vendedoresRes.data || [] });

  return (
    <ConversacionesShell
      canalFijo="messenger"
      backTo="/panel/messenger?tab=leads"
      conversacionesIniciales={[]}
      conversacionesInstagramIniciales={[]}
      conversacionesMessengerIniciales={conversacionesVisibles}
      vendedores={vendedores}
      miId={user?.id || ""}
    />
  );
}
