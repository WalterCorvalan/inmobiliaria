import type { SupabaseClient } from "@supabase/supabase-js";
import { crearAlerta, type CategoriaNotif, type PrioridadAlerta } from "./alertas";

// Ojo: este archivo lo importan tanto Server Components como componentes
// "use client" (ImprimirSena, NuevaSenaModal, etc.) -- NUNCA importar acá
// lib/panel/logger.ts (usa SUPABASE2_SERVICE_ROLE_KEY, la key de servicio)
// porque Next.js lo mete igual en el bundle del cliente y el navegador
// revienta con "supabaseKey is required." apenas se carga el módulo, antes
// de que se ejecute ninguna función. Loguear con console.error alcanza acá.
function registrarError(origen: string, error: unknown, contexto?: Record<string, unknown>) {
  console.error(`[${origen}]`, error, contexto);
}

// Equivalentes de lib/notificaciones.ts (v1) pero sobre "alertas" (nova) en
// vez de "notificaciones" (v1), y roles como array (perfiles.roles) en vez
// de columna singular "rol".
//
// Todas pasan por crearAlerta() (no insertan directo en "alertas") -- antes
// lo hacían, así que ninguna alerta de este archivo respetaba el filtro de
// módulo apagado ni el de categoría desactivada en Mi Espacio →
// Notificaciones (bug de auditoría, ver alertas/ARCHITECTURE.md). Cada
// función toma `opciones.categoriaNotif`/`opciones.modulo` opcionales --
// quien la llama decide si hay una categoría/módulo real que le corresponda
// (no todos los avisos tienen una todavía, ver la lista de categorías en
// NotificacionesTab.tsx).

type OpcionesNotif = { categoriaNotif?: CategoriaNotif; modulo?: string; prioridad?: "alta" | "media" | "baja" | "novedad" };

export async function notificarPersona(supabase: SupabaseClient, destinatarioId: string, tipo: string, mensaje: string, link: string, opciones?: OpcionesNotif) {
  try {
    await crearAlerta(supabase, destinatarioId, mensaje, { link, tipo, prioridad: opciones?.prioridad || "media", modulo: opciones?.modulo, categoriaNotif: opciones?.categoriaNotif });
  } catch (error) {
    registrarError("notificaciones:notificarPersona", error, { destinatarioId, tipo });
  }
}

// sucursalId opcional: si se pasa, prioriza al/los encargado(s) de ESA
// sucursal (admin siempre recibe, sea cual sea). Si nadie de esa sucursal
// tiene el rol "encargado" (hoy nadie lo tiene asignado todavía), cae al
// comportamiento viejo -- avisar a TODOS los admin/encargado -- para no
// perder silenciosamente un aviso importante mientras se carga esa data.
export async function notificarEncargados(supabase: SupabaseClient, mensaje: string, link: string, tipo: string = "precio_a_confirmar", sucursalId?: string | null, prioridad: PrioridadAlerta = "media", opciones?: OpcionesNotif) {
  const { data: candidatos } = await supabase.from("perfiles").select("id, roles, sucursal_id").or("roles.cs.{admin},roles.cs.{director},roles.cs.{encargado}").eq("activo", true);
  if (!candidatos || candidatos.length === 0) return;

  let destinatarios = candidatos;
  if (sucursalId) {
    const filtrados = candidatos.filter((p) => p.roles.some((r: string) => r === "admin" || r === "director") || p.sucursal_id === sucursalId);
    if (filtrados.some((p) => p.roles.includes("encargado"))) destinatarios = filtrados;
  }

  try {
    await Promise.all(destinatarios.map((e) =>
      crearAlerta(supabase, e.id, mensaje, { link, tipo, prioridad: opciones?.prioridad || prioridad, modulo: opciones?.modulo, categoriaNotif: opciones?.categoriaNotif })
    ));
  } catch (error) {
    registrarError("notificaciones:notificarEncargados", error, { tipo, sucursalId });
  }
}

