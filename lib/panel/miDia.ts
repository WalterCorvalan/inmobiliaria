import type { SupabaseClient } from "@supabase/supabase-js";

// "Para hoy" de Mi Espacio -- un resumen de lectura por rol sobre datos
// operativos de la empresa (Gestoría/Finanzas/Recepción/Ventas), pensado
// para que cada uno vea de un vistazo qué le urge sin tener que entrar a
// cada módulo. TODO ACÁ ES SOLO LECTURA: ninguna de estas funciones hace
// insert/update/delete -- Mi Espacio es una vista personal, no un lugar
// para editar ni cerrar nada de esos módulos (eso sigue viviendo en cada
// módulo real). Mismos umbrales/criterios que ya usa cada módulo (ver
// comentarios en cada función) para no inventar una segunda definición de
// "demorado"/"sin contestar" que quede desincronizada de la real.

const DIAS_SIN_RESPUESTA = 2; // mismo criterio que app/panel/leads/LeadsUnificadosClient.tsx
const DIAS_SIN_CONTACTO_CARTERA = 14; // "más de dos semanas" (paso 5 de la doc del módulo)
const DIAS_DEMORADO_EXPEDIENTE = 15; // mismo criterio que app/panel/gestoria/GestoriaClient.tsx

function diasDesde(fecha: string) {
  return Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000);
}

export async function paraHoyGestoria(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("expedientes")
    .select("id, titulo, fecha_apertura, created_at")
    .eq("archivado", false)
    .neq("estado", "cerrado")
    .order("fecha_apertura", { ascending: true })
    .limit(80);
  return (data || [])
    .map((e: any) => ({ id: e.id, titulo: e.titulo, dias: diasDesde(e.fecha_apertura || e.created_at) }))
    .filter((e) => e.dias > DIAS_DEMORADO_EXPEDIENTE)
    .sort((a, b) => b.dias - a.dias)
    .slice(0, 5);
}

export async function paraHoyFinanzas(supabase: SupabaseClient) {
  const hoy = new Date();
  const mesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const mesAnteriorStr = `${mesAnterior.getFullYear()}-${String(mesAnterior.getMonth() + 1).padStart(2, "0")}-01`;
  const [{ data: cierre }, { data: cuentas }] = await Promise.all([
    supabase.from("cierres_mensuales").select("mes, reabierto_en").eq("mes", mesAnteriorStr).maybeSingle(),
    supabase.from("cuentas").select("id, nombre, moneda, saldo").eq("activa", true).lt("saldo", 0),
  ]);
  return {
    mesAnteriorLabel: mesAnterior.toLocaleDateString("es-AR", { month: "long", year: "numeric" }),
    mesAnteriorCerrado: !!cierre && !cierre.reabierto_en,
    cuentasEnRojo: (cuentas || []).map((c: any) => ({ id: c.id, nombre: c.nombre, moneda: c.moneda, saldo: Number(c.saldo) })),
  };
}

// Última dirección real (in=cliente, out=nosotros/IA) de cada conversación
// -- mismo enfoque que app/panel/leads/page.tsx, pero acotado a las
// conversaciones ya traídas (no a las 3000 filas más recientes de mensajes
// de todo el sistema) para no repetir esa consulta pesada acá.
async function ultimaDireccion(supabase: SupabaseClient, tabla: string, conversacionIds: string[]) {
  if (conversacionIds.length === 0) return {} as Record<string, { direccion: string; created_at: string }>;
  const { data } = await supabase.from(tabla).select("conversacion_id, direccion, created_at").in("conversacion_id", conversacionIds).order("created_at", { ascending: false });
  const mapa: Record<string, { direccion: string; created_at: string }> = {};
  for (const m of data || []) if (!mapa[m.conversacion_id]) mapa[m.conversacion_id] = { direccion: m.direccion, created_at: m.created_at };
  return mapa;
}

interface LeadSinContestar { id: string; origen: "whatsapp" | "instagram" | "messenger" | "rodi"; nombre: string; telefono: string | null; vendedorId: string | null }

