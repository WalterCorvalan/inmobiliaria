// Cuentas de la pantalla de Inicio del panel (rediseño 25/11/2026): qué hay para atender hoy, de un vistazo.
// Funciones puras: reciben las filas tal como vienen de la base y devuelven lo que se muestra.

export type CanalLead = "whatsapp" | "instagram" | "messenger" | "rodi" | "manual";

export interface LeadInicio {
  id: string;
  canal: CanalLead;
  nombre: string;
  calificacion: string | null;
  estado_lead: string | null;
  unread_count: number | null;
  last_message_at: string | null;
  created_at: string;
  es_basura: boolean | null;
}

export interface VisitaInicio {
  id: string;
  nombre_cliente: string | null;
  fecha_visita: string;
  horario_visita: string | null;
  estado: string;
  tipo: string | null;
  propiedad_codigo: string | null;
}

export interface PropiedadInicio { estado: string; operacion: string | null }
export interface TareaInicio { id: string; titulo: string; tipo: string | null; fecha_vencimiento: string | null; completada: boolean | null }

const CERRADOS = new Set(["convertido", "perdido"]);
const PESO_CALIFICACION: Record<string, number> = { caliente: 3, tibio: 2, frio: 1 };

/** Fecha de hoy en Argentina (UTC-3, sin horario de verano) como AAAA-MM-DD, aunque el servidor corra en UTC. */
export function hoyArgentina(ahora: Date = new Date()): string {
  return new Date(ahora.getTime() - 3 * 3600000).toISOString().slice(0, 10);
}

/** Suma días a una fecha AAAA-MM-DD. */
export function sumarDiasISO(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export const leadActivo = (l: LeadInicio) => !l.es_basura && !CERRADOS.has(l.estado_lead || "nuevo");

/** Leads para atender primero: con mensajes sin leer o calientes, ordenados por temperatura y después por el más reciente. */
export function leadsParaAtender(leads: LeadInicio[], max = 6): LeadInicio[] {
  return leads
    .filter((l) => leadActivo(l) && ((l.unread_count ?? 0) > 0 || l.calificacion === "caliente"))
    .sort((a, b) => {
      const p = (PESO_CALIFICACION[b.calificacion || ""] ?? 0) - (PESO_CALIFICACION[a.calificacion || ""] ?? 0);
      if (p !== 0) return p;
      return (b.last_message_at || b.created_at).localeCompare(a.last_message_at || a.created_at);
    })
    .slice(0, max);
}

/** Visitas que siguen en pie (pendientes o confirmados) desde hoy hasta dentro de `dias`, en orden. */
export function agendaProxima(visitas: VisitaInicio[], hoy: string, dias = 7): VisitaInicio[] {
  const hasta = sumarDiasISO(hoy, dias);
  return visitas
    .filter((v) => (v.estado === "Pendiente" || v.estado === "Confirmada") && v.fecha_visita >= hoy && v.fecha_visita <= hasta)
    .sort((a, b) => `${a.fecha_visita} ${a.horario_visita || ""}`.localeCompare(`${b.fecha_visita} ${b.horario_visita || ""}`));
}

export interface ResumenInicio {
  leadsActivos: number;
  leadsNuevosHoy: number;
  sinLeer: number;
  calientes: number;
  visitasHoy: number;
  visitasSemana: number;
  disponibles: number;
  reservadas: number;
  enVenta: number;
  enAlquiler: number;
  tareasVencidas: number;
  tareasHoy: number;
  porCanal: Record<CanalLead, number>;
}

export function resumenInicio(d: { leads: LeadInicio[]; visitas: VisitaInicio[]; propiedades: PropiedadInicio[]; tareas: TareaInicio[] }, ahora: Date = new Date()): ResumenInicio {
  const hoy = hoyArgentina(ahora);
  const activos = d.leads.filter(leadActivo);
  const porCanal: Record<CanalLead, number> = { whatsapp: 0, instagram: 0, messenger: 0, rodi: 0, manual: 0 };
  for (const l of activos) porCanal[l.canal]++;
  const pendientes = d.tareas.filter((t) => !t.completada && t.fecha_vencimiento);
  const activas = d.propiedades.filter((p) => p.estado === "disponible" || p.estado === "reservada");
  return {
    leadsActivos: activos.length,
    leadsNuevosHoy: d.leads.filter((l) => !l.es_basura && hoyArgentina(new Date(l.created_at)) === hoy).length,
    sinLeer: activos.filter((l) => (l.unread_count ?? 0) > 0).length,
    calientes: activos.filter((l) => l.calificacion === "caliente").length,
    visitasHoy: agendaProxima(d.visitas, hoy, 0).length,
    visitasSemana: agendaProxima(d.visitas, hoy, 7).length,
    disponibles: d.propiedades.filter((p) => p.estado === "disponible").length,
    reservadas: d.propiedades.filter((p) => p.estado === "reservada").length,
    enVenta: activas.filter((p) => p.operacion === "venta").length,
    enAlquiler: activas.filter((p) => p.operacion === "alquiler").length,
    tareasVencidas: pendientes.filter((t) => new Date(t.fecha_vencimiento!).getTime() < ahora.getTime()).length,
    tareasHoy: pendientes.filter((t) => hoyArgentina(new Date(t.fecha_vencimiento!)) === hoy && new Date(t.fecha_vencimiento!).getTime() >= ahora.getTime()).length,
    porCanal,
  };
}

/** La tarea ya pasó su hora y sigue sin hacer. */
export const tareaVencida = (t: TareaInicio, ahora: Date = new Date()) => !t.completada && !!t.fecha_vencimiento && new Date(t.fecha_vencimiento).getTime() < ahora.getTime();

/** "hace 5 min", "hace 3 h", "ayer", "hace 4 días". */
export function haceCuanto(iso: string | null, ahora: Date = new Date()): string {
  if (!iso) return "";
  const min = Math.max(0, Math.round((ahora.getTime() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const dias = Math.round(h / 24);
  return dias === 1 ? "ayer" : `hace ${dias} días`;
}
