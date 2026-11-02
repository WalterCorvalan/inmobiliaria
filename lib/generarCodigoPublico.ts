// Códigos/tokens públicos (seguimiento de venta/seña, link de presupuesto).
// Se generan con crypto.getRandomValues (CSPRNG) en vez de Math.random(),
// que no es apto para valores que actúan como credencial de acceso.
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generarCodigoPublico(length = 8): string {
  const valores = new Uint32Array(length);
  crypto.getRandomValues(valores);
  return Array.from(valores, (v) => ALFABETO[v % ALFABETO.length]).join("");
}
