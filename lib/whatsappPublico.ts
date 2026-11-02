// Números de WhatsApp: los números se guardan de muchas formas ("11 2190-7000", "+54 9 11...", "011 15...");
// wa.me necesita 549 + característica + número, sin el 0 ni el 15. normalizarWhatsappAR lo arma.

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
