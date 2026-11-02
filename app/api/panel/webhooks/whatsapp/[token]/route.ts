import { asignacionPorAuto, autoDeLaCharla } from "@/lib/panel/asignacionPorAuto";
import { asignarCharlaWhatsapp } from "@/lib/panel/asignacionWhatsapp";
import { isAiConfiguredV2 } from "@/lib/ai/indexV2";
import { generarRespuestaAgenteV2, dividirRespuestaEnMensajes } from "@/lib/ai/agenteV2";
import { sendTextMessage, sendImageMessage, descargarMediaWhatsapp } from "@/lib/meta/client";
import { decrypt } from "@/lib/crypto";
import { subirArchivoR2, r2Configurado } from "@/lib/storage/r2";
import { rateLimit, ipDesdeRequest } from "@/lib/rateLimit";
import { registrarError } from "@/lib/panel/logger";
import { buscarRespuestaMemoria, buscarRespuestaFueraHorario, textoPendienteDelCliente, REGEX_CONSULTA_AUTO } from "@/lib/panel/whatsappMemoria";
import { horarioDeConfig, estaEnHorario, debeAvisarFueraDeHorario, textoFueraDeHorarioPorDefecto } from "@/lib/panel/horarioBots";
import { notificarPersona, notificarEncargados } from "@/lib/panel/notificaciones";
import { resolverFechaVisitaConControl } from "@/lib/fechas";
import { crearAlerta } from "@/lib/panel/alertas";
import { avisoMensajeNoEnviado } from "@/lib/panel/ventana24h";
import { cargarConsignacionDesdeChat } from "@/lib/panel/consignacionDesdeChat";
import { cargarPedidoDesdeChat } from "@/lib/panel/pedidoDesdeChat";
import { completarVisitaRepetida } from "@/lib/panel/visitaRepetida";
import { guardarPedidoDelBot } from "@/lib/panel/pedidoDelBot";
import { RESPUESTA_FALLBACK } from "@/lib/panel/textosBot";
import { supabaseEmpresa as supabase, dentroDeEmpresa, empresaPorTokenDeWebhook } from "@/lib/empresa/db";
import { verificarFirmaDeMeta } from "@/lib/empresa/credenciales";

// Webhook de Meta para el WhatsApp de panel-v2 (Conversaciones → WhatsApp,
// replica /panel/chat de v1: bandeja de mensajes reales de clientes con
// asignación por ronda, con el mismo agente de respuesta automática que ya
// tenía v1 ahí). Sin relación con Rodi — Rodi es el chatbot del sitio
// público (home), un módulo totalmente aparte. Las credenciales (token del
// bot, phone_number_id, webhook_verify_token) están cifradas en
// whatsapp_configuracion (Configuración → WhatsApp), no en env vars como v1
// — así cada instalación puede tener su propio número sin redeployar.


// El colchón de DEBOUNCE_MS (ver más abajo) se suma al tiempo de la función,
// y el agente hace hasta dos pasadas de IA más la búsqueda de stock (5-15 s)
// -- con 30 s una respuesta lenta quedaba cortada a la mitad sin enviarse.
export const maxDuration = 60;

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const empresaId = await empresaPorTokenDeWebhook("whatsapp", token);
  if (!empresaId) return new Response("Not found", { status: 404 });

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
  // Endpoint público — Meta reintenta legítimo, pero sin límite cualquiera
  // que le pegue directo a la URL puede disparar llamadas pagas a Anthropic
  // sin freno. Generoso (60/min) para no frenar entregas reales de Meta.
  const limite = await rateLimit(ipDesdeRequest(req), { limite: 60, ventanaMs: 60 * 1000, proyecto: "v2" });
  if (!limite.ok) return new Response("Too many requests", { status: 429 });

  const { token } = await params;
  const empresaId = await empresaPorTokenDeWebhook("whatsapp", token);
  if (!empresaId) return new Response("Not found", { status: 404 });

  const rawBody = await req.text();

  // Cada empresa firma con el secreto de SU app de Meta (guardado cifrado en su configuración).
  const firmaOk = await dentroDeEmpresa(empresaId, () => verificarFirmaDeMeta("whatsapp", rawBody, req.headers.get("x-hub-signature-256") ?? "", "webhook-v2:firma"));
  if (!firmaOk) return new Response("Unauthorized", { status: 401 });

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    // Body que pasó la firma HMAC pero no es JSON válido (glitch de
    // reintento de Meta, body truncado) -- sin este catch tiraba 500 sin
    // loguear nada útil. Devolvemos 200 igual que un error de
    // procesamiento, para no generar reintentos infinitos de Meta.
    registrarError("webhook-v2:parse-body", err);
    return Response.json({ received: true });
  }
  // Hay que esperar el procesamiento antes de responder: en el runtime
  // serverless de Vercel, la función se congela apenas se devuelve la
  // respuesta, así que "fire and forget" nunca llega a terminar y el
  // mensaje entrante se pierde sin guardarse.
  try {
    await dentroDeEmpresa(empresaId, () => procesarEvento(payload));
  } catch (err) {
    registrarError("webhook-v2:procesar-evento", err);
  }

  return Response.json({ received: true });
}

// Pedido del 25/9: si el cliente manda dos (o más) mensajes casi seguidos
// ("Entregar 13 millones", después "resto cuotas"), el bot tiene que leerlos
// juntos antes de contestar, no contestar al primero y confundirse con el
// segundo. Se guardan TODOS los mensajes entrantes del payload primero (acá
// abajo, sin tocar al agente) y recién al final se dispara el agente una
// sola vez por conversación tocada -- así el historial que arma
// ejecutarAgente ya trae los mensajes juntos en vez de solo el primero.
async function procesarEvento(payload: any) {
  const conversacionesTocadas = new Map<string, string>(); // conversacionId -> id del último mensaje entrante guardado acá
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (change.field !== "messages") continue;

      for (const msg of value.messages ?? []) {
        const waId = msg.from;
        const nombrePerfil = value.contacts?.find((c: any) => c.wa_id === waId)?.profile?.name ?? null;
        const resultado = await guardarMensajeEntrante({ waId, nombrePerfil, msg });
        if (resultado) conversacionesTocadas.set(resultado.conversacionId, resultado.mensajeId);
      }
      for (const status of value.statuses ?? []) {
        await actualizarEstadoMensaje(status);
      }
    }
  }
  for (const [conversacionId, mensajeId] of conversacionesTocadas) {
    await ejecutarAgenteConDebounce(conversacionId, mensajeId);
  }
}

