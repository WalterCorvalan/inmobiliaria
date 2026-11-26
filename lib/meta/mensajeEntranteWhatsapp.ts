// Qué texto se guarda para cada mensaje que llega por WhatsApp y si el bot lo contesta (Walter, 5/11/2026).
// Antes los tipos que no eran texto/botón/archivo (reacción, ubicación, contacto, botón de plantilla, "unsupported")
// se guardaban sin texto: en el chat quedaba una burbuja vacía y el bot contestaba sin nada que leer, inventando
// "hubo un problema con mi respuesta anterior".

export interface MensajeLeido {
  /** Texto que se guarda en whatsapp_mensajes.texto y lee el bot. */
  texto: string | null;
  /** false = se guarda y se ve en el chat, pero el bot no contesta (una reacción, un aviso de WhatsApp). */
  activaBot: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- el mensaje viene crudo del webhook de Meta
export function leerMensajeWhatsapp(msg: any): MensajeLeido {
  const tipo = msg?.type;
  const conBot = (texto: string | null): MensajeLeido => ({ texto, activaBot: true });
  switch (tipo) {
    case "text": return conBot(msg.text?.body ?? null);
    case "interactive": return conBot(msg.interactive?.list_reply?.title ?? msg.interactive?.button_reply?.title ?? null);
    // Botón de respuesta rápida de una plantilla que mandamos nosotros.
    case "button": return conBot(msg.button?.text || msg.button?.payload || "[El cliente tocó un botón del mensaje]");
    case "audio": return conBot("🎤 Audio");
    case "image": return conBot(msg.image?.caption?.trim() || "[Cliente envió una foto sin descripción]");
    case "video": return conBot(msg.video?.caption?.trim() || "[Cliente envió un video]");
    case "document": return conBot(msg.document?.caption?.trim() || msg.document?.filename || "[Cliente envió un documento]");
    case "sticker": return conBot("[Cliente envió un sticker]");
    case "location": {
      const l = msg.location ?? {};
      const lugar = [l.name, l.address].filter(Boolean).join(", ");
      const mapa = l.latitude != null && l.longitude != null ? `https://maps.google.com/?q=${l.latitude},${l.longitude}` : "";
      return conBot(["📍 Ubicación", lugar, mapa].filter(Boolean).join("\n"));
    }
    case "contacts": {
      const contactos = (msg.contacts ?? []) as { name?: { formatted_name?: string }; phones?: { phone?: string }[] }[];
      const lista = contactos.map((c) => [c.name?.formatted_name, c.phones?.[0]?.phone].filter(Boolean).join(" ")).filter(Boolean);
      return conBot(`👤 Contacto${lista.length ? `: ${lista.join(" · ")}` : " compartido"}`);
    }
    // Una reacción se ve en el chat pero no es una consulta: el bot no contesta. Emoji vacío = sacó la reacción.
    case "reaction": return { texto: msg.reaction?.emoji ? `Reaccionó con ${msg.reaction.emoji}` : "Sacó su reacción", activaBot: false };
    case "order": return conBot("[Cliente envió un pedido del catálogo]");
    // Encuestas, fotos de "ver una vez", mensajes editados, etc.: WhatsApp no deja leerlos desde el sistema.
    case "unsupported": return conBot("[El cliente mandó un mensaje que WhatsApp no deja ver desde el sistema (por ejemplo una encuesta o una foto de ver una vez)]");
    case "system": return { texto: `Aviso de WhatsApp: ${msg.system?.body || "cambio en la cuenta del cliente"}`, activaBot: false };
    default: return { texto: `[Mensaje de WhatsApp de tipo "${tipo ?? "desconocido"}" que el sistema no muestra]`, activaBot: false };
  }
}

/** Texto para un mensaje viejo guardado sin texto (antes de este arreglo), para que no quede una burbuja vacía. */
export function textoDeReemplazo(tipo: string | null | undefined): string {
  if (tipo === "unsupported") return "Mensaje que WhatsApp no deja ver desde el sistema";
  if (tipo === "reaction") return "Reacción";
  if (tipo === "location") return "📍 Ubicación";
  if (tipo === "contacts") return "👤 Contacto compartido";
  return "Mensaje que el sistema no puede mostrar";
}
