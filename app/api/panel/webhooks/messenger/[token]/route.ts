import { asignacionPorAuto, autoDeLaCharla } from "@/lib/panel/asignacionPorAuto";
import { createHmac, timingSafeEqual, randomUUID } from "crypto";
import { extensionDeArchivo, resolverAdjuntoMeta } from "@/lib/panel/adjuntosMeta";
import { createClient } from "@supabase/supabase-js";
import { isAiConfiguredV2 } from "@/lib/ai/indexV2";
import { generarRespuestaAgenteV2, dividirRespuestaEnMensajes } from "@/lib/ai/agenteV2";
import { sendMessengerMessage, sendMessengerImageMessage, getMessengerUserProfile } from "@/lib/meta/client";
import { decrypt } from "@/lib/crypto";
import { rateLimit, ipDesdeRequest } from "@/lib/rateLimit";
import { registrarError } from "@/lib/panel/logger";
import { notificarPersona } from "@/lib/panel/notificaciones";
import { buscarRespuestaFueraHorario, buscarRespuestaMemoria, textoPendienteDelCliente, REGEX_CONSULTA_AUTO } from "@/lib/panel/whatsappMemoria";
import { guardarDatosDeContacto, registrarPedidoSinStock, procesarDerivacion } from "@/lib/panel/botDespuesDelAgente";
import { horarioDeConfig, estaEnHorario, debeAvisarFueraDeHorario, textoFueraDeHorarioPorDefecto } from "@/lib/panel/horarioBots";
import { enviarTextoBot } from "@/lib/panel/enviarMensajeBot";
import { subirArchivoR2, r2Configurado } from "@/lib/storage/r2";

// Webhook de Meta para el Facebook Messenger de la página -- mismo patrón
// exacto que /api/panel/webhooks/instagram (Messenger y el Instagram DM
// corren sobre la misma infraestructura de "Send/Receive API" de Meta, el
// payload que llega por entry[].messaging[] es prácticamente idéntico).
// Diferencias reales con Instagram: usa graph.facebook.com (no
// graph.instagram.com), el identificador de la otra persona es un PSID
// (Page-Scoped ID) en vez de un IGSID, no tiene username público (solo
// nombre real si Meta lo resuelve), y no hay flujo de "comentario ->
// respuesta privada" (Messenger arranca siempre con un mensaje directo).
// Credenciales cifradas en messenger_configuracion (Configuración >
// Messenger), no en env vars -- mismo criterio que WhatsApp/Instagram.
//
// TODAVÍA NO PROBADO CONTRA META REAL -- construido en paralelo mientras la
// verificación de negocio está pendiente (28/9), para que quede listo el día
// que se apruebe. Revisar el primer webhook real que llegue con cuidado.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE2_URL!,
  process.env.SUPABASE2_SERVICE_ROLE_KEY!
);

// Espera de DEBOUNCE_MS + dos pasadas de IA + búsqueda de stock -- mismo
// límite que WhatsApp/Instagram.
export const maxDuration = 60;

async function tokenValido(token: string): Promise<boolean> {
  const { data } = await supabase.from("messenger_configuracion").select("verify_token").eq("id", true).maybeSingle();
  const expected = data?.verify_token ?? "";
  if (!expected) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!(await tokenValido(token))) return new Response("Not found", { status: 404 });

  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const verifyToken = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const { data: config } = await supabase.from("messenger_configuracion").select("verify_token").eq("id", true).maybeSingle();
  if (mode === "subscribe" && verifyToken === config?.verify_token) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const limite = await rateLimit(ipDesdeRequest(req), { limite: 60, ventanaMs: 60 * 1000, proyecto: "v2" });
  if (!limite.ok) return new Response("Too many requests", { status: 429 });

  const { token } = await params;
  if (!(await tokenValido(token))) return new Response("Not found", { status: 404 });

  const rawBody = await req.text();

  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    console.error("[webhook-messenger] META_APP_SECRET no está configurada.");
    return new Response("Unauthorized", { status: 401 });
  }

  const signature = req.headers.get("x-hub-signature-256") ?? "";
  const expected = "sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex");
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    // Antes se rechazaba sin dejar rastro y los mensajes se perdían en silencio.
    await registrarError("webhook-messenger:firma", new Error("Firma de Meta inválida: el webhook de Messenger llegó pero se rechazó (revisar META_APP_SECRET en Vercel)."), { conFirma: !!signature });
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    registrarError("webhook-messenger:parse-body", err);
    return Response.json({ received: true });
  }
  try {
    await procesarEvento(payload);
  } catch (err) {
    registrarError("webhook-messenger:procesar-evento", err);
  }

  return Response.json({ received: true });
}

