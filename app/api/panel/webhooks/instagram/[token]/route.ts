import { after } from "next/server";
import { randomUUID } from "crypto";
import { extensionDeArchivo, resolverAdjuntoMeta } from "@/lib/panel/adjuntosMeta";
import { isAiConfiguredV2 } from "@/lib/ai/indexV2";
import { generarRespuestaAgenteV2, dividirRespuestaEnMensajes } from "@/lib/ai/agenteV2";
import { sendInstagramPrivateReply, sendInstagramMessage, sendInstagramImageMessage, replyToInstagramCommentPublicly, getInstagramUserProfile } from "@/lib/meta/client";
import { decrypt } from "@/lib/crypto";
import { esSoloEmoji, respuestaAReaccionHistoria, respuestaAMencionHistoria, textoDeRespuestaAHistoria } from "@/lib/meta/reaccionHistoria";
import { rateLimit, ipDesdeRequest } from "@/lib/rateLimit";
import { registrarError } from "@/lib/panel/logger";
import { buscarRespuestaFueraHorario, buscarRespuestaMemoria, textoPendienteDelCliente } from "@/lib/panel/whatsappMemoria";
import { guardarDatosDeContacto, procesarDerivacion } from "@/lib/panel/botDespuesDelAgente";
import { horarioDeConfig, estaEnHorario, debeAvisarFueraDeHorario, textoFueraDeHorarioPorDefecto } from "@/lib/panel/horarioBots";
import { enviarTextoBot } from "@/lib/panel/enviarMensajeBot";
import { subirArchivoR2, r2Configurado } from "@/lib/storage/r2";
import { RESPUESTA_FALLBACK } from "@/lib/panel/textosBot";
import { zonaActual, supabaseEmpresa as supabase, dentroDeEmpresa, empresaPorTokenDeWebhook } from "@/lib/empresa/db";
import { verificarFirmaDeMeta } from "@/lib/empresa/credenciales";

// Webhook de Meta para el Instagram de panel (Conversaciones → Instagram),
// mismo patrón que /api/panel/webhooks/whatsapp: comentario en un post →
// respuesta privada automática, y a partir de ahí sigue como DM normal
// atendido por el mismo agente (agenteV2). Credenciales cifradas en
// instagram_configuracion (Configuración → Instagram), no en env vars.


// El colchón de DEBOUNCE_MS (ver más abajo) se suma al tiempo de la función
// -- sin este límite explícito corre el riesgo de superar el default de la
// plataforma antes de terminar de contestar. Mismo criterio que el webhook
// de WhatsApp (60 s: espera + dos pasadas de IA + búsqueda de stock).
export const maxDuration = 120; // 60 s de espera antes de contestar (ESPERA_ANTES_DE_CONTESTAR_MS) + lo que tarda la IA

const MENSAJE_APERTURA =
  "¡Hola! 👋 Gracias por tu comentario. Te escribimos por acá para ayudarte más rápido — ¿qué auto te interesa?";

// Automatización tipo ManyChat: si el texto del comentario contiene alguna
// palabra clave configurada en Configuración > Instagram, se usa esa
// respuesta puntual en vez del mensaje de apertura genérico -- reglas
// globales (no por post), la primera que matchea por orden gana.
async function buscarAutomatizacionPorComentario(texto: string): Promise<{ respuesta_dm: string; respuesta_publica: string | null } | null> {
  const { data: reglas } = await supabase
    .from("instagram_automatizaciones_comentarios")
    .select("palabras_clave, respuesta_dm, respuesta_publica")
    .eq("activo", true)
    .order("orden");
  const textoLower = texto.toLowerCase();
  for (const regla of reglas || []) {
    if ((regla.palabras_clave || []).some((p: string) => textoLower.includes(p.toLowerCase()))) {
      return { respuesta_dm: regla.respuesta_dm, respuesta_publica: regla.respuesta_publica || null };
    }
  }
  return null;
}

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const empresa = await empresaPorTokenDeWebhook("instagram", token);
  if (!empresa) return new Response("Not found", { status: 404 });

  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const verifyToken = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && verifyToken === token) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const limite = await rateLimit(ipDesdeRequest(req), { limite: 60, ventanaMs: 60 * 1000, proyecto: "v2" });
  if (!limite.ok) return new Response("Too many requests", { status: 429 });

  const { token } = await params;
  const empresa = await empresaPorTokenDeWebhook("instagram", token);
  if (!empresa) return new Response("Not found", { status: 404 });
  const empresaId = empresa.id;

  const rawBody = await req.text();

  // Cada empresa firma con el secreto de SU app de Meta (guardado cifrado en su configuración).
  const firmaOk = await dentroDeEmpresa(empresaId, () => verificarFirmaDeMeta("instagram", rawBody, req.headers.get("x-hub-signature-256") ?? "", "webhook-ig-v2:firma"));
  if (!firmaOk) return new Response("Unauthorized", { status: 401 });

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    // Body que pasó la firma HMAC pero no es JSON válido -- sin este catch
    // tiraba 500 sin loguear nada útil. Devolvemos 200 igual que un error
    // de procesamiento, para no generar reintentos infinitos de Meta.
    registrarError("webhook-ig-v2:parse-body", err);
    return Response.json({ received: true });
  }
  try {
    await dentroDeEmpresa(empresaId, () => procesarEvento(payload), empresa.zona);
  } catch (err) {
    registrarError("webhook-ig-v2:procesar-evento", err);
  }

  return Response.json({ received: true });
}

