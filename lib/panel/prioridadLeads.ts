// Prioridad y orden de la bandeja de Leads ("a quién llamar primero").
// Extraído de LeadsUnificadosClient.tsx para poder testearlo: el orden ya
// falló una vez (un lead viejo con puntaje un poco más alto quedaba arriba
// de uno que escribió hoy, pedido 1/10) y es lo primero que ve el vendedor.

export interface LeadParaPrioridad {
  calificacion: string | null;
  estado_lead: string;
  vendedor_id: string | null;
  last_message_at: string | null;
}
export type Prioridad = "alta" | "media" | "baja" | null;

export function diasDesde(iso: string | null, ahora: number = Date.now()): number {
  if (!iso) return Infinity;
  return (ahora - new Date(iso).getTime()) / 86400000;
}

// Score simple y auditable -- no es IA ni predicción, es una suma de señales
// que ya están cargadas en cada lead. Los leads perdidos/convertidos/basura
// quedan siempre al final (ya no hay nada que priorizar).
export function calcularScore(l: LeadParaPrioridad & { sinRespuesta: boolean; esBasuraFinal: boolean }, ahora: number = Date.now()): number {
  if (l.estado_lead === "perdido" || l.estado_lead === "convertido" || l.esBasuraFinal) return -1;
  let score = 0;
  score += l.calificacion === "caliente" ? 50 : l.calificacion === "tibio" ? 25 : l.calificacion === "frio" ? 5 : 15; // sin calificar: prioridad media, todavía no se sabe
  if (l.estado_lead === "nuevo") score += 20;
  else if (l.estado_lead === "calificando") score += 10;
  if (l.sinRespuesta) score += 40; // caliente + cliente esperando respuesta hace 2+ días
  if (!l.vendedor_id) score += 15; // nadie lo tiene asignado todavía
  if (l.last_message_at && diasDesde(l.last_message_at, ahora) < 1) score += 5; // recién escribió
  return score;
}

export function prioridadDeScore(score: number): Prioridad {
  if (score < 0) return null;
  if (score >= 60) return "alta";
  if (score >= 30) return "media";
  return "baja";
}

// Por qué un lead tiene la prioridad que tiene -- se muestra en la tarjeta.
// Mismas señales que calcularScore, en palabras.
export function motivosPrioridad(l: LeadParaPrioridad & { sinRespuesta: boolean }): string[] {
  const m: string[] = [];
  if (l.calificacion === "caliente") m.push("caliente");
  else if (l.calificacion === "tibio") m.push("tibio");
  if (l.sinRespuesta) m.push("cliente esperando respuesta");
  if (l.estado_lead === "nuevo") m.push("nuevo");
  if (!l.vendedor_id) m.push("sin vendedor");
  return m;
}

// Primero por nivel (alta > media > baja) y, dentro de cada nivel, el que
// escribió más recién arriba. No muta el arreglo recibido.
export function ordenarPorPrioridad<T extends { prioridad: Prioridad; last_message_at: string | null; created_at: string }>(leads: T[]): T[] {
  const nivel = (p: Prioridad) => (p === "alta" ? 2 : p === "media" ? 1 : 0);
  const fecha = (l: T) => new Date(l.last_message_at || l.created_at).getTime();
  return [...leads].sort((a, b) => nivel(b.prioridad) - nivel(a.prioridad) || fecha(b) - fecha(a));
}
