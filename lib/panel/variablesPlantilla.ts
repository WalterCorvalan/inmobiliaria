// Datos {{1}}, {{2}}… de una plantilla de WhatsApp. Antes se aceptaba uno solo ({{1}}); desde el 19/10/2026 hasta
// MAX_VARIABLES, numerados de corrido, para plantillas como "Hola {{1}}, encontramos un {{2}}…"
// (lib/panel/plantillasSugeridas.ts). Sin base de datos, para poder probarlo.

export const MAX_VARIABLES = 4;
const VARIABLE_REGEX = /\{\{\s*(\d+)\s*\}\}/g;

/** Cuántos datos distintos pide la plantilla ({{1}} y {{2}} = 2). */
export function countVariables(body: string): number {
  return new Set([...body.matchAll(VARIABLE_REGEX)].map((m) => m[1])).size;
}

/** null si está bien; si no, el motivo para mostrar. */
export function validateBodyVariables(body: string): string | null {
  const numeros = [...new Set([...body.matchAll(VARIABLE_REGEX)].map((m) => Number(m[1])))].sort((a, b) => a - b);
  if (numeros.length > MAX_VARIABLES) return `Máximo ${MAX_VARIABLES} datos ({{1}} a {{${MAX_VARIABLES}}})`;
  if (numeros.some((n, i) => n !== i + 1)) return "Los datos van numerados de corrido: {{1}}, {{2}}, {{3}}…";
  // Meta rechaza las plantillas que empiezan o terminan con un dato.
  if (/^\s*\{\{/.test(body) || /\}\}\s*[.!?]?\s*$/.test(body)) return "La plantilla no puede empezar ni terminar con un dato {{…}}";
  return null;
}

/** El texto con los datos puestos (lo que queda guardado en el chat). */
export function renderBody(body: string, valores: string[] | string | undefined): string {
  const lista = Array.isArray(valores) ? valores : valores ? [valores] : [];
  return body.replace(VARIABLE_REGEX, (_, n) => lista[Number(n) - 1] ?? "");
}

/**
 * Plantillas de ejemplo que Meta carga en todas las cuentas ("hello_world", las de Jasper's Market). Meta no deja
 * borrarlas (19/10/2026: "Invalid parameter", subcódigo 2593002), así que el panel las saca solo de su lista y
 * "Sincronizar" no las vuelve a traer.
 */
export const esPlantillaDeEjemploMeta = (nombre: string) => /^(hello_world|jaspers_market)/.test(nombre);