// Mismo fix del 25/9 que ya tiene el webhook de WhatsApp: si el cliente
// manda dos (o más) mensajes casi seguidos por Instagram, el bot tiene que
// leerlos juntos antes de contestar, no contestar al primero y confundirse
// con el segundo. Se guardan TODOS los mensajes entrantes del payload
// primero (acá abajo, sin tocar al agente) y recién al final se dispara el
// agente una sola vez por conversación tocada -- así el historial que arma
// ejecutarAgente ya trae los mensajes juntos en vez de solo el primero.
async function procesarEvento(payload: any) {
  const conversacionesTocadas = new Map<string, { mensajeId: string; igUserId: string }>();
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field === "comments") {
        await procesarComentario(change.value);
      }
    }
    for (const msg of entry.messaging ?? []) {
      // Meta reenvía por este mismo webhook un "echo" de cada mensaje
      // saliente de la cuenta (msg.message.is_echo === true) -- del bot Y
      // de respuestas manuales de empleados desde la app de Instagram. Un
      // echo NUNCA se procesa como si fuera un mensaje nuevo del cliente
      // (eso hacía que el bot se contestara a sí mismo) -- se maneja aparte
      // en procesarEcho, que solo lo guarda si es una respuesta manual
      // real que todavía no estaba en la base.
      if (msg.message?.is_echo) {
        await procesarEcho(msg);
        continue;
      }
      // El cliente puede reaccionar con un emoji a un mensaje nuestro (doble
      // tap = ❤️, o mantener presionado y elegir otro) -- en la app real eso
      // se ve como un emoji chiquito pegado a la burbuja. Antes este evento
      // (messaging_reactions, ya suscripto en Meta) se ignoraba entero: la
      // reacción real del cliente no se veía en ningún lado del panel.
      if (msg.reaction) {
        await procesarReaccion(msg.reaction);
        continue;
      }
      // Recibo de lectura: el cliente abrió la charla y vio nuestros
      // mensajes -- en la app real eso se ve como "Visto" debajo del último
      // mensaje leído. Meta manda esto por "messaging_seen" (ya suscripto),
      // pero antes se ignoraba entero.
      if (msg.read) {
        await procesarLectura(msg);
        continue;
      }
      // Edición de un mensaje ya enviado por el cliente (Instagram permite
      // editar un DM después de mandarlo) -- "messaging_edit" ya suscripto,
      // pero antes se ignoraba y el panel se quedaba con el texto viejo.
      if (msg.message_edit) {
        await procesarEdicion(msg.message_edit);
        continue;
      }
      // Historias. Tres casos distintos, ninguno debe llegarle a la IA "pelado":
      // - reacción con emoji: llega como DM con solo el emoji + reply_to.story;
      // - mención (@) nuestra en la historia de ellos: adjunto "story_mention";
      // - respuesta con texto a una historia nuestra: reply_to.story + texto.
      // Reacción y mención se contestan con un texto fijo (sin IA: sin contexto
      // inventaba "¿qué pasó?, ¿no te gustó?"); la respuesta con texto sí la
      // contesta la IA, pero sabiendo que habla de una historia.
      const esReaccionHistoria = !!msg.message?.reply_to?.story && !msg.message?.attachments?.length && esSoloEmoji(msg.message?.text);
      if (esReaccionHistoria) {
        const emoji = String(msg.message.text).trim();
        const resultado = await procesarMensajeDirecto({ ...msg, message: { ...msg.message, text: `Reaccionó a tu historia con ${emoji}` } });
        if (resultado) await responderConTextoFijo(resultado.conversacionId, resultado.igUserId, respuestaAReaccionHistoria(emoji));
        continue;
      }
      if (msg.message?.attachments?.[0]?.type === "story_mention") {
        const resultado = await procesarMensajeDirecto({ ...msg, message: { ...msg.message, text: "Te mencionó en su historia", attachments: [] } });
        if (resultado) await responderConTextoFijo(resultado.conversacionId, resultado.igUserId, respuestaAMencionHistoria());
        continue;
      }
      if (msg.message?.reply_to?.story && msg.message?.text && !msg.message?.attachments?.length) {
        const resultado = await procesarMensajeDirecto({ ...msg, message: { ...msg.message, text: textoDeRespuestaAHistoria(msg.message.text) } });
        if (resultado) conversacionesTocadas.set(resultado.conversacionId, { mensajeId: resultado.mensajeId, igUserId: resultado.igUserId });
        continue;
      }
      if (msg.message?.text || msg.message?.attachments?.length) {
        const resultado = await procesarMensajeDirecto(msg);
        if (resultado) conversacionesTocadas.set(resultado.conversacionId, { mensajeId: resultado.mensajeId, igUserId: resultado.igUserId });
      }
    }
  }
  // Se le contesta 200 a Meta ya y el bot espera su minuto después de responder (si no, Meta reintenta el webhook y se contesta dos veces).
  after(async () => {
    for (const [conversacionId, { mensajeId, igUserId }] of conversacionesTocadas) {
      try {
        await ejecutarAgenteConDebounce(conversacionId, mensajeId, igUserId);
      } catch (err) {
        registrarError("webhook-ig-v2:agente", err);
      }
    }
  });
}