// Mismo fix de "mensajes seguidos" que WhatsApp/Instagram -- se guardan
// todos los mensajes entrantes del payload primero, el agente se dispara
// una sola vez por conversación tocada al final.
async function procesarEvento(payload: any) {
  const conversacionesTocadas = new Map<string, { mensajeId: string; psid: string }>();
  for (const entry of payload.entry ?? []) {
    for (const msg of entry.messaging ?? []) {
      // Echo de cualquier mensaje saliente de la página -- del bot (ya
      // guardado, tiene messenger_message_id) o de un empleado contestando a
      // mano desde el Administrador de Comentarios/Meta Business Suite.
      if (msg.message?.is_echo) {
        await procesarEcho(msg);
        continue;
      }
      // Recibo de lectura -- Messenger manda esto por "messaging_seen".
      if (msg.read) {
        await procesarLectura(msg);
        continue;
      }
      if (msg.message?.text || msg.message?.attachments?.length) {
        const resultado = await procesarMensajeDirecto(msg);
        if (resultado) conversacionesTocadas.set(resultado.conversacionId, { mensajeId: resultado.mensajeId, psid: resultado.psid });
      }
    }
  }
  for (const [conversacionId, { mensajeId, psid }] of conversacionesTocadas) {
    await ejecutarAgenteConDebounce(conversacionId, mensajeId, psid);
  }
}

const DEBOUNCE_MS = 8000;

async function hayMensajeMasNuevo(conversacionId: string, mensajeId: string): Promise<boolean> {
  const { data: ultimoEntrante } = await supabase
    .from("messenger_mensajes")
    .select("id")
    .eq("conversacion_id", conversacionId)
    .eq("direccion", "in")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return !!ultimoEntrante && ultimoEntrante.id !== mensajeId;
}

async function ejecutarAgenteConDebounce(conversacionId: string, mensajeId: string, psid: string) {
  await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS));
  if (await hayMensajeMasNuevo(conversacionId, mensajeId)) return;
  await ejecutarAgente(conversacionId, psid, mensajeId);
}

async function obtenerOCrearConversacion(psid: string, nombrePerfil: string | null) {
  const { data: contactoExistente } = await supabase.from("messenger_contactos").select("id, nombre_perfil").eq("psid", psid).maybeSingle();
  const nombreFinal = nombrePerfil ?? contactoExistente?.nombre_perfil ?? null;

  const { data: contacto } = await supabase
    .from("messenger_contactos")
    .upsert({ psid, nombre_perfil: nombreFinal }, { onConflict: "psid", ignoreDuplicates: false })
    .select("id")
    .single();
  if (!contacto) return null;

  let { data: conversacion } = await supabase
    .from("messenger_conversaciones")
    .select("id, vendedor_id, ai_habilitada, canal_origen, vehiculo_id")
    .eq("contacto_id", contacto.id)
    .maybeSingle();

  if (!conversacion) {
    const { data: nueva, error: errInsertConv } = await supabase
      .from("messenger_conversaciones")
      .insert({ contacto_id: contacto.id, canal_origen: "Messenger" })
      .select("id, vendedor_id, ai_habilitada, canal_origen, vehiculo_id")
      .single();
    if (errInsertConv && errInsertConv.code === "23505") {
      // Mismo caso que Instagram/WhatsApp: la otra invocación ya creó la
      // conversación de este contacto nuevo, se usa esa.
      ({ data: conversacion } = await supabase.from("messenger_conversaciones").select("id, vendedor_id, ai_habilitada, canal_origen, vehiculo_id").eq("contacto_id", contacto.id).maybeSingle());
    } else {
      conversacion = nueva;
    }
  }
  return conversacion
    ? { conversacionId: conversacion.id, contactoId: contacto.id, aiHabilitada: conversacion.ai_habilitada, canalOrigen: conversacion.canal_origen, vehiculoId: conversacion.vehiculo_id }
    : null;
}

