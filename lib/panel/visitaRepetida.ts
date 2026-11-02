// Visitas repetidas (Walter, 30/10/2026): Lucas pidió visita por el formulario de la web y después por WhatsApp con el
// bot, y quedaron dos visitas el mismo día y a la misma hora (una "3781609287", otra "5493781609287"). Antes de crear
// una visita automática (formularios de la web y bots), se busca si ese mismo teléfono ya tiene una visita activa ese
// día: si la tiene no se crea otra, se completa la que está con lo que le falte (el auto). La carga manual desde el
// panel no pasa por acá: si un vendedor la carga a mano, es a propósito.
import type { SupabaseClient } from "@supabase/supabase-js";
import { registrarError } from "@/lib/panel/logger";

const ESTADOS_ACTIVOS = ["Pendiente", "Confirmada"];

/** Los últimos 10 números del teléfono (sin 54 / 9 / 0 / 15 adelante), o null si no hay suficientes para comparar. */
export function telefonoComparable(telefono: string | null | undefined): string | null {
  const digitos = String(telefono ?? "").replace(/\D/g, "");
  return digitos.length >= 8 ? digitos.slice(-10) : null;
}

export function mismoTelefono(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = telefonoComparable(a);
  const y = telefonoComparable(b);
  return !!x && !!y && (x.endsWith(y) || y.endsWith(x));
}

type DatosAuto = { vehiculo_id?: string | null; vehiculo_marca?: string | null; vehiculo_modelo?: string | null };

/** Lo que le falta a la visita que ya estaba y trae la nueva (nunca pisa un dato cargado). */
export function datosQueFaltan(existente: DatosAuto, nueva: DatosAuto): DatosAuto {
  const patch: DatosAuto = {};
  if (!existente.vehiculo_id && nueva.vehiculo_id) patch.vehiculo_id = nueva.vehiculo_id;
  if (!existente.vehiculo_marca && nueva.vehiculo_marca) patch.vehiculo_marca = nueva.vehiculo_marca;
  if (!existente.vehiculo_modelo && nueva.vehiculo_modelo) patch.vehiculo_modelo = nueva.vehiculo_modelo;
  return patch;
}

/**
 * Si ese teléfono ya tiene una visita activa ese día, la completa con lo que le falte y devuelve su id (no hay que
 * crear otra). Si no, devuelve null. Ante un error de la consulta devuelve null: mejor una visita de más que perderla.
 */
export async function completarVisitaRepetida(supabase: SupabaseClient, nueva: DatosAuto & { telefono: string | null | undefined; fecha: string }): Promise<string | null> {
  if (!telefonoComparable(nueva.telefono)) return null;
  const { data, error } = await supabase.from("visitas").select("id, telefono_cliente, vehiculo_id, vehiculo_marca, vehiculo_modelo")
    .eq("fecha_visita", nueva.fecha).in("estado", ESTADOS_ACTIVOS).limit(200);
  if (error) {
    registrarError("visitas:buscar-repetida", error, { fecha: nueva.fecha });
    return null;
  }
  const existente = (data || []).find((v) => mismoTelefono(v.telefono_cliente, nueva.telefono));
  if (!existente) return null;
  const patch = datosQueFaltan(existente, nueva);
  if (Object.keys(patch).length) {
    const { error: errPatch } = await supabase.from("visitas").update(patch).eq("id", existente.id);
    if (errPatch) registrarError("visitas:completar-repetida", errPatch, { visitaId: existente.id });
  }
  return existente.id as string;
}
