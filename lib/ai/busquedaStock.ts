// Cómo el bot entiende la marca, el modelo y el año que pide el cliente contra lo que está cargado en Stock.
// Caso Fran Arias (Instagram, 29/10/2026): pidió "la sprinter 2018", había una Mercedes Benz Sprinter 2018 disponible
// y el bot contestó que no tenía. La búsqueda comparaba el texto tal cual ("Mercedes-Benz" contra "Mercedes Benz")
// y, si la marca no coincidía, ni probaba con el modelo solo. Ahora no importan mayúsculas, tildes, guiones ni
// espacios, se entienden los errores de tipeo comunes ("renol", "wolsvagen") y el año ordena la búsqueda.

/** Minúsculas, sin tildes y sin nada que no sea letra o número. "Mercedes-Benz" y "MERCEDES BENZ" quedan iguales. */
export function compactar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Formas comunes de nombrar una marca que no se parecen lo suficiente para la cuenta de letras distintas de abajo.
const ALIAS_MARCA: Record<string, string> = {
  vw: "volkswagen",
  volks: "volkswagen",
  wolsvagen: "volkswagen",
  wolswagen: "volkswagen",
  chevy: "chevrolet",
  chevi: "chevrolet",
  mercedes: "mercedesbenz",
  benz: "mercedesbenz",
  mb: "mercedesbenz",
  renol: "renault",
  reno: "renault",
  pegeot: "peugeot",
  peyo: "peugeot",
  mitsu: "mitsubishi",
};

/** Cuántas letras hay que cambiar, agregar o sacar para pasar de un texto al otro. */
export function distancia(a: string, b: string): number {
  const fila = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let anterior = fila[0];
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const guardado = fila[j];
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1));
      anterior = guardado;
    }
  }
  return fila[b.length];
}

// Errores de tipeo que se aceptan según el largo de la palabra: en palabras cortas uno solo ("Fiaf"), en largas dos.
const toleranciaPara = (largo: number) => (largo < 4 ? 0 : largo < 7 ? 1 : 2);

/**
 * Las marcas del stock que corresponden a lo que dijo el cliente, escritas como están cargadas.
 * Vacío si ninguna se parece: así la búsqueda sigue diciendo que esa marca no está.
 */
export function marcasQueCoinciden(pedida: string | null | undefined, marcasStock: string[]): string[] {
  if (!pedida) return [];
  const p = compactar(pedida);
  if (!p) return [];
  const buscada = ALIAS_MARCA[p] ?? p;
  const unicas = Array.from(new Set(marcasStock.filter(Boolean)));
  const iguales = unicas.filter((m) => {
    const c = compactar(m);
    return c === buscada || (buscada.length >= 3 && (c.startsWith(buscada) || buscada.startsWith(c)));
  });
  if (iguales.length) return iguales;
  const tolerancia = toleranciaPara(buscada.length);
  return unicas.filter((m) => distancia(compactar(m), buscada) <= tolerancia);
}

/**
 * Los modelos del stock que corresponden a lo que dijo el cliente. En Stock el modelo trae la ficha entera
 * ("SPRINTER 411 CDI/F 3250 STREET V1"): alcanza con que lo pedido esté adentro, o que la primera palabra se parezca
 * ("hilux" contra "Hi-Lux", "corola" contra "Corolla").
 */
export function modelosQueCoinciden(pedido: string | null | undefined, modelosStock: string[]): string[] {
  if (!pedido) return [];
  const p = compactar(sacarAnio(pedido).texto);
  if (p.length < 2) return [];
  const unicos = Array.from(new Set(modelosStock.filter(Boolean)));
  const contienen = unicos.filter((m) => compactar(m).includes(p));
  if (contienen.length) return contienen;
  const tolerancia = toleranciaPara(p.length);
  if (!tolerancia) return [];
  return unicos.filter((m) => {
    const primera = compactar(m.split(/\s+/)[0] || "");
    return primera.length >= 3 && distancia(primera, p) <= tolerancia;
  });
}

/** Un año de 4 cifras dentro del texto ("la sprinter 2018"), y el texto sin él. */
export function sacarAnio(texto: string): { texto: string; anio: number | null } {
  const anioActual = new Date().getFullYear();
  const m = texto.match(/\b(19[5-9]\d|20\d\d)\b/);
  const anio = m && Number(m[1]) <= anioActual + 1 ? Number(m[1]) : null;
  return { texto: anio ? texto.replace(m![0], " ").replace(/\s+/g, " ").trim() : texto, anio };
}
