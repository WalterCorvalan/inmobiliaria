const GRAPH_BASE_URL = process.env.META_GRAPH_BASE_URL ?? "https://graph.facebook.com";
// Los tokens del login nuevo de Instagram (Business Login for Instagram --
// api.instagram.com/oauth/authorize, ver Configuración → Instagram → botón
// "Conectar con Instagram") son válidos SOLO contra graph.instagram.com, no
// contra graph.facebook.com -- son namespaces de token distintos. Usarlos
// contra el endpoint equivocado da "Invalid OAuth access token - Cannot
// parse access token" (código 190) aunque el token sea válido y nuevo.
// Ver hilo del 24/9. Lo usan los mensajes, las respuestas a comentarios y,
// desde el 15/10/2026, las estadísticas de la cuenta (pedían a graph.facebook.com
// y Marketing → Instagram mostraba ese error). publishInstagramPost sigue con el
// host de Facebook: no se usa con el token del login nuevo.
const GRAPH_INSTAGRAM_BASE_URL = "https://graph.instagram.com";
const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION ?? "v25.0";

export class MetaApiError extends Error {
  code?: number;
  isReconnectRequired: boolean;
  constructor(message: string, code?: number) {
    super(message);
    this.code = code;
    this.isReconnectRequired = code === 190;
  }
}

