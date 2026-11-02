// Pedido que carga un bot (WhatsApp, Instagram, Messenger, Paffy) cuando el cliente busca un auto que no tenemos.
// Bug real (30/10/2026, Walter): el bot completa "pedido_stock" en cada respuesta mientras el cliente va dando datos
// ("una Sprinter", "2020", "hasta 30 mil"), y cada vez se insertaba un pedido nuevo: César, Guillermo, Raquel y otro
// cliente quedaron 2 y 3 veces. Ahora, si el mismo cliente (mismo teléfono) ya tiene un pedido activo de la misma
// marca, se completa ese con lo nuevo; si pide otra marca, es otro pedido. Solo para rutas de servidor.
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizarMarca } from "@/lib/vehiculos";
import { registrarError } from "@/lib/panel/logger";

export type FilaPedidoBot = {
  telefono: string | null;
  nombre_cliente: string;
  marca: string;
  modelo: string | null;
  presupuesto_max: number | null;
  moneda: string;
  puertas: number | null;
  vendedor_id: string | null;
  origen: "whatsapp" | "instagram" | "messenger" | "web";
};

type PedidoExistente = { id: string; marca: string | null; nombre_cliente: string | null; vendedor_id: string | null };

/** Últimos 8 dígitos del teléfono: el mismo número llega con y sin 54/9 según el canal. Null si no alcanza. */
export function finDelTelefono(telefono: string | null | undefined): string | null {
  const digitos = (telefono || "").replace(/\D/g, "");
  return digitos.length >= 8 ? digitos.slice(-8) : null;
}

/** El pedido activo del mismo cliente con la misma marca, si hay. */
export function pedidoDeLaMismaMarca<T extends PedidoExistente>(activos: T[], marca: string): T | null {
  const buscada = normalizarMarca(marca);
  return activos.find((p) => p.marca && normalizarMarca(p.marca) === buscada) ?? null;
}

/** Lo que se actualiza en el pedido que ya estaba: solo lo que el cliente dijo ahora, sin borrar lo que ya había. */
export function cambiosDelPedido(existente: PedidoExistente, fila: FilaPedidoBot): Record<string, unknown> {
  const cambios: Record<string, unknown> = {};
  if (fila.modelo) cambios.modelo = fila.modelo;
  if (fila.presupuesto_max != null) { cambios.presupuesto_max = fila.presupuesto_max; cambios.moneda = fila.moneda; }
  if (fila.puertas != null) cambios.puertas = fila.puertas;
  // El nombre de relleno ("Cliente de WhatsApp") no pisa un nombre real.
  if (fila.nombre_cliente && !/^(Cliente de |Visitante de )/.test(fila.nombre_cliente)) cambios.nombre_cliente = fila.nombre_cliente;
  if (!existente.vendedor_id && fila.vendedor_id) cambios.vendedor_id = fila.vendedor_id;
  return cambios;
}

export async function guardarPedidoDelBot(supabase: SupabaseClient, fila: FilaPedidoBot, origenError: string): Promise<void> {
  const fin = finDelTelefono(fila.telefono);
  if (fin) {
    const { data: activos, error } = await supabase.from("pedidos").select("id, marca, nombre_cliente, vendedor_id")
      .ilike("telefono", `%${fin}`).eq("estado", "activo").eq("gestion_finalizada", false);
    if (error) registrarError(origenError, error);
    const existente = pedidoDeLaMismaMarca(activos || [], fila.marca);
    if (existente) {
      const cambios = cambiosDelPedido(existente, fila);
      if (Object.keys(cambios).length === 0) return;
      const { error: errorUpdate } = await supabase.from("pedidos").update(cambios).eq("id", existente.id);
      if (errorUpdate) registrarError(origenError, errorUpdate, { pedidoId: existente.id });
      return;
    }
  }
  const { error } = await supabase.from("pedidos").insert({ ...fila, tipo: "avisame", estado: "activo" });
  if (error) registrarError(origenError, error);
}
