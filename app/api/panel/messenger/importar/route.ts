import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { type SupabaseClient } from "@supabase/supabase-js";
import { supabaseEmpresa, empresaActual } from "@/lib/empresa/db";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/crypto";
import { listarConversacionesMessenger, type ConversacionHistorialMessenger } from "@/lib/meta/client";
import { registrarError } from "@/lib/panel/logger";
import { conEmpresaDeSesion } from "@/lib/empresa/sesion";

// Trae a la bandeja y a Leads las conversaciones de Messenger de los últimos
// días que llegaron ANTES de que el webhook funcionara (Meta no las reenvía).
// No contesta a nadie: solo guarda contacto, conversación y mensajes, con la
// fecha original de cada mensaje. Se puede correr más de una vez: lo que ya
// está guardado (por id de mensaje de Meta) no se duplica.

export const maxDuration = 60;

const DIAS_POR_DEFECTO = 21;
const MAX_PAGINAS = 10;

async function esAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE2_URL!,
    process.env.NEXT_PUBLIC_SUPABASE2_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: perfil } = await supabase.from("perfiles").select("roles").eq("id", user.id).maybeSingle();
  return perfil?.roles?.some((r: string) => r === "admin" || r === "director") ?? false;
}

async function POST_(request: Request) {
  try {
    if (!(await esAdmin())) return NextResponse.json({ error: "Solo Admin puede importar conversaciones." }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const dias = Math.min(Math.max(Number(body?.dias) || DIAS_POR_DEFECTO, 1), 60);
    const limite = Date.now() - dias * 24 * 60 * 60 * 1000;

    const supabase = supabaseEmpresa as unknown as SupabaseClient;
    const { data: config } = await supabase.from("messenger_configuracion").select("page_id, token_cifrado, token_iv, token_tag").eq("empresa_id", empresaActual()).maybeSingle();
    if (!config?.page_id || !config.token_cifrado || !config.token_iv || !config.token_tag) {
      return NextResponse.json({ error: "Faltan el Page ID o el token de Messenger en Configuración." }, { status: 400 });
    }
    const token = decrypt(config.token_cifrado, config.token_iv, config.token_tag);
    const pageId = String(config.page_id);

    const resumen = { conversaciones: 0, mensajesNuevos: 0, mensajesYaGuardados: 0, saltadas: 0 };

    let cursor: string | undefined;
    for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
      const lote = await listarConversacionesMessenger(pageId, token, cursor);
      let llegoAlLimite = false;
      for (const conv of lote.data) {
        if (new Date(conv.updated_time).getTime() < limite) { llegoAlLimite = true; continue; }
        const resultado = await importarConversacion(supabase, conv, pageId, limite);
        if (!resultado) { resumen.saltadas++; continue; }
        resumen.conversaciones++;
        resumen.mensajesNuevos += resultado.nuevos;
        resumen.mensajesYaGuardados += resultado.yaGuardados;
      }
      cursor = lote.paging?.cursors?.after;
      if (llegoAlLimite || !lote.paging?.next || !cursor) break;
    }

    return NextResponse.json({ ok: true, dias, ...resumen });
  } catch (error: any) {
    registrarError("api/panel/messenger/importar", error);
    return NextResponse.json({ error: error?.message ?? "Error importando las conversaciones." }, { status: 500 });
  }
}

async function importarConversacion(
  supabase: SupabaseClient<any>,
  conv: ConversacionHistorialMessenger,
  pageId: string,
  limite: number,
): Promise<{ nuevos: number; yaGuardados: number } | null> {
  const cliente = conv.participants?.data?.find((p) => p.id !== pageId);
  const mensajes = (conv.messages?.data ?? []).filter((m) => new Date(m.created_time).getTime() >= limite);
  if (!cliente?.id || mensajes.length === 0) return null;

  // Contacto: se crea si no existe; si ya existe no se pisa un nombre ya guardado.
  const { data: previo } = await supabase.from("messenger_contactos").select("id, nombre_perfil").eq("psid", cliente.id).maybeSingle();
  let contactoId = previo?.id as string | undefined;
  if (!contactoId) {
    const { data: nuevo } = await supabase.from("messenger_contactos").insert({ psid: cliente.id, nombre_perfil: cliente.name ?? null }).select("id").single();
    contactoId = nuevo?.id;
  } else if (!previo?.nombre_perfil && cliente.name) {
    await supabase.from("messenger_contactos").update({ nombre_perfil: cliente.name }).eq("id", contactoId);
  }
  if (!contactoId) return null;

  let { data: conversacion } = await supabase.from("messenger_conversaciones").select("id, last_message_at, last_inbound_at").eq("contacto_id", contactoId).maybeSingle();
  if (!conversacion) {
    const { data: nueva, error } = await supabase.from("messenger_conversaciones").insert({ contacto_id: contactoId, canal_origen: "Messenger" }).select("id, last_message_at, last_inbound_at").single();
    if (error?.code === "23505") {
      ({ data: conversacion } = await supabase.from("messenger_conversaciones").select("id, last_message_at, last_inbound_at").eq("contacto_id", contactoId).maybeSingle());
    } else {
      conversacion = nueva;
    }
  }
  if (!conversacion) return null;

  const { data: existentes } = await supabase.from("messenger_mensajes").select("messenger_message_id").eq("conversacion_id", conversacion.id).not("messenger_message_id", "is", null);
  const yaGuardadosIds = new Set((existentes ?? []).map((m: any) => m.messenger_message_id as string));

  const filas = mensajes
    .filter((m) => !yaGuardadosIds.has(m.id))
    .map((m) => {
      const saliente = m.from?.id === pageId;
      const hayAdjunto = !!m.attachments?.data?.length;
      return {
        conversacion_id: conversacion!.id,
        messenger_message_id: m.id,
        direccion: saliente ? "out" : "in",
        tipo: "text",
        texto: m.message || (hayAdjunto ? "[Envió un archivo]" : null),
        media_url: null,
        status: saliente ? "sent" : "received",
        created_at: m.created_time,
      };
    })
    .filter((f) => f.texto);

  if (filas.length > 0) {
    const { error } = await supabase.from("messenger_mensajes").insert(filas);
    if (error) throw error;
  }

  // La fecha de la conversación solo avanza (nunca se pisa algo más nuevo que ya llegó por webhook).
  const ultimoMensaje = mensajes.reduce((max, m) => (m.created_time > max ? m.created_time : max), mensajes[0].created_time);
  const ultimoEntrante = mensajes.filter((m) => m.from?.id !== pageId).reduce<string | null>((max, m) => (!max || m.created_time > max ? m.created_time : max), null);
  const patch: Record<string, string> = {};
  if (!conversacion.last_message_at || ultimoMensaje > conversacion.last_message_at) patch.last_message_at = ultimoMensaje;
  if (ultimoEntrante && (!conversacion.last_inbound_at || ultimoEntrante > conversacion.last_inbound_at)) patch.last_inbound_at = ultimoEntrante;
  if (Object.keys(patch).length > 0) await supabase.from("messenger_conversaciones").update(patch).eq("id", conversacion.id);

  return { nuevos: filas.length, yaGuardados: mensajes.length - filas.length };
}

export const POST = conEmpresaDeSesion(POST_);
