// Adjuntos que llegan por Instagram y Messenger (mismo formato de Meta: message.attachments[0] con type y payload.url).
// Antes un PDF u otro archivo ("file") se tiraba y quedaba "[Envió un archivo]" sin poder verlo (Walter, 19/10/2026):
// ahora se guarda el link (y el webhook lo copia a nuestro almacenamiento) para abrirlo desde el chat.
// "tipo" queda "text" para lo que no es foto/audio/video, como ya se hacía con "share": no se sabe si la columna
// acepta otros valores en Instagram/Messenger; el panel lo reconoce por tener media_url.

// 20/10/2026: seguía llegando "[Envió un archivo]" en Instagram. Era un tipo que no estaba en la lista: ahora, si trae
// link, se guarda como archivo para abrirlo igual, y el webhook anota el tipo (desconocido) para sumarlo.
import { telefonoEnTexto } from "@/lib/panel/resaltarResumen";

export type AdjuntoResuelto = { texto: string | null; tipo: string; mediaUrl: string | null; esArchivo: boolean; desconocido?: string };

type Mensaje = { text?: string; is_unsupported?: boolean; attachments?: { type?: string; title?: string; payload?: ({ url?: string | null } & Record<string, unknown>) | null }[] } | null | undefined;

export const TEXTO_NO_SOPORTADO = "[Mandó algo que Instagram no deja ver desde acá: miralo en la app]";

export function resolverAdjuntoMeta(message: Mensaje): AdjuntoResuelto {
  if (message?.text) return { texto: message.text, tipo: "text", mediaUrl: null, esArchivo: false };
  const adjunto = message?.attachments?.[0];
  // Meta marca así lo que su API no entrega (algunos stickers, encuestas, notas de voz de un solo uso, etc.).
  if (message?.is_unsupported && !adjunto?.payload?.url) return { texto: TEXTO_NO_SOPORTADO, tipo: "text", mediaUrl: null, esArchivo: false, desconocido: "is_unsupported" };
  if (!adjunto) return { texto: null, tipo: "text", mediaUrl: null, esArchivo: false };
  const url = adjunto.payload?.url ?? null;
  switch (adjunto.type) {
    case "image":
    case "animated_image":
    case "sticker":
      return { texto: url ? null : "[Envió una foto]", tipo: "image", mediaUrl: url, esArchivo: false };
    case "audio":
      return { texto: "🎤 Audio", tipo: "audio", mediaUrl: url, esArchivo: false };
    case "video":
      return { texto: url ? null : "[Envió un video]", tipo: "video", mediaUrl: url, esArchivo: false };
    case "file":
      return { texto: "📄 Envió un archivo", tipo: "text", mediaUrl: url, esArchivo: !!url };
    case "share":
    case "ig_reel":
    case "reel":
      return { texto: url ? null : "[Compartió una publicación/reel]", tipo: "text", mediaUrl: url, esArchivo: false };
    case "unsupported_type":
      return { texto: TEXTO_NO_SOPORTADO, tipo: "text", mediaUrl: null, esArchivo: false, desconocido: "unsupported_type" };
    default: {
      // Una tarjeta de contacto ("Número de teléfono", con botones de WhatsApp) llega como un tipo que no es archivo
      // (caso Santo Detailing, 20/10/2026): si trae un teléfono, se muestra el número.
      const resto = Object.fromEntries(Object.entries(adjunto.payload ?? {}).filter(([k]) => k !== "url"));
      const telefono = telefonoEnTexto(`${adjunto.title ?? ""} ${JSON.stringify(resto)}`);
      if (telefono) return { texto: `📞 Compartió un teléfono: ${telefono}`, tipo: "text", mediaUrl: null, esArchivo: false, desconocido: adjunto.type || "sin tipo" };
      return { texto: url ? "📄 Envió un archivo" : "[Compartió algo que no se puede ver acá: miralo en la app]", tipo: "text", mediaUrl: url, esArchivo: !!url, desconocido: adjunto.type || "sin tipo" };
    }
  }
}

/** Extensión para guardar un archivo según su tipo (application/pdf → pdf). */
export function extensionDeArchivo(mimeType: string | null, url: string): string {
  const mime = (mimeType || "").split(";")[0].trim();
  const porMime: Record<string, string> = {
    "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
    "application/msword": "doc", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  };
  if (porMime[mime]) return porMime[mime];
  const deUrl = url.split("?")[0].split(".").pop()?.toLowerCase();
  return deUrl && /^[a-z0-9]{2,5}$/.test(deUrl) ? deUrl : "bin";
}

/** Qué decir en el link de un adjunto que no es foto, audio ni video. */
export function etiquetaAdjunto(url: string, tipo?: string | null): string {
  if (/instagram\.com|facebook\.com|fb\.watch|lookaside/i.test(url) && tipo !== "document") return "Ver publicación compartida";
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "Abrir PDF";
  if (ext && ["doc", "docx"].includes(ext)) return "Abrir documento de Word";
  if (ext && ["xls", "xlsx", "csv"].includes(ext)) return "Abrir planilla";
  return "Abrir archivo";
}