// Igual que resolverTextoYMediaInstagram: un mensaje sin texto (foto/audio/
// video) no se puede seguir perdiendo -- se guarda un placeholder legible.
function resolverTextoYMediaMessenger(message: any) {
  // Reglas en lib/panel/adjuntosMeta.ts (también guarda PDFs y otros archivos, 19/10/2026).
  return resolverAdjuntoMeta(message);
}

// Mismo criterio que Instagram (descargarYSubirMediaInstagram): la URL que
// manda Meta es de ellos, no nuestra -- se baja y sube a R2 para tener copia
// propia permanente. Best-effort: si falla, se guarda con la URL de Meta.
async function descargarYSubirMediaMessenger(url: string, tipo: string, messageId: string | undefined): Promise<string> {
  if (!r2Configurado()) return url;
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    const buffer = Buffer.from(await res.arrayBuffer());
    const mimeType = res.headers.get("content-type") || (tipo === "image" ? "image/jpeg" : tipo === "audio" ? "audio/mpeg" : tipo === "video" ? "video/mp4" : "application/octet-stream");
    const extension = tipo === "archivo" ? extensionDeArchivo(mimeType, url) : mimeType.split("/")[1]?.split(";")[0] || (tipo === "image" ? "jpg" : tipo === "audio" ? "mp3" : "mp4");
    return await subirArchivoR2(buffer, `messenger/${tipo}/${Date.now()}-${messageId || randomUUID()}.${extension}`, mimeType.split(";")[0]);
  } catch {
    return url;
  }
}

async function procesarMensajeDirecto(msg: any): Promise<{ conversacionId: string; mensajeId: string; psid: string } | null> {
  const psid = msg.sender?.id;
  const adjunto = resolverTextoYMediaMessenger(msg.message);
  const { texto, tipo } = adjunto;
  let { mediaUrl } = adjunto;
  const messengerMessageId = msg.message?.mid;
  if (!psid || (!texto && !mediaUrl)) return null;

  if (adjunto.desconocido) registrarError("webhook-messenger-v2:adjunto-desconocido", new Error(`Adjunto de tipo "${adjunto.desconocido}"`), { mensaje: messengerMessageId ?? null, conLink: !!mediaUrl });
  if (mediaUrl && (tipo === "image" || tipo === "audio" || tipo === "video" || adjunto.esArchivo)) {
    mediaUrl = await descargarYSubirMediaMessenger(mediaUrl, adjunto.esArchivo ? "archivo" : tipo, messengerMessageId);
  }

  // A diferencia de Instagram (no manda username en el evento de mensaje
  // tampoco), acá se resuelve el nombre real solo si todavía no lo tenemos
  // guardado -- evita pegarle a la API de Meta en cada mensaje.
  const { data: contactoPrevio } = await supabase.from("messenger_contactos").select("nombre_perfil").eq("psid", psid).maybeSingle();
  let nombreResuelto: string | null = contactoPrevio?.nombre_perfil ?? null;
  if (!nombreResuelto) {
    const { data: config } = await supabase.from("messenger_configuracion").select("token_cifrado, token_iv, token_tag").eq("id", true).maybeSingle();
    if (config?.token_cifrado && config.token_iv && config.token_tag) {
      try {
        const tokenPlano = decrypt(config.token_cifrado, config.token_iv, config.token_tag);
        const perfil = await getMessengerUserProfile(tokenPlano, psid);
        const nombreCompleto = [perfil.first_name, perfil.last_name].filter(Boolean).join(" ");
        nombreResuelto = nombreCompleto || null;
      } catch (err) {
        registrarError("webhook-messenger:resolver-nombre", err, { psid });
      }
    }
  }

  const refs = await obtenerOCrearConversacion(psid, nombreResuelto);
  if (!refs) return null;

  if (msg.referral && !refs.canalOrigen) {
    // Nombre del anuncio para Marketing → "Embudo por campaña" (21/10/2026), como origen_ads en WhatsApp.
    const anuncio = msg.referral.ads_context_data?.ad_title || (msg.referral.ad_id ? `Anuncio ${msg.referral.ad_id}` : null);
    await supabase.from("messenger_conversaciones").update({ canal_origen: "Meta Ads", ...(anuncio ? { origen_ads: anuncio } : {}) }).eq("id", refs.conversacionId);
  }

  const { data: mensajeInsertado, error } = await supabase.from("messenger_mensajes").insert({
    conversacion_id: refs.conversacionId,
    messenger_message_id: messengerMessageId,
    direccion: "in",
    tipo,
    texto,
    media_url: mediaUrl,
    status: "received",
  }).select("id").single();
  if (error) {
    if (error.code === "23505") return null; // duplicado, Meta reintentó el mismo evento
    registrarError("webhook-messenger:insertar-mensaje", error, { conversacionId: refs.conversacionId });
    return null;
  }

  await supabase.from("messenger_conversaciones").update({
    last_inbound_at: new Date().toISOString(),
    last_message_at: new Date().toISOString(),
  }).eq("id", refs.conversacionId);
  // Alerta de "nuevo mensaje" la dispara el trigger sobre messenger_mensajes.

  return { conversacionId: refs.conversacionId, mensajeId: mensajeInsertado.id, psid };
}

