// Horario de atención de los bots de WhatsApp, Instagram y Messenger (Rodi, el chat de la web, contesta las
// 24 horas y no usa esto). Pedido de Walter, 8/10/2026:
//  - el bot conversa de 7 a 23 (hora de Argentina), configurable en Configuración → WhatsApp (vale para los tres);
//  - fuera de horario contesta UN aviso ("estamos fuera de horario") por noche, no uno por mensaje;
//  - a la mañana siguiente, ~9 h, le escribe UNA vez a quien recibió el aviso: "ya estamos disponibles".
// Todo con hora argentina (el servidor de Vercel corre en UTC).

export const HORARIO_BOTS_POR_DEFECTO = { inicio: 7, fin: 23 };
// Una noche fuera de horario dura como mucho 8 h (23 a 7): con 12 h, dos mensajes en la misma noche reciben un solo aviso.
export const HORAS_ENTRE_AVISOS = 12;
// El mensaje de apertura sale a las 9: solo para avisos de las últimas 14 h (la noche anterior), así no se le escribe
// a alguien de hace días y se respeta la ventana de 24 h de Meta para mensajes libres.
export const HORAS_VALIDEZ_AVISO_PARA_APERTURA = 14;

export const TEXTO_APERTURA_POR_DEFECTO = "¡Buen día! 👋 Ya estamos disponibles. Si querés, contame qué estás buscando y te ayudo.";

export function textoFueraDeHorarioPorDefecto(inicio: number, fin: number): string {
  return `¡Hola! Gracias por escribirnos 🙌 En este momento estamos fuera de horario (atendemos de ${inicio} a ${fin} hs). Mañana a primera hora te respondemos.`;
}

const HORA = 3600_000;

export const ZONA_POR_DEFECTO = "America/Argentina/Buenos_Aires";

// Hora de la zona de la empresa (por defecto Argentina): nunca la del servidor.
export function horaArgentina(ahora: Date = new Date(), zona: string = ZONA_POR_DEFECTO): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: zona, hour: "numeric", hourCycle: "h23" }).format(ahora));
}

// Horario guardado en whatsapp_configuracion (horario_inicio / horario_fin); si falta o es inválido, 7 a 23.
export function horarioDeConfig(config: { horario_inicio?: number | null; horario_fin?: number | null } | null | undefined): { inicio: number; fin: number } {
  const inicio = Number(config?.horario_inicio);
  const fin = Number(config?.horario_fin);
  if (Number.isInteger(inicio) && Number.isInteger(fin) && inicio >= 0 && fin <= 24 && inicio < fin) return { inicio, fin };
  return HORARIO_BOTS_POR_DEFECTO;
}

export function estaEnHorario(horario: { inicio: number; fin: number }, ahora: Date = new Date(), zona: string = ZONA_POR_DEFECTO): boolean {
  const h = horaArgentina(ahora, zona);
  return h >= horario.inicio && h < horario.fin;
}

// ¿Se le manda el aviso de fuera de horario? Solo si no se le mandó otro en las últimas 12 h (misma noche).
export function debeAvisarFueraDeHorario(avisadoAt: string | null | undefined, ahora: Date = new Date()): boolean {
  if (!avisadoAt) return true;
  return ahora.getTime() - new Date(avisadoAt).getTime() > HORAS_ENTRE_AVISOS * HORA;
}

// ¿Se le manda el "ya estamos disponibles" de la mañana?
//  - recibió el aviso de fuera de horario en las últimas 14 h;
//  - no se le mandó ya la apertura después de ese aviso;
//  - ninguna persona tomó la charla (ai_habilitada = false);
//  - nadie le contestó desde el aviso (el último mensaje es el aviso mismo o uno nuevo del cliente).
export function debeMandarApertura(c: {
  avisadoAt: string | null | undefined;
  aperturaAt: string | null | undefined;
  aiHabilitada: boolean | null | undefined;
  ultimoMensaje: { direccion: string; created_at: string } | null | undefined;
}, ahora: Date = new Date()): boolean {
  if (!c.avisadoAt) return false;
  const aviso = new Date(c.avisadoAt).getTime();
  if (ahora.getTime() - aviso > HORAS_VALIDEZ_AVISO_PARA_APERTURA * HORA) return false;
  if (c.aperturaAt && new Date(c.aperturaAt).getTime() >= aviso) return false;
  if (c.aiHabilitada === false) return false;
  const u = c.ultimoMensaje;
  if (u && u.direccion !== "in" && new Date(u.created_at).getTime() > aviso + 60_000) return false;
  return true;
}
