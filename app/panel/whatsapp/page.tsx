import { createClient } from "@/lib/supabase/server";
import ConversacionesShell from "@/components/panel/conversaciones/ConversacionesShell";
import { filtrarVendedoresAsignables, filtrarPorVendedorAsignado } from "@/lib/panel/permisosModulos";
import { ocultarCharlasDelBotSinAsignar } from "@/lib/panel/asignacionWhatsapp";

export default async function WhatsappPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [waRes, vendedoresRes, miPerfilRes, ultimosMensajesRes] = await Promise.all([
    supabase
      .from("whatsapp_conversaciones")
      .select(`
        id, last_message_at, unread_count, handoff_at, handoff_reason, handoff_resumen, ai_habilitada, calificacion, origen_ads, notas, estado_pipeline, estado_lead, archivada,
        whatsapp_contactos ( id, telefono, nombre_perfil ), cliente_id,
        vendedor_id, vendedor:perfiles!whatsapp_conversaciones_vendedor_id_fkey ( id, nombre )
      `)
      .order("last_message_at", { ascending: false })
      .limit(3000),
    supabase.from("perfiles").select("id, nombre, roles, sucursal_id").eq("activo", true).order("nombre"),
    user?.id ? supabase.from("perfiles").select("roles, sucursal_id").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    // Preview + check de leido en la bandeja (pedido 27/9) -- no hay columna
    // cacheada del último mensaje en whatsapp_conversaciones, así que se trae
    // el más reciente de cada conversación acá y se toma la primera
    // ocurrencia por conversacion_id (ordenado desc, así que la primera
    // aparición de cada id ES la más reciente de esa conversación).
    supabase.from("whatsapp_mensajes").select("conversacion_id, texto, tipo, direccion, status, created_at").order("created_at", { ascending: false }).limit(5000),
  ]);
  const ultimoMensajePorConversacion = new Map<string, { texto: string | null; tipo: string; direccion: string; status: string | null }>();
  for (const m of ultimosMensajesRes.data || []) {
    if (!ultimoMensajePorConversacion.has(m.conversacion_id)) ultimoMensajePorConversacion.set(m.conversacion_id, m);
  }
  const conversacionesConUltimoMensaje = (waRes.data || []).map((c) => ({ ...c, ultimo_mensaje: ultimoMensajePorConversacion.get(c.id) || null }));

  const soyAdmin = miPerfilRes.data?.roles?.some((r: string) => r === "admin" || r === "director") ?? false;
  const soyEncargado = miPerfilRes.data?.roles?.includes("encargado") ?? false;
  const miSucursalId = miPerfilRes.data?.sucursal_id ?? null;
  const vendedores = filtrarVendedoresAsignables(vendedoresRes.data || [], { soyAdmin, soyEncargado, miSucursalId });
  // Mientras habla solo el bot, la charla no tiene vendedor y ningún vendedor la ve (Walter, 31/10/2026).
  const conversacionesVisibles = ocultarCharlasDelBotSinAsignar(
    filtrarPorVendedorAsignado(conversacionesConUltimoMensaje, { soyAdmin, soyEncargado, miId: user?.id || "", miSucursalId, perfiles: vendedoresRes.data || [] }),
    { soyAdmin, soyEncargado },
  );

  return (
    <ConversacionesShell
      canalFijo="whatsapp"
      conversacionesIniciales={conversacionesVisibles}
      conversacionesInstagramIniciales={[]}
      vendedores={vendedores}
      miId={user?.id || ""}
    />
  );
}