const RESPUESTA_FALLBACK = "¡Hola! Gracias por escribirnos a Pfaffen Cars. En breve te contacta uno de nuestros asesores. 🚗";

function isMessengerEnvioConfigurado(config: any): boolean {
  return !!config?.listo && !!config?.token_cifrado && !!config?.token_iv && !!config?.token_tag && !!config?.page_id;
}

// Horario de los bots: el mismo para WhatsApp, Instagram y Messenger (whatsapp_configuracion, editable en
// Configuración → WhatsApp). Ver lib/panel/horarioBots.ts.
async function horarioBots() {
  const { data } = await supabase.from("whatsapp_configuracion").select("horario_inicio, horario_fin").eq("id", true).maybeSingle();
  return horarioDeConfig(data);
}

// Fuera de horario: un solo aviso por noche (el mismo texto de "Memoria del bot" que usa WhatsApp). A las 9 el
// cron /api/cron/panel/bots-apertura le escribe "ya estamos disponibles". No pisa una charla que atiende una persona.
async function avisarFueraDeHorario(conversacionId: string) {
  const { data: conversacion } = await supabase.from("messenger_conversaciones").select("*").eq("id", conversacionId).maybeSingle();
  if (!conversacion || conversacion.ai_habilitada === false) return;
  if (!debeAvisarFueraDeHorario(conversacion.fuera_horario_avisado_at)) return;
  const horario = await horarioBots();
  const texto = (await buscarRespuestaFueraHorario(supabase)) || textoFueraDeHorarioPorDefecto(horario.inicio, horario.fin);
  if (await enviarTextoBot(supabase, "messenger", conversacionId, texto)) {
    await supabase.from("messenger_conversaciones").update({ fuera_horario_avisado_at: new Date().toISOString() }).eq("id", conversacionId);
  }
}

