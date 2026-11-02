// Mensajes automáticos por WhatsApp a los clientes (Walter, 20/10/2026): salen solos, con plantillas aprobadas por Meta
// (categoría Marketing: cada envío se paga). Dos casos:
//   - Cumpleaños: el día del cumpleaños, a las 9.
//   - Fin de pago: a principio del mes en que vence la última cuota del cliente, sumando las cuotas que cobra la
//     agencia (cuotas_cobrar_clientes) y las de la financiera (cuotas_financiera) de la misma venta.
//   - Renovación (20/10/2026): el día del cumpleaños, si ya pasaron 3 años (o los que diga Configuración) desde su última
//     compra, el saludo sale con la oferta de renovar el auto, en un solo mensaje. Una sola vez por compra. No sale si
//     el cliente escribió por WhatsApp en los últimos 30 días (ya está hablando con un vendedor).
// Cada mensaje sale una sola vez por cliente y período (tabla mensajes_automaticos). Se prenden en
// Configuración → WhatsApp; arrancan apagados hasta que Meta apruebe las plantillas.

export const PLANTILLA_CUMPLEANOS = "feliz_cumpleanos";
export const PLANTILLA_FIN_DE_PAGO = "fin_de_pago_felicitaciones";
export const PLANTILLA_CUMPLEANOS_RENOVACION = "feliz_cumpleanos_renovacion";

export const TEXTO_CUMPLEANOS = "¡Feliz cumpleaños, {{1}}! Todo el equipo de Pfaffen Cars te desea un gran día. 🎉";
export const TEXTO_CUMPLEANOS_RENOVACION = "¡Feliz cumpleaños, {{1}}! Todo el equipo de Pfaffen Cars te desea un gran día. 🎉 Ya pasaron {{2}} años desde que te llevaste tu {{3}}. Si estás pensando en cambiarlo, te tomamos tu auto como parte de pago y te ayudamos con la financiación. ¿Querés que te pasemos una tasación sin compromiso?";
export const ANIOS_RENOVACION_DEFAULT = 3;
export const DIAS_CHARLA_RECIENTE = 30;
export const TEXTO_FIN_DE_PAGO = "¡Felicitaciones, {{1}}! Este mes terminaste de pagar tu {{2}}. Gracias por confiar en Pfaffen Cars; cuando quieras renovarlo, acá estamos.";

export type CuotaParaFinDePago = { cliente_id: string | null; venta_id: string | null; vencimiento: string };

/** Clientes cuya última cuota (agencia + financiera, por venta) vence en el mes dado ("AAAA-MM"). */
export function terminanDePagarEnElMes(cuotas: CuotaParaFinDePago[], mes: string): { cliente_id: string; venta_id: string | null }[] {
  const ultima = new Map<string, { cliente_id: string; venta_id: string | null; vencimiento: string }>();
  for (const c of cuotas) {
    if (!c.cliente_id || !c.vencimiento) continue;
    const clave = `${c.cliente_id}|${c.venta_id ?? ""}`;
    const prev = ultima.get(clave);
    if (!prev || c.vencimiento > prev.vencimiento) ultima.set(clave, { cliente_id: c.cliente_id, venta_id: c.venta_id, vencimiento: c.vencimiento });
  }
  return [...ultima.values()].filter((u) => u.vencimiento.slice(0, 7) === mes).map(({ cliente_id, venta_id }) => ({ cliente_id, venta_id }));
}

export type VentaParaRenovar = { id: string; fecha_cierre: string | null; vehiculo_marca?: string | null; vehiculo_modelo?: string | null };

/** Años completos entre dos fechas "AAAA-MM-DD". */
export function aniosEntre(desde: string, hasta: string): number {
  const [a1, m1, d1] = desde.slice(0, 10).split("-").map(Number);
  const [a2, m2, d2] = hasta.slice(0, 10).split("-").map(Number);
  return a2 - a1 - (m2 < m1 || (m2 === m1 && d2 < d1) ? 1 : 0);
}

/** La última compra del cliente si ya pasaron `anios` o más; null si compró hace menos o no compró. */
export function compraParaRenovar(ventas: VentaParaRenovar[], hoy: string, anios = ANIOS_RENOVACION_DEFAULT): { venta: VentaParaRenovar; anios: number } | null {
  const ultima = ventas.filter((v) => v.fecha_cierre).sort((a, b) => (b.fecha_cierre as string).localeCompare(a.fecha_cierre as string))[0];
  if (!ultima) return null;
  const pasaron = aniosEntre(ultima.fecha_cierre as string, hoy);
  return pasaron >= anios ? { venta: ultima, anios: pasaron } : null;
}

/** Teléfono argentino como lo pide WhatsApp (549 + área + número), o null si no alcanza para mandar. */
export function telefonoParaWhatsapp(telefono: string | null | undefined): string | null {
  let d = (telefono || "").replace(/\D/g, "").replace(/^00/, "");
  if (d.startsWith("549")) d = d.slice(3);
  else if (d.startsWith("54")) d = d.slice(2);
  d = d.replace(/^0/, "");
  // "11 15 1234 5678": el 15 después del código de área sobra.
  if (d.length === 12 && /^\d{2}15/.test(d)) d = d.slice(0, 2) + d.slice(4);
  return d.length === 10 ? `549${d}` : null;
}

/** Primer nombre para el saludo ("Juan Carlos" → "Juan"). */
export function primerNombre(nombre: string | null | undefined): string {
  return (nombre || "").trim().split(/\s+/)[0] || "";
}
