// Números de WhatsApp de los botones del sitio público.
//
// - Rely y Karry: todo va a Gaby (pedido de Walter, 8/10/2026), en las páginas
//   de la marca, en la ficha de cada unidad del catálogo y en /marcas.
// - El resto de los autos: vendedor asignado -> su WhatsApp -> teléfono del
//   encargado de la sucursal del auto (lib/panel/contactoVehiculo.ts).
//
// Los números se guardan de muchas formas ("11 2190-7000", "+54 9 11...",
// "011 15..."); wa.me necesita 549 + característica + número, sin el 0 ni el
// 15. normalizarWhatsappAR lo arma.

export const WHATSAPP_GABY = "5491156520726";
export const WHATSAPP_RELY_KARRY = WHATSAPP_GABY;

// Respaldo cuando no hay vendedor ni encargado con WhatsApp (pie de la web,
// /marcas, botones de "hablar con un asesor"): el número de la empresa,
// +54 9 11 2190-7000. Entre el 8 y el 9/10/2026 estuvo desconectado de WhatsApp
// y se mandó todo a Lucas (5491157998065); ya se registró de nuevo y volvió.
export const WHATSAPP_RESPALDO = "5491121907000";

export function esMarcaRelyKarry(marca: string | null | undefined): boolean {
  return /^(rely|karry)$/i.test((marca ?? "").trim());
}

export function normalizarWhatsappAR(telefono: string | null | undefined): string | null {
  let n = (telefono ?? "").replace(/\D/g, "");
  if (!n) return null;
  if (n.startsWith("00")) n = n.slice(2);
  if (n.startsWith("54")) n = n.slice(2);
  if (n.startsWith("9")) n = n.slice(1);
  if (n.startsWith("0")) n = n.slice(1);
  // Celular escrito a la vieja usanza: 11 15 xxxx-xxxx -> 11 xxxx-xxxx.
  if (n.length === 12 && n.slice(2, 4) === "15") n = n.slice(0, 2) + n.slice(4);
  if (n.length < 10) return null;
  return "549" + n;
}