async function ejecutarAgente(conversacionId: string, psid: string, mensajeId: string) {
  if (!estaEnHorario(await horarioBots())) { await avisarFueraDeHorario(conversacionId); return; }

  const { data: conversacionActual } = await supabase.from("messenger_conversaciones").select("ai_habilitada, contacto_id, vehiculo_id, vendedor_id").eq("id", conversacionId).single();
  if (conversacionActual?.ai_habilitada === false) return;

  // Los 20 más recientes, dados vuelta a orden cronológico (ascending+limit
  // traía los PRIMEROS 20 de la charla -- mismo fix que WhatsApp/Instagram).
  const { data: mensajesDesc } = await supabase.from("messenger_mensajes").select("direccion, texto").eq("conversacion_id", conversacionId).order("created_at", { ascending: false }).limit(20);
  const mensajes = mensajesDesc ? [...mensajesDesc].reverse() : mensajesDesc;
  const historial = (mensajes ?? []).filter((m) => m.texto).map((m) => ({ role: (m.direccion === "in" ? "user" : "assistant") as "user" | "assistant", content: m.texto as string }));

  const { data: config } = await supabase.from("messenger_configuracion").select("*").eq("id", true).maybeSingle();
  // "Memoria del bot" primero (respuestas fijas por palabra clave, sin gastar IA), igual que WhatsApp: solo si lo
  // que escribió el cliente no pregunta por un auto. Se edita en Configuración → WhatsApp → Memoria del bot.
  const textoPendiente = textoPendienteDelCliente(historial);
  if (textoPendiente && !REGEX_CONSULTA_AUTO.test(textoPendiente)) {
    const respuestaMemoria = await buscarRespuestaMemoria(supabase, textoPendiente);
    if (respuestaMemoria) {
      await enviarTextoBot(supabase, "messenger", conversacionId, respuestaMemoria, config);
      return;
    }
  }
  if (!isAiConfiguredV2()) return;

  const tonoMessenger = config?.tono?.trim() || "profesional y serio, como un vendedor de la concesionaria atendiendo por Messenger -- el mismo tono formal y directo que se usa en WhatsApp, sin informalidades ni frases de amigo. Amable y claro, pero siempre con la seriedad de alguien vendiendo un vehículo.";
  // "panel-v2/webhooks/messenger" -- mismo criterio de prefijo que Instagram
  // (uso_ia_anthropic.origen), para que Marketing pueda filtrar el costo de
  // IA de este canal por separado el día que se prenda.
  const result = await generarRespuestaAgenteV2(historial, "panel-v2/webhooks/messenger", undefined, conversacionActual?.vehiculo_id ?? null, tonoMessenger, true);

  // Mismo freno que WhatsApp/Instagram: llegó otro mensaje mientras el
  // agente pensaba, esta respuesta quedó vieja y contesta la invocación nueva.
  if (await hayMensajeMasNuevo(conversacionId, mensajeId)) return;

  if (!result.ok) {
    registrarError("webhook-messenger:agente", result.error, { conversacionId });
    const { data: mensajeFallback } = await supabase.from("messenger_mensajes").insert({ conversacion_id: conversacionId, direccion: "out", tipo: "text", texto: RESPUESTA_FALLBACK, status: "pending", ai_generado: false }).select("id").single();
    if (mensajeFallback) await enviarYActualizarMensaje(mensajeFallback.id, psid, RESPUESTA_FALLBACK, config);
    return;
  }

  const { reply, handoff, pausar_sin_notificar, calificacion, resumen_handoff, datos_detectados } = result.data;
  const { fotosParaEnviar, vehiculoFocoId, pedidoStock } = result;
  const autoCharla = autoDeLaCharla(vehiculoFocoId, result.data.intencion);

  const estadoSegunCalificacion = calificacion === "caliente" ? "calificando" : undefined;
  const patchConversacion: Record<string, unknown> = { calificacion };
  if (estadoSegunCalificacion) patchConversacion.estado_lead = estadoSegunCalificacion;
  if (autoCharla !== undefined) patchConversacion.vehiculo_id = autoCharla;

  // Pedido del 29/9: mismo criterio que WhatsApp/Instagram -- todo 0km en
  // foco va siempre a Gabriel (Casa Central), y si el auto en foco tiene
  // vendedor responsable en Stock distinto del que ya tiene la charla, se
  // reasigna (Messenger no tiene round-robin propio todavía, así que acá
  // esto suele ser la única asignación real que recibe la charla). Cada
  // reasignación queda anotada en Eventos del lead y avisa al vendedor.
  const registrarEventoAsignacionMsg = (descripcion: string) =>
    supabase.from("eventos_lead").insert({ messenger_conversacion_id: conversacionId, tipo: "asignacion", descripcion }).then(({ error }) => {
      if (error) registrarError("webhook-v2:evento-asignacion", error, { conversacionId });
    });

  // A quién va el lead: a quien tiene el auto (o a Gabriel si es consignación), salvo que lo hayan pasado a mano
  // (Walter, 21/10/2026; reglas en lib/panel/asignacionPorAuto.ts). Reemplaza "todo 0 km a Gabriel".
  const porAuto = await asignacionPorAuto(supabase, { fk: "messenger_conversacion_id", conversacionId, vehiculoId: autoCharla ?? null, intencion: result.data.intencion, vendedorActual: conversacionActual?.vendedor_id ?? null });
  if (porAuto) {
    patchConversacion.vendedor_id = porAuto.vendedorId;
    patchConversacion.estado_lead = "asignado";
    registrarEventoAsignacionMsg(porAuto.descripcion);
  }

  await supabase.from("messenger_conversaciones").update(patchConversacion).eq("id", conversacionId);

  if (patchConversacion.vendedor_id && patchConversacion.vendedor_id !== conversacionActual?.vendedor_id) {
    notificarPersona(supabase, patchConversacion.vendedor_id as string, "whatsapp_venta_zona", "Un cliente te escribió por Messenger por un auto que tenés asignado — se te asignó automáticamente.", `/panel/messenger?conversacion=${conversacionId}`, { categoriaNotif: "leads", modulo: "leads" }).catch((err) => console.error("[webhook-v2] error notificando asignación:", err));
  }

  // Nombre, mail, teléfono y CUIL apenas los da (como WhatsApp); el teléfono es el que pide el bot para pasar a WhatsApp.
  await guardarDatosDeContacto(supabase, "messenger", conversacionActual?.contacto_id, datos_detectados);
  // Sin stock que coincida: queda en Pedidos (si el cliente dio un teléfono para avisarle).
  await registrarPedidoSinStock(supabase, "messenger", conversacionId, pedidoStock, datos_detectados);

  for (const parte of dividirRespuestaEnMensajes(reply)) {
    const { data: mensajeSaliente } = await supabase.from("messenger_mensajes").insert({ conversacion_id: conversacionId, direccion: "out", tipo: "text", texto: parte, status: "pending", ai_generado: true }).select("id").single();
    if (mensajeSaliente) await enviarYActualizarMensaje(mensajeSaliente.id, psid, parte, config);
  }

  for (const fotoUrl of fotosParaEnviar) {
    const { data: mensajeFoto } = await supabase.from("messenger_mensajes").insert({ conversacion_id: conversacionId, direccion: "out", tipo: "image", media_url: fotoUrl, status: "pending", ai_generado: true }).select("id").single();
    if (mensajeFoto) await enviarYActualizarImagen(mensajeFoto.id, psid, fotoUrl, config);
  }

  // Derivación igual que WhatsApp: cliente ofensivo, ronda de la sucursal elegida, aviso y visita agendada.
  if (handoff) await procesarDerivacion(supabase, "messenger", conversacionId, { pausar_sin_notificar, resumen_handoff, datos_detectados, intencion: result.data.intencion });
}