async function leadsSinContestar(supabase: SupabaseClient, soloVendedorId?: string): Promise<LeadSinContestar[]> {
  let qWa = supabase.from("whatsapp_conversaciones").select("id, vendedor_id, last_message_at, whatsapp_contactos(nombre_perfil, telefono)").eq("es_basura", false).order("last_message_at", { ascending: false }).limit(40);
  let qIg = supabase.from("instagram_conversaciones").select("id, vendedor_id, last_message_at, instagram_contactos(username)").eq("es_basura", false).order("last_message_at", { ascending: false }).limit(40);
  let qMessenger = supabase.from("messenger_conversaciones").select("id, vendedor_id, last_message_at, messenger_contactos(nombre_perfil)").eq("es_basura", false).order("last_message_at", { ascending: false }).limit(40);
  let qRodi = supabase.from("rodi_conversaciones").select("id, vendedor_id, last_message_at, nombre_contacto, telefono_contacto").eq("es_basura", false).order("last_message_at", { ascending: false }).limit(40);
  if (soloVendedorId) {
    qWa = qWa.eq("vendedor_id", soloVendedorId);
    qIg = qIg.eq("vendedor_id", soloVendedorId);
    qMessenger = qMessenger.eq("vendedor_id", soloVendedorId);
    qRodi = qRodi.eq("vendedor_id", soloVendedorId);
  }
  const [{ data: wa }, { data: ig }, { data: messenger }, { data: rodi }] = await Promise.all([qWa, qIg, qMessenger, qRodi]);

  const filasMessenger = (messenger || []) as unknown as { id: string; vendedor_id: string | null; messenger_contactos: { nombre_perfil: string | null } | null }[];
  const [dirWa, dirIg, dirMessenger, dirRodi] = await Promise.all([
    ultimaDireccion(supabase, "whatsapp_mensajes", (wa || []).map((c: any) => c.id)),
    ultimaDireccion(supabase, "instagram_mensajes", (ig || []).map((c: any) => c.id)),
    ultimaDireccion(supabase, "messenger_mensajes", filasMessenger.map((c) => c.id)),
    ultimaDireccion(supabase, "rodi_mensajes", (rodi || []).map((c: any) => c.id)),
  ]);

  const esSinContestar = (dir: { direccion: string; created_at: string } | undefined) => dir?.direccion === "in" && diasDesde(dir.created_at) >= DIAS_SIN_RESPUESTA;

  const lista: LeadSinContestar[] = [
    ...(wa || []).filter((c: any) => esSinContestar(dirWa[c.id])).map((c: any) => ({ id: c.id, origen: "whatsapp" as const, nombre: c.whatsapp_contactos?.nombre_perfil || c.whatsapp_contactos?.telefono || "Sin nombre", telefono: c.whatsapp_contactos?.telefono || null, vendedorId: c.vendedor_id })),
    ...(ig || []).filter((c: any) => esSinContestar(dirIg[c.id])).map((c: any) => ({ id: c.id, origen: "instagram" as const, nombre: c.instagram_contactos?.username ? `@${c.instagram_contactos.username}` : "Sin nombre", telefono: null, vendedorId: c.vendedor_id })),
    ...filasMessenger.filter((c) => esSinContestar(dirMessenger[c.id])).map((c) => ({ id: c.id, origen: "messenger" as const, nombre: c.messenger_contactos?.nombre_perfil || "Sin nombre", telefono: null, vendedorId: c.vendedor_id })),
    ...(rodi || []).filter((c: any) => esSinContestar(dirRodi[c.id])).map((c: any) => ({ id: c.id, origen: "rodi" as const, nombre: c.nombre_contacto || c.telefono_contacto || "Sin nombre", telefono: c.telefono_contacto || null, vendedorId: c.vendedor_id })),
  ];
  return lista.sort((a, b) => (a.vendedorId ? 1 : 0) - (b.vendedorId ? 1 : 0));
}

