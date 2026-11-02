import type { SupabaseClient } from "@supabase/supabase-js";

import { limpiarParaFiltro } from "@/lib/busquedaCatalogo";
// Búsqueda de leads (personas que todavía no son un cliente cargado en
// public.clientes) para los buscadores de cliente de Presupuesto/Seña/Venta/
// Consignación -- antes esos formularios solo buscaban en "clientes", así
// que alguien que llegó por WhatsApp/Instagram/Rodi/carga manual y nunca se
// convirtió en cliente no aparecía, aunque la conversación ya exista en el
// sistema. No se mezcla con la tabla "clientes": un lead nunca tiene los
// campos (DNI, domicilio, etc.) que piden esos formularios, así que elegir
// un lead abre el alta de "cliente nuevo" precargada con lo que ya se sabe
// en vez de "engancharlo" directo como si fuera un cliente real.
export interface LeadEncontrado {
  id: string;
  origen: "whatsapp" | "instagram" | "messenger" | "rodi" | "manual";
  nombre: string;
  telefono: string | null;
}

export async function buscarLeadsPorTexto(supabase: SupabaseClient, texto: string, limitePorOrigen = 5): Promise<LeadEncontrado[]> {
  // Sin coma ni paréntesis: rompían los .or() de abajo y la búsqueda volvía vacía.
  const q = limpiarParaFiltro(texto);
  if (q.length < 2) return [];

  const [{ data: wa }, { data: ig }, { data: msg }, { data: rodi }, { data: manuales }] = await Promise.all([
    supabase.from("whatsapp_conversaciones").select("id, whatsapp_contactos(nombre_perfil, telefono)").eq("es_basura", false)
      .or(`nombre_perfil.ilike.%${q}%,telefono.ilike.%${q}%`, { foreignTable: "whatsapp_contactos" }).limit(limitePorOrigen),
    supabase.from("instagram_conversaciones").select("id, instagram_contactos(username)").eq("es_basura", false)
      .ilike("instagram_contactos.username", `%${q}%`).limit(limitePorOrigen),
    // Messenger: sin filtro es_basura (esa tabla no lo tiene garantizado) y con !inner para que el límite cuente solo coincidencias.
    supabase.from("messenger_conversaciones").select("id, messenger_contactos!inner(nombre_perfil)")
      .ilike("messenger_contactos.nombre_perfil", `%${q}%`).limit(limitePorOrigen),
    supabase.from("rodi_conversaciones").select("id, nombre_contacto, telefono_contacto").eq("es_basura", false)
      .or(`nombre_contacto.ilike.%${q}%,telefono_contacto.ilike.%${q}%`).limit(limitePorOrigen),
    supabase.from("leads_manuales").select("id, nombre, telefono")
      .or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%`).limit(limitePorOrigen),
  ]);

  const contacto = <T,>(rel: T | T[] | null): T | null => (Array.isArray(rel) ? rel[0] ?? null : rel);

  type ConWa = { id: string; whatsapp_contactos: { nombre_perfil: string | null; telefono: string | null } | { nombre_perfil: string | null; telefono: string | null }[] | null };
  type ConIg = { id: string; instagram_contactos: { username: string | null } | { username: string | null }[] | null };
  type ConMsg = { id: string; messenger_contactos: { nombre_perfil: string | null } | { nombre_perfil: string | null }[] | null };
  type ConRodi = { id: string; nombre_contacto: string | null; telefono_contacto: string | null };
  type ConManual = { id: string; nombre: string | null; telefono: string | null };

  const resultado: LeadEncontrado[] = [
    ...((wa || []) as ConWa[])
      .map((c) => ({ id: c.id, contacto: contacto(c.whatsapp_contactos) }))
      .filter((c): c is { id: string; contacto: { nombre_perfil: string | null; telefono: string | null } } => !!c.contacto)
      .map((c) => ({ id: c.id, origen: "whatsapp" as const, nombre: c.contacto.nombre_perfil || c.contacto.telefono || "Sin nombre", telefono: c.contacto.telefono || null })),
    ...((ig || []) as ConIg[])
      .map((c) => ({ id: c.id, contacto: contacto(c.instagram_contactos) }))
      .filter((c): c is { id: string; contacto: { username: string | null } } => !!c.contacto?.username)
      .map((c) => ({ id: c.id, origen: "instagram" as const, nombre: `@${c.contacto.username}`, telefono: null })),
    ...((msg || []) as ConMsg[])
      .map((c) => ({ id: c.id, contacto: contacto(c.messenger_contactos) }))
      .filter((c): c is { id: string; contacto: { nombre_perfil: string | null } } => !!c.contacto?.nombre_perfil)
      .map((c) => ({ id: c.id, origen: "messenger" as const, nombre: c.contacto.nombre_perfil || "Contacto de Messenger", telefono: null })),
    ...((rodi || []) as ConRodi[]).map((c) => ({ id: c.id, origen: "rodi" as const, nombre: c.nombre_contacto || c.telefono_contacto || "Sin nombre", telefono: c.telefono_contacto || null })),
    ...((manuales || []) as ConManual[]).map((c) => ({ id: c.id, origen: "manual" as const, nombre: c.nombre || "Sin nombre", telefono: c.telefono || null })),
  ];
  return resultado;
}

export const LEAD_ORIGEN_LABEL: Record<LeadEncontrado["origen"], string> = {
  whatsapp: "Lead · WhatsApp",
  instagram: "Lead · Instagram",
  messenger: "Lead · Messenger",
  rodi: "Lead · Paffy",
  manual: "Lead · Manual",
};
