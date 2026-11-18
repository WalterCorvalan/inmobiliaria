// Visitas: estados, semana de la agenda y agrupado por día. Funciones puras (sin base ni pantalla).
// La tabla es `visitas` (sql_004_leads.sql + sql_010_visitas_propiedad.sql). Las crean los bots al agendar y los asesores a mano.

export const ESTADOS_VISITA = ["Pendiente", "Confirmada", "Asistió", "Cancelada"] as const;
export type EstadoVisita = (typeof ESTADOS_VISITA)[number];

export interface Visita {
  id: string;
  nombre_cliente: string;
  telefono_cliente: string;
  fecha_visita: string; // AAAA-MM-DD
  horario_visita: string; // "10:30" o texto libre que dejó el bot ("a la mañana")
  sucursal: string;
  estado: EstadoVisita;
  vendedor_id: string | null;
  propiedad_id: string | null;
  propiedad_codigo: string | null;
  notas: string | null;
  canal_origen: string | null;
  created_at: string;
}

/** Fecha local AAAA-MM-DD (sin pasar por UTC, que en Argentina corre el día después de las 21). */
export function aFechaISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function desdeFechaISO(s: string): Date {
  const [a, m, d] = s.split("-").map(Number);
  return new Date(a, (m || 1) - 1, d || 1);
}

/** Lunes de la semana de esa fecha. */
export function inicioDeSemana(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dia = (x.getDay() + 6) % 7; // lunes = 0
  x.setDate(x.getDate() - dia);
  return x;
}

export function sumarDias(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

/** Los 7 días (lunes a domingo) de la semana que empieza en `lunes`, como AAAA-MM-DD. */
export function diasDeSemana(lunes: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => aFechaISO(sumarDias(lunes, i)));
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "lunes 16 de noviembre" */
export function etiquetaDia(fechaISO: string): string {
  const d = desdeFechaISO(fechaISO);
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

/** "16 al 22 de noviembre" o "30 de noviembre al 6 de diciembre". */
export function etiquetaSemana(lunes: Date): string {
  const dom = sumarDias(lunes, 6);
  return lunes.getMonth() === dom.getMonth()
    ? `${lunes.getDate()} al ${dom.getDate()} de ${MESES[dom.getMonth()]}`
    : `${lunes.getDate()} de ${MESES[lunes.getMonth()]} al ${dom.getDate()} de ${MESES[dom.getMonth()]}`;
}

/** Minutos desde las 00:00 para ordenar; los horarios en texto ("a la mañana") van al final del día. */
export function minutosDeHorario(h: string): number {
  const m = h.match(/(\d{1,2})(?:[:.hs]+\s*(\d{2}))?/i);
  if (!m) return 24 * 60;
  const hora = Number(m[1]);
  const min = Number(m[2] || 0);
  return hora < 24 && min < 60 ? hora * 60 + min : 24 * 60;
}

export function ordenarVisitas<T extends Pick<Visita, "fecha_visita" | "horario_visita">>(lista: T[]): T[] {
  return [...lista].sort((a, b) => a.fecha_visita.localeCompare(b.fecha_visita) || minutosDeHorario(a.horario_visita) - minutosDeHorario(b.horario_visita));
}

/** Agrupa por día, en el orden de `dias`; cada día con sus visitas ordenadas por horario (los días vacíos quedan con []). */
export function agruparPorDia<T extends Pick<Visita, "fecha_visita" | "horario_visita">>(lista: T[], dias: string[]): { fecha: string; visitas: T[] }[] {
  const orden = ordenarVisitas(lista);
  return dias.map((fecha) => ({ fecha, visitas: orden.filter((v) => v.fecha_visita === fecha) }));
}

export interface FiltroVisitas { sucursal?: string | "todas"; vendedorId?: string | "todos"; estado?: EstadoVisita | "todos" }

export function filtrarVisitas<T extends Pick<Visita, "sucursal" | "vendedor_id" | "estado">>(lista: T[], f: FiltroVisitas): T[] {
  return lista.filter((v) => {
    if (f.sucursal && f.sucursal !== "todas" && v.sucursal !== f.sucursal) return false;
    if (f.vendedorId && f.vendedorId !== "todos" && (f.vendedorId === "sin" ? v.vendedor_id !== null : v.vendedor_id !== f.vendedorId)) return false;
    if (f.estado && f.estado !== "todos" && v.estado !== f.estado) return false;
    return true;
  });
}

/** Dos visitas activas de la misma oficina el mismo día y horario: hay que reagendar una. Devuelve los ids en conflicto. */
export function visitasEnConflicto(lista: Pick<Visita, "id" | "fecha_visita" | "horario_visita" | "sucursal" | "estado">[]): Set<string> {
  const activas = lista.filter((v) => v.estado === "Pendiente" || v.estado === "Confirmada");
  const porClave = new Map<string, string[]>();
  for (const v of activas) {
    const clave = `${v.fecha_visita}|${v.sucursal}|${v.horario_visita.trim().toLowerCase()}`;
    porClave.set(clave, [...(porClave.get(clave) || []), v.id]);
  }
  const out = new Set<string>();
  for (const ids of porClave.values()) if (ids.length > 1) ids.forEach((id) => out.add(id));
  return out;
}

export function resumenVisitas(lista: Pick<Visita, "estado">[]) {
  return {
    total: lista.length,
    pendientes: lista.filter((v) => v.estado === "Pendiente").length,
    confirmadas: lista.filter((v) => v.estado === "Confirmada").length,
    asistieron: lista.filter((v) => v.estado === "Asistió").length,
    canceladas: lista.filter((v) => v.estado === "Cancelada").length,
  };
}

/** Link de WhatsApp para confirmar la visita con el cliente (mensaje armado). Sin teléfono usable, null. */
export function linkConfirmarPorWhatsapp(v: Pick<Visita, "telefono_cliente" | "nombre_cliente" | "fecha_visita" | "horario_visita" | "sucursal">, negocio: string): string | null {
  let d = v.telefono_cliente.replace(/\D/g, "");
  if (d.length < 8) return null;
  if (!d.startsWith("54")) d = `549${d.replace(/^0/, "").replace(/^15/, "")}`;
  const nombre = v.nombre_cliente.split(" ")[0];
  const texto = `Hola ${nombre}, te escribimos de ${negocio} para confirmar tu visita del ${etiquetaDia(v.fecha_visita)} a las ${v.horario_visita}${v.sucursal && v.sucursal !== "Sin especificar" ? ` (${v.sucursal})` : ""}. ¿Nos confirmás?`;
  return `https://wa.me/${d}?text=${encodeURIComponent(texto)}`;
}
