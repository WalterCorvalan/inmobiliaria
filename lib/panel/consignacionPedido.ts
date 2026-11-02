// Línea corta con lo que pidió el dueño en una consignación: precio que pide, zona y chat de donde vino
// ("Pide 11.000 dólares limpios · Casa Central · por WhatsApp"). La usan la ficha y la tabla de Consignaciones.
import { CANALES_CHAT, chatDelLink } from "@/lib/panel/clienteSinContestar";

export function detallePedidoConsignacion(c: { precio_pedido?: string | null; sucursal_nombre?: string | null; chat_link?: string | null; vehiculo_km?: number | null }): string | null {
  const canal = CANALES_CHAT.find((x) => x.canal === chatDelLink(c.chat_link)?.canal)?.nombre;
  const partes = [c.precio_pedido?.trim() ? `Pide ${c.precio_pedido.trim()}` : null, c.sucursal_nombre || null, canal ? `por ${canal}` : null, canal && c.vehiculo_km == null ? "faltan km" : null];
  return partes.filter(Boolean).join(" · ") || null;
}