// Además del caso de arriba (mismo payload), Meta puede mandar dos mensajes
// casi simultáneos del mismo cliente en DOS llamadas de webhook separadas
// (POST distintos, unos cientos de ms de diferencia) -- ahí no alcanza con
// agrupar dentro de procesarEvento porque son invocaciones distintas de la
// función. Se espera un colchón corto y, si en ese lapso llegó un mensaje
// más nuevo en esa conversación, esta invocación se retira sin contestar --
// la invocación del mensaje más nuevo es la que va a terminar respondiendo,
// ya con el historial completo (los dos mensajes) en la consulta que hace
// ejecutarAgente más abajo.
// Pedido del 5/10: 8 s en vez de 6 -- escribir el segundo mensaje ("hola buen
// día" → "¿tienen Ford?") suele llevar más de 6 s.
const DEBOUNCE_MS = 8000;

async function hayMensajeMasNuevo(conversacionId: string, mensajeId: string): Promise<boolean> {
  const { data: ultimoEntrante } = await supabase
    .from("whatsapp_mensajes")
    .select("id")
    .eq("conversacion_id", conversacionId)
    .eq("direccion", "in")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return !!ultimoEntrante && ultimoEntrante.id !== mensajeId;
}

async function ejecutarAgenteConDebounce(conversacionId: string, mensajeId: string) {
  await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS));
  if (await hayMensajeMasNuevo(conversacionId, mensajeId)) return; // llegó algo más nuevo, esa invocación se encarga
  await ejecutarAgente(conversacionId, mensajeId);
}

// Mensajes del cliente que todavía no tienen respuesta (todo lo que mandó
// desde la última respuesta nuestra), juntos en un solo texto -- "hola buen
// día" + "¿dónde están?" se leen como una sola consulta.

// Antes, cualquier mensaje que no fuera texto/interactive (audio, foto,
// video, documento) se guardaba con texto=null y quedaba invisible para el
// agente -- ejecutarAgente arma el historial filtrando ".filter(m => m.texto)",
// así que el cliente mandaba un audio y el bot se quedaba en silencio total.
// Se resuelve un texto real para cada tipo -- sin transcripción automática de
// audio (a propósito, el vendedor lo escucha directo en el panel, ver
// media_url más abajo en guardarMensajeEntrante()).
function resolverTextoMensaje(msg: any): string | null {
  if (msg.type === "text") return msg.text?.body ?? null;
  if (msg.type === "interactive") return msg.interactive?.list_reply?.title ?? msg.interactive?.button_reply?.title ?? null;
  if (msg.type === "audio") return "🎤 Audio";
  if (msg.type === "image") return msg.image?.caption?.trim() || "[Cliente envió una foto sin descripción]";
  if (msg.type === "video") return msg.video?.caption?.trim() || "[Cliente envió un video]";
  if (msg.type === "document") return msg.document?.caption?.trim() || msg.document?.filename || "[Cliente envió un documento]";
  if (msg.type === "sticker") return "[Cliente envió un sticker]";
  return null;
}