export async function colaVendedor(supabase: SupabaseClient, vendedorId: string) {
  const [leads, { data: reservas }] = await Promise.all([
    leadsSinContestar(supabase, vendedorId),
    // "reserva sin seña" -- una venta en estado "reserva" del vendedor sin
    // ninguna fila en venta_senas todavía (distinto de "señado", que ya
    // implica que la seña se registró).
    supabase.from("ventas").select("id, comprador_nombre, vehiculo_marca, vehiculo_modelo, created_at, venta_senas(id)").eq("vendedor_id", vendedorId).eq("estado", "reserva").order("created_at", { ascending: true }).limit(20),
  ]);
  const reservasSinSena = (reservas || []).filter((v: any) => !v.venta_senas || v.venta_senas.length === 0).slice(0, 5);
  return { leadsSinContestar: leads.slice(0, 6), reservasSinSena };
}

export async function carteraVendedor(supabase: SupabaseClient, vendedorId: string) {
  const { data } = await supabase.from("clientes").select("id, ultimo_contacto, created_at").eq("vendedor_id", vendedorId);
  const lista = data || [];
  const sinContactoHaceRato = lista.filter((c: any) => diasDesde(c.ultimo_contacto || c.created_at) > DIAS_SIN_CONTACTO_CARTERA).length;
  return { total: lista.length, sinContactoHaceRato };
}

// --- "Mi día" del vendedor (Walter, 26/10/2026) ---
// Página /panel/mi-dia, sin botón en el menú: se llega desde el "Resumen del día" de la campanita ("Ver en Mi día").
// Al vendedor solo (rol ventas, sin encargado/admin/director) le muestra lo de colaVendedor y carteraVendedor (lo mismo
// que el "Para hoy" de Mi Espacio, que el vendedor no abre) más visitas de hoy, seguimientos para hoy o atrasados y
// señas abiertas. El encargado, aunque también venda, sigue con su Mi Espacio.

/** Si la persona usa "Mi día": vendedor que no es encargado, admin ni director. */
export function veMiDia(roles: string[] | null | undefined): boolean {
  const r = roles ?? [];
  return r.includes("ventas") && !r.some((x) => x === "encargado" || x === "admin" || x === "director");
}

type LeadDeTarea = { vendedor_id: string | null; nombre?: string | null; nombre_perfil?: string | null; username?: string | null; nombre_contacto?: string | null } | null;
export interface TareaParaMiDia {
  id: string; titulo: string | null; tipo: string | null; fecha_vencimiento: string; creado_por: string | null;
  leads: LeadDeTarea[];
}

// Día AAAA-MM-DD en Argentina de una fecha con hora (fecha_vencimiento se guarda con hora, en UTC).
const diaAR = (instante: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(instante));

/** Seguimientos del vendedor para hoy o atrasados: los que creó o los de sus leads. Los más atrasados primero. */
export function seguimientosDelVendedor(tareas: TareaParaMiDia[], vendedorId: string, hoy: string) {
  return tareas
    .filter((t) => diaAR(t.fecha_vencimiento) <= hoy)
    .filter((t) => t.creado_por === vendedorId || t.leads.some((l) => l?.vendedor_id === vendedorId))
    .sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento))
    .map((t) => {
      const lead = t.leads.find((l) => l) ?? null;
      return {
        id: t.id,
        titulo: t.titulo || t.tipo || "Seguimiento",
        contacto: lead?.nombre || lead?.nombre_perfil || (lead?.username ? `@${lead.username}` : null) || lead?.nombre_contacto || null,
        atrasado: diaAR(t.fecha_vencimiento) < hoy,
      };
    });
}

