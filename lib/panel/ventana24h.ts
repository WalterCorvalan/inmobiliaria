// Ventana de 24 horas de Meta (WhatsApp, Instagram y Messenger): se le puede escribir libre al cliente hasta 24 hs
// después de SU último mensaje. Pasado eso, WhatsApp solo acepta plantillas aprobadas e Instagram/Messenger no dejan
// escribir hasta que el cliente vuelva a hablar.
// Pedido de Walter (19/10/2026, caso Mateo: el cliente escribió el sábado 9:59 y Gabriel contestó el lunes 9:55, y los
// mensajes fallaron): avisar ANTES de que se cierre, diciendo qué hay que hacer, y marcar los días en el chat.

export const HORAS_VENTANA = 24;
/**
 * Permiso "Human Agent" de Meta (Walter, 22/10/2026): en Instagram y Messenger una persona puede contestar hasta 7 días
 * después del último mensaje del cliente (el bot no). Queda apagado hasta que Meta lo apruebe: se prende en Vercel con
 * NEXT_PUBLIC_META_HUMAN_AGENT=true. Prendido antes de la aprobación, Meta rechaza los mensajes.
 */
export const HORAS_VENTANA_HUMAN_AGENT = 7 * 24;
export const humanAgentActivo = () => process.env.NEXT_PUBLIC_META_HUMAN_AGENT === "true";
/** Horas que una persona tiene para contestar por ese canal. WhatsApp siempre 24. */
export function horasVentana(canal: string, humanAgent: boolean = humanAgentActivo()): number {
  return humanAgent && (canal === "instagram" || canal === "messenger") ? HORAS_VENTANA_HUMAN_AGENT : HORAS_VENTANA;
}
/** Desde cuántas horas antes del cierre se avisa. */
export const HORAS_AVISO = 3;

const ZONA = "America/Argentina/Buenos_Aires";
const HORA = 3_600_000;

export type EstadoVentana = { estado: "abierta" | "por_vencer" | "vencida"; restanteMs: number; cierra: Date };

export function estadoVentana(ultimoDelCliente: string | Date | null | undefined, ahora: Date, horas: number = HORAS_VENTANA): EstadoVentana | null {
  if (!ultimoDelCliente) return null;
  const cierra = new Date(new Date(ultimoDelCliente).getTime() + horas * HORA);
  const restanteMs = cierra.getTime() - ahora.getTime();
  const estado = restanteMs <= 0 ? "vencida" : restanteMs <= HORAS_AVISO * HORA ? "por_vencer" : "abierta";
  return { estado, restanteMs, cierra };
}

/** "2 h 15 min", "40 min", "menos de 1 min". */
export function textoRestante(ms: number): string {
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "menos de 1 min";
  const h = Math.floor(min / 60);
  const resto = min % 60;
  if (h === 0) return `${min} min`;
  return resto ? `${h} h ${resto} min` : `${h} h`;
}

const horaCorta = (d: Date) => d.toLocaleTimeString("es-AR", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** Qué mostrar arriba del campo para escribir. null = nada (la ventana está abierta y lejos de cerrarse). */
export function avisoVentana(canal: string, v: EstadoVentana | null, humanAgent: boolean = humanAgentActivo()): { titulo: string; detalle: string; tono: "ambar" | "rojo"; plantilla: boolean } | null {
  if (!v || v.estado === "abierta") return null;
  const esWhatsapp = canal === "whatsapp";
  const plazo = horasVentana(canal, humanAgent) === HORAS_VENTANA ? "24 horas" : "7 días";
  if (v.estado === "por_vencer") {
    return {
      tono: "ambar",
      plantilla: false,
      titulo: `Contestale antes de las ${horaCorta(v.cierra)} (quedan ${textoRestante(v.restanteMs)})`,
      detalle: esWhatsapp
        ? "Después de esa hora ya no vas a poder escribirle libre: solo mandarle una plantilla aprobada."
        : "Después de esa hora ya no se le puede escribir desde el CRM: vas a tener que contestarle desde la app en el celular.",
    };
  }
  return esWhatsapp
    ? {
        tono: "rojo",
        plantilla: true,
        titulo: "Ya no le podés escribir libre a este cliente",
        detalle: "Mandale una plantilla aprobada. Cuando conteste, volvés a escribirle normal.",
      }
    : {
        tono: "rojo",
        plantilla: false,
        titulo: canal === "messenger" ? "Contestale desde la app de Messenger" : "Contestale desde la app de Instagram",
        // No es por plata: Instagram y Messenger no cobran. Meta solo deja escribir desde un sistema como el CRM hasta 24 hs
        // después del último mensaje del cliente; desde la app del celular no hay límite (Walter, 21/10/2026).
        detalle: `Pasaron más de ${plazo} desde su último mensaje y Meta no deja escribirle desde el CRM. Desde la app en el celular le podés escribir cuando quieras, y no se cobra.`,
      };
}

/**
 * Día de un mensaje para el separador del chat, igual que WhatsApp (captura de Walter del 19/10/2026): "Hoy", "Ayer",
 * el nombre del día en la última semana ("sábado") y la fecha si es más viejo ("10/10/2026").
 */
export function etiquetaDia(fecha: string | Date, ahora: Date): string {
  const clave = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: ZONA });
  const d = new Date(fecha);
  const dias = Math.round((Date.parse(clave(ahora)) - Date.parse(clave(d))) / (24 * HORA));
  if (dias <= 0) return "Hoy";
  if (dias === 1) return "Ayer";
  if (dias < 7) return d.toLocaleDateString("es-AR", { timeZone: ZONA, weekday: "long" });
  return d.toLocaleDateString("es-AR", { timeZone: ZONA, day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Clave del día (en Argentina) para saber dónde poner un separador. */
export const claveDia = (fecha: string | Date) => new Date(fecha).toLocaleDateString("sv-SE", { timeZone: ZONA });

// Aviso cuando un mensaje escrito a mano no le llega al cliente (29/10/2026): el de Gabriel a Jorge Rodríguez del 12/10
// quedó fallido porque ya habían pasado las 24 hs, y nadie se enteró. Meta avisa el fallo después, no al mandarlo.
// detalle = "#código título" como lo guarda el webhook en error_detalle.
export function avisoMensajeNoEnviado(nombreCliente: string, detalle: string | null): { titulo: string; mensaje: string } {
  const titulo = `No le llegó tu mensaje a ${nombreCliente}`;
  if (detalle && /#131047\b/.test(detalle)) {
    return { titulo, mensaje: "Pasaron más de 24 hs desde que el cliente escribió. Mandale una plantilla aprobada desde el chat." };
  }
  return { titulo, mensaje: `WhatsApp lo rechazó${detalle ? ` (${detalle})` : ""}. Abrí el chat y volvé a intentarlo.` };
}
