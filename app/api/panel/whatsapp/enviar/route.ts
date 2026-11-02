import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { sendTextMessage } from "@/lib/meta/client";
import { decrypt } from "@/lib/crypto";
import { rateLimit, ipDesdeRequest } from "@/lib/rateLimit";
import { registrarError } from "@/lib/panel/logger";
import { contieneLenguajeInapropiado } from "@/lib/panel/moderacion";
import { crearAlerta } from "@/lib/panel/alertas";
import { seQuedaLaCharla } from "@/lib/panel/asignacionWhatsapp";
import { z } from "zod";

const EnviarSchema = z.object({
  conversacionId: z.string().uuid(),
  texto: z.string().trim().min(1).max(4000),
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE2_URL!,
  process.env.SUPABASE2_SERVICE_ROLE_KEY!
);

// El vendedor responde manualmente desde /panel/whatsapp — a diferencia
// del bot, esto requiere sesión de staff logueada. Las credenciales de Meta
// viven cifradas en whatsapp_configuracion (Configuración → WhatsApp), no en
// variables de entorno como en v1.
export async function POST(request: Request) {
  const limite = await rateLimit(ipDesdeRequest(request), { limite: 30, ventanaMs: 60 * 1000, proyecto: "v2" });
  if (!limite.ok) {
    return NextResponse.json({ error: "Demasiados mensajes. Esperá un momento." }, { status: 429 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE2_URL!,
    process.env.NEXT_PUBLIC_SUPABASE2_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const parsed = EnviarSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Falta conversacionId o texto." }, { status: 400 });
  }
  const { conversacionId, texto } = parsed.data;

  const moderacion = contieneLenguajeInapropiado(texto);
  if (moderacion.bloqueado) {
    return NextResponse.json({ error: moderacion.motivo }, { status: 422 });
  }

  const { data: conversacion } = await supabaseAdmin
    .from("whatsapp_conversaciones")
    .select("contacto_id, vendedor_id, ai_habilitada, estado_pipeline, whatsapp_contactos(telefono, nombre_perfil)")
    .eq("id", conversacionId)
    .single();

  const telefono = (conversacion?.whatsapp_contactos as any)?.telefono;
  if (!telefono) {
    return NextResponse.json({ error: "No se encontró el teléfono del contacto." }, { status: 404 });
  }

  const { data: perfil } = await supabaseAdmin.from("perfiles").select("nombre, roles").eq("id", user.id).maybeSingle();

  // El [Nombre] va siempre en un mensaje manual, sin importar si la IA
  // seguía activa en ese momento -- antes solo se agregaba si ya estaba
  // pausada, así que un mensaje mandado mientras el bot todavía respondía
  // salía "pelado" (ver más abajo: la pausa recién ocurre después de
  // mandar este mismo mensaje, es tarde para que el chequeo de arriba la
  // vea). El cliente siempre tiene que saber quién le escribe.
  const textoFinal = perfil?.nombre ? `[${perfil.nombre}]\n${texto}` : texto;

  const { data: mensaje, error: insertError } = await supabaseAdmin
    .from("whatsapp_mensajes")
    .insert({ conversacion_id: conversacionId, direccion: "out", tipo: "text", texto: textoFinal, status: "pending", ai_generado: false })
    .select("id")
    .single();

  if (insertError || !mensaje) {
    return NextResponse.json({ error: "No se pudo guardar el mensaje." }, { status: 500 });
  }

  const { data: config } = await supabaseAdmin.from("whatsapp_configuracion").select("*").eq("id", true).maybeSingle();
  if (!config?.listo || !config.token_cifrado || !config.token_iv || !config.token_tag || !config.phone_number_id) {
    await supabaseAdmin.from("whatsapp_mensajes").update({ status: "failed" }).eq("id", mensaje.id);
    return NextResponse.json({ error: "WhatsApp no está configurado — cargá las credenciales en Configuración." }, { status: 503 });
  }

  try {
    const token = decrypt(config.token_cifrado, config.token_iv, config.token_tag);
    const resultado = await sendTextMessage(config.phone_number_id, token, telefono, textoFinal);
    await supabaseAdmin.from("whatsapp_mensajes").update({ status: "sent", wa_message_id: resultado.messages?.[0]?.id }).eq("id", mensaje.id);

    // Un vendedor respondiendo a mano toma la charla: se pausa el bot (si no
    // lo estaba ya) para que no le pise la respuesta, y si el lead seguía
    // "Sin contactar" pasa a "Contactado" solo.
    const esPrimeraRespuesta = !conversacion?.estado_pipeline || conversacion.estado_pipeline === "sin_contactar";
    const patchConversacion: Record<string, unknown> = { last_message_at: new Date().toISOString() };
    if (conversacion?.ai_habilitada !== false) patchConversacion.ai_habilitada = false;
    if (esPrimeraRespuesta) patchConversacion.estado_pipeline = "contactado";
    // Charla sin vendedor (la atendía el bot): quien escribe se la queda, si vende (lib/panel/asignacionWhatsapp.ts).
    const seLaQueda = !conversacion?.vendedor_id && seQuedaLaCharla(perfil?.roles);
    if (seLaQueda) {
      patchConversacion.vendedor_id = user.id;
      patchConversacion.estado_lead = "asignado";
    }
    await supabaseAdmin.from("whatsapp_conversaciones").update(patchConversacion).eq("id", conversacionId);
    if (seLaQueda) {
      await supabaseAdmin.from("eventos_lead").insert({ whatsapp_conversacion_id: conversacionId, tipo: "asignacion", descripcion: `Asignado a ${perfil?.nombre || "quien respondió"}: escribió en la charla cuando la atendía el bot.`, creado_por: user.id });
    }

    // Aviso a admin/encargados de que el lead ya fue atendido -- solo en la
    // primera respuesta, no en cada mensaje de la charla (eso sería ruido).
    if (esPrimeraRespuesta) {
      const nombreContacto = (conversacion?.whatsapp_contactos as any)?.nombre_perfil || telefono;
      const { data: destinatarios } = await supabaseAdmin.from("perfiles").select("id").or("roles.cs.{admin},roles.cs.{director},roles.cs.{encargado}").eq("activo", true).neq("id", user.id);
      for (const d of destinatarios || []) {
        crearAlerta(supabaseAdmin, d.id, `${perfil?.nombre || "Un vendedor"} respondió a ${nombreContacto}`, {
          link: "/panel/whatsapp",
          tipo: "lead_respondido",
          prioridad: "novedad",
          categoriaNotif: "leads",
        }).catch((err) => console.error("[whatsapp/enviar] error notificando primera respuesta:", err));
      }
    }
  } catch (err: any) {
    registrarError("api/panel/whatsapp/enviar", err, { conversacionId, mensajeId: mensaje.id });
    // Mismo gap que en el webhook: sin esto, error_detalle quedaba en null
    // y el botón "reintentar con plantilla" del panel no mostraba el motivo
    // real (ej. "(#2) Service temporarily unavailable"), solo el genérico.
    const detalleError = (err?.message ? String(err.message) : String(err)).slice(0, 500);
    await supabaseAdmin.from("whatsapp_mensajes").update({ status: "failed", error_detalle: detalleError }).eq("id", mensaje.id);
    return NextResponse.json({ error: err?.message ?? "Error enviando el mensaje." }, { status: 502 });
  }

  return NextResponse.json({ ok: true, mensajeId: mensaje.id });
}