// Además del caso de arriba (mismo payload), Meta puede mandar dos mensajes
// casi simultáneos del mismo cliente en DOS llamadas de webhook separadas --
// ahí no alcanza con agrupar dentro de procesarEvento porque son invocaciones
// distintas de la función. Se espera un colchón corto y, si en ese lapso
// llegó un mensaje más nuevo en esa conversación, esta invocación se retira
// sin contestar -- la invocación del mensaje más nuevo es la que va a
// terminar respondiendo, ya con el historial completo en la consulta que
// hace ejecutarAgente más abajo. Mismo patrón que el webhook de WhatsApp.
// Walter, 2/11/2026: el bot espera un minuto antes de contestar en Instagram, siempre. Si en ese tiempo un asesor
// contestó desde el panel o desde la app de Instagram, el bot no dice nada. Además junta los mensajes seguidos del cliente.
const DEBOUNCE_MS = 60000;

async function hayMensajeMasNuevo(conversacionId: string, mensajeId: string): Promise<boolean> {
  const { data: ultimoEntrante } = await supabase
    .from("instagram_mensajes")
    .select("id")
    .eq("conversacion_id", conversacionId)
    .eq("direccion", "in")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return !!ultimoEntrante && ultimoEntrante.id !== mensajeId;
}

// ¿Contestó una persona (no la IA) después del mensaje del cliente?
async function contestoUnaPersona(conversacionId: string, mensajeId: string): Promise<boolean> {
  const { data: entrante } = await supabase.from("instagram_mensajes").select("created_at").eq("id", mensajeId).maybeSingle();
  if (!entrante) return false;
  const { count } = await supabase.from("instagram_mensajes").select("id", { count: "exact", head: true })
    .eq("conversacion_id", conversacionId).eq("direccion", "out").eq("ai_generado", false).gt("created_at", entrante.created_at);
  return (count ?? 0) > 0;
}

async function ejecutarAgenteConDebounce(conversacionId: string, mensajeId: string, igUserId: string) {
  await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS));
  if (await hayMensajeMasNuevo(conversacionId, mensajeId)) return; // llegó algo más nuevo, esa invocación se encarga
  if (await contestoUnaPersona(conversacionId, mensajeId)) return; // ya lo atendió un asesor
  await ejecutarAgente(conversacionId, igUserId, mensajeId);
}

async function obtenerOCrearConversacion(igUserId: string, username: string | null) {
  // No pisar un username real ya guardado con null -- procesarMensajeDirecto
  // (los DM) no siempre trae el username en el evento, y antes este upsert
  // lo sobreescribía a null igual, borrando el @ que sí se había guardado
  // antes desde un comentario. Se conserva el que ya había si el nuevo viene vacío.
  const { data: contactoExistente } = await supabase.from("instagram_contactos").select("id, username").eq("ig_user_id", igUserId).maybeSingle();
  const usernameFinal = username ?? contactoExistente?.username ?? null;

  const { data: contacto } = await supabase
    .from("instagram_contactos")
    .upsert({ ig_user_id: igUserId, username: usernameFinal }, { onConflict: "ig_user_id", ignoreDuplicates: false })
    .select("id")
    .single();
  if (!contacto) return null;

  let { data: conversacion } = await supabase
    .from("instagram_conversaciones")
    .select("id, vendedor_id, ai_habilitada, canal_origen, vehiculo_id")
    .eq("contacto_id", contacto.id)
    .maybeSingle();

  if (!conversacion) {
    // El trigger asignar_vendedor_conversacion_nueva_instagram le pone
    // vendedor solo (ronda) antes de que termine el insert.
    const { data: nueva, error: errInsertConv } = await supabase
      .from("instagram_conversaciones")
      .insert({ contacto_id: contacto.id, canal_origen: "Instagram" })
      .select("id, vendedor_id, ai_habilitada, canal_origen, vehiculo_id")
      .single();
    if (errInsertConv && errInsertConv.code === "23505") {
      // Dos mensajes casi simultáneos de un contacto nuevo, en invocaciones
      // distintas -- la otra ya creó la conversación, se usa esa (mismo
      // criterio que WhatsApp; lo dispara el índice único
      // instagram_conversaciones_contacto_unico, ya creado en la base).
      ({ data: conversacion } = await supabase.from("instagram_conversaciones").select("id, vendedor_id, ai_habilitada, canal_origen, vehiculo_id").eq("contacto_id", contacto.id).maybeSingle());
    } else {
      conversacion = nueva;
    }
  }
  return conversacion
    ? { conversacionId: conversacion.id, contactoId: contacto.id, aiHabilitada: conversacion.ai_habilitada, canalOrigen: conversacion.canal_origen, vehiculoId: conversacion.vehiculo_id }
    : null;
}

