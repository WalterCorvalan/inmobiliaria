import { createClient } from "@/lib/supabase/server";
import LeadsUnificadosClient from "./LeadsUnificadosClient";
import { filtrarVendedoresAsignables, filtrarPorVendedorAsignado } from "@/lib/panel/permisosModulos";
import { ocultarCharlasDelBotSinAsignar } from "@/lib/panel/asignacionWhatsapp";
import { fetchPaginado } from "@/lib/panel/fetchPaginado";
import { cargarTareasLead } from "./tareasLead";

// Para las pestañas "Sin respuesta" y "Lead basura" hace falta saber si el
// ÚLTIMO mensaje de la charla lo mandó el cliente ("in") o nosotros/la IA
// ("out") -- eso no vive en la fila de la conversación, solo en la tabla de
// mensajes. Se trae un lote reciente ordenado desc y se agarra la primera
// ocurrencia por conversación (= el último mensaje real), en vez de una
// query por conversación (200 conversaciones x 3 canales sería carísimo).
async function ultimaDireccionPorConversacion(supabase: Awaited<ReturnType<typeof createClient>>, tabla: string) {
  const mapa: Record<string, "in" | "out"> = {};

  // Camino rápido: la base devuelve UNA fila por conversación (rpc leads_ultima_direccion, ver
  // migraciones/sql_volumen_indices_y_taller_reportes.sql) -- no escala con la cantidad de mensajes.
  const canal = tabla.replace("_mensajes", "");
  const { data: filas, error } = await supabase.rpc("leads_ultima_direccion", { p_canal: canal });
  if (!error && filas) {
    for (const m of filas as { conversacion_id: string; direccion: "in" | "out" }[]) mapa[m.conversacion_id] = m.direccion;
    return mapa;
  }

  // Fallback (si la función todavía no existe en la base): el método viejo, con su techo de 3000 filas.
  console.error(`[leads] rpc leads_ultima_direccion(${canal}) falló, uso el método viejo:`, error?.message);
  const { data } = await supabase.from(tabla).select("conversacion_id, direccion").order("created_at", { ascending: false }).limit(3000);
  for (const m of data || []) {
    if (!mapa[m.conversacion_id]) mapa[m.conversacion_id] = m.direccion;
  }
  return mapa;
}

// Carga una fuente de leads sin que un error de esa tabla se la trague
// callado (pedido 1/10: "no se están cargando ni Rodi ni Messenger"). Antes un
// select que fallaba (columna que falta en la base, relación ambigua, permiso)
// devolvía data = null y la fuente entera aparecía vacía, sin ningún aviso.
// Si el select completo falla se reintenta con uno mínimo (sin la columna
// es_basura ni el join con el contacto) -- el lead aparece igual, solo con
// menos datos -- y en cualquier caso se avisa en pantalla qué pasó.
async function cargarFuente(
  supabase: Awaited<ReturnType<typeof createClient>>,
  etiqueta: string, tabla: string, selectCompleto: string, selectMinimo: string,
): Promise<{ data: any[]; aviso: string | null }> {
  const completo = await supabase.from(tabla).select(selectCompleto).order("last_message_at", { ascending: false }).limit(1000);
  if (!completo.error) return { data: (completo.data as any[]) || [], aviso: null };
  console.error(`[leads] ${tabla}: select completo falló:`, completo.error.message);
  const minimo = await supabase.from(tabla).select(selectMinimo).order("last_message_at", { ascending: false }).limit(1000);
  if (!minimo.error) return { data: (minimo.data as any[]) || [], aviso: `${etiqueta}: se cargó con datos reducidos (${completo.error.message})` };
  console.error(`[leads] ${tabla}: select mínimo también falló:`, minimo.error.message);
  return { data: [], aviso: `${etiqueta}: no se pudo cargar (${minimo.error.message})` };
}

