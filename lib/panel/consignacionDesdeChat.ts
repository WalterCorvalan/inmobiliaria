// Consignación que se carga sola desde un chat (Walter, 30/10/2026). Cuando el bot de WhatsApp, Instagram, Messenger
// o el chat de la web le pasa la charla a un vendedor y el cliente quiere dejar su auto en consignación, se crea en
// Pendientes del módulo Consignaciones, igual que las del formulario de la web (app/api/panel/consignaciones), con el
// precio que pide el dueño y la zona. Solo para rutas de servidor (cliente con service role).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentReplyV2 } from "@/lib/ai/agenteV2";
import { registrarError } from "@/lib/panel/logger";
import { ESTADOS_CONSIGNACION_ACTIVOS } from "@/lib/panel/consignacionContacto";
import { CANALES_CHAT, type CanalChat } from "@/lib/panel/clienteSinContestar";
import { MAX_FOTOS_CONSIGNACION } from "@/lib/panel/fotosConsignacion";

type DatosDetectados = AgentReplyV2["datos_detectados"];

const numero = (v: string | null | undefined) => {
  // "2014" -> 2014; texto sin números -> null.
  const n = Number(String(v ?? "").replace(/\D/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

// Km como lo dice el cliente: "120.000", "120000 km", "120 mil", "85k". 0 vale (auto sin uso); vacío o sin números no.
function kmDeTexto(v: string | null | undefined): number | null {
  const texto = String(v ?? "").toLowerCase();
  const digitos = texto.replace(/\D/g, "");
  if (!digitos) return null;
  const n = Number(digitos);
  return /\d\s*(mil|k)\b/.test(texto) && n < 1000 ? n * 1000 : n;
}

/**
 * El auto que ofrece el cliente en el chat, solo si dio marca, modelo, año y kilómetros (si no, null). Con sinKm (charlas
 * viejas, de antes de que el bot los pidiera: lib/panel/revisarCharlasViejas.ts) alcanza con marca, modelo y año.
 */
export function autoDelChat(datos: DatosDetectados | null | undefined, sinKm = false) {
  const auto = datos?.vehiculo_propio;
  const marca = auto?.marca?.trim();
  const modelo = auto?.modelo?.trim();
  const anio = numero(auto?.anio);
  const anioValido = anio && anio >= 1950 && anio <= new Date().getFullYear() + 1 ? anio : null;
  const km = kmDeTexto(auto?.km);
  if (!marca || !modelo || !anioValido || (km == null && !sinKm)) return null;
  return { marca, modelo, anio: anioValido, km };
}

/**
 * La fila a guardar, o null si no corresponde. Condiciones (Walter, 30/10/2026): que sea una consignación y que el
 * cliente haya dado marca, modelo, año y kilómetros. El precio que pide y la zona se guardan si están, no se exigen.
 */
export function filaConsignacionDesdeChat(intencion: AgentReplyV2["intencion"], datos: DatosDetectados | null | undefined, sinKm = false) {
  const auto = autoDelChat(datos, sinKm);
  if (intencion !== "CONSIGNACION" || !auto) return null;
  return {
    vehiculo_descripcion: [auto.marca, auto.modelo, auto.anio, auto.km != null ? `${auto.km.toLocaleString("es-AR")} km` : null].filter(Boolean).join(" "),
    vehiculo_marca: auto.marca,
    vehiculo_modelo: auto.modelo,
    vehiculo_anio: auto.anio,
    vehiculo_km: auto.km,
    precio_pedido: datos?.precio_pedido?.trim().slice(0, 120) || null,
  };
}

export async function cargarConsignacionDesdeChat(supabase: SupabaseClient, o: {
  canal: CanalChat;
  conversacionId: string;
  intencion: AgentReplyV2["intencion"];
  datos: DatosDetectados | null | undefined;
  nombre: string;
  telefono: string | null | undefined;
  email?: string | null;
  vendedorId: string | null;
  sucursalId: string | null | undefined;
  sinKm?: boolean;
}) {
  const fila = filaConsignacionDesdeChat(o.intencion, o.datos, o.sinKm);
  if (!fila) return false;
  const canal = CANALES_CHAT.find((c) => c.canal === o.canal)!;
  const chatLink = `${canal.ruta}?conversacion=${o.conversacionId}`;
  try {
    // Una sola por charla mientras siga abierta: si el bot vuelve a derivar, no se repite.
    const { data: ya } = await supabase.from("consignaciones").select("id").eq("chat_link", chatLink)
      .in("estado", ESTADOS_CONSIGNACION_ACTIVOS).is("deleted_at", null).limit(1);
    if (ya?.length) return false;

    const { data, error } = await supabase.from("consignaciones").insert({
      cliente_nombre: o.nombre,
      cliente_telefono: o.telefono || "sin dato",
      cliente_email: o.email || null,
      vehiculo_descripcion: fila.vehiculo_descripcion,
      vendedor_id: o.vendedorId,
    }).select("id").single();
    if (error) throw error;

    // El resto en un update aparte, como el formulario de la web: si falta alguna columna, la consignación queda igual.
    const { error: errExtra } = await supabase.from("consignaciones").update({
      vehiculo_marca: fila.vehiculo_marca, vehiculo_modelo: fila.vehiculo_modelo,
      vehiculo_anio: fila.vehiculo_anio, vehiculo_km: fila.vehiculo_km,
      precio_pedido: fila.precio_pedido, sucursal_id: o.sucursalId || null,
      chat_link: chatLink, canal_origen: canal.canal === "rodi" ? "Chat de la web" : canal.nombre,
    }).eq("id", data.id);
    if (errExtra) registrarError(`bot:${o.canal}:consignacion-datos`, errExtra, { consignacionId: data.id });

    // Las fotos que mandó el cliente en ese chat hasta ahora (ya están guardadas en R2, no vencen). Paffy no recibe fotos.
    if (o.canal !== "rodi") {
      const { data: fotos } = await supabase.from(canal.mensajes).select("media_url").eq("conversacion_id", o.conversacionId)
        .eq("direccion", "in").eq("tipo", "image").not("media_url", "is", null).order("created_at", { ascending: true }).limit(MAX_FOTOS_CONSIGNACION);
      const urls = (fotos || []).map((m) => m.media_url as string);
      if (urls.length) {
        const { error: errFotos } = await supabase.from("consignaciones").update({ fotos: urls }).eq("id", data.id);
        if (errFotos) registrarError(`bot:${o.canal}:consignacion-fotos`, errFotos, { consignacionId: data.id });
      }
    }

    // Mismo aviso que el formulario de la web.
    const { data: destinatarios } = await supabase.from("perfiles").select("id").or("roles.cs.{admin},roles.cs.{director},roles.cs.{encargado}").eq("activo", true);
    for (const d of destinatarios || []) {
      await supabase.from("alertas").insert({
        destinatario_id: d.id,
        tipo: "consignacion_nueva",
        prioridad: "novedad",
        titulo: `Nueva consignación por ${canal.nombre} — ${o.nombre}`,
        mensaje: [fila.vehiculo_descripcion, fila.precio_pedido ? `pide ${fila.precio_pedido}` : null].filter(Boolean).join(" · "),
        link: `/panel/consignaciones?consignacion=${data.id}`,
      });
    }
    return true;
  } catch (err) {
    registrarError(`bot:${o.canal}:crear-consignacion`, err, { conversacionId: o.conversacionId });
    return false;
  }
}
