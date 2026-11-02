// Formato del resumen "Qué pidió el cliente" (Walter, 21/10/2026, ejemplo de Luz Bernat): frases cortas, cada dato con su
// nombre adelante, para que "4 millones" no quede colgado sin decir que es el anticipo. Lo usan el lector de charlas
// (lib/panel/lectorCharlas.ts) y el bot al derivar (lib/ai/promptV2/reglasGenerales.ts); la ficha marca el nombre de
// cada dato (components/panel/conversaciones/ResumenResaltado.tsx).

export const INSTRUCCION_RESUMEN = [
  "frases cortas en español rioplatense, en tercera persona, cada una en su renglón, en este orden y salteando las que no tengan dato:",
  "1) Qué quiere: \"Quiere comprar [el auto puntual, o un auto] y consultó [lo que preguntó]\" (o vender, o dejar en consignación).",
  "2) \"Anticipo: [monto con moneda] para entregar.\" o \"Presupuesto: [monto].\"",
  "3) \"Permuta: [marca modelo año km].\" si ofrece un usado; \"No ofrece usado en permuta.\" si dijo que no.",
  "4) \"Paga con: [efectivo, financiación, transferencia...].\"",
  "5) \"Teléfono: [número].\" o \"Mail: [mail].\" si lo dejó.",
  "6) \"Envió: [foto, archivo, audio...].\" si mandó algo.",
  "7) \"Pendiente: [qué falta hacer].\" Si no se sabe qué auto quiere, \"Pendiente: que un asesor lo contacte y definir qué auto le interesa.\"",
  "Nunca un número suelto: siempre con su nombre adelante (Anticipo, Presupuesto, Teléfono).",
].join(" ");

/** "Anticipo: $ 4.000.000 para entregar." → etiqueta "Anticipo" y el resto. null si la frase no empieza con un nombre de dato. */
export function etiquetaDeFrase(frase: string): { etiqueta: string; resto: string } | null {
  const m = /^([A-ZÁÉÍÓÚÑ][a-záéíóúñ ]{2,20}):\s+(.+)$/.exec(frase.trim());
  return m ? { etiqueta: m[1], resto: m[2] } : null;
}