async function procesarComentario(value: any) {
  const commentId = value?.id;
  const igUserId = value?.from?.id;
  const username = value?.from?.username ?? null;
  const texto = value?.text ?? "";
  if (!commentId || !igUserId) return;

  const refs = await obtenerOCrearConversacion(igUserId, username);
  if (!refs) return;

  await supabase.from("instagram_mensajes").insert({
    conversacion_id: refs.conversacionId,
    direccion: "in",
    tipo: "text",
    texto,
    status: "received",
  });
  await supabase.from("instagram_conversaciones").update({ last_inbound_at: new Date().toISOString() }).eq("id", refs.conversacionId);

  const { data: config } = await supabase.from("instagram_configuracion").select("*").maybeSingle();
  if (!isInstagramEnvioConfigurado(config)) {
    console.warn("[webhook-ig-v2] Instagram no está configurado: respuesta privada no enviada.");
    return;
  }

  const automatizacion = await buscarAutomatizacionPorComentario(texto);
  const mensajeDm = automatizacion?.respuesta_dm || MENSAJE_APERTURA;

  try {
    const tokenPlano = decrypt(config.token_cifrado, config.token_iv, config.token_tag);
    await sendInstagramPrivateReply(commentId, tokenPlano, mensajeDm);
    await supabase.from("instagram_mensajes").insert({
      conversacion_id: refs.conversacionId,
      direccion: "out",
      tipo: "text",
      texto: mensajeDm,
      status: "sent",
      ai_generado: false,
    });
    // Respuesta pública opcional debajo del comentario -- solo cuando la
    // regla que matcheó tiene una configurada (nunca en el caso genérico
    // sin match, mismo comportamiento de siempre ahí).
    if (automatizacion?.respuesta_publica) {
      try {
        await replyToInstagramCommentPublicly(commentId, tokenPlano, automatizacion.respuesta_publica);
      } catch (err) {
        registrarError("webhook-ig-v2:respuesta-publica", err, { conversacionId: refs.conversacionId, commentId });
      }
    }
  } catch (err) {
    registrarError("webhook-ig-v2:respuesta-privada", err, { conversacionId: refs.conversacionId, commentId });
  }
}

// Igual que resolverTextoMensaje del webhook de WhatsApp: un mensaje sin
// texto (foto/audio/video/sticker/compartir un posteo) no puede seguir
// perdiéndose -- antes esto se descartaba entero (ni cliente ni empleado
// veían nada guardado). Devuelve un texto placeholder legible para el
// agente/el panel, más el tipo y la URL real si Meta la manda.
function resolverTextoYMediaInstagram(message: any) {
  // Reglas en lib/panel/adjuntosMeta.ts (también guarda PDFs y otros archivos, 19/10/2026).
  return resolverAdjuntoMeta(message);
}

// A diferencia de WhatsApp (media_id + Bearer token para pedir una URL
// temporal), el payload del DM de Instagram ya trae la URL del archivo
// directo, sin auth -- pero es un link de Meta igual, no nuestro: si algún
// día expira o Meta lo invalida, la foto vieja se rompe en el panel. Mismo
// criterio que descargarMediaWhatsapp(): se baja ahora mismo y se sube a R2
// para tener una copia propia permanente. Best-effort -- si falla (R2 sin
// configurar, Meta caído), se guarda igual con la URL de Meta en vez de
// perder el archivo.
async function descargarYSubirMediaInstagram(url: string, tipo: string, igMessageId: string | undefined): Promise<string> {
  if (!r2Configurado()) return url;
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    const buffer = Buffer.from(await res.arrayBuffer());
    const mimeType = res.headers.get("content-type") || (tipo === "image" ? "image/jpeg" : tipo === "audio" ? "audio/mpeg" : tipo === "video" ? "video/mp4" : "application/octet-stream");
    const extension = tipo === "archivo" ? extensionDeArchivo(mimeType, url) : mimeType.split("/")[1]?.split(";")[0] || (tipo === "image" ? "jpg" : tipo === "audio" ? "mp3" : "mp4");
    return await subirArchivoR2(buffer, `instagram/${tipo}/${Date.now()}-${igMessageId || randomUUID()}.${extension}`, mimeType.split(";")[0]);
  } catch {
    return url;
  }
}