async function guardarMensajeEntrante({ waId, nombrePerfil, msg }: { waId: string; nombrePerfil: string | null; msg: any }): Promise<{ conversacionId: string; mensajeId: string } | null> {
  // Solo se completa nombre_perfil al crear el contacto por primera vez --
  // si ya existe, NO se pisa con el nombre de perfil de WhatsApp en cada
  // mensaje entrante, porque eso borraba el nombre real que el cliente ya
  // había dado en la charla (el agente lo guarda apenas lo detecta).
  let { data: contacto } = await supabase.from("whatsapp_contactos").select("id").eq("telefono", waId).maybeSingle();
  if (!contacto) {
    const { data: nuevo, error: errInsert } = await supabase.from("whatsapp_contactos").insert({ telefono: waId, nombre_perfil: nombrePerfil }).select("id").single();
    if (errInsert && errInsert.code === "23505") {
      // Dos mensajes casi simultáneos del mismo contacto nuevo -- el otro ya
      // lo insertó primero, lo buscamos de nuevo en vez de fallar.
      ({ data: contacto } = await supabase.from("whatsapp_contactos").select("id").eq("telefono", waId).maybeSingle());
    } else {
      contacto = nuevo;
    }
  }
  if (!contacto) return null;

  let { data: conversacion } = await supabase
    .from("whatsapp_conversaciones")
    .select("id, vendedor_id, ai_habilitada, canal_origen, vehiculo_id")
    .eq("contacto_id", contacto.id)
    .maybeSingle();

  if (!conversacion) {
    // Desde el 31/10/2026 la charla nueva entra sin vendedor mientras la
    // atiende el bot (migraciones/sql_whatsapp_asignar_al_terminar.sql y
    // lib/panel/asignacionWhatsapp.ts). canal_origen arranca en
    // "WhatsApp" por default -- antes quedaba en null hasta que alguien lo
    // marcara a mano en el panel, así que un lead que entraba orgánico (sin
    // pauta de Meta ni desde MercadoLibre) aparecía "Sin especificar"
    // indefinidamente. Si el primer mensaje sí trae señal de Meta Ads o
    // MercadoLibre, los bloques de abajo lo pisan (ambos chequean también
    // canal_origen === "WhatsApp", no solo null).
    const { data: nueva, error: errInsertConv } = await supabase.from("whatsapp_conversaciones").insert({ contacto_id: contacto.id, canal_origen: "WhatsApp" }).select("id, vendedor_id, ai_habilitada, canal_origen, vehiculo_id").single();
    if (errInsertConv && errInsertConv.code === "23505") {
      // Dos mensajes casi simultáneos del mismo contacto nuevo, en
      // invocaciones de webhook distintas -- la otra ya creó la
      // conversación primero (ver migraciones/sql_whatsapp_conversaciones_
      // unique_contacto.sql), la buscamos de nuevo en vez de duplicarla.
      // Sin esto, cada una respondía el menú de bienvenida por separado.
      ({ data: conversacion } = await supabase.from("whatsapp_conversaciones").select("id, vendedor_id, ai_habilitada, canal_origen, vehiculo_id").eq("contacto_id", contacto.id).maybeSingle());
    } else {
      conversacion = nueva;
    }
  }
  if (!conversacion) return null;

  if (msg.referral?.headline) {
    // Meta manda "referral" solo en el primer mensaje de una charla que
    // arrancó desde un anuncio de Click-to-WhatsApp o el botón "Enviar
    // mensaje" de un posteo de FB/IG -- antes solo se guardaba el headline
    // (texto libre del anuncio) en origen_ads, sin clasificar canal_origen,
    // que es el campo que el resto de la app (Leads, Dashboard, "canalTop"
    // de Clientes) sí lee para saber de dónde vino el contacto. Mismo
    // vocabulario que lib/utm.ts (MAPA_FUENTE) para hablar el mismo idioma
    // que /panel/marketing/pautas -- instagram y facebook mapean los dos a
    // "Meta Ads" ahí también, no se distinguen.
    const patch: Record<string, unknown> = { origen_ads: msg.referral.headline };
    if (!conversacion.canal_origen || conversacion.canal_origen === "WhatsApp") patch.canal_origen = "Meta Ads";
    await supabase.from("whatsapp_conversaciones").update(patch).eq("id", conversacion.id);
  } else if (/mercadolibre\.com/i.test(msg.text?.body || "")) {
    // El botón "Contactá al vendedor" de una publicación de MercadoLibre
    // genera un wa.me con un texto prearmado que SIEMPRE incluye el link
    // completo de la publicación (auto.mercadolibre.com.ar/MLA-...) -- no
    // manda "referral" como Meta Ads, pero el link en el texto del primer
    // mensaje es una señal igual de confiable. Mismo vocabulario que
    // lib/utm.ts ("MercadoLibre").
    const patch: Record<string, unknown> = {};
    if (!conversacion.canal_origen || conversacion.canal_origen === "WhatsApp") patch.canal_origen = "MercadoLibre";

    // El link trae el ID de la publicación (MLA-2006584545-...) -- si ese
    // mismo auto está publicado en ML desde Stock (vehiculos.ml_item_id se
    // carga al publicar, ver lib/ads/mercadolibrePublish.ts), se vincula
    // solo como "vehículo de interés" de la charla, sin que el vendedor
    // tenga que cargarlo a mano. Deja "cuántas consultas por WhatsApp
    // entraron por este auto publicado en ML" contable por vehiculo_id.
    if (!conversacion.vehiculo_id) {
      const mlaId = msg.text?.body?.match(/MLA-?(\d+)/i)?.[1];
      if (mlaId) {
        const { data: vehiculo } = await supabase.from("vehiculos").select("id").eq("ml_item_id", `MLA${mlaId}`).maybeSingle();
        if (vehiculo) patch.vehiculo_id = vehiculo.id;
      }
    }

    if (Object.keys(patch).length > 0) {
      await supabase.from("whatsapp_conversaciones").update(patch).eq("id", conversacion.id);
    }
  }

  // Cuando el cliente toca una opción de la lista interactiva del menú de
  // bienvenida, Meta manda type "interactive" con interactive.list_reply en
  // vez de texto — se usa el título de la opción como si lo hubiera tipeado,
  // así el agente lo procesa igual que cualquier mensaje de texto.
  const texto = resolverTextoMensaje(msg);
  // Audio entrante: se baja el archivo real de Meta (URL temporal, ~5 min) y
  // se sube a R2 para poder reproducirlo después desde el panel (antes solo
  // quedaba el placeholder de texto de arriba, el vendedor tenía que
  // escucharlo en su WhatsApp real). Best-effort: si falla (Meta caída, R2
  // sin configurar, etc.) el mensaje se guarda igual con el placeholder de
  // texto, no se pierde el mensaje por esto.
  // Lo mismo para foto, video, documento y sticker: antes solo se bajaba el
  // audio y el resto quedaba como un texto de reemplazo, sin el archivo, así
  // que el vendedor no veía lo que mandó el cliente. El panel decide cómo
  // mostrarlo por "tipo" (ChatClient.tsx): el sticker se guarda como imagen.
  const TIPOS_CON_ARCHIVO = ["audio", "image", "video", "document", "sticker"];
  const mediaId: string | undefined = TIPOS_CON_ARCHIVO.includes(msg.type) ? msg[msg.type]?.id : undefined;
  let mediaUrl: string | null = null;
  if (mediaId) {
    try {
      const { data: config } = await supabase.from("whatsapp_configuracion").select("token_cifrado, token_iv, token_tag").maybeSingle();
      if (config?.token_cifrado && r2Configurado()) {
        const tokenPlano = decrypt(config.token_cifrado, config.token_iv, config.token_tag);
        const { buffer, mimeType } = await descargarMediaWhatsapp(mediaId, tokenPlano);
        const extensionDelNombre = msg.type === "document" ? String(msg.document?.filename || "").split(".").pop()?.toLowerCase() : "";
        const extension = mimeType.includes("ogg") ? "ogg" : extensionDelNombre || mimeType.split("/")[1]?.split(";")[0] || "bin";
        mediaUrl = await subirArchivoR2(buffer, `whatsapp/${msg.type}/${Date.now()}-${msg.id}.${extension}`, mimeType.split(";")[0]);
      }
    } catch (err) {
      registrarError("webhook-v2:descargar-media", err, { conversacionId: conversacion.id, mediaId, tipo: msg.type });
    }
  }
  const { data: mensajeInsertado, error } = await supabase.from("whatsapp_mensajes").insert({
    conversacion_id: conversacion.id,
    wa_message_id: msg.id,
    direccion: "in",
    tipo: msg.type === "sticker" ? "image" : msg.type ?? "text",
    texto,
    media_url: mediaUrl,
    status: "received",
    wa_timestamp: new Date(Number(msg.timestamp) * 1000).toISOString(),
  }).select("id").single();
  if (error) {
    if (error.code === "23505") return null; // duplicado (reintento de Meta)
    registrarError("webhook-v2:insertar-mensaje", error, { conversacionId: conversacion.id });
    return null;
  }

  const { data: convActual } = await supabase.from("whatsapp_conversaciones").select("unread_count, vendedor_id").eq("id", conversacion.id).single();
  await supabase.from("whatsapp_conversaciones").update({ last_inbound_at: new Date().toISOString(), last_message_at: new Date().toISOString(), unread_count: (convActual?.unread_count ?? 0) + 1 }).eq("id", conversacion.id);

  // La alerta de "nuevo mensaje" la dispara el trigger trg_whatsapp_mensaje_
  // entrante sobre whatsapp_mensajes (avisa al vendedor asignado, o a todo
  // admin/encargado/ventas si todavía no tiene uno) -- llamarlo también
  // desde acá duplicaba la alerta.

  return { conversacionId: conversacion.id, mensajeId: mensajeInsertado.id };
}



