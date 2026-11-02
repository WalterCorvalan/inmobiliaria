// Nombre a mostrar en la ficha del lead (Walter, 20/10/2026): en Instagram el contacto suele ser el usuario
// ("usuario______900") y el resumen de la IA ya dice cómo se llama ("Luz Bernat consultó por..."). Si el nombre del
// contacto parece un usuario o un teléfono, se muestra el que nombra el resumen; el usuario queda chiquito abajo.
// Solo cambia lo que se ve: no se guarda nada.

const NO_SON_NOMBRES = new Set([
  "el", "la", "los", "las", "un", "una", "cliente", "clienta", "consulta", "consultó", "consulto", "pregunta", "preguntó",
  "busca", "quiere", "pidió", "pidio", "se", "le", "lo", "no", "hola", "interesado", "interesada", "usuario", "usuaria",
]);

const PALABRA_NOMBRE = /^[A-ZÁÉÍÓÚÑ][a-záéíóúñü]+$/;

/** El contacto no tiene un nombre de persona: es un usuario (@algo, guiones bajos, números), un teléfono o vacío. */
export function pareceUsuario(nombre: string | null | undefined): boolean {
  const n = (nombre || "").trim();
  if (!n || n === "Sin nombre") return true;
  if (n.startsWith("@") || /[_\d.]/.test(n)) return true;
  return !/\s/.test(n) && n === n.toLowerCase();
}

/** Nombre (y apellido, si está) con el que arranca el resumen: "Luz Bernat consultó…" → "Luz Bernat". */
export function nombreDelResumen(resumen: string | null | undefined): string | null {
  const palabras = (resumen || "").trim().split(/\s+/);
  const nombre: string[] = [];
  for (const p of palabras.slice(0, 3)) {
    const limpia = p.replace(/[,;:]$/, "");
    if (!PALABRA_NOMBRE.test(limpia) || NO_SON_NOMBRES.has(limpia.toLowerCase())) break;
    nombre.push(limpia);
    if (limpia !== p) break; // "Luz, de Pilar, ..." termina en la coma
  }
  // Necesita seguir con una palabra en minúscula (el verbo): si no, puede ser una marca o un lugar.
  const siguiente = palabras[nombre.length];
  if (nombre.length === 0 || !siguiente || !/^[a-záéíóúñ(]/.test(siguiente)) return null;
  return nombre.join(" ");
}

/** Lo que se muestra como nombre y, si cambió, el usuario original para ponerlo abajo. */
export function nombreParaFicha(nombreContacto: string, resumen: string | null | undefined): { nombre: string; usuario: string | null } {
  if (!pareceUsuario(nombreContacto)) return { nombre: nombreContacto, usuario: null };
  const delResumen = nombreDelResumen(resumen);
  if (!delResumen) return { nombre: nombreContacto, usuario: null };
  return { nombre: delResumen, usuario: nombreContacto === "Sin nombre" ? null : nombreContacto };
}
