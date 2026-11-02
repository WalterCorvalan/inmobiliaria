// Orden de las bandejas de chat (WhatsApp, Instagram, Messenger, Rodi): la
// charla con actividad más reciente arriba. Antes dependía solo de que el
// server trajera la lista ordenada por last_message_at, y en Postgres un
// DESC pone los NULL primero: charlas sin ese campo quedaban arriba mezcladas
// y las de hoy abajo. Se ordena acá por la fecha real del último mensaje.

export interface ConversacionOrdenable {
  calificacion?: string | null;
  last_message_at?: string | null;
  created_at?: string | null;
  ultimo_mensaje?: { created_at?: string | null } | null;
}

function ms(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function fechaDeLlegada(c: ConversacionOrdenable): number {
  return Math.max(ms(c.last_message_at), ms(c.ultimo_mensaje?.created_at), ms(c.created_at));
}

// Más reciente primero. No muta el arreglo recibido.
export function ordenarPorLlegada<T extends ConversacionOrdenable>(conversaciones: T[]): T[] {
  return [...conversaciones].sort((a, b) => fechaDeLlegada(b) - fechaDeLlegada(a));
}