function isWhatsappEnvioConfigurado(config: any): boolean {
  return !!config?.listo && !!config?.token_cifrado && !!config?.token_iv && !!config?.token_tag && !!config?.phone_number_id;
}

// Horario de atención configurable desde Configuración → WhatsApp (default 8 a 22, hora Argentina).
async function enviarMensajeFijo(conversacionId: string, texto: string, config: any) {
  const { data: mensajeSaliente } = await supabase.from("whatsapp_mensajes").insert({ conversacion_id: conversacionId, direccion: "out", tipo: "text", texto, status: "pending", ai_generado: false }).select("id").single();
  if (mensajeSaliente) await enviarYActualizarMensaje(mensajeSaliente.id, conversacionId, texto, config);
}

async function ejecutarAgente(conversacionId: string, mensajeId: string) {
  // select("*"): fuera_horario_avisado_at viene de la migración sql_horario_bots.sql; sin ella la charla se atiende igual.
  const { data: conversacionActual } = await supabase.from("whatsapp_conversaciones").select("*").eq("id", conversacionId).single();
  if (conversacionActual?.ai_habilitada === false) return;

  const { data: config } = await supabase.from("whatsapp_configuracion").select("*").maybeSingle();

  // Horario de los bots (lib/panel/horarioBots.ts): fuera de horario, un solo aviso por noche; a las 9 el cron
  // /api/cron/panel/bots-apertura le escribe "ya estamos disponibles" a quien lo recibió.
  const horario = horarioDeConfig(config);
  if (!estaEnHorario(horario)) {
    if (!debeAvisarFueraDeHorario(conversacionActual?.fuera_horario_avisado_at)) return;
    const avisoFueraHorario = (await buscarRespuestaFueraHorario(supabase)) || textoFueraDeHorarioPorDefecto(horario.inicio, horario.fin);
    await enviarMensajeFijo(conversacionId, avisoFueraHorario, config);
    await supabase.from("whatsapp_conversaciones").update({ fuera_horario_avisado_at: new Date().toISOString() }).eq("id", conversacionId);
    return;
  }

  // Ojo: ascending+limit trae los primeros 20 mensajes de TODA la charla,
  // no los últimos 20 -- en una charla larga el bot quedaba viendo siempre
  // el arranque de la conversación y nunca lo que se habló después. Se pide
  // descendente (los más recientes) y se da vuelta para volver a dejarlos en
  // orden cronológico antes de mandarlos como historial.
  const { data: mensajesDesc } = await supabase.from("whatsapp_mensajes").select("direccion, texto").eq("conversacion_id", conversacionId).order("created_at", { ascending: false }).limit(20);
  const mensajes = mensajesDesc ? [...mensajesDesc].reverse() : mensajesDesc;
  const historial = (mensajes ?? []).filter((m) => m.texto).map((m) => ({ role: (m.direccion === "in" ? "user" : "assistant") as "user" | "assistant", content: m.texto as string }));

  // "Memoria" primero (palabras clave, sin costo de IA) -- solo se llama a la
  // IA si lo que el cliente mandó desde nuestra última respuesta no matchea
  // nada fijo (horarios, ubicación, formas de pago, datos de la empresa), o
  // si además pregunta por un auto (ver REGEX_CONSULTA_AUTO).
  const textoPendiente = textoPendienteDelCliente(historial);
  if (textoPendiente && !REGEX_CONSULTA_AUTO.test(textoPendiente)) {
    const respuestaMemoria = await buscarRespuestaMemoria(supabase, textoPendiente);
    if (respuestaMemoria) {
      await enviarMensajeFijo(conversacionId, respuestaMemoria, config);
      return;
    }
  }

  if (!isAiConfiguredV2()) return;

  const result = await generarRespuestaAgenteV2(historial, "panel-v2/webhooks/whatsapp", undefined, conversacionActual?.vehiculo_id ?? null, config?.tono ?? null);

  // Pedido del 5/10: el agente tarda 5-15 s en pensar. Si mientras tanto el
  // cliente mandó otro mensaje ("Hola buen día" y a los 10 s "¿tienen
  // Ford?"), esta respuesta ya quedó vieja -- se descarta sin enviar ni
  // tocar nada, y contesta la invocación del mensaje nuevo, que lee los dos
  // juntos. Sin esto salían el menú de bienvenida Y la respuesta del Ford.
  if (await hayMensajeMasNuevo(conversacionId, mensajeId)) return;

  if (!result.ok) {
    registrarError("webhook-v2:agente", result.error, { conversacionId });
    const { data: mensajeFallback } = await supabase.from("whatsapp_mensajes").insert({ conversacion_id: conversacionId, direccion: "out", tipo: "text", texto: RESPUESTA_FALLBACK, status: "pending", ai_generado: false }).select("id").single();
    if (mensajeFallback) await enviarYActualizarMensaje(mensajeFallback.id, conversacionId, RESPUESTA_FALLBACK, config);
    return;
  }

  const { reply, handoff, pausar_sin_notificar, calificacion, resumen_handoff, datos_detectados } = result.data;
  const { fotosParaEnviar, vehiculoFocoId, pedidoStock } = result;
  const autoCharla = autoDeLaCharla(vehiculoFocoId, result.data.intencion);

  const estadoSegunCalificacion = calificacion === "caliente" ? "calificando" : undefined;
  const patchConversacion: Record<string, unknown> = { calificacion };
  if (estadoSegunCalificacion) patchConversacion.estado_lead = estadoSegunCalificacion;
  if (autoCharla !== undefined) patchConversacion.vehiculo_id = autoCharla;

  // La sucursal que elige el cliente se guarda apenas la dice, no recién al pasar la charla: así sirve para asignarla
  // aunque el cliente deje de contestar a mitad de camino (Walter, 31/10/2026; lib/panel/asignacionWhatsapp.ts).
  let sucursalElegida: { id: string; nombre: string } | null = null;
  if (datos_detectados?.zona) {
    const { data } = await supabase.from("sucursales").select("id, nombre").eq("slug", datos_detectados.zona).maybeSingle();
    sucursalElegida = data;
    if (sucursalElegida && sucursalElegida.id !== conversacionActual?.sucursal_id) patchConversacion.sucursal_id = sucursalElegida.id;
  }

  // Pedido del usuario: todo auto 0km que el bot elige como foco de la
  // charla se deriva siempre a Gabriel (Casa Central), sin importar la
  // ronda normal por sucursal -- lo maneja una sola persona. Se busca por
  // nombre/sucursal en vivo (no un UUID hardcodeado) para no romper si
  // cambia el perfil; si no se encuentra a Gabriel activo en Casa Central,
  // no rompe el resto del flujo, solo no fuerza el cambio.
  // Pedido del 29/9: consignación deja de ir a Gabriel -- ahora cae en la
  // ronda común (el trigger asignar_vendedor_conversacion_nueva ya le puso
  // vendedor al crear la charla), igual que Instagram/Messenger/Rodi, que
  // nunca tuvieron este caso especial.
    // Pedido del 29/9: además de avisarle al vendedor nuevo por qué le llegó
  // (ya lo hacía la notificación de abajo), la reasignación automática
  // queda anotada en Eventos del lead -- sin esto, quien abre el detalle
  // más tarde (o el vendedor al que se lo sacaron) no tiene forma de saber
  // que un lead que tenía asignado cambió de dueño solo, ni por qué.
  const registrarEventoAsignacion = (descripcion: string) =>
    supabase.from("eventos_lead").insert({ whatsapp_conversacion_id: conversacionId, tipo: "asignacion", descripcion }).then(({ error }) => {
      if (error) registrarError("webhook-v2:evento-asignacion", error, { conversacionId });
    });

  // A quién va el lead: a quien tiene el auto (o a Gabriel si es consignación), salvo que lo hayan pasado a mano
  // (Walter, 21/10/2026; reglas en lib/panel/asignacionPorAuto.ts). Reemplaza "todo 0 km a Gabriel".
  const porAuto = await asignacionPorAuto(supabase, { fk: "whatsapp_conversacion_id", conversacionId, vehiculoId: autoCharla ?? null, intencion: result.data.intencion, vendedorActual: conversacionActual?.vendedor_id ?? null });
  if (porAuto) {
    patchConversacion.vendedor_id = porAuto.vendedorId;
    patchConversacion.estado_lead = "asignado";
    registrarEventoAsignacion(porAuto.descripcion);
  }
  // Pedido del 1/10: ya NO se reasigna la charla solo porque el auto en
  // foco tenga otro vendedor en Stock -- antes esto le sacaba el lead al
  // vendedor que lo venía atendiendo (y, con el filtro de visibilidad por
  // vendedor de leads/page.tsx y los 4 módulos de conversaciones, el chat
  // directamente desaparecía de su bandeja). Ahora el vendedor original
  // se queda con la conversación; LeadDetailModal.tsx muestra un aviso de
  // "este auto lo tiene asignado [otro vendedor]" comparando en vivo
  // vehiculos.vendedor_asignado_id contra la conversación, sin tocar quién
  // es el dueño del lead. El caso de Gabriel/0km (arriba) sigue igual, no
  // se tocó -- ese sí es una regla de negocio explícita de reasignar.

  await supabase.from("whatsapp_conversaciones").update(patchConversacion).eq("id", conversacionId);

  // Avisar recién después del update de arriba (así el link ya muestra la
  // conversación con el vendedor correcto si abre desde la alerta).
  if (patchConversacion.vendedor_id) {
    // Única rama que llega acá: el lead fue a quien tiene el auto o, si es consignación, a Gabriel (asignacionPorAuto).
    const textoAviso = result.data.intencion === "CONSIGNACION"
      ? "Un cliente quiere dejar su auto en consignación — se te asignó automáticamente."
      : "Un cliente está consultando por un auto que tenés asignado — se te asignó automáticamente.";
    notificarPersona(supabase, patchConversacion.vendedor_id as string, "whatsapp_venta_zona", textoAviso, `/panel/whatsapp?conversacion=${conversacionId}`, { categoriaNotif: "leads", modulo: "leads" }).catch((err) => console.error("[webhook-v2] error notificando asignación:", err));
  }

  // Nombre y mail que el cliente vaya dando durante la charla se guardan en
  // el contacto apenas se detectan, sin esperar al handoff — así quedan
  // aunque la charla se corte antes de derivar a un vendedor.
  let contactoIdActual: string | null = null;
  if (datos_detectados?.nombre || datos_detectados?.email || datos_detectados?.cuil) {
    const { data: conv } = await supabase.from("whatsapp_conversaciones").select("contacto_id").eq("id", conversacionId).single();
    contactoIdActual = conv?.contacto_id ?? null;
    if (contactoIdActual) {
      const patchContacto: Record<string, unknown> = {};
      if (datos_detectados.nombre) patchContacto.nombre_perfil = datos_detectados.nombre;
      if (datos_detectados.email) patchContacto.email = datos_detectados.email;
      if (datos_detectados.cuil) patchContacto.cuil = datos_detectados.cuil;
      const { error: errorContacto } = await supabase.from("whatsapp_contactos").update(patchContacto).eq("id", contactoIdActual);
      if (errorContacto) registrarError("webhook-v2:patch-contacto", errorContacto, { conversacionId });
    }
  }

  // Sin stock que coincida: el bot ya avisó que va a notificar apenas entre
  // un auto así -- queda registrado en Pedidos con lo que se sabe hasta
  // ahora (aunque sea parcial), para que reasignar_pedidos_vencidos y el
  // match automático de stock nuevo lo tengan en cuenta.
  if (pedidoStock?.marca) {
    const { data: convParaPedido } = await supabase.from("whatsapp_conversaciones").select("vendedor_id, contacto_id, whatsapp_contactos(telefono, nombre_perfil)").eq("id", conversacionId).single();
    const telefonoContacto = (convParaPedido?.whatsapp_contactos as any)?.telefono;
    if (telefonoContacto) {
      // "nombre_cliente" es NOT NULL en "pedidos" -- fallback para no perder
      // el pedido si todavía no tenemos el nombre. "marca" también es NOT
      // NULL, pero esa la exige el prompt antes de completar pedido_stock
      // (ver regla SIN STOCK QUE COINCIDA) -- no se rellena con un fallback
      // acá porque un pedido con marca inventada no sirve para nada.
      await guardarPedidoDelBot(supabase, {
        telefono: telefonoContacto,
        nombre_cliente: datos_detectados?.nombre || (convParaPedido?.whatsapp_contactos as any)?.nombre_perfil || "Cliente de WhatsApp",
        marca: pedidoStock.marca, modelo: pedidoStock.modelo,
        presupuesto_max: pedidoStock.presupuesto_max, moneda: pedidoStock.moneda || "ARS",
        puertas: pedidoStock.puertas,
        vendedor_id: convParaPedido?.vendedor_id ?? null,
        origen: "whatsapp",
      }, "webhook-v2:crear-pedido");
    }
  }

  // Cuando el agente muestra opciones de stock, "reply" viene partido en
  // varias burbujas (lista de autos + pregunta corta abajo) — se mandan como
  // mensajes de WhatsApp separados, en orden, no todo apelotonado en uno.
  for (const parte of dividirRespuestaEnMensajes(reply)) {
    const { data: mensajeSaliente } = await supabase.from("whatsapp_mensajes").insert({ conversacion_id: conversacionId, direccion: "out", tipo: "text", texto: parte, status: "pending", ai_generado: true }).select("id").single();
    if (mensajeSaliente) await enviarYActualizarMensaje(mensajeSaliente.id, conversacionId, parte, config);
  }

  for (const fotoUrl of fotosParaEnviar) {
    const { data: mensajeFoto } = await supabase.from("whatsapp_mensajes").insert({ conversacion_id: conversacionId, direccion: "out", tipo: "image", media_url: fotoUrl, status: "pending", ai_generado: true }).select("id").single();
    if (mensajeFoto) await enviarYActualizarImagen(mensajeFoto.id, conversacionId, fotoUrl, config);
  }

  if (handoff) {
    // CLIENTE OFENSIVO -- el bot ya respondió con altura y se pausa (misma
    // mecánica que un handoff normal, ai_habilitada false), pero A PROPÓSITO
    // no se asigna vendedor, no se notifica a nadie, ni se crea visita: es
    // una charla que se enfría sola, no una venta real para avisarle a un
    // vendedor. Si más adelante el cliente escribe algo normal, el flujo de
    // "reactivar tras pausa" ya existente lo retoma como cualquier otro.
    await supabase.from("whatsapp_conversaciones").update({
      handoff_at: new Date().toISOString(), handoff_reason: pausar_sin_notificar ? "cliente_ofensivo" : "cliente_pidio_humano",
      handoff_resumen: resumen_handoff || null, ai_habilitada: false,
    }).eq("id", conversacionId);

    if (pausar_sin_notificar) return;

    const { data: convHandoff } = await supabase.from("whatsapp_conversaciones").select("vendedor_id, sucursal_id, contacto_id, whatsapp_contactos(telefono, nombre_perfil)").eq("id", conversacionId).single();
    const linkNoti = `/panel/whatsapp?conversacion=${conversacionId}`;
    const mensajeNoti = resumen_handoff || "El cliente pidió hablar con una persona — la IA dejó de responder.";
    let vendedorAsignado = convHandoff?.vendedor_id ?? null;

    // La sucursal que eligió en un mensaje anterior (se guarda apenas la dice, ver arriba).
    if (!sucursalElegida && convHandoff?.sucursal_id) {
      const { data } = await supabase.from("sucursales").select("id, nombre").eq("id", convHandoff.sucursal_id).maybeSingle();
      sucursalElegida = data;
    }
    // El bot pasa la charla y todavía no tiene vendedor (no se habló de un auto del stock ni de consignación): va a la
    // ronda de la sucursal que eligió el cliente o, si no eligió, a la ronda general (lib/panel/asignacionWhatsapp.ts).
    if (!vendedorAsignado) {
      vendedorAsignado = await asignarCharlaWhatsapp(supabase, {
        conversacionId, sucursalId: sucursalElegida?.id ?? null,
        motivo: sucursalElegida ? `el bot pasó la charla (eligió ${sucursalElegida.nombre}).` : "el bot pasó la charla.",
      });
    }

    if (vendedorAsignado) {
      notificarPersona(supabase, vendedorAsignado, sucursalElegida ? "whatsapp_venta_zona" : "whatsapp_handoff", mensajeNoti, linkNoti, { categoriaNotif: "leads", modulo: "leads" }).catch((err) => console.error("[webhook-v2] error notificando handoff:", err));
    } else if (sucursalElegida) {
      // Ni un vendedor ni un encargado disponible en esa sucursal -- último
      // recurso, avisar en general (prioridad alta igual, es venta real).
      notificarEncargados(supabase, mensajeNoti, linkNoti, "whatsapp_venta_zona", sucursalElegida.id, "alta", { categoriaNotif: "leads", modulo: "leads" }).catch((err) => console.error("[webhook-v2] error notificando zona:", err));
    } else {
      notificarEncargados(supabase, mensajeNoti, linkNoti, "whatsapp_handoff", null, "media", { categoriaNotif: "leads", modulo: "leads" }).catch((err) => console.error("[webhook-v2] error notificando handoff:", err));
    }

    // Quiere dejar su auto en consignación: se carga sola en Consignaciones → Pendientes (lib/panel/consignacionDesdeChat.ts).
    const contactoHandoff = convHandoff?.whatsapp_contactos as { telefono?: string | null; nombre_perfil?: string | null } | null | undefined;
    await cargarConsignacionDesdeChat(supabase, {
      canal: "whatsapp", conversacionId, intencion: result.data.intencion, datos: datos_detectados,
      nombre: datos_detectados?.nombre || contactoHandoff?.nombre_perfil || "Cliente de WhatsApp",
      telefono: contactoHandoff?.telefono, email: datos_detectados?.email,
      vendedorId: vendedorAsignado, sucursalId: sucursalElegida?.id,
    });
    await cargarPedidoDesdeChat(supabase, {
      canal: "whatsapp", conversacionId, intencion: result.data.intencion, datos: datos_detectados,
      nombre: datos_detectados?.nombre || contactoHandoff?.nombre_perfil || "Cliente de WhatsApp",
      telefono: contactoHandoff?.telefono, email: datos_detectados?.email,
      vendedorId: vendedorAsignado, sucursalNombre: sucursalElegida?.nombre,
    });

    // Día/horario confirmado para acercarse: se agenda como visita real en
    // el módulo Visitas, no queda solo en el texto de la charla para que el
    // vendedor tenga que volver a preguntarlo.
    if (datos_detectados?.dia_visita && datos_detectados?.horario_visita) {
      const telefonoCliente = (convHandoff?.whatsapp_contactos as any)?.telefono;
      const nombreCliente = datos_detectados?.nombre || (convHandoff?.whatsapp_contactos as any)?.nombre_perfil || "Cliente de WhatsApp";
      const { fecha: fechaVisita, dudosa: fechaDudosa } = resolverFechaVisitaConControl(datos_detectados.dia_visita);
      const sucursalVisita = sucursalElegida?.nombre || "Sin especificar";
      // Mismo chequeo que los formularios públicos (AgendarVisitaForm.tsx /
      // AgendarCitaForm.tsx) -- acá el bot no puede reofrecerle otro horario
      // al cliente en el momento, así que la visita se crea igual (mejor
      // tener el lead con un conflicto que perderlo) pero se avisa al
      // vendedor/encargados para que reagenden una de las dos a mano.
      // Si ya pidió visita ese día por otro lado (formulario de la web), no se repite: se completa esa (lib/panel/visitaRepetida.ts).
      const visitaYaCargada = await completarVisitaRepetida(supabase, {
        telefono: telefonoCliente, fecha: fechaVisita,
        vehiculo_marca: datos_detectados?.vehiculo_propio?.marca || null, vehiculo_modelo: datos_detectados?.vehiculo_propio?.modelo || null,
      });
      const { data: ocupados } = visitaYaCargada ? { data: [] } : await supabase.rpc("visitas_horarios_ocupados", { p_sucursal: sucursalVisita, p_fecha: fechaVisita });
      const hayConflicto = (ocupados || []).some((o: { horario_visita: string }) => o.horario_visita === datos_detectados.horario_visita);

      const { error: errorVisita } = visitaYaCargada ? { error: null } : await supabase.from("visitas").insert({
        vehiculo_marca: datos_detectados?.vehiculo_propio?.marca || null,
        vehiculo_modelo: datos_detectados?.vehiculo_propio?.modelo || null,
        nombre_cliente: nombreCliente,
        telefono_cliente: telefonoCliente || "sin dato",
        fecha_visita: fechaVisita,
        horario_visita: datos_detectados.horario_visita,
        sucursal: sucursalVisita,
        estado: "Pendiente",
        vendedor_id: vendedorAsignado,
      });
      if (errorVisita) registrarError("webhook-v2:crear-visita", errorVisita);
      else if (fechaDudosa && !visitaYaCargada) {
        const mensajeFecha = `📅 ${nombreCliente} agendó por WhatsApp "${datos_detectados.dia_visita}", pero ese día de la semana no coincide con el número. Quedó el ${fechaVisita}: confirmar la fecha con el cliente.`;
        if (vendedorAsignado) notificarPersona(supabase, vendedorAsignado, "whatsapp_venta_zona", mensajeFecha, "/panel/visitas", { modulo: "visitas" }).catch((err) => console.error("[webhook-v2] error avisando fecha dudosa:", err));
        else notificarEncargados(supabase, mensajeFecha, "/panel/visitas", "whatsapp_venta_zona", sucursalElegida?.id, "alta", { modulo: "visitas" }).catch((err) => console.error("[webhook-v2] error avisando fecha dudosa:", err));
      }
      if (!errorVisita && hayConflicto) {
        const mensajeConflicto = `⚠️ ${nombreCliente} agendó por WhatsApp a las ${datos_detectados.horario_visita} el ${fechaVisita} en ${sucursalVisita}, pero ese horario ya estaba ocupado. Reagendar una de las dos.`;
        if (vendedorAsignado) notificarPersona(supabase, vendedorAsignado, "whatsapp_venta_zona", mensajeConflicto, "/panel/visitas", { modulo: "visitas" }).catch((err) => console.error("[webhook-v2] error notificando conflicto de visita:", err));
        else notificarEncargados(supabase, mensajeConflicto, "/panel/visitas", "whatsapp_venta_zona", sucursalElegida?.id, "alta", { modulo: "visitas" }).catch((err) => console.error("[webhook-v2] error notificando conflicto de visita:", err));
      }
    }
  }
}

