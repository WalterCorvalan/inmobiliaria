// Pedidos de compra y permuta que se cargan solos desde un chat (Walter, 30/10/2026). Cuando el bot de WhatsApp,
// Instagram, Messenger o el chat de la web le pasa la charla a un vendedor y el cliente quiere vendernos su auto
// (Compra) o entregarlo como parte de pago de un auto nuestro (Permuta), se crea el pedido en Cotizaciones, en la
// pestaña de su tipo, igual que los del formulario de la web (app/api/panel/leads-tasacion). Decisiones del 30/10:
// se busca el precio de mercado con la IA como en la web, el precio que pide se guarda como lo dijo y no hay aviso
// extra (el vendedor ya recibe el de la derivación). Solo para rutas de servidor (cliente con service role).
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentReplyV2 } from "@/lib/ai/agenteV2";
import { registrarError } from "@/lib/panel/logger";
import { autoDelChat } from "@/lib/panel/consignacionDesdeChat";
import { CANALES_CHAT, type CanalChat } from "@/lib/panel/clienteSinContestar";
import { estimarPrecioMercado } from "@/lib/ai/estimarPrecioMercado";
import { descuentoPctPorKm, precioQueTomamos } from "@/lib/panel/descuentoPorKm";

type DatosDetectados = AgentReplyV2["datos_detectados"];

// Mismo tope de fotos que el formulario de la web (fotosYVideos.max(30) en app/api/panel/leads-tasacion).
const MAX_FOTOS_PEDIDO = 30;

/**
 * El pedido a guardar, o null si no corresponde. Condiciones (Walter, 30/10/2026): que quiera vendernos su auto o
 * permutarlo, y que haya dado marca, modelo, año y kilómetros. En la permuta además tiene que estar el auto de
 * nuestro stock que quiere llevarse. El precio que pide se guarda si está, no se exige.
 */
export function filaPedidoDesdeChat(intencion: AgentReplyV2["intencion"], datos: DatosDetectados | null | undefined, sinKm = false) {
  const auto = autoDelChat(datos, sinKm);
  if (!auto) return null;
  const autoQueQuiere = datos?.auto_que_quiere?.trim().slice(0, 150) || null;
  const esPermuta = intencion === "COMPRA_CON_PERMUTA" || (intencion === "COMPRA" && datos?.tiene_permuta === true);
  const tipo = intencion === "VENTA" ? "tasacion" : esPermuta && autoQueQuiere ? "permuta" : null;
  if (!tipo) return null;
  return {
    tipo,
    marca: auto.marca, modelo: auto.modelo, anio: auto.anio, kilometraje: auto.km,
    precio_pedido: datos?.precio_pedido?.trim().slice(0, 120) || null,
    auto_que_quiere: tipo === "permuta" ? autoQueQuiere : null,
  } as const;
}

export async function cargarPedidoDesdeChat(supabase: SupabaseClient, o: {
  canal: CanalChat;
  conversacionId: string;
  intencion: AgentReplyV2["intencion"];
  datos: DatosDetectados | null | undefined;
  nombre: string;
  telefono: string | null | undefined;
  email?: string | null;
  vendedorId: string | null;
  sucursalNombre?: string | null;
  sinKm?: boolean;
}) {
  const fila = filaPedidoDesdeChat(o.intencion, o.datos, o.sinKm);
  if (!fila) return false;
  const canal = CANALES_CHAT.find((c) => c.canal === o.canal)!;
  const chatLink = `${canal.ruta}?conversacion=${o.conversacionId}`;
  try {
    // Uno por charla y tipo mientras no esté descartado: si el bot vuelve a derivar, no se repite.
    const { data: ya } = await supabase.from("leads_tasacion").select("id").eq("chat_link", chatLink)
      .eq("tipo", fila.tipo).or("estado.is.null,estado.neq.descartado").limit(1);
    if (ya?.length) return false;

    const { data: lead, error } = await supabase.from("leads_tasacion").insert({
      nombre: o.nombre,
      telefono: o.telefono || "sin dato",
      email: o.email || null,
      marca: fila.marca, modelo: fila.modelo, anio: fila.anio, kilometraje: fila.kilometraje,
      tipo: fila.tipo,
      vendedor_id: o.vendedorId,
      sucursal_preferida: o.sucursalNombre || null,
      fotos_y_videos: [],
    }).select("id").single();
    if (error) throw error;

    // Lo del chat en un update aparte (migraciones/sql_pedidos_desde_chat.sql): si falta la columna, el pedido queda igual.
    const { error: errChat } = await supabase.from("leads_tasacion").update({
      canal_chat: o.canal, chat_link: chatLink, precio_pedido: fila.precio_pedido, auto_que_quiere: fila.auto_que_quiere,
    }).eq("id", lead.id);
    if (errChat) registrarError(`bot:${o.canal}:pedido-datos`, errChat, { leadId: lead.id });

    // Las fotos que mandó el cliente en ese chat hasta ahora (ya están guardadas en R2). Paffy no recibe fotos.
    if (o.canal !== "rodi") {
      const { data: fotos } = await supabase.from(canal.mensajes).select("media_url").eq("conversacion_id", o.conversacionId)
        .eq("direccion", "in").eq("tipo", "image").not("media_url", "is", null).order("created_at", { ascending: true }).limit(MAX_FOTOS_PEDIDO);
      const urls = (fotos || []).map((m) => m.media_url as string);
      if (urls.length) {
        const { error: errFotos } = await supabase.from("leads_tasacion").update({ fotos_y_videos: urls }).eq("id", lead.id);
        if (errFotos) registrarError(`bot:${o.canal}:pedido-fotos`, errFotos, { leadId: lead.id });
      }
    }

    // Precio de mercado con la IA, en segundo plano como en el formulario de la web. Lo que pide viene como texto
    // ("18 mil dólares"), así que no entra en la cuenta de lo que tomamos: solo la media y el descuento por km.
    after(async () => {
      const estimado = await estimarPrecioMercado({ marca: fila.marca, modelo: fila.modelo, anio: fila.anio, km: fila.kilometraje });
      if (!estimado) return;
      const descuentoPct = fila.kilometraje != null ? descuentoPctPorKm(fila.kilometraje) : 0;
      const { error: errPrecio } = await supabase.from("leads_tasacion").update({
        precio_mercado_estimado: precioQueTomamos({ media: estimado.precio, pide: null, descuentoPct }).precio,
        precio_mercado_medio_web: estimado.precio,
        precio_mercado_descuento_pct: descuentoPct,
        precio_mercado_fuentes: estimado.fuentes,
      }).eq("id", lead.id);
      if (errPrecio) registrarError(`bot:${o.canal}:pedido-precio-mercado`, errPrecio, { leadId: lead.id });
    });
    return true;
  } catch (err) {
    registrarError(`bot:${o.canal}:crear-pedido-compra`, err, { conversacionId: o.conversacionId });
    return false;
  }
}
