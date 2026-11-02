// Avisos urgentes de los chats (Walter, 22/10/2026). Dos cosas:
//
// 1. "Cliente sin contestar": en WhatsApp, Instagram, Messenger y el chat de la web, si un cliente espera respuesta de
//    una persona hace 2 horas hábiles, le llega un aviso de nivel alto solo a quien tiene asignado al cliente
//    ("No le contestaste a Rodolfo Vidal"). Lo que contesta el bot no
//    cuenta como respuesta: el reloj corre desde que el bot le pasa la charla al vendedor (o desde el primer mensaje
//    sin contestar, si el bot no está atendiendo esa charla).
// 2. Repetición: un aviso de nivel alto sin leer vuelve a sonar en el celular cada 30 minutos, hasta 3 veces, solo en
//    horario de atención y sin sumar nada a la campanita. Deja de sonar cuando lo leen (en la campanita o tocando la
//    notificación), o, si es de un chat, cuando abren ese chat o le contestan al cliente. Al encargado no se
//    le avisa (Walter, 30/10/2026: "no hay que sobrecargarlo al encargado").
//
// Lo corre app/api/cron/panel/avisos-urgentes cada 15 minutos. Horario de atención: lunes a viernes de 9 a 18 y
// sábados de 9 a 13, domingo cerrado (el mismo de lib/horarioAtencion.ts), en hora argentina.

export const HORAS_SIN_CONTESTAR = 2;
export const MINUTOS_ENTRE_REPETICIONES = 30;
export const MAX_REPETICIONES = 3;
export const TIPO_SIN_CONTESTAR = "cliente_sin_contestar";
// Ya no se crea (30/10/2026); queda para que los avisos viejos de ese tipo dejen de sonar al abrir el chat.
export const TIPO_SIN_CONTESTAR_ENCARGADO = "cliente_sin_contestar_encargado";
// Avisos que apuntan a un chat: dejan de repetirse cuando abren el chat o le contestan al cliente.
export const TIPOS_DE_CHARLA = [TIPO_SIN_CONTESTAR, TIPO_SIN_CONTESTAR_ENCARGADO, "ventana_24h", "lead_caliente_sin_atender"];

export type CanalChat = "whatsapp" | "instagram" | "messenger" | "rodi";
// contacto: columnas para saber el nombre del cliente (ver nombreDelCliente).
export const CANALES_CHAT: { canal: CanalChat; nombre: string; tabla: string; mensajes: string; ruta: string; contacto: string }[] = [
  { canal: "whatsapp", nombre: "WhatsApp", tabla: "whatsapp_conversaciones", mensajes: "whatsapp_mensajes", ruta: "/panel/whatsapp", contacto: "whatsapp_contactos ( nombre_perfil, telefono )" },
  { canal: "instagram", nombre: "Instagram", tabla: "instagram_conversaciones", mensajes: "instagram_mensajes", ruta: "/panel/instagram", contacto: "instagram_contactos ( nombre_perfil, username )" },
  { canal: "messenger", nombre: "Messenger", tabla: "messenger_conversaciones", mensajes: "messenger_mensajes", ruta: "/panel/messenger", contacto: "messenger_contactos ( nombre_perfil )" },
  { canal: "rodi", nombre: "el chat de la web", tabla: "rodi_conversaciones", mensajes: "rodi_mensajes", ruta: "/panel/rodi", contacto: "nombre_contacto, telefono_contacto" },
];

const TABLA_CONTACTO: Record<CanalChat, string | null> = { whatsapp: "whatsapp_contactos", instagram: "instagram_contactos", messenger: "messenger_contactos", rodi: null };

/** Nombre del cliente como se ve en el chat: el del perfil, o el teléfono / @usuario, o "un cliente". */
type DatosContacto = { nombre_perfil?: string | null; telefono?: string | null; username?: string | null; nombre_contacto?: string | null; telefono_contacto?: string | null };
export function nombreDelCliente(canal: CanalChat, conv: Record<string, unknown>): string {
  const tabla = TABLA_CONTACTO[canal];
  const crudo = tabla ? conv[tabla] : conv;
  const c: DatosContacto = (Array.isArray(crudo) ? crudo[0] : crudo) ?? {};
  const nombre = canal === "rodi"
    ? c.nombre_contacto || c.telefono_contacto
    : c.nombre_perfil || (c.username ? `@${c.username}` : c.telefono);
  return String(nombre || "").trim() || "un cliente";
}

/** De un link de aviso ("/panel/instagram?conversacion=<id>"), el canal y la charla. Null si no apunta a un chat. */
export function chatDelLink(link: string | null | undefined): { canal: CanalChat; conversacionId: string } | null {
  if (!link) return null;
  const [ruta, query = ""] = link.split("?");
  const canal = CANALES_CHAT.find((c) => c.ruta === ruta)?.canal;
  const conversacionId = new URLSearchParams(query).get("conversacion");
  return canal && conversacionId ? { canal, conversacionId } : null;
}