async function enviarYActualizarMensaje(mensajeId: string, conversacionId: string, texto: string, config: any) {
  if (!isWhatsappEnvioConfigurado(config)) {
    console.warn("[webhook-v2] WhatsApp no está configurado — mensaje queda 'pending' sin enviar.");
    return;
  }

  const { data: conversacion } = await supabase.from("whatsapp_conversaciones").select("contacto_id, whatsapp_contactos(telefono)").eq("id", conversacionId).single();
  const telefono = (conversacion?.whatsapp_contactos as any)?.telefono;
  if (!telefono) return;

  try {
    const tokenPlano = decrypt(config.token_cifrado, config.token_iv, config.token_tag);
    const resultado = await sendTextMessage(config.phone_number_id, tokenPlano, telefono, texto);
    await supabase.from("whatsapp_mensajes").update({ status: "sent", wa_message_id: resultado.messages?.[0]?.id }).eq("id", mensajeId);
  } catch (err) {
    registrarError("webhook-v2:enviar-mensaje", err, { conversacionId, mensajeId });
    // Antes esto dejaba error_detalle en null -- el webhook de status
    // asíncrono (actualizarEstadoMensaje) sí lo guarda, pero una falla
    // síncrona al mandar (ej. Meta caída, ventana de 24hs) solo quedaba en
    // logs_errores, invisible para el botón "reintentar con plantilla" del
    // panel, que mostraba siempre el motivo genérico por defecto.
    const detalleError = err instanceof Error ? err.message : String(err);
    await supabase.from("whatsapp_mensajes").update({ status: "failed", error_detalle: detalleError.slice(0, 500) }).eq("id", mensajeId);
  }
}