async function procesarMensajeDirecto(msg: any): Promise<{ conversacionId: string; mensajeId: string; igUserId: string } | null> {
  const igUserId = msg.sender?.id;
  const adjunto = resolverTextoYMediaInstagram(msg.message);
  const { texto, tipo } = adjunto;
  let { mediaUrl } = adjunto;
  const igMessageId = msg.message?.mid;
  if (!igUserId || (!texto && !mediaUrl)) return null;

  if (adjunto.desconocido) registrarError("webhook-ig-v2:adjunto-desconocido", new Error(`Adjunto de tipo "${adjunto.desconocido}"`), { mensaje: igMessageId ?? null, conLink: !!mediaUrl });
  if (mediaUrl && (tipo === "image" || tipo === "audio" || tipo === "video" || adjunto.esArchivo)) {
    mediaUrl = await descargarYSubirMediaInstagram(mediaUrl, adjunto.esArchivo ? "archivo" : tipo, igMessageId);
  }

  // A diferencia de un comentario (Meta manda el username directo), un DM
  // entrante solo trae el IGSID numérico -- sin esto el contacto quedaba
  // guardado con username null y el panel lo mostraba como "@" + el ID
  // numérico en vez del @usuario real. Solo se pide si todavía no lo
  // tenemos guardado (evita pegarle a la API de Meta en cada mensaje).
  const { data: contactoPrevio } = await supabase.from("instagram_contactos").select("username").eq("ig_user_id", igUserId).maybeSingle();
  let usernameResuelto: string | null = contactoPrevio?.username ?? null;
  if (!usernameResuelto) {
    const { data: config } = await supabase.from("instagram_configuracion").select("token_cifrado, token_iv, token_tag").maybeSingle();
    if (config?.token_cifrado && config.token_iv && config.token_tag) {
      try {
        const tokenPlano = decrypt(config.token_cifrado, config.token_iv, config.token_tag);
        const perfil = await getInstagramUserProfile(tokenPlano, igUserId);
        usernameResuelto = perfil.username ?? null;
      } catch (err) {
        registrarError("webhook-ig-v2:resolver-username", err, { igUserId });
      }
    }
  }

  const refs = await obtenerOCrearConversacion(igUserId, usernameResuelto);
  if (!refs) return null;

  // Meta manda "referral" en el evento de mensaje cuando la charla arrancó
  // desde un anuncio de Click-to-Instagram o el botón "Enviar mensaje" de
  // un posteo/story -- mismo patrón que el webhook de WhatsApp (ver ese
  // archivo). Mismo vocabulario que lib/utm.ts para hablar el mismo idioma
  // que /panel/marketing/pautas.
  if (msg.referral && (!refs.canalOrigen || refs.canalOrigen === "Instagram")) {
    // Nombre del anuncio para Marketing → "Embudo por campaña" (21/10/2026), como origen_ads en WhatsApp.
    const anuncio = msg.referral.ads_context_data?.ad_title || (msg.referral.ad_id ? `Anuncio ${msg.referral.ad_id}` : null);
    await supabase.from("instagram_conversaciones").update({ canal_origen: "Meta Ads", ...(anuncio ? { origen_ads: anuncio } : {}) }).eq("id", refs.conversacionId);
  }

  const { data: mensajeInsertado, error } = await supabase.from("instagram_mensajes").insert({
    conversacion_id: refs.conversacionId,
    ig_message_id: igMessageId,
    direccion: "in",
    tipo,
    texto,
    media_url: mediaUrl,
    status: "received",
  }).select("id").single();
  if (error) {
    if (error.code === "23505") return null; // duplicado, Meta reintentó el mismo evento
    registrarError("webhook-ig-v2:insertar-mensaje", error, { conversacionId: refs.conversacionId });
    return null;
  }

  await supabase.from("instagram_conversaciones").update({
    last_inbound_at: new Date().toISOString(),
    last_message_at: new Date().toISOString(),
  }).eq("id", refs.conversacionId);
  // Alerta de "nuevo mensaje" la dispara el trigger sobre instagram_mensajes.

  return { conversacionId: refs.conversacionId, mensajeId: mensajeInsertado.id, igUserId };
}



function isInstagramEnvioConfigurado(config: any): boolean {
  return !!config?.listo && !!config?.token_cifrado && !!config?.token_iv && !!config?.token_tag && !!config?.ig_user_id;
}

// Horario de los bots: el mismo para WhatsApp, Instagram y Messenger (whatsapp_configuracion, editable en
// Configuración → WhatsApp). Ver lib/panel/horarioBots.ts.
async function horarioBots() {
  const { data } = await supabase.from("whatsapp_configuracion").select("horario_inicio, horario_fin").maybeSingle();
  return horarioDeConfig(data);
}

// Fuera de horario: un solo aviso por noche (el mismo texto de "Memoria del bot" que usa WhatsApp). A las 9 el
// cron /api/cron/panel/bots-apertura le escribe "ya estamos disponibles". No pisa una charla que atiende una persona.
async function avisarFueraDeHorario(conversacionId: string) {
  const { data: conversacion } = await supabase.from("instagram_conversaciones").select("*").eq("id", conversacionId).maybeSingle();
  if (!conversacion || conversacion.ai_habilitada === false) return;
  if (!debeAvisarFueraDeHorario(conversacion.fuera_horario_avisado_at)) return;
  const horario = await horarioBots();
  const texto = (await buscarRespuestaFueraHorario(supabase)) || textoFueraDeHorarioPorDefecto(horario.inicio, horario.fin);
  if (await enviarTextoBot(supabase, "instagram", conversacionId, texto)) {
    await supabase.from("instagram_conversaciones").update({ fuera_horario_avisado_at: new Date().toISOString() }).eq("id", conversacionId);
  }
}

