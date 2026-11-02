import type { SupabaseClient } from "@supabase/supabase-js";

// A quién va un lead según el auto (Walter, 21/10/2026: "lo que predomina es quién tiene el auto"). Vale para WhatsApp,
// Instagram, Messenger y Paffy, lo vincule el bot o el lector de charlas:
//  - si la charla es por un auto del stock, el lead va al vendedor asignado a ese auto; si el auto no tiene uno, al
//    único vendedor o encargado activo de la sucursal donde está (Don Torcuato → Lucas). Un 0 km ya no va siempre a
//    Gabriel: manda quién tiene el auto;
//  - si el cliente quiere dejar su auto en consignación, va a Gabriel;
//  - si una persona ya pasó el lead a mano, no se toca;
//  - si no se habla de ningún auto, queda la ronda de siempre.

export type PerfilVendedor = { id: string; nombre?: string | null; roles?: string[] | null; sucursal_id?: string | null; activo?: boolean | null };
export type AutoConDueno = { vendedor_asignado_id?: string | null; sucursal_id?: string | null };

const vende = (p: PerfilVendedor) => p.activo !== false && !!p.roles && (p.roles.includes("ventas") || p.roles.includes("encargado"));

/** Quién tiene el auto: su vendedor asignado (si está activo y vende) o el único que vende en su sucursal. */
export function vendedorDelAuto(auto: AutoConDueno, perfiles: PerfilVendedor[]): string | null {
  const asignado = auto.vendedor_asignado_id ? perfiles.find((p) => p.id === auto.vendedor_asignado_id) : undefined;
  if (asignado && vende(asignado)) return asignado.id;
  if (!auto.sucursal_id) return null;
  const deLaSucursal = perfiles.filter((p) => vende(p) && p.sucursal_id === auto.sucursal_id);
  return deLaSucursal.length === 1 ? deLaSucursal[0].id : null;
}

/**
 * El auto del stock que queda vinculado a la charla: null = desvincular, undefined = no tocar. Si el cliente viene a
 * vender o dejar en consignación SU auto, no se vincula ninguno (y se saca el que hubiera): el chat de Jorge Rodríguez
 * (10/10/2026) quedó atado al Corolla GR-Sport del stock cuando quería consignar su Corolla Cross. Con permuta sí, porque
 * ahí compra uno del stock.
 */
export function autoDeLaCharla(vehiculoFocoId: string | null | undefined, intencion?: string | null): string | null | undefined {
  if (intencion === "CONSIGNACION" || intencion === "VENTA") return null;
  return vehiculoFocoId || undefined;
}

/** A quién pasar el lead, o null si se deja como está. */
export function destinoDelLead(d: {
  intencion?: string | null; vendedorDelAuto: string | null; gabrielId: string | null; vendedorActual: string | null; asignadoAMano: boolean;
}): string | null {
  if (d.asignadoAMano) return null;
  const destino = d.intencion === "CONSIGNACION" ? d.gabrielId : d.vendedorDelAuto;
  return destino && destino !== d.vendedorActual ? destino : null;
}

/**
 * Lee de la base lo necesario y devuelve a quién pasar el lead y el texto para Eventos del lead, o null.
 * `fk` es la columna de eventos_lead del canal (whatsapp_conversacion_id, instagram_conversacion_id, ...).
 */
export async function asignacionPorAuto(supabase: SupabaseClient, d: {
  fk: string; conversacionId: string; vehiculoId: string | null; intencion?: string | null; vendedorActual: string | null;
}): Promise<{ vendedorId: string; descripcion: string } | null> {
  const esConsignacion = d.intencion === "CONSIGNACION";
  if (!d.vehiculoId && !esConsignacion) return null;

  const [{ data: perfiles }, { data: auto }, { count: manuales }] = await Promise.all([
    supabase.from("perfiles").select("id, nombre, roles, sucursal_id, activo, sucursal:sucursal_id ( nombre )").eq("activo", true),
    d.vehiculoId && !esConsignacion
      ? supabase.from("vehiculos").select("marca, modelo, vendedor_asignado_id, sucursal_id").eq("id", d.vehiculoId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("eventos_lead").select("id", { count: "exact", head: true }).eq(d.fk, d.conversacionId).eq("tipo", "asignacion").not("creado_por", "is", null),
  ]);
  const lista = (perfiles || []) as (PerfilVendedor & { sucursal?: { nombre?: string } | { nombre?: string }[] | null })[];
  const sucursalDe = (p: (typeof lista)[number]) => (Array.isArray(p.sucursal) ? p.sucursal[0]?.nombre : p.sucursal?.nombre) || "";
  const gabriel = lista.find((p) => /^gabriel/i.test(p.nombre || "") && /casa central/i.test(sucursalDe(p))) ?? null;
  const delAuto = auto ? vendedorDelAuto(auto as AutoConDueno, lista) : null;

  const destino = destinoDelLead({ intencion: d.intencion, vendedorDelAuto: delAuto, gabrielId: gabriel?.id ?? null, vendedorActual: d.vendedorActual, asignadoAMano: (manuales ?? 0) > 0 });
  if (!destino) return null;
  const nombre = lista.find((p) => p.id === destino)?.nombre || "vendedor";
  const nombreAuto = auto ? `${(auto as { marca?: string }).marca ?? ""} ${(auto as { modelo?: string }).modelo ?? ""}`.trim() : "";
  const descripcion = esConsignacion
    ? `Reasignado automáticamente a ${nombre}: el cliente quiere dejar su auto en consignación.`
    : `Reasignado automáticamente a ${nombre}: tiene el auto por el que consulta${nombreAuto ? ` (${nombreAuto})` : ""}.`;
  return { vendedorId: destino, descripcion };
}