async function enviarYActualizarMensaje(mensajeId: string, psid: string, texto: string, config: any) {
  if (!isMessengerEnvioConfigurado(config)) {
    console.warn("[webhook-messenger] Messenger no está configurado — mensaje queda 'pending' sin enviar.");
    return;
  }

  try {
    const tokenPlano = decrypt(config.token_cifrado, config.token_iv, config.token_tag);
    const resultado = await sendMessengerMessage(config.page_id, tokenPlano, psid, texto);
    await supabase.from("messenger_mensajes").update({ status: "sent", messenger_message_id: resultado.message_id }).eq("id", mensajeId);
  } catch (err) {
    registrarError("webhook-messenger:enviar-mensaje", err, { mensajeId, psid });
    await supabase.from("messenger_mensajes").update({ status: "failed" }).eq("id", mensajeId);
  }
}

async function enviarYActualizarImagen(mensajeId: string, psid: string, imageUrl: string, config: any) {
  if (!isMessengerEnvioConfigurado(config)) return;

  try {
    const tokenPlano = decrypt(config.token_cifrado, config.token_iv, config.token_tag);
    await sendMessengerImageMessage(config.page_id, tokenPlano, psid, imageUrl);
    await supabase.from("messenger_mensajes").update({ status: "sent" }).eq("id", mensajeId);
  } catch (err) {
    registrarError("webhook-messenger:enviar-imagen", err, { mensajeId, psid });
    await supabase.from("messenger_mensajes").update({ status: "failed" }).eq("id", mensajeId);
  }
}