// Respuesta fija (reacción o mención en historia). Mismas reglas que el agente: no
// pisa una charla que atiende una persona (ai_habilitada=false) ni contesta
// fuera de horario, y no repite si ya le escribimos en las últimas 24 horas
// (quien reacciona a varias historias seguidas no recibe un mensaje por cada una).
async function responderConTextoFijo(conversacionId: string, igUserId: string, respuesta: string) {
  if (!estaEnHorario(await horarioBots(), new Date(), zonaActual())) return;
  const { data: conversacion } = await supabase.from("instagram_conversaciones").select("ai_habilitada").eq("id", conversacionId).single();
  if (conversacion?.ai_habilitada === false) return;

  const desde = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data: salienteReciente } = await supabase.from("instagram_mensajes").select("id").eq("conversacion_id", conversacionId).eq("direccion", "out").gte("created_at", desde).limit(1).maybeSingle();
  if (salienteReciente) return;

  const { data: config } = await supabase.from("instagram_configuracion").select("*").maybeSingle();
  const { data: mensaje } = await supabase.from("instagram_mensajes").insert({ conversacion_id: conversacionId, direccion: "out", tipo: "text", texto: respuesta, status: "pending", ai_generado: true }).select("id").single();
  if (mensaje) await enviarYActualizarMensaje(mensaje.id, igUserId, respuesta, config);
}

async function ejecutarAgente(conversacionId: string, igUserId: string, mensajeId: string) {
  if (!estaEnHorario(await horarioBots(), new Date(), zonaActual())) { await avisarFueraDeHorario(conversacionId); return; }

  const { data: conversacionActual } = await supabase.from("instagram_conversaciones").select("ai_habilitada, contacto_id, vehiculo_id, vendedor_id").eq("id", conversacionId).single();
  if (conversacionActual?.ai_habilitada === false) return;

  // Mismo fix que WhatsApp/Rodi: ascending+limit traía los PRIMEROS 20
  // mensajes de la charla, no los últimos -- en una charla larga el bot no
  // veía lo último que escribió el cliente. Se piden los más recientes y se
  // dan vuelta para dejarlos en orden cronológico.
  const { data: mensajesDesc } = await supabase.from("instagram_mensajes").select("direccion, texto").eq("conversacion_id", conversacionId).order("created_at", { ascending: false }).limit(20);
  const mensajes = mensajesDesc ? [...mensajesDesc].reverse() : mensajesDesc;
  const historial = (mensajes ?? []).filter((m) => m.texto).map((m) => ({ role: (m.direccion === "in" ? "user" : "assistant") as "user" | "assistant", content: m.texto as string }));

  const { data: config } = await supabase.from("instagram_configuracion").select("*").maybeSingle();
  // Instagram tiene que sonar igual de profesional y serio que WhatsApp --
  // un vendedor real, no un amigo chateando. El admin puede pisar esto
  // cargando su propio tono en Configuración > Instagram, pero no depende
  // de que lo haga (el campo hoy suele estar vacío).
  // "Memoria del bot" primero (respuestas fijas por palabra clave, sin gastar IA), igual que WhatsApp: solo si lo
  // que escribió el cliente no pregunta por un auto. Se edita en Configuración → WhatsApp → Memoria del bot.
  const textoPendiente = textoPendienteDelCliente(historial);
  if (textoPendiente) {
    const respuestaMemoria = await buscarRespuestaMemoria(supabase, textoPendiente);
    if (respuestaMemoria) {
      await enviarTextoBot(supabase, "instagram", conversacionId, respuestaMemoria, config);
      return;
    }
  }
  if (!isAiConfiguredV2()) return;

  const tonoInstagram = config?.tono?.trim() || "profesional y serio, como un asesor atendiendo por Instagram -- el mismo tono formal y directo que se usa en WhatsApp, sin informalidades ni frases de amigo (nada de \"che\", \"dale\", tratar al cliente como si fueran conocidos). Amable y claro, pero siempre con la seriedad de alguien vendiendo un vehículo, no charlando en redes sociales.";
  // "panel-v2/webhooks/instagram", no "panel/webhooks/instagram" -- este
  // string es lo que uso_ia_anthropic.origen guarda para el costo de IA de
  // cada llamada (ver agenteV2.ts, { origen: canal }), y Marketing > Instagram
  // / Marketing > Generales filtran por "panel-v2/webhooks/instagram" para
  // armar la tarjeta "Costo IA" -- con el prefijo mal puesto el filtro nunca
  // matcheaba nada y la tarjeta quedaba siempre en "—" aunque hubiera uso real.
  const result = await generarRespuestaAgenteV2(historial, "panel-v2/webhooks/instagram", { tono: tonoInstagram, esInstagram: true });

  // Mismo freno que WhatsApp: si mientras el agente pensaba llegó otro
  // mensaje del cliente, esta respuesta quedó vieja -- se descarta y
  // contesta la invocación del mensaje nuevo, con los dos juntos.
  if (await hayMensajeMasNuevo(conversacionId, mensajeId)) return;

  if (!result.ok) {
    registrarError("webhook-ig-v2:agente", result.error, { conversacionId });
    const { data: mensajeFallback } = await supabase.from("instagram_mensajes").insert({ conversacion_id: conversacionId, direccion: "out", tipo: "text", texto: RESPUESTA_FALLBACK, status: "pending", ai_generado: false }).select("id").single();
    if (mensajeFallback) await enviarYActualizarMensaje(mensajeFallback.id, igUserId, RESPUESTA_FALLBACK, config);
    return;
  }

  const { reply, handoff, pausar_sin_notificar, calificacion, resumen_handoff, datos_detectados } = result.data;

  const estadoSegunCalificacion = calificacion === "caliente" ? "calificando" : undefined;
  const patchConversacion: Record<string, unknown> = { calificacion };
  if (estadoSegunCalificacion) patchConversacion.estado_lead = estadoSegunCalificacion;
  await supabase.from("instagram_conversaciones").update(patchConversacion).eq("id", conversacionId);

  // El agente SÍ le pregunta el nombre real al cliente en Instagram (regla
  // DATOS DE CONTACTO), pero hasta ahora nunca se guardaba en ningún lado --
  // instagram_contactos solo tenía username (el @ de Instagram, no el
  // nombre real). Mismo patrón que whatsapp_contactos.nombre_perfil.
  // Nombre, mail, teléfono y CUIL apenas los da (como WhatsApp); el teléfono es el que pide el bot para pasar a WhatsApp.
  await guardarDatosDeContacto(supabase, "instagram", conversacionActual?.contacto_id, datos_detectados);

  for (const parte of dividirRespuestaEnMensajes(reply)) {
    const { data: mensajeSaliente } = await supabase.from("instagram_mensajes").insert({ conversacion_id: conversacionId, direccion: "out", tipo: "text", texto: parte, status: "pending", ai_generado: true }).select("id").single();
    if (mensajeSaliente) await enviarYActualizarMensaje(mensajeSaliente.id, igUserId, parte, config);
  }

  // Derivación igual que WhatsApp: cliente ofensivo, ronda de la sucursal elegida, aviso y visita agendada.
  if (handoff) await procesarDerivacion(supabase, "instagram", conversacionId, { pausar_sin_notificar, resumen_handoff, datos_detectados });
}

