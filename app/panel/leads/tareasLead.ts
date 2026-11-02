import type { createClient } from "@/lib/supabase/server";

// Datos de las pestañas de Tareas dentro de Leads (antes módulo aparte /panel/tareas; unificado el 19/10/2026).

export async function cargarTareasLead(supabase: Awaited<ReturnType<typeof createClient>>) {
  // Igual que Ventas/Expedientes -- se pagina a los últimos 6 meses. Una
  // tarea pendiente de hace más de 6 meses ya está tan vencida que no
  // cambia nada tenerla en pantalla; lo que sí importa es no cargar años
  // de tareas completadas en cada visita al tablero.
  const desde6Meses = new Date();
  desde6Meses.setMonth(desde6Meses.getMonth() - 6);

  // tareas_lead puede colgar de cualquiera de las 4 fuentes de leads (ver
  // app/panel/leads/page.tsx) -- whatsapp_conversacion_id, instagram_conversacion_id,
  // rodi_conversacion_id, leads_manuales_id (ver el mapeo en LeadDetailModal.tsx).
  // Antes este tablero solo hacía join con whatsapp/instagram: una tarea
  // asignada sobre un lead de Rodi o cargado a mano desaparecía del board
  // por completo (el filter de abajo la descartaba por no tener "lead").
  const [{ data: todasLasTareas }, { data: leadsWaNuevos }, { data: leadsIgNuevos }, { data: leadsRodiNuevos }, { data: leadsManualesNuevos }, { data: vendedores }] = await Promise.all([
    supabase
      .from("tareas_lead")
      .select(`
        *,
        whatsapp_conversaciones ( id, vendedor_id, calificacion, whatsapp_contactos ( nombre_perfil, telefono ) ),
        instagram_conversaciones ( id, vendedor_id, calificacion, instagram_contactos ( username ) ),
        rodi_conversaciones ( id, vendedor_id, calificacion, nombre_contacto, telefono_contacto ),
        leads_manuales ( id, vendedor_id, calificacion, nombre, telefono )
      `)
      .gte("fecha_vencimiento", desde6Meses.toISOString().slice(0, 10))
      .order("fecha_vencimiento", { ascending: true }),
    supabase
      .from("whatsapp_conversaciones")
      .select("id, vendedor_id, calificacion, created_at, whatsapp_contactos ( nombre_perfil, telefono )")
      .eq("estado_lead", "nuevo")
      .order("created_at", { ascending: false }),
    supabase
      .from("instagram_conversaciones")
      .select("id, vendedor_id, calificacion, created_at, instagram_contactos ( username )")
      .eq("estado_lead", "nuevo")
      .order("created_at", { ascending: false }),
    supabase
      .from("rodi_conversaciones")
      .select("id, vendedor_id, calificacion, created_at, nombre_contacto, telefono_contacto")
      .eq("estado_lead", "nuevo")
      .order("created_at", { ascending: false }),
    supabase
      .from("leads_manuales")
      .select("id, vendedor_id, calificacion, created_at, nombre, telefono")
      .eq("estado_lead", "nuevo")
      .order("created_at", { ascending: false }),
    supabase.from("perfiles").select("id, nombre").eq("activo", true).order("nombre"),
  ]);

  const todas = (todasLasTareas || []).map((t: any) => {
    const lead = t.whatsapp_conversaciones
      ? { id: t.whatsapp_conversaciones.id, origen: "whatsapp" as const, nombre: t.whatsapp_conversaciones.whatsapp_contactos?.nombre_perfil || t.whatsapp_conversaciones.whatsapp_contactos?.telefono || "Consulta WhatsApp", vendedor_id: t.whatsapp_conversaciones.vendedor_id, calificacion: t.whatsapp_conversaciones.calificacion }
      : t.instagram_conversaciones
      ? { id: t.instagram_conversaciones.id, origen: "instagram" as const, nombre: t.instagram_conversaciones.instagram_contactos?.username ? `@${t.instagram_conversaciones.instagram_contactos.username}` : "Consulta Instagram", vendedor_id: t.instagram_conversaciones.vendedor_id, calificacion: t.instagram_conversaciones.calificacion }
      : t.rodi_conversaciones
      ? { id: t.rodi_conversaciones.id, origen: "rodi" as const, nombre: t.rodi_conversaciones.nombre_contacto || t.rodi_conversaciones.telefono_contacto || "Consulta del chat web", vendedor_id: t.rodi_conversaciones.vendedor_id, calificacion: t.rodi_conversaciones.calificacion }
      : t.leads_manuales
      ? { id: t.leads_manuales.id, origen: "manual" as const, nombre: t.leads_manuales.nombre || t.leads_manuales.telefono || "Lead manual", vendedor_id: t.leads_manuales.vendedor_id, calificacion: t.leads_manuales.calificacion }
      : null;
    return { ...t, lead };
  }).filter((t) => t.lead);

  const idsConTarea = new Set(todas.map((t) => t.lead!.id));
  const leadsSinContacto = [
    ...(leadsWaNuevos || []).filter((l) => !idsConTarea.has(l.id)).map((l: any) => ({ id: l.id, origen: "whatsapp" as const, nombre: l.whatsapp_contactos?.nombre_perfil || l.whatsapp_contactos?.telefono || "Consulta WhatsApp", telefono: l.whatsapp_contactos?.telefono, vendedor_id: l.vendedor_id, calificacion: l.calificacion, created_at: l.created_at })),
    ...(leadsIgNuevos || []).filter((l) => !idsConTarea.has(l.id)).map((l: any) => ({ id: l.id, origen: "instagram" as const, nombre: l.instagram_contactos?.username ? `@${l.instagram_contactos.username}` : "Consulta Instagram", telefono: null, vendedor_id: l.vendedor_id, calificacion: l.calificacion, created_at: l.created_at })),
    ...(leadsRodiNuevos || []).filter((l) => !idsConTarea.has(l.id)).map((l) => ({ id: l.id, origen: "rodi" as const, nombre: l.nombre_contacto || l.telefono_contacto || "Consulta del chat web", telefono: l.telefono_contacto, vendedor_id: l.vendedor_id, calificacion: l.calificacion, created_at: l.created_at })),
    ...(leadsManualesNuevos || []).filter((l) => !idsConTarea.has(l.id)).map((l) => ({ id: l.id, origen: "manual" as const, nombre: l.nombre || l.telefono || "Lead manual", telefono: l.telefono, vendedor_id: l.vendedor_id, calificacion: l.calificacion, created_at: l.created_at })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return {
    tareasIniciales: todas.filter((t) => !t.completada),
    tareasCompletadas: todas.filter((t) => t.completada),
    leadsSinContacto,
    vendedores: vendedores || [],
  };
}

export type DatosTareasLead = Awaited<ReturnType<typeof cargarTareasLead>>;