export type MensajeChat = { direccion: string; ai_generado: boolean | null; created_at: string };
const t = (fecha: string) => new Date(fecha).getTime();

/**
 * Desde cuándo el cliente espera que le conteste una persona, o null si no espera (ya le contestaron o el bot está
 * conversando con él). `mensajes`, en cualquier orden.
 */
export function esperaDesde(conv: { ai_habilitada: boolean | null; handoff_at: string | null }, mensajes: MensajeChat[]): Date | null {
  const orden = [...mensajes].sort((a, b) => t(a.created_at) - t(b.created_at));
  const ultimo = orden[orden.length - 1];
  const ultimoIn = orden.filter((m) => m.direccion === "in").pop();
  if (!ultimo || !ultimoIn) return null;
  const ultimoHumano = orden.filter((m) => m.direccion === "out" && m.ai_generado !== true).pop();
  if (ultimoHumano && t(ultimoHumano.created_at) >= t(ultimoIn.created_at)) return null;

  const botAtiende = conv.ai_habilitada !== false;
  // El bot le está contestando: todavía no le toca a una persona.
  if (botAtiende && ultimo.direccion !== "in") return null;
  // Primer mensaje del cliente después de la última respuesta (del bot si atiende, de una persona si no).
  const corte = botAtiende ? orden.filter((m) => m.direccion === "out").pop() : ultimoHumano;
  const primerIn = orden.find((m) => m.direccion === "in" && (!corte || t(m.created_at) > t(corte.created_at)));
  if (!primerIn) return null;
  let desde = t(primerIn.created_at);
  // Lo que pasó mientras el bot conversaba no cuenta: el reloj arranca cuando le pasó la charla al vendedor.
  if (!botAtiende && conv.handoff_at) desde = Math.max(desde, t(conv.handoff_at));
  return new Date(desde);
}

const HORA = 3_600_000;
const DESFASE_AR = -3 * HORA; // Argentina no tiene horario de verano.

// Horario de atención del día (0 = domingo), en horas argentinas. Null = cerrado.
function franjaDelDia(diaSemana: number): [number, number] | null {
  if (diaSemana === 0) return null;
  return diaSemana === 6 ? [9, 13] : [9, 18];
}

/** Milisegundos de horario de atención entre dos momentos. */
export function msHabilesEntre(desde: Date, hasta: Date): number {
  if (hasta <= desde) return 0;
  let total = 0;
  // Se recorre día por día en hora argentina (corrida 3 h para trabajar con los métodos UTC).
  const ini = desde.getTime() + DESFASE_AR;
  const fin = hasta.getTime() + DESFASE_AR;
  const dia = new Date(ini);
  dia.setUTCHours(0, 0, 0, 0);
  for (let d = dia.getTime(); d < fin; d += 24 * HORA) {
    const franja = franjaDelDia(new Date(d).getUTCDay());
    if (!franja) continue;
    const a = Math.max(ini, d + franja[0] * HORA);
    const b = Math.min(fin, d + franja[1] * HORA);
    if (b > a) total += b - a;
  }
  return total;
}

/** ¿Es horario de atención? */
export function enHorarioDeAtencion(ahora: Date): boolean {
  const ar = new Date(ahora.getTime() + DESFASE_AR);
  const franja = franjaDelDia(ar.getUTCDay());
  const h = ar.getUTCHours() + ar.getUTCMinutes() / 60;
  return !!franja && h >= franja[0] && h < franja[1];
}

/** ¿Pasaron las 2 horas hábiles? */
export function corresponderAvisoSinContestar(espera: Date | null, ahora: Date): boolean {
  return !!espera && msHabilesEntre(espera, ahora) >= HORAS_SIN_CONTESTAR * HORA;
}

/** ¿Una persona le contestó al cliente después de su último mensaje? */
export function contestado(mensajes: MensajeChat[]): boolean {
  const orden = [...mensajes].sort((a, b) => t(a.created_at) - t(b.created_at));
  const ultimoIn = orden.filter((m) => m.direccion === "in").pop();
  const ultimoHumano = orden.filter((m) => m.direccion === "out" && m.ai_generado !== true).pop();
  return !ultimoIn || (!!ultimoHumano && t(ultimoHumano.created_at) >= t(ultimoIn.created_at));
}

/** ¿Toca el próximo paso de este aviso ahora? (No mira si ya lo leyeron o abrieron el chat: eso lo resuelve el cron.) */
export function tocaRepetir(alerta: { push_repeticiones: number | null; push_ultimo_at: string | null; created_at: string }, ahora: Date): boolean {
  if ((alerta.push_repeticiones ?? 0) >= MAX_REPETICIONES) return false;
  if (!enHorarioDeAtencion(ahora)) return false;
  const ultimo = t(alerta.push_ultimo_at ?? alerta.created_at);
  return ahora.getTime() - ultimo >= MINUTOS_ENTRE_REPETICIONES * 60_000;
}