// Echo de cualquier mensaje saliente de la página -- del bot (ya guardado,
// tiene messenger_message_id) o de un empleado contestando a mano. Se
// distingue por messenger_message_id: si ya existe, es un echo de un
// mensaje nuestro (se ignora); si no, es una respuesta manual real.
async function procesarEcho(msg: any) {
  const messageId = msg.message?.mid;
  let { texto, tipo, mediaUrl } = resolverTextoYMediaMessenger(msg.message);
  const psid = msg.recipient?.id; // en un echo, el cliente es el "recipient"
  if (!messageId || (!texto && !mediaUrl) || !psid) return;

  const { data: existente } = await supabase.from("messenger_mensajes").select("id").eq("messenger_message_id", messageId).maybeSingle();
  if (existente) return;

  // Mismo criterio que en Instagram: el archivo de una respuesta manual viene
  // con una URL temporal de Meta, se guarda en R2 para que no se pierda.
  if (mediaUrl && (tipo === "image" || tipo === "audio" || tipo === "video")) {
    mediaUrl = await descargarYSubirMediaMessenger(mediaUrl, tipo, messageId);
  }

  const refs = await obtenerOCrearConversacion(psid, null);
  if (!refs) return;

  await supabase.from("messenger_mensajes").insert({
    conversacion_id: refs.conversacionId,
    messenger_message_id: messageId,
    direccion: "out",
    tipo,
    texto,
    media_url: mediaUrl,
    status: "sent",
    ai_generado: false,
  });
  await supabase.from("messenger_conversaciones").update({
    last_message_at: new Date().toISOString(),
    ai_habilitada: false,
  }).eq("id", refs.conversacionId);
}

// Recibo de lectura -- "messaging_seen". Si Meta manda "watermark" (todo lo
// anterior a esa marca de tiempo se vio) en vez de un mid puntual, se usa
// eso como corte.
async function procesarLectura(msg: any) {
  const psid = msg.sender?.id;
  const read = msg.read;
  if (!psid || !read) return;

  const { data: contacto } = await supabase.from("messenger_contactos").select("id").eq("psid", psid).maybeSingle();
  if (!contacto) return;
  const { data: conversacion } = await supabase.from("messenger_conversaciones").select("id").eq("contacto_id", contacto.id).maybeSingle();
  if (!conversacion) return;

  let corte: string | null = null;
  if (read.mid) {
    const { data: mensajeLeido } = await supabase.from("messenger_mensajes").select("created_at").eq("messenger_message_id", read.mid).maybeSingle();
    corte = mensajeLeido?.created_at ?? null;
  } else if (read.watermark) {
    corte = new Date(Number(read.watermark)).toISOString();
  }
  if (!corte) return;

  const { error } = await supabase.from("messenger_mensajes")
    .update({ leido_at: new Date().toISOString() })
    .eq("conversacion_id", conversacion.id)
    .eq("direccion", "out")
    .is("leido_at", null)
    .lte("created_at", corte);
  if (error) registrarError("webhook-messenger:lectura", error, { psid });
}