async function enviarYActualizarMensaje(mensajeId: string, igUserId: string, texto: string, config: any) {
  if (!isInstagramEnvioConfigurado(config)) {
    console.warn("[webhook-ig-v2] Instagram no está configurado — mensaje queda 'pending' sin enviar.");
    return;
  }

  try {
    const tokenPlano = decrypt(config.token_cifrado, config.token_iv, config.token_tag);
    // Guardamos el message_id real que devuelve Meta -- Meta reenvía este
    // mismo mensaje como "echo" por el webhook unos segundos después (ver
    // procesarEcho más abajo); con el id guardado, ese echo se reconoce
    // como "ya lo tengo" y no se duplica en el chat del panel.
    const resultado = await sendInstagramMessage(config.ig_user_id, tokenPlano, igUserId, texto);
    await supabase.from("instagram_mensajes").update({ status: "sent", ig_message_id: resultado.message_id }).eq("id", mensajeId);
  } catch (err) {
    registrarError("webhook-ig-v2:enviar-dm", err, { mensajeId, igUserId });
    await supabase.from("instagram_mensajes").update({ status: "failed" }).eq("id", mensajeId);
  }
}

// Meta reenvía por el mismo webhook un "echo" de CUALQUIER mensaje saliente
// de la cuenta -- tanto los que manda el bot (ya guardados por nosotros
// arriba, con ig_message_id) como los que un empleado escribe a mano desde
// la app de Instagram (esos nunca pasaron por nuestro código, no están en
// la base todavía). Antes se ignoraban todos los echoes por igual -- eso
// frenaba al bot de contestarse a sí mismo, pero de paso dejaba las
// respuestas manuales de los empleados invisibles en el panel (pedido
// explícito: "el panel tiene que ser un espejo exacto de Instagram"). Acá
// se distingue por ig_message_id: si ya existe, es un echo de un mensaje
// nuestro (se ignora); si no existe, es una respuesta manual real (se
// guarda como "out", sin ai_generado, y se pausa la IA para esa charla).
async function procesarEcho(msg: any) {
  const igMessageId = msg.message?.mid;
  let { texto, tipo, mediaUrl } = resolverTextoYMediaInstagram(msg.message);
  const igUserId = msg.recipient?.id; // en un echo, el cliente es el "recipient", no el "sender"
  if (!igMessageId || (!texto && !mediaUrl) || !igUserId) return;

  const { data: existente } = await supabase.from("instagram_mensajes").select("id").eq("ig_message_id", igMessageId).maybeSingle();
  if (existente) return; // echo de un mensaje que ya mandó el bot -- nada que hacer

  // Una foto/audio/video mandado a mano desde la app trae una URL temporal de
  // Meta: se baja a R2 igual que en los mensajes entrantes, si no deja de verse.
  if (mediaUrl && (tipo === "image" || tipo === "audio" || tipo === "video")) {
    mediaUrl = await descargarYSubirMediaInstagram(mediaUrl, tipo, igMessageId);
  }

  const refs = await obtenerOCrearConversacion(igUserId, null);
  if (!refs) return;

  await supabase.from("instagram_mensajes").insert({
    conversacion_id: refs.conversacionId,
    ig_message_id: igMessageId,
    direccion: "out",
    tipo,
    texto,
    media_url: mediaUrl,
    status: "sent",
    ai_generado: false,
  });
  await supabase.from("instagram_conversaciones").update({
    last_message_at: new Date().toISOString(),
    ai_habilitada: false, // un humano ya está atendiendo esta charla a mano -- el bot no debe pisarlo
  }).eq("id", refs.conversacionId);
}