export default async function LeadsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [
    { data: whatsapp, aviso: avisoWA }, { data: instagram, aviso: avisoIG }, { data: messenger, aviso: avisoMSG }, { data: rodi, aviso: avisoRodi }, { data: manuales },
    { data: vendedores }, { data: sucursales }, { data: miPerfil },
    direccionWA, direccionIG, direccionMSG, direccionRodi,
    tareas,
  ] = await Promise.all([
    cargarFuente(supabase, "WhatsApp", "whatsapp_conversaciones", "id, vendedor_id, ai_habilitada, calificacion, estado_lead, canal_origen, sucursal_id, created_at, last_message_at, es_basura, whatsapp_contactos ( nombre_perfil, telefono )", "id, vendedor_id, ai_habilitada, calificacion, estado_lead, canal_origen, sucursal_id, created_at, last_message_at"),
    cargarFuente(supabase, "Instagram", "instagram_conversaciones", "id, vendedor_id, calificacion, estado_lead, canal_origen, sucursal_id, created_at, last_message_at, es_basura, instagram_contactos ( username, ig_user_id )", "id, vendedor_id, calificacion, estado_lead, canal_origen, sucursal_id, created_at, last_message_at"),
    cargarFuente(supabase, "Messenger", "messenger_conversaciones", "id, vendedor_id, calificacion, estado_lead, canal_origen, created_at, last_message_at, messenger_contactos ( nombre_perfil, psid )", "id, vendedor_id, calificacion, estado_lead, canal_origen, created_at, last_message_at"),
    cargarFuente(supabase, "Rodi", "rodi_conversaciones", "id, vendedor_id, calificacion, estado_lead, canal_origen, sucursal_id, created_at, last_message_at, es_basura, nombre_contacto, telefono_contacto", "id, vendedor_id, calificacion, estado_lead, canal_origen, sucursal_id, created_at, last_message_at, nombre_contacto, telefono_contacto"),
    supabase.from("leads_manuales").select("id, vendedor_id, calificacion, estado_lead, canal_origen, sucursal_id, created_at, es_basura, nombre, telefono").order("created_at", { ascending: false }).limit(1000),
    supabase.from("perfiles").select("id, nombre, roles, sucursal_id").eq("activo", true).order("nombre"),
    supabase.from("sucursales").select("id, nombre").order("nombre"),
    user?.id ? supabase.from("perfiles").select("roles, sucursal_id").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    ultimaDireccionPorConversacion(supabase, "whatsapp_mensajes"),
    ultimaDireccionPorConversacion(supabase, "instagram_mensajes"),
    ultimaDireccionPorConversacion(supabase, "messenger_mensajes"),
    ultimaDireccionPorConversacion(supabase, "rodi_mensajes"),
    cargarTareasLead(supabase),
  ]);

  // Se normaliza cada fuente a la misma forma para poder listarlas/filtrarlas
  // juntas -- cada una vive en su propia tabla (whatsapp/instagram/rodi
  // conversaciones + leads_manuales), esto es solo la vista unificada.
  const normalizados = [
    ...(whatsapp || []).map((c: any) => ({ id: c.id, origen: "whatsapp" as const, nombre: c.whatsapp_contactos?.nombre_perfil || c.whatsapp_contactos?.telefono || "Sin nombre", telefono: c.whatsapp_contactos?.telefono, vendedor_id: c.vendedor_id, ai_habilitada: c.ai_habilitada, calificacion: c.calificacion, estado_lead: c.estado_lead || "nuevo", canal_origen: c.canal_origen, sucursal_id: c.sucursal_id, created_at: c.created_at, last_message_at: c.last_message_at, esBasura: c.es_basura || false, ultimaDireccion: direccionWA[c.id] || null })),
    ...(instagram || []).map((c: any) => ({ id: c.id, origen: "instagram" as const, nombre: c.instagram_contactos?.username ? `@${c.instagram_contactos.username}` : c.instagram_contactos?.ig_user_id || "Sin nombre", telefono: null, vendedor_id: c.vendedor_id, calificacion: c.calificacion, estado_lead: c.estado_lead || "nuevo", canal_origen: c.canal_origen, sucursal_id: c.sucursal_id, created_at: c.created_at, last_message_at: c.last_message_at, esBasura: c.es_basura || false, ultimaDireccion: direccionIG[c.id] || null })),
    ...(messenger || []).map((c: any) => ({ id: c.id, origen: "messenger" as const, nombre: c.messenger_contactos?.nombre_perfil || "Contacto de Messenger", telefono: null, vendedor_id: c.vendedor_id, calificacion: c.calificacion, estado_lead: c.estado_lead || "nuevo", canal_origen: c.canal_origen, sucursal_id: c.sucursal_id, created_at: c.created_at, last_message_at: c.last_message_at, esBasura: c.es_basura || false, ultimaDireccion: direccionMSG[c.id] || null })),
    ...(rodi || []).map((c: any) => ({ id: c.id, origen: "rodi" as const, nombre: c.nombre_contacto || c.telefono_contacto || "Sin nombre", telefono: c.telefono_contacto, vendedor_id: c.vendedor_id, calificacion: c.calificacion, estado_lead: c.estado_lead || "nuevo", canal_origen: c.canal_origen, sucursal_id: c.sucursal_id, created_at: c.created_at, last_message_at: c.last_message_at, esBasura: c.es_basura || false, ultimaDireccion: direccionRodi[c.id] || null })),
    ...(manuales || []).map((c: any) => ({ id: c.id, origen: "manual" as const, nombre: c.nombre, telefono: c.telefono, vendedor_id: c.vendedor_id, calificacion: c.calificacion, estado_lead: c.estado_lead || "nuevo", canal_origen: c.canal_origen, sucursal_id: c.sucursal_id, created_at: c.created_at, last_message_at: c.created_at, esBasura: c.es_basura || false, ultimaDireccion: null })),
  ].sort((a, b) => new Date(b.last_message_at || b.created_at).getTime() - new Date(a.last_message_at || a.created_at).getTime());

  // Mismo criterio de reparto que /panel/whatsapp, /panel/instagram y
  // /panel/rodi (ver filtrarVendedoresAsignables) -- antes este listado
  // era global (ventas+admin, sin distinguir sucursal ni encargado),
  // así que cualquier vendedor podía reasignar un lead a cualquier otro
  // vendedor o admin del sistema entero.
  const soyAdmin = miPerfil?.roles?.some((r: string) => r === "admin" || r === "director") ?? false;
  const soyEncargado = miPerfil?.roles?.includes("encargado") ?? false;
  const miSucursalId = miPerfil?.sucursal_id ?? null;
  const vendedoresLista = filtrarVendedoresAsignables(vendedores || [], { soyAdmin, soyEncargado, miSucursalId });
  // El Ranking de Leads (con las ventas por vendedor) es solo para admin y encargado: a un vendedor no se le piden ni se le mandan esos datos.
  // Ventas cerradas de TODO el historial: alimentan el "Cierre". Una venta no está atada a un lead (puede venir del salón), por eso se cuenta por vendedor.
  const ventasCerradas = soyAdmin || soyEncargado
    ? await fetchPaginado<{ vendedor_id: string | null; fecha_cierre: string | null }>(() => supabase.from("ventas").select("id, vendedor_id, fecha_cierre").eq("estado", "cerrada").order("id"))
    : [];
  // WhatsApp: mientras habla solo el bot, ningún vendedor ve el lead (Walter, 31/10/2026; lib/panel/asignacionWhatsapp.ts).
  const leadsVisibles = ocultarCharlasDelBotSinAsignar(
    filtrarPorVendedorAsignado(normalizados, { soyAdmin, soyEncargado, miId: user?.id || "", miSucursalId, perfiles: vendedores || [] }),
    { soyAdmin, soyEncargado },
  );

  return (
    <LeadsUnificadosClient
      leadsIniciales={leadsVisibles}
      ventasCerradas={(ventasCerradas || []).map((v) => ({ vendedor_id: v.vendedor_id, fecha_cierre: v.fecha_cierre }))}
      avisosCarga={[avisoWA, avisoIG, avisoMSG, avisoRodi].filter((a): a is string => !!a)}
      topeAlcanzado={[whatsapp, instagram, messenger, rodi, manuales].some((c) => (c || []).length >= 1000)}
      vendedores={vendedoresLista}
      sucursales={sucursales || []}
      miId={user?.id || ""}
      tareas={tareas}
    />
  );
}