// Best-effort: si falla el envío de la foto no rompe la conversación, ya se
// mandó el texto antes. La URL de la foto ya es pública (mismo storage que
// usa el catálogo web), Meta la descarga directo del link.
async function enviarYActualizarImagen(mensajeId: string, conversacionId: string, imageUrl: string, config: any) {
  if (!isWhatsappEnvioConfigurado(config)) return;

  const { data: conversacion } = await supabase.from("whatsapp_conversaciones").select("contacto_id, whatsapp_contactos(telefono)").eq("id", conversacionId).single();
  const telefono = (conversacion?.whatsapp_contactos as any)?.telefono;
  if (!telefono) return;

  try {
    const tokenPlano = decrypt(config.token_cifrado, config.token_iv, config.token_tag);
    const resultado = await sendImageMessage(config.phone_number_id, tokenPlano, telefono, imageUrl);
    await supabase.from("whatsapp_mensajes").update({ status: "sent", wa_message_id: resultado.messages?.[0]?.id }).eq("id", mensajeId);
  } catch (err) {
    registrarError("webhook-v2:enviar-imagen", err, { conversacionId, mensajeId });
    await supabase.from("whatsapp_mensajes").update({ status: "failed" }).eq("id", mensajeId);
  }
}

async function actualizarEstadoMensaje(status: any) {
  const orden = ["pending", "sent", "delivered", "read"];
  const { data: msg } = await supabase.from("whatsapp_mensajes").select("id, status, ai_generado, conversacion_id").eq("wa_message_id", status.id).maybeSingle();
  if (!msg) return;

  if (status.status === "failed") {
    // Meta manda el motivo real acá (status.errors) -- antes se descartaba y
    // quedaba solo el status "failed" sin ninguna pista de por qué.
    const detalleError = Array.isArray(status.errors)
      ? status.errors.map((e: any) => `#${e.code} ${e.title}${e.error_data?.details ? ` — ${e.error_data.details}` : ""}`).join(" | ")
      : null;
    await supabase.from("whatsapp_mensajes").update({ status: "failed", error_detalle: detalleError }).eq("id", msg.id);
    if (detalleError) registrarError("webhook-v2:mensaje-fallido", new Error(detalleError), { waMessageId: status.id, mensajeId: msg.id });
    // Un mensaje escrito por una persona que no salió: se le avisa al vendedor de la charla (los del bot no, ya quedan
    // en Errores del sistema y no hay a quién avisarle).
    if (msg.status !== "failed" && !msg.ai_generado) {
      const { data: conv } = await supabase.from("whatsapp_conversaciones").select("vendedor_id, whatsapp_contactos(nombre_perfil, telefono)").eq("id", msg.conversacion_id).maybeSingle();
      const contacto = conv?.whatsapp_contactos as { nombre_perfil?: string | null; telefono?: string | null } | null;
      if (conv?.vendedor_id) {
        const aviso = avisoMensajeNoEnviado(contacto?.nombre_perfil || contacto?.telefono || "un cliente", detalleError);
        await crearAlerta(supabase, conv.vendedor_id, aviso.titulo, { mensaje: aviso.mensaje, link: `/panel/whatsapp?conversacion=${msg.conversacion_id}`, tipo: "mensaje_no_enviado", prioridad: "alta", modulo: "leads", categoriaNotif: "leads" })
          .catch((err) => registrarError("webhook-v2:aviso-mensaje-fallido", err, { mensajeId: msg.id }));
      }
    }
    return;
  }
  const actualIdx = orden.indexOf(msg.status);
  const nuevoIdx = orden.indexOf(status.status);
  if (nuevoIdx > actualIdx) {
    await supabase.from("whatsapp_mensajes").update({ status: status.status }).eq("id", msg.id);
  }
}