// Reacción del cliente a un mensaje puntual (mid = el ig_message_id de ESE
// mensaje, no de la conversación). "unreact" pasa cuando saca la reacción
// que había puesto -- se limpia la columna en vez de dejar la vieja pegada.
// Update best-effort: si migraciones/sql_instagram_mensajes_reaccion.sql
// todavía no corrió (columna no existe), esto falla solo y el resto del
// webhook sigue andando igual (mismo patrón resiliente que el resto del
// archivo).
// Meta a veces manda la reacción como palabra clave en vez del emoji real
// (herencia del Messenger Platform viejo) -- sin este mapeo el panel mostraba
// literalmente "love" pegado a la burbuja en vez del corazón que el cliente
// tocó de verdad en la app.
const EMOJI_POR_PALABRA_CLAVE: Record<string, string> = {
  love: "❤️", like: "👍", wow: "😮", haha: "😆", sad: "😢", angry: "😠",
};

async function procesarReaccion(reaction: any) {
  const mid = reaction?.mid;
  if (!mid) return;
  const crudo = reaction.action === "unreact" ? null : (reaction.emoji || reaction.reaction || null);
  const emoji = crudo ? (EMOJI_POR_PALABRA_CLAVE[crudo.toLowerCase()] || crudo) : null;
  const { error } = await supabase.from("instagram_mensajes").update({ reaccion: emoji }).eq("ig_message_id", mid);
  if (error) registrarError("webhook-ig-v2:reaccion", error, { mid });
}

// Recibo de lectura. El sender de un evento "read" es el CLIENTE (confirma
// que vio lo que le mandamos) -- Meta identifica hasta dónde leyó con
// read.mid (el id del último mensaje que vio) o read.watermark (un
// timestamp: "todo lo mandado antes de esto ya se vio"). Se soportan los
// dos formatos porque no hay forma de confirmar cuál manda Instagram en
// este entorno sin tráfico real -- si ninguno viene, no se marca nada (mejor
// no marcar que marcar mal). No usa obtenerOCrearConversacion a propósito:
// un recibo de lectura nunca debería crear una conversación nueva -- si no
// existe todavía, no hay nada que marcar como leído.
async function procesarLectura(msg: any) {
  const igUserId = msg.sender?.id;
  const read = msg.read;
  if (!igUserId || !read) return;

  const { data: contacto } = await supabase.from("instagram_contactos").select("id").eq("ig_user_id", igUserId).maybeSingle();
  if (!contacto) return;
  const { data: conversacion } = await supabase.from("instagram_conversaciones").select("id").eq("contacto_id", contacto.id).maybeSingle();
  if (!conversacion) return;

  let corte: string | null = null;
  if (read.mid) {
    const { data: mensajeLeido } = await supabase.from("instagram_mensajes").select("created_at").eq("ig_message_id", read.mid).maybeSingle();
    corte = mensajeLeido?.created_at ?? null;
  } else if (read.watermark) {
    corte = new Date(Number(read.watermark)).toISOString();
  }
  if (!corte) return;

  const { error } = await supabase.from("instagram_mensajes")
    .update({ leido_at: new Date().toISOString() })
    .eq("conversacion_id", conversacion.id)
    .eq("direccion", "out")
    .is("leido_at", null)
    .lte("created_at", corte);
  if (error) registrarError("webhook-ig-v2:lectura", error, { igUserId });
}

// Edición de un mensaje ya enviado -- mid identifica CUÁL mensaje se editó,
// text trae el contenido nuevo. Se marca "editado: true" para que el panel
// pueda avisar que ese texto no es el original (igual que hace la propia
// app de Instagram con la etiqueta "Editado").
async function procesarEdicion(edicion: any) {
  const mid = edicion?.mid;
  const textoNuevo = edicion?.text;
  if (!mid || textoNuevo == null) return;
  const { error } = await supabase.from("instagram_mensajes").update({ texto: textoNuevo, editado: true }).eq("ig_message_id", mid);
  if (error) registrarError("webhook-ig-v2:edicion", error, { mid });
}

