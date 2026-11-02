// Resumen de la IA más fácil de leer (17/10/2026, Walter): era un párrafo plano y los datos importantes (qué auto,
// la permuta, el teléfono, plata, kilómetros) se perdían. Se parte en una línea por frase y se marcan esos datos.
// Solo cambia cómo se ve: el texto guardado no se toca.

export type Trozo = { texto: string; tipo?: "auto" | "dato" | "telefono" };

const MARCAS = [
  "Alfa Romeo", "Audi", "BAIC", "BMW", "Chery", "Chevrolet", "Citroën", "Citroen", "DS", "Dodge", "Fiat", "Ford", "Honda",
  "Hyundai", "Jeep", "Karry", "Kia", "Mercedes-Benz", "Mercedes Benz", "Mercedes", "Mini", "Mitsubishi", "Nissan",
  "Peugeot", "RAM", "Renault", "Rely", "Subaru", "Suzuki", "Toyota", "Volkswagen", "VW", "Volvo",
];
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");

// Marca y hasta 4 palabras más del modelo (empiezan en mayúscula o número: "Fiat Palio Fire 2016 1.4").
const AUTO = String.raw`(?:${MARCAS.map(esc).join("|")})(?:\s+[A-ZÁÉÍÓÚ0-9][\w.áéíóúñ/-]*){0,4}`;
// Teléfono: 8 a 13 dígitos, con espacios o guiones en el medio; no toma kilómetros ("2016 170000 km") ni números con punto.
const TELEFONO = String.raw`(?<![\d.,])\+?\d(?:[\s-]?\d){7,12}(?![\d.,]|\s?km)`;
const PLATA = String.raw`(?:US\$|U\$S|USD|\$)\s?\d[\d.,]*(?:\s?(?:mil|millones|M)\b)?|\d[\d.,]*\s?(?:dólares|dolares|pesos|USD)`;
const KM = String.raw`\d[\d.,]*\s?km\b`;
const ANIO = String.raw`\b(?:19[89]\d|20[0-4]\d)\b`;

const PATRON = new RegExp(`(${AUTO})|(${PLATA})|(${KM})|(${TELEFONO})|(${ANIO})`, "g");

export function resaltarFrase(frase: string): Trozo[] {
  const trozos: Trozo[] = [];
  let desde = 0;
  for (const m of frase.matchAll(PATRON)) {
    const i = m.index ?? 0;
    if (i > desde) trozos.push({ texto: frase.slice(desde, i) });
    const tipo = m[1] ? "auto" : m[4] ? "telefono" : "dato";
    trozos.push({ texto: m[0], tipo });
    desde = i + m[0].length;
  }
  if (desde < frase.length) trozos.push({ texto: frase.slice(desde) });
  return trozos;
}

/** El teléfono escrito en un texto (el último, si hay varios), o null. */
export function telefonoEnTexto(texto: string): string | null {
  const encontrados = texto.match(new RegExp(TELEFONO, "g"));
  return encontrados ? encontrados[encontrados.length - 1].trim() : null;
}

/** Una frase por renglón (corta en ". " seguido de mayúscula, para no partir "1.4" ni "170.000"). */
export function frasesDelResumen(texto: string): string[] {
  return texto
    .split(/\n+|(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/)
    .map((f) => f.trim())
    .filter(Boolean);
}