async function graphRequest<T>(
  path: string,
  token: string,
  init?: RequestInit,
  baseUrl: string = GRAPH_BASE_URL
): Promise<T> {
  const url = `${baseUrl}/${GRAPH_VERSION}/${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = data?.error?.code;
    // Meta repite el mismo mensaje genérico para causas muy distintas (ej. #200
    // "no tenés permisos para enviar"); lo que las distingue es el subcódigo y
    // el error_data, que antes se tiraban. Se agregan al final del mensaje, así
    // quedan en Errores del sistema sin cambiar lo que ya se muestra al usuario.
    const sub = data?.error?.error_subcode;
    const detalle = data?.error?.error_data?.details;
    const extra = [sub ? `subcódigo ${sub}` : null, detalle ? `detalle: ${detalle}` : null, data?.error?.fbtrace_id ? `traza ${data.error.fbtrace_id}` : null].filter(Boolean).join(" · ");
    const base = data?.error?.message ?? `Graph API error ${res.status}`;
    throw new MetaApiError(extra ? `${base} [${extra}]` : base, code);
  }
  return data as T;
}

// Meta dejó de requerir el "9" de celular argentino en el parámetro "to" al
// enviar (aunque el wa_id que llega en los mensajes ENTRANTES lo sigue
// trayendo, ej. "5493856865979") — mandarlo con el 9 puesto devuelve
// "Recipient phone number not in allowed list" (#131030) incluso con
// destinatarios habilitados. Solo se normaliza acá, en el envío: el wa_id
// guardado en whatsapp_contactos.telefono no se toca (sigue siendo la
// identidad real del contacto para matchear mensajes entrantes).
function formatearParaEnvio(to: string): string {
  return to.replace(/^549(\d{10})$/, "54$1");
}

// Descarga un media entrante (audio/imagen/documento) de WhatsApp. Meta
// entrega el archivo en 2 pasos: primero hay que pedir la URL temporal por
// el ID del media (dura pocos minutos), después bajarla con el mismo Bearer
// token -- sin el header, la URL de Meta devuelve 401 aunque sea la url
// "correcta". Por eso no se puede simplemente guardar la URL de Meta como
// media_url permanente: hay que bajar el archivo ahora mismo y subirlo a
// nuestro storage (R2) para que quede accesible después.
export async function descargarMediaWhatsapp(mediaId: string, token: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const info = await graphRequest<{ url: string; mime_type: string }>(mediaId, token);
  const res = await fetch(info.url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new MetaApiError(`No se pudo descargar el media (${res.status})`, res.status);
  const arrayBuffer = await res.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), mimeType: info.mime_type };
}

export async function validatePhoneNumber(phoneNumberId: string, token: string) {
  return graphRequest<{ display_phone_number: string; verified_name: string; id: string }>(
    `${phoneNumberId}?fields=display_phone_number,verified_name`,
    token
  );
}

// Estado real del número para enviar (no solo si existe/está bien tipeado
// como validatePhoneNumber de arriba) -- "status" viene en MAYÚSCULAS
// ("CONNECTED", "FLAGGED", etc.), no confundir con quality_rating.
export async function getPhoneNumberStatus(phoneNumberId: string, token: string) {
  return graphRequest<{ display_phone_number: string; verified_name: string; quality_rating?: string; code_verification_status?: string; status?: string }>(
    `${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,code_verification_status,status`,
    token
  );
}

// Paso previo al registro cuando Meta responde #133006 ("re-verification needed"): Meta manda un código de 6 dígitos al
// número por SMS o llamada, y se confirma con verifyPhoneNumberCode.
export async function requestPhoneNumberCode(phoneNumberId: string, token: string, metodo: "SMS" | "VOICE") {
  return graphRequest<{ success: boolean }>(`${phoneNumberId}/request_code`, token, {
    method: "POST",
    body: JSON.stringify({ code_method: metodo, language: "es" }),
  });
}

export async function verifyPhoneNumberCode(phoneNumberId: string, token: string, code: string) {
  return graphRequest<{ success: boolean }>(`${phoneNumberId}/verify_code`, token, {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

// Registra el número en la Cloud API (lo pasa de DISCONNECTED a CONNECTED). Si el número ya tenía una verificación en
// dos pasos de otro proveedor, el PIN tiene que ser ese; si no, el PIN que se manda queda como el nuevo.
export async function registerPhoneNumber(phoneNumberId: string, token: string, pin: string) {
  return graphRequest<{ success: boolean }>(`${phoneNumberId}/register`, token, {
    method: "POST",
    body: JSON.stringify({ messaging_product: "whatsapp", pin }),
  });
}

// Estado de verificación del negocio (WABA) -- este es el campo que bloquea
// TODO el envío (bot, manual, plantillas) cuando queda en "not_verified",
// sin importar que el resto (registro del número, PIN, suscripción de la
// app) ya esté bien. Ver diagnóstico del 30/9: error #141010 de Meta.
export async function getWabaVerificationStatus(wabaId: string, token: string) {
  return graphRequest<{ id: string; name?: string; business_verification_status?: string }>(
    `${wabaId}?fields=name,business_verification_status`,
    token
  );
}

export async function sendTextMessage(phoneNumberId: string, token: string, to: string, text: string) {
  return graphRequest<{ messages: { id: string }[] }>(`${phoneNumberId}/messages`, token, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: formatearParaEnvio(to),
      type: "text",
      text: { body: text },
    }),
  });
}

// Plantillas de mensaje: viven en el WABA (Business Account), no en el
// phone_number_id -- por eso reciben wabaId aparte.
export async function createMessageTemplate(
  wabaId: string,
  token: string,
  input: { name: string; language: string; category: string; body: string; ejemplos: string[] }
) {
  return graphRequest<{ id?: string; status?: string }>(`${wabaId}/message_templates`, token, {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      language: input.language,
      category: input.category,
      components: [
        {
          type: "BODY",
          text: input.body,
          // Meta pide un ejemplo por cada dato {{n}} para revisar la plantilla.
          ...(input.ejemplos.length ? { example: { body_text: [input.ejemplos] } } : {}),
        },
      ],
    }),
  });
}

// Borra la plantilla del WABA (todas sus traducciones). Meta no deja reusar el mismo nombre por unas semanas.
export async function deleteMessageTemplate(wabaId: string, token: string, name: string) {
  return graphRequest<{ success?: boolean }>(`${wabaId}/message_templates?name=${encodeURIComponent(name)}`, token, { method: "DELETE" });
}

export async function listMessageTemplates(wabaId: string, token: string) {
  return graphRequest<{
    data: {
      id?: string; name?: string; language?: string; status?: string; rejected_reason?: string; category?: string;
      components?: { type: string; text?: string }[];
    }[];
  }>(`${wabaId}/message_templates`, token);
}

export async function sendTemplateMessage(
  phoneNumberId: string,
  token: string,
  to: string,
  name: string,
  language: string,
  variable?: string | string[]
) {
  const valores = (Array.isArray(variable) ? variable : variable ? [variable] : []).filter((v) => v !== undefined);
  return graphRequest<{ messages: { id: string }[] }>(`${phoneNumberId}/messages`, token, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: formatearParaEnvio(to),
      type: "template",
      template: {
        name,
        language: { code: language },
        ...(valores.length
          ? { components: [{ type: "body", parameters: valores.map((text) => ({ type: "text", text })) }] }
          : {}),
      },
    }),
  });
}

export async function sendImageMessage(phoneNumberId: string, token: string, to: string, imageUrl: string, caption?: string) {
  return graphRequest<{ messages: { id: string }[] }>(`${phoneNumberId}/messages`, token, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: formatearParaEnvio(to),
      type: "image",
      image: { link: imageUrl, ...(caption ? { caption } : {}) },
    }),
  });
}

// Instagram: publicación en el feed. Dos pasos obligatorios de la Content
// Publishing API — primero se crea el contenedor con la imagen, después se
// publica ese contenedor (no se puede publicar en un solo llamado).
export async function publishInstagramPost(igUserId: string, token: string, imageUrl: string, caption: string) {
  const contenedor = await graphRequest<{ id: string }>(`${igUserId}/media`, token, {
    method: "POST",
    body: JSON.stringify({ image_url: imageUrl, caption }),
  });
  return graphRequest<{ id: string }>(`${igUserId}/media_publish`, token, {
    method: "POST",
    body: JSON.stringify({ creation_id: contenedor.id }),
  });
}

// Instagram con el login de Instagram (el token de Configuración → Instagram, que pide
// instagram_business_content_publish): una foto o un carrusel de 2 a 10 fotos en el feed.
// Va contra graph.instagram.com, como el resto de lo que usa ese token (publishInstagramPost
// de arriba usa el host de Facebook y no sirve con él). Cada foto se sube primero como
// contenedor; el carrusel es otro contenedor que las agrupa. Instagram baja las fotos de su
// dirección pública y puede tardar unos segundos: se espera a que el contenedor esté listo.
export async function publicarFotosInstagram(igUserId: string, token: string, imagenes: string[], caption: string) {
  const crear = (cuerpo: Record<string, unknown>) =>
    graphRequest<{ id: string }>(`${igUserId}/media`, token, { method: "POST", body: JSON.stringify(cuerpo) }, GRAPH_INSTAGRAM_BASE_URL);
  const esperarListo = async (contenedorId: string) => {
    for (let intento = 0; intento < 10; intento++) {
      const { status_code } = await graphRequest<{ status_code?: string }>(`${contenedorId}?fields=status_code`, token, undefined, GRAPH_INSTAGRAM_BASE_URL);
      if (!status_code || status_code === "FINISHED") return;
      if (status_code === "ERROR" || status_code === "EXPIRED") throw new MetaApiError("Instagram no pudo procesar una de las fotos (tiene que ser JPG y no muy vertical).");
      await new Promise((r) => setTimeout(r, 1500));
    }
    throw new MetaApiError("Instagram está tardando en procesar las fotos. Probá de nuevo en unos minutos.");
  };

  let contenedor: { id: string };
  if (imagenes.length === 1) {
    contenedor = await crear({ image_url: imagenes[0], caption });
  } else {
    const hijos = [];
    for (const url of imagenes) hijos.push(await crear({ image_url: url, is_carousel_item: true }));
    for (const h of hijos) await esperarListo(h.id);
    contenedor = await crear({ media_type: "CAROUSEL", children: hijos.map((h) => h.id).join(","), caption });
  }
  await esperarListo(contenedor.id);
  const publicado = await graphRequest<{ id: string }>(`${igUserId}/media_publish`, token, { method: "POST", body: JSON.stringify({ creation_id: contenedor.id }) }, GRAPH_INSTAGRAM_BASE_URL);
  const { permalink } = await graphRequest<{ permalink?: string }>(`${publicado.id}?fields=permalink`, token, undefined, GRAPH_INSTAGRAM_BASE_URL).catch(() => ({ permalink: undefined }));
  return { id: publicado.id, permalink: permalink ?? null };
}

// Facebook: publicación con foto en el feed de la página (un solo llamado).
export async function publishFacebookPost(pageId: string, token: string, imageUrl: string, caption: string) {
  return graphRequest<{ id: string; post_id: string }>(`${pageId}/photos`, token, {
    method: "POST",
    body: JSON.stringify({ url: imageUrl, caption }),
  });
}

// Instagram: alcance por día (permiso instagram_business_manage_insights, que el
// botón "Conectar con Instagram" ya pide). Con el login de Instagram solo
// "reach" sale como serie diaria; el resto de las métricas de la cuenta son
// totales del período (getInstagramAccountTotales).
export async function getInstagramAccountInsights(igUserId: string, token: string, since: number, until: number) {
  return graphRequest<{
    data: { name: string; period: string; values: { value: number; end_time: string }[] }[];
  }>(
    `${igUserId}/insights?metric=reach&period=day&metric_type=time_series&since=${since}&until=${until}`,
    token,
    undefined,
    GRAPH_INSTAGRAM_BASE_URL
  );
}

// Totales del período (máximo 30 días). Se pide una métrica por vez: Meta saca y
// renombra métricas seguido (profile_views dejó de andar un tiempo en 2025) y una
// que no exista haría fallar el pedido entero. La que falla queda afuera.
export const METRICAS_TOTALES_INSTAGRAM = ["views", "reach", "accounts_engaged", "total_interactions", "profile_views", "profile_links_taps"] as const;
export type MetricaTotalInstagram = (typeof METRICAS_TOTALES_INSTAGRAM)[number];

export async function getInstagramAccountTotales(igUserId: string, token: string, since: number, until: number) {
  const resultados = await Promise.allSettled(
    METRICAS_TOTALES_INSTAGRAM.map((metrica) =>
      graphRequest<{ data: { name: string; total_value?: { value: number } }[] }>(
        `${igUserId}/insights?metric=${metrica}&period=day&metric_type=total_value&since=${since}&until=${until}`,
        token,
        undefined,
        GRAPH_INSTAGRAM_BASE_URL
      )
    )
  );
  const totales: Partial<Record<MetricaTotalInstagram, number>> = {};
  resultados.forEach((r, i) => {
    const valor = r.status === "fulfilled" ? r.value.data[0]?.total_value?.value : undefined;
    if (typeof valor === "number") totales[METRICAS_TOTALES_INSTAGRAM[i]] = valor;
  });
  return totales;
}

// Datos base de la cuenta: seguidores actuales, cantidad de publicaciones.
export async function getInstagramAccountSummary(igUserId: string, token: string) {
  return graphRequest<{ followers_count: number; media_count: number; username: string }>(
    `${igUserId}?fields=followers_count,media_count,username`,
    token,
    undefined,
    GRAPH_INSTAGRAM_BASE_URL
  );
}

// Publicaciones recientes con sus datos básicos (likes/comments vienen en el
// campo mismo; para reach/saved/shares hay que pedir insights por post aparte).
export async function getInstagramMedia(igUserId: string, token: string, limit = 12) {
  return graphRequest<{
    data: {
      id: string;
      caption?: string;
      media_type: string;
      media_product_type?: string;
      media_url?: string;
      thumbnail_url?: string;
      permalink: string;
      timestamp: string;
      like_count?: number;
      comments_count?: number;
    }[];
  }>(
    `${igUserId}/media?fields=id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=${limit}`,
    token,
    undefined,
    GRAPH_INSTAGRAM_BASE_URL
  );
}

// Insights de un post puntual — reach y engagement real (guardados/compartidos).
export async function getInstagramMediaInsights(mediaId: string, token: string) {
  return graphRequest<{ data: { name: string; values: { value: number }[] }[] }>(
    `${mediaId}/insights?metric=reach,saved,shares`,
    token,
    undefined,
    GRAPH_INSTAGRAM_BASE_URL
  );
}

// Cómo rindió una publicación (Marketing → Instagram, "Cómo rindió cada publicación", 26/10/2026): reproducciones,
// alcance, guardados, compartidos y, en los Reels, el tiempo promedio que la miran (en milisegundos). Meta cambia los
// nombres de las métricas seguido: si rechaza el pedido completo, se pide lo básico (alcance, guardados, compartidos).
// Seguidores contra no seguidores y de dónde vino la gente (Reels, Explorar, perfil) no los da la API por publicación.
export async function getInstagramRendimientoPost(mediaId: string, token: string, esReel: boolean): Promise<Record<string, number>> {
  const pedir = (metricas: string) =>
    graphRequest<{ data: { name: string; values?: { value: number }[]; total_value?: { value: number } }[] }>(`${mediaId}/insights?metric=${metricas}`, token, undefined, GRAPH_INSTAGRAM_BASE_URL);
  const completo = esReel ? "views,reach,saved,shares,ig_reels_avg_watch_time" : "views,reach,saved,shares";
  const r = await pedir(completo).catch(() => pedir("reach,saved,shares"));
  const salida: Record<string, number> = {};
  for (const m of r.data) {
    const v = m.values?.[0]?.value ?? m.total_value?.value;
    if (typeof v === "number") salida[m.name] = v;
  }
  return salida;
}

// Instagram: respuesta privada (DM) a un comentario puntual — es el mecanismo
// "comentaste, te mando un privado" tipo ManyChat, hecho directo con la API de Meta.
// 17/10/2026: con el login de Instagram (graph.instagram.com) la respuesta privada se manda a /me/messages con
// recipient.comment_id. El camino viejo, /{comment-id}/private_replies, es del login de Facebook: acá Meta contestaba
// "Object with ID … does not exist" y ningún comentario recibía el privado (Errores del sistema, 5/10 al 15/10).
export async function sendInstagramPrivateReply(commentId: string, token: string, text: string) {
  return graphRequest<{ recipient_id: string; message_id: string }>("me/messages", token, {
    method: "POST",
    body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text } }),
  }, GRAPH_INSTAGRAM_BASE_URL);
}

// Instagram: respuesta PÚBLICA visible debajo del comentario original (a
// diferencia de sendInstagramPrivateReply, que es el DM) -- se usa junto al
// DM cuando una automatización por palabra clave tiene texto público
// configurado, mismo patrón visible que ManyChat.
export async function replyToInstagramCommentPublicly(commentId: string, token: string, text: string) {
  return graphRequest<{ id: string }>(`${commentId}/replies`, token, {
    method: "POST",
    body: JSON.stringify({ message: text }),
  }, GRAPH_INSTAGRAM_BASE_URL);
}

// Instagram: nombre de usuario (@lo-que-sea) real de quien escribe por DM --
// a diferencia de un comentario (donde Meta manda el username directo en el
// evento), un mensaje directo entrante solo trae el IGSID (un ID numérico),
// no el @. Este llamado aparte resuelve el username real para no dejar el
// contacto guardado solo con el ID numérico como si fuera su nombre.
export async function getInstagramUserProfile(token: string, igsid: string) {
  return graphRequest<{ id: string; name?: string; username?: string }>(`${igsid}?fields=name,username`, token, undefined, GRAPH_INSTAGRAM_BASE_URL);
}

// Instagram: mensaje directo de seguimiento dentro de una conversación ya abierta
// (después del primer private reply, se puede seguir charlando como un DM normal).
// humanAgent: mensaje escrito por una persona del CRM con el permiso "Human Agent" de Meta, que deja contestar hasta
// 7 días después del último mensaje del cliente (lib/panel/ventana24h.ts). El bot nunca lo usa.
const etiquetaHumanAgent = (humanAgent?: boolean) => (humanAgent ? { messaging_type: "MESSAGE_TAG", tag: "HUMAN_AGENT" } : {});

export async function sendInstagramMessage(igUserId: string, token: string, recipientId: string, text: string, opciones?: { humanAgent?: boolean }) {
  return graphRequest<{ recipient_id: string; message_id: string }>(`${igUserId}/messages`, token, {
    method: "POST",
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
      ...etiquetaHumanAgent(opciones?.humanAgent),
    }),
  }, GRAPH_INSTAGRAM_BASE_URL);
}

// Instagram: foto de un vehículo por DM -- mismo mecanismo que sendInstagramMessage
// pero con un adjunto de imagen en vez de texto (Send API, no Content Publishing).
export async function sendInstagramImageMessage(igUserId: string, token: string, recipientId: string, imageUrl: string) {
  return graphRequest<{ recipient_id: string; message_id: string }>(`${igUserId}/messages`, token, {
    method: "POST",
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { attachment: { type: "image", payload: { url: imageUrl } } },
    }),
  }, GRAPH_INSTAGRAM_BASE_URL);
}

// Messenger -- a diferencia de Instagram, usa graph.facebook.com (el mismo
// token de Página de siempre, no el namespace especial de graph.instagram.com)
// y el PSID (Page-Scoped ID) en vez de un IGSID. Mismo Send API, misma forma
// de payload.
export async function sendMessengerMessage(pageId: string, token: string, recipientPsid: string, text: string, opciones?: { humanAgent?: boolean }) {
  return graphRequest<{ recipient_id: string; message_id: string }>(`${pageId}/messages`, token, {
    method: "POST",
    body: JSON.stringify({
      recipient: { id: recipientPsid },
      message: { text },
      ...etiquetaHumanAgent(opciones?.humanAgent),
    }),
  });
}

export async function sendMessengerImageMessage(pageId: string, token: string, recipientPsid: string, imageUrl: string) {
  return graphRequest<{ recipient_id: string; message_id: string }>(`${pageId}/messages`, token, {
    method: "POST",
    body: JSON.stringify({
      recipient: { id: recipientPsid },
      message: { attachment: { type: "image", payload: { url: imageUrl } } },
    }),
  });
}

// Historial de conversaciones de la página (Conversations API): sirve para
// traer lo que llegó antes de que el webhook estuviera funcionando, que Meta
// no reenvía. Vienen ordenadas de la más reciente a la más vieja.
export type MensajeHistorialMessenger = {
  id: string; message?: string; created_time: string; from?: { id: string; name?: string };
  attachments?: { data?: { mime_type?: string; name?: string }[] };
};
export type ConversacionHistorialMessenger = {
  id: string; updated_time: string;
  participants?: { data: { id: string; name?: string }[] };
  messages?: { data: MensajeHistorialMessenger[] };
};

export async function listarConversacionesMessenger(pageId: string, token: string, after?: string) {
  const campos = "id,updated_time,participants,messages.limit(50){id,message,created_time,from,attachments}";
  return graphRequest<{ data: ConversacionHistorialMessenger[]; paging?: { cursors?: { after?: string }; next?: string } }>(
    `${pageId}/conversations?platform=messenger&limit=25&fields=${encodeURIComponent(campos)}${after ? `&after=${encodeURIComponent(after)}` : ""}`,
    token
  );
}

// Nombre real de quien escribe por Messenger -- el webhook solo trae el PSID
// numérico, igual que Instagram con el IGSID. Requiere permiso
// pages_messaging (ya cubierto por el mismo token de Página).
export async function getMessengerUserProfile(token: string, psid: string) {
  return graphRequest<{ id: string; first_name?: string; last_name?: string }>(`${psid}?fields=first_name,last_name`, token);
}