export async function agendaVendedor(supabase: SupabaseClient, vendedorId: string, hoy: string) {
  const [{ data: visitas }, { data: tareas }, { data: senas }] = await Promise.all([
    supabase.from("visitas").select("id, nombre_cliente, horario_visita, vehiculo_marca, vehiculo_modelo, estado").eq("vendedor_id", vendedorId).eq("fecha_visita", hoy).neq("estado", "Cancelada").order("horario_visita", { ascending: true }),
    supabase
      .from("tareas_lead")
      .select("id, titulo, tipo, fecha_vencimiento, creado_por, whatsapp_conversaciones ( vendedor_id, whatsapp_contactos ( nombre_perfil ) ), instagram_conversaciones ( vendedor_id, instagram_contactos ( username ) ), rodi_conversaciones ( vendedor_id, nombre_contacto ), leads_manuales ( vendedor_id, nombre )")
      .eq("completada", false)
      // Hasta mañana a la mañana en UTC: cubre todo "hoy" de Argentina; el corte fino lo hace seguimientosDelVendedor.
      .lt("fecha_vencimiento", new Date(new Date(`${hoy}T00:00:00-03:00`).getTime() + 24 * 3600 * 1000).toISOString())
      .order("fecha_vencimiento", { ascending: true })
      .limit(200),
    supabase.from("senas").select("id, nombre, apellido, cliente_nombre, marca, modelo, fecha, created_at").eq("vendedor_id", vendedorId).eq("estado", "Activa").order("created_at", { ascending: true }).limit(10),
  ]);
  // PostgREST puede devolver una relación como objeto o como lista de uno.
  type Rel<T> = T | T[] | null | undefined;
  const uno = <T,>(x: Rel<T>): T | null => (Array.isArray(x) ? x[0] ?? null : x ?? null);
  type FilaTarea = {
    id: string; titulo: string | null; tipo: string | null; fecha_vencimiento: string; creado_por: string | null;
    whatsapp_conversaciones: Rel<{ vendedor_id: string | null; whatsapp_contactos: Rel<{ nombre_perfil: string | null }> }>;
    instagram_conversaciones: Rel<{ vendedor_id: string | null; instagram_contactos: Rel<{ username: string | null }> }>;
    rodi_conversaciones: Rel<{ vendedor_id: string | null; nombre_contacto: string | null }>;
    leads_manuales: Rel<{ vendedor_id: string | null; nombre: string | null }>;
  };
  const tareasPlanas: TareaParaMiDia[] = ((tareas ?? []) as unknown as FilaTarea[]).map((t) => {
    const wa = uno(t.whatsapp_conversaciones), ig = uno(t.instagram_conversaciones), rodi = uno(t.rodi_conversaciones), manual = uno(t.leads_manuales);
    return {
      id: t.id, titulo: t.titulo, tipo: t.tipo, fecha_vencimiento: String(t.fecha_vencimiento), creado_por: t.creado_por,
      leads: [
        wa ? { vendedor_id: wa.vendedor_id, nombre_perfil: uno(wa.whatsapp_contactos)?.nombre_perfil } : null,
        ig ? { vendedor_id: ig.vendedor_id, username: uno(ig.instagram_contactos)?.username } : null,
        rodi ? { vendedor_id: rodi.vendedor_id, nombre_contacto: rodi.nombre_contacto } : null,
        manual ? { vendedor_id: manual.vendedor_id, nombre: manual.nombre } : null,
      ],
    };
  });
  type FilaVisita = { id: string; nombre_cliente: string; horario_visita: string | null; vehiculo_marca: string | null; vehiculo_modelo: string | null; estado: string };
  type FilaSena = { id: string; nombre: string | null; apellido: string | null; cliente_nombre: string | null; marca: string | null; modelo: string | null; fecha: string | null; created_at: string };
  return {
    visitasHoy: ((visitas ?? []) as FilaVisita[]).map((v) => ({ id: v.id, nombre: v.nombre_cliente, horario: v.horario_visita, auto: [v.vehiculo_marca, v.vehiculo_modelo].filter(Boolean).join(" ") || null, estado: v.estado })),
    seguimientos: seguimientosDelVendedor(tareasPlanas, vendedorId, hoy).slice(0, 8),
    senasAbiertas: ((senas ?? []) as FilaSena[]).map((x) => ({ id: x.id, nombre: [x.nombre, x.apellido].filter(Boolean).join(" ") || x.cliente_nombre || "Sin nombre", auto: [x.marca, x.modelo].filter(Boolean).join(" ") || null, desde: x.fecha || x.created_at })),
  };
}
