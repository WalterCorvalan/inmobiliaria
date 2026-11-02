// Mandar un mensaje de texto del bot por WhatsApp, Instagram o Messenger desde el SERVIDOR (cron), con el
// mismo registro que usan los webhooks: se guarda en <canal>_mensajes como saliente "pending" y se pasa a
// "sent" (con el id de Meta, para que el eco no se duplique) o "failed". Solo para rutas de servidor:
// usa el cliente con service role que le pasan y el logger de errores.
import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/crypto";
import { sendTextMessage, sendInstagramMessage, sendMessengerMessage } from "@/lib/meta/client";
import { registrarError } from "@/lib/panel/logger";

export type CanalBot = "whatsapp" | "instagram" | "messenger";

export const TABLAS_CANAL: Record<CanalBot, { conversaciones: string; mensajes: string; contactos: string; config: string }> = {
  whatsapp: { conversaciones: "whatsapp_conversaciones", mensajes: "whatsapp_mensajes", contactos: "whatsapp_contactos", config: "whatsapp_configuracion" },
  instagram: { conversaciones: "instagram_conversaciones", mensajes: "instagram_mensajes", contactos: "instagram_contactos", config: "instagram_configuracion" },
  messenger: { conversaciones: "messenger_conversaciones", mensajes: "messenger_mensajes", contactos: "messenger_contactos", config: "messenger_configuracion" },
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function enviarTextoBot(supabase: SupabaseClient, canal: CanalBot, conversacionId: string, texto: string, config?: any): Promise<boolean> {
  const t = TABLAS_CANAL[canal];
  const cfg = config ?? (await supabase.from(t.config).select("*").maybeSingle()).data;
  if (!cfg?.token_cifrado) return false;

  const { data: conv } = await supabase.from(t.conversaciones).select("contacto_id").eq("id", conversacionId).maybeSingle();
  if (!conv?.contacto_id) return false;
  const campoDestino = canal === "whatsapp" ? "telefono" : canal === "instagram" ? "ig_user_id" : "psid";
  const { data: contacto } = await supabase.from(t.contactos).select(campoDestino).eq("id", conv.contacto_id).maybeSingle();
  const destino = (contacto as any)?.[campoDestino];
  if (!destino) return false;

  const { data: mensaje } = await supabase.from(t.mensajes).insert({ conversacion_id: conversacionId, direccion: "out", tipo: "text", texto, status: "pending", ai_generado: false }).select("id").single();
  if (!mensaje) return false;

  try {
    const token = decrypt(cfg.token_cifrado, cfg.token_iv, cfg.token_tag);
    if (canal === "whatsapp") {
      const r = await sendTextMessage(cfg.phone_number_id, token, destino, texto);
      await supabase.from(t.mensajes).update({ status: "sent", wa_message_id: r.messages?.[0]?.id }).eq("id", mensaje.id);
    } else if (canal === "instagram") {
      const r = await sendInstagramMessage(cfg.ig_user_id, token, destino, texto);
      await supabase.from(t.mensajes).update({ status: "sent", ig_message_id: r.message_id }).eq("id", mensaje.id);
    } else {
      const r = await sendMessengerMessage(cfg.page_id, token, destino, texto);
      await supabase.from(t.mensajes).update({ status: "sent", messenger_message_id: r.message_id }).eq("id", mensaje.id);
    }
    return true;
  } catch (err) {
    registrarError(`bot:${canal}:enviar-texto`, err, { conversacionId });
    const detalle = err instanceof Error ? err.message : String(err);
    await supabase.from(t.mensajes).update(canal === "whatsapp" ? { status: "failed", error_detalle: detalle.slice(0, 500) } : { status: "failed" }).eq("id", mensaje.id);
    return false;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
