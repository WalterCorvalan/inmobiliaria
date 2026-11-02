import type { SupabaseClient } from "@supabase/supabase-js";
import { MINUTOS_QUIETA } from "@/lib/panel/lectorCharlas";

// WhatsApp: el lead se asigna cuando termina la charla con el bot, no al entrar (Walter, 31/10/2026). Pasó con la charla de
// Lourdes: entró, la ronda se la dio a Julián, y ella quería vender su auto en Don Torcuato (le tocaba a Lucas).
//  - mientras habla solo el bot, la charla queda sin vendedor y ningún vendedor la ve (solo admin y encargados);
//  - si se habla de un auto del stock o es consignación, va enseguida a quien corresponde (lib/panel/asignacionPorAuto.ts);
//  - si no, se asigna cuando: alguien del equipo escribe (se la queda), el bot la pasa, o el cliente deja de contestar
//    (el mismo tiempo que el resumen de IA de los leads: MINUTOS_QUIETA, con la tarea cada 2 minutos).
// Instagram, Messenger y Paffy siguen como estaban.

type ConVendedor = { vendedor_id?: string | null; ai_habilitada?: boolean | null };

/** Un vendedor no ve las charlas de WhatsApp en las que todavía habla solo el bot. Admin y encargados sí. */
export function ocultarCharlasDelBotSinAsignar<T extends ConVendedor>(items: T[], d: { soyAdmin: boolean; soyEncargado: boolean }): T[] {
  if (d.soyAdmin || d.soyEncargado) return items;
  return items.filter((i) => !(i.ai_habilitada === true && !i.vendedor_id));
}

/** Quien escribe en una charla sin vendedor se la queda, si vende (no un admin que solo mira). */
export function seQuedaLaCharla(roles: string[] | null | undefined): boolean {
  return !!roles && (roles.includes("ventas") || roles.includes("encargado"));
}

/** La charla con el bot quedó quieta: el cliente dejó de contestar y hay que pasársela a un vendedor. */
export function charlaQuieta(d: { ultimoMensaje: string | null; avisadaHasta: string | null; ahora: Date }): boolean {
  if (!d.ultimoMensaje) return false;
  const ultimo = Date.parse(d.ultimoMensaje);
  if (d.ahora.getTime() - ultimo < MINUTOS_QUIETA * 60_000) return false;
  return !d.avisadaHasta || ultimo > Date.parse(d.avisadaHasta);
}

/** Aviso al vendedor cuando el cliente se fue a mitad de la charla con el bot. */
export function textoClienteDejoDeContestar(ultimoDelBot: string | null | undefined): string {
  const pregunta = (ultimoDelBot || "").replace(/\s+/g, " ").trim();
  return pregunta
    ? `El cliente dejó de contestar. Lo último que le preguntó el bot: "${pregunta.length > 160 ? `${pregunta.slice(0, 157)}...` : pregunta}". Fijate esta charla.`
    : "El cliente dejó de contestar. Fijate esta charla.";
}

/**
 * Le pone vendedor a una charla de WhatsApp que no tiene: por la ronda de la sucursal que eligió el cliente o, si no
 * eligió, por la ronda general. Respeta el interruptor de Configuración → Asignación por canal (si WhatsApp está apagado,
 * no asigna). Devuelve el vendedor, o null si no asignó a nadie.
 */
export async function asignarCharlaWhatsapp(supabase: SupabaseClient, d: { conversacionId: string; sucursalId: string | null; motivo: string }): Promise<string | null> {
  const { data: asignaSolo } = await supabase.rpc("asignacion_auto_en_tabla", { p_tabla: "whatsapp_conversaciones" });
  if (asignaSolo === false) return null;

  const { data: vendedorId } = d.sucursalId
    ? await supabase.rpc("asignar_vendedor_ronda_whatsapp_por_sucursal", { p_sucursal_id: d.sucursalId })
    : await supabase.rpc("proximo_vendedor_ronda");
  if (!vendedorId) return null;

  // Solo si sigue sin vendedor: si mientras tanto alguien la tomó, no se le saca.
  const { data: actualizada } = await supabase.from("whatsapp_conversaciones")
    .update({ vendedor_id: vendedorId, estado_lead: "asignado" })
    .eq("id", d.conversacionId).is("vendedor_id", null).select("id").maybeSingle();
  if (!actualizada) return null;

  const { data: perfil } = await supabase.from("perfiles").select("nombre").eq("id", vendedorId).maybeSingle();
  await supabase.from("eventos_lead").insert({
    whatsapp_conversacion_id: d.conversacionId, tipo: "asignacion",
    descripcion: `Asignado automáticamente a ${perfil?.nombre || "un vendedor"}: ${d.motivo}`,
  });
  return vendedorId as string;
}
