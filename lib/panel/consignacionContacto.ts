// Seguimiento de una consignación antes de que el auto entre a stock: cuántos
// días lleva sin contacto y si ya está "fría". La misma regla usan la pantalla
// (Consignaciones) y el aviso diario al vendedor (api/cron/panel/seguimientos).
// "Marcar contacto hoy" actualiza consignaciones.ultimo_contacto; si nunca se
// marcó, cuenta desde la fecha de alta.

export const ESTADOS_CONSIGNACION_ACTIVOS = ["pendiente_contacto", "contactado", "agendado", "ingreso_local", "publicado"];

// A partir de estos días sin contacto la consignación está fría y el vendedor recibe el aviso.
export const DIAS_CONSIGNACION_FRIA = 10;

type ConsignacionContacto = { estado?: string | null; ultimo_contacto?: string | null; fecha_alta?: string | null; created_at?: string | null };

const diaUtc = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

// Días entre el último contacto (o el alta) y hoy (YYYY-MM-DD, fecha local). null si no hay ninguna fecha.
export function diasSinContacto(c: ConsignacionContacto, hoyIso: string): number | null {
  const desde = (c.ultimo_contacto || c.fecha_alta || c.created_at || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) return null;
  return Math.max(0, Math.round((diaUtc(hoyIso) - diaUtc(desde)) / 86400000));
}

export function esConsignacionFria(c: ConsignacionContacto, hoyIso: string): boolean {
  if (!ESTADOS_CONSIGNACION_ACTIVOS.includes(c.estado || "")) return false;
  const dias = diasSinContacto(c, hoyIso);
  return dias != null && dias >= DIAS_CONSIGNACION_FRIA;
}