// Lead nuevo sin vendedor asignado todavía (el "hola" inicial): antes solo
// avisaba a encargados, que después reasignan a mano -- se pierden minutos
// valiosos. Avisa a TODOS los vendedores por igual (mismo criterio que
// disponibilidad_vendedor.recibir_leads usa el resto del sistema para lead
// routing) para que el primero que lo vea lo tome, no solo quien está de
// turno como encargado.
export async function notificarVendedoresDisponibles(supabase: SupabaseClient, mensaje: string, link: string, tipo: string) {
  const { data: disponibilidad } = await supabase.from("disponibilidad_vendedor").select("vendedor_id, recibir_leads, hasta");
  const hoy = new Date().toISOString().slice(0, 10);
  // DisponibilidadModal.tsx promete "Volvés solo pasada la fecha 'hasta'" --
  // eso no pasaba solo: recibir_leads quedaba en false para siempre hasta
  // que alguien lo destildara a mano, `hasta` nunca se chequeaba acá.
  const noDisponibles = new Set(
    (disponibilidad || []).filter((d) => d.recibir_leads === false && (!d.hasta || d.hasta >= hoy)).map((d) => d.vendedor_id)
  );

  const { data: candidatos } = await supabase.from("perfiles").select("id, roles").or("roles.cs.{admin},roles.cs.{director},roles.cs.{encargado},roles.cs.{ventas}").eq("activo", true);
  if (!candidatos || candidatos.length === 0) return;

  const destinatarios = candidatos.filter((p) => !noDisponibles.has(p.id));
  if (destinatarios.length === 0) return;

  try {
    await Promise.all(destinatarios.map((d) =>
      crearAlerta(supabase, d.id, mensaje, { link, tipo, prioridad: "media", modulo: "leads", categoriaNotif: "leads" })
    ));
  } catch (error) {
    registrarError("notificaciones:notificarVendedoresDisponibles", error, { tipo });
  }
}

export async function notificarGestoria(supabase: SupabaseClient, mensaje: string, link: string, tipo: string = "movimiento_pendiente") {
  const { data: destinatarios } = await supabase.from("perfiles").select("id").or("roles.cs.{admin},roles.cs.{director},roles.cs.{encargado},roles.cs.{gestoria}").eq("activo", true);
  if (!destinatarios || destinatarios.length === 0) return;
  try {
    await Promise.all(destinatarios.map((d) =>
      crearAlerta(supabase, d.id, mensaje, { link, tipo, prioridad: "media", modulo: "gestoria", categoriaNotif: "gestoria" })
    ));
  } catch (error) {
    registrarError("notificaciones:notificarGestoria", error, { tipo });
  }
}

export async function notificarFinanzas(supabase: SupabaseClient, mensaje: string, link: string, tipo: string = "sobrante_registro") {
  const { data: destinatarios } = await supabase.from("perfiles").select("id").or("roles.cs.{admin},roles.cs.{director},roles.cs.{finanzas}").eq("activo", true);
  if (!destinatarios || destinatarios.length === 0) return;
  try {
    await Promise.all(destinatarios.map((d) =>
      crearAlerta(supabase, d.id, mensaje, { link, tipo, prioridad: "media", modulo: "finanzas", categoriaNotif: "finanzas" })
    ));
  } catch (error) {
    registrarError("notificaciones:notificarFinanzas", error, { tipo });
  }
}

export async function notificarRespuestaPrecio(supabase: SupabaseClient, vendedorId: string | null, mensaje: string, link: string, opciones?: OpcionesNotif) {
  if (!vendedorId) return;
  try {
    await crearAlerta(supabase, vendedorId, mensaje, { link, tipo: "precio_confirmado_respuesta", prioridad: "media", modulo: opciones?.modulo, categoriaNotif: opciones?.categoriaNotif });
  } catch (error) {
    registrarError("notificaciones:notificarRespuestaPrecio", error, { vendedorId });
  }
}
