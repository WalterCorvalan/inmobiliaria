import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEmpresa as supabaseAdmin, empresaActual } from "@/lib/empresa/db";
import { sendInstagramMessage } from "@/lib/meta/client";
import { humanAgentActivo } from "@/lib/panel/ventana24h";
import { decrypt } from "@/lib/crypto";
import { rateLimit, ipDesdeRequest } from "@/lib/rateLimit";
import { registrarError } from "@/lib/panel/logger";
import { contieneLenguajeInapropiado } from "@/lib/panel/moderacion";
import { crearAlerta } from "@/lib/panel/alertas";
import { z } from "zod";
import { conEmpresaDeSesion } from "@/lib/empresa/sesion";

const EnviarSchema = z.object({
  conversacionId: z.string().uuid(),
  texto: z.string().trim().min(1).max(4000),
});


async function POST_(request: Request) {
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
    .from("instagram_conversaciones")
    .select("contacto_id, ai_habilitada, estado_pipeline, instagram_contactos(ig_user_id, username)")
    .eq("id", conversacionId)
    .single();

  const igUserId = (conversacion?.instagram_contactos as any)?.ig_user_id;
  if (!igUserId) {
    return NextResponse.json({ error: "No se encontró el contacto de Instagram." }, { status: 404 });
  }

  const { data: mensaje, error: insertError } = await supabaseAdmin
    .from("instagram_mensajes")
    .insert({ conversacion_id: conversacionId, direccion: "out", tipo: "text", texto, status: "pending", ai_generado: false })
    .select("id")
    .single();

  if (insertError || !mensaje) {
    return NextResponse.json({ error: "No se pudo guardar el mensaje." }, { status: 500 });
  }

  const { data: config } = await supabaseAdmin.from("instagram_configuracion").select("*").eq("empresa_id", empresaActual()).maybeSingle();
  if (!config?.listo || !config.token_cifrado || !config.token_iv || !config.token_tag || !config.ig_user_id) {
    await supabaseAdmin.from("instagram_mensajes").update({ status: "failed" }).eq("id", mensaje.id);
    return NextResponse.json({ error: "Instagram no está configurado — cargá las credenciales en Configuración." }, { status: 503 });
  }

  try {
    const token = decrypt(config.token_cifrado, config.token_iv, config.token_tag);
    // Lo manda una persona: con el permiso Human Agent prendido puede contestar hasta 7 días (lib/panel/ventana24h.ts).
    await sendInstagramMessage(config.ig_user_id, token, igUserId, texto, { humanAgent: humanAgentActivo() });
    await supabaseAdmin.from("instagram_mensajes").update({ status: "sent" }).eq("id", mensaje.id);

    const esPrimeraRespuesta = !conversacion?.estado_pipeline || conversacion.estado_pipeline === "sin_contactar";
    const patchConversacion: Record<string, unknown> = { last_message_at: new Date().toISOString() };
    if (conversacion?.ai_habilitada !== false) patchConversacion.ai_habilitada = false;
    if (esPrimeraRespuesta) patchConversacion.estado_pipeline = "contactado";
    await supabaseAdmin.from("instagram_conversaciones").update(patchConversacion).eq("id", conversacionId);

    // Aviso a admin/encargados de que el lead ya fue atendido -- solo en la
    // primera respuesta, no en cada mensaje de la charla (eso sería ruido).
    if (esPrimeraRespuesta) {
      const { data: perfil } = await supabaseAdmin.from("perfiles").select("nombre").eq("id", user.id).maybeSingle();
      const nombreContacto = (conversacion?.instagram_contactos as any)?.username ? `@${(conversacion?.instagram_contactos as any)?.username}` : "un contacto de Instagram";
      const { data: destinatarios } = await supabaseAdmin.from("perfiles").select("id").or("roles.cs.{admin},roles.cs.{director},roles.cs.{encargado}").eq("activo", true).neq("id", user.id);
      for (const d of destinatarios || []) {
        crearAlerta(supabaseAdmin, d.id, `${perfil?.nombre || "Un vendedor"} respondió a ${nombreContacto}`, {
          link: "/panel/whatsapp",
          tipo: "lead_respondido",
          prioridad: "novedad",
          categoriaNotif: "leads",
        }).catch((err) => console.error("[instagram/enviar] error notificando primera respuesta:", err));
      }
    }
  } catch (err: any) {
    registrarError("api/panel/instagram/enviar", err, { conversacionId, mensajeId: mensaje.id });
    await supabaseAdmin.from("instagram_mensajes").update({ status: "failed" }).eq("id", mensaje.id);
    return NextResponse.json({ error: err?.message ?? "Error enviando el mensaje." }, { status: 502 });
  }

  return NextResponse.json({ ok: true, mensajeId: mensaje.id });
}

export const POST = conEmpresaDeSesion(POST_);
