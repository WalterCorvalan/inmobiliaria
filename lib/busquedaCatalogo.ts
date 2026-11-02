// Armado del filtro del buscador público (header, Hero, /catalogo, las
// sugerencias y /api/buscar-ia). Antes cada lugar pegaba el texto entero
// adentro de un `.or("marca.ilike.%texto%,...")`, con estos problemas:
//  - "Toyota Corolla" nunca coincidía: ninguna columna guarda ese texto entero
//    (la marca está en una y el modelo en otra).
//  - Una coma, un paréntesis o un % en el texto rompían el filtro de PostgREST
//    (error 400): la búsqueda quedaba sin respuesta, sin aviso.
//  - "camioneta" no encontraba nada: el tipo de vehículo se carga en Stock en
//    `categoria` ("Pickup/Camioneta", "SUV"...) y esa columna no se buscaba.
//    Tampoco se entendían "diesel", "automática" ni "4x4".
// Ahora se busca palabra por palabra (todas tienen que aparecer, cada una en
// alguna de las columnas), se limpian los caracteres propios de la sintaxis y
// se entienden sinónimos y acentos.

export const COLUMNAS_BUSQUEDA = [
  "marca",
  "modelo",
  "version",
  "categoria",
  "carroceria",
  "segmento",
  "tipo",
  "combustible",
  "transmision",
  "traccion",
] as const;

const MAX_PALABRAS = 6;

export function palabrasDeBusqueda(texto: string): string[] {
  return (
    texto
      // "pick up", "pick-up" y "pickup" son lo mismo; igual "todo terreno".
      .replace(/pick[\s-]+up/gi, "pickup")
      .replace(/todo[\s-]+terreno/gi, "todoterreno")
      .replace(/[,()%*_\\"':;]/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, MAX_PALABRAS)
  );
}

// Lo que la gente escribe sin tilde pero se guarda con tilde en Stock. En un
// ilike, `_` reemplaza justo una letra, así que "di_sel" encuentra "Diésel" y
// "Diesel".
const CON_TILDE: Record<string, string> = {
  diesel: "di_sel",
  hibrido: "h_brido",
  electrico: "el_ctrico",
  automatica: "autom_tica",
  automatico: "autom_tico",
  camion: "cam_on",
  omnibus: "_mnibus",
  sedan: "sed_n",
  coupe: "coup_",
  furgon: "furg_n",
};

// Palabras que la gente usa para un tipo de vehículo y qué valores de Stock
// (categoria / segmento) les corresponden. "Camioneta" se usa para pickups y
// SUV; "pickup" no incluye SUV.
const SINONIMOS: Record<string, string[]> = {
  camioneta: ["camioneta", "pickup", "pick-up", "suv"],
  pickup: ["pickup", "pick-up", "camioneta"],
  suv: ["suv", "todo terreno"],
  todoterreno: ["todo terreno", "suv"],
  sedan: ["sedan", "auto"],
  hatchback: ["hatchback", "auto"],
  utilitario: ["utilitario", "furgon", "van"],
  furgon: ["furgon", "utilitario"],
  // En Stock el combustible de los diésel suele estar cargado como "Gasoil" (el filtro ya lo tenía en cuenta,
  // COMBUSTIBLE_A_VALORES): sin esto, buscar "diesel" daba 0 resultados.
  diesel: ["diesel", "gasoil"],
  gasoil: ["gasoil", "di_sel"],
};

// Palabras que el buscador entiende aunque no sean marca ni modelo (Marketing → Búsquedas web las usa para saber si
// una búsqueda sin resultado "se entendió"): tipos, combustibles, cajas y tracciones.
const OTRAS_PALABRAS_DE_TIPO = ["auto", "autos", "usado", "usados", "0km", "nafta", "gnc", "manual", "4x4", "4x2", "awd", "electrico", "hibrido", "automatica", "automatico", "diesel", "gasoil", "familiar", "chico", "grande"];
export function esPalabraDeTipo(palabra: string): boolean {
  const p = palabra.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const raiz = p.length > 4 && p.endsWith("s") ? p.slice(0, -1) : p;
  return [p, raiz].some((x) => x in SINONIMOS || x in CON_TILDE || OTRAS_PALABRAS_DE_TIPO.includes(x));
}

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");

// Plural simple: "camionetas" -> "camioneta", "autos" -> "auto".
const singular = (t: string) => (t.length > 4 && t.endsWith("s") ? t.slice(0, -1) : t);

// Todas las formas con las que se busca una palabra (sin repetir).
export function terminosDePalabra(palabra: string): string[] {
  const minuscula = palabra.toLowerCase();
  const base = sinTildes(minuscula);
  const raiz = singular(base);
  const terminos = new Set<string>();

  for (const clave of [base, raiz]) {
    for (const s of SINONIMOS[clave] ?? []) terminos.add(s);
  }
  // Si escribió una tilde ("diésel"), esa letra queda como comodín: encuentra
  // tanto "Diésel" como "Diesel".
  terminos.add(minuscula !== base ? minuscula.replace(/[áéíóúüëï]/g, "_") : raiz);
  terminos.add(CON_TILDE[raiz] ?? raiz);
  if (raiz !== base) terminos.add(base);
  return [...terminos];
}

// Condición para un `.or()` de PostgREST: la palabra (o un sinónimo) en alguna
// de las columnas. Varias llamadas a `.or()` se combinan con AND.
export function filtroOrPorPalabra(palabra: string, columnas: readonly string[] = COLUMNAS_BUSQUEDA): string {
  const condiciones: string[] = [];
  for (const termino of terminosDePalabra(palabra)) {
    for (const c of columnas) condiciones.push(`${c}.ilike.%${termino}%`);
  }
  return condiciones.join(",");
}

// Texto libre que va dentro de un `.or("nombre.ilike.%texto%,...")` (buscadores
// del panel: clientes, vehículos, leads). La coma y los paréntesis son sintaxis
// propia de PostgREST: un nombre como "Pérez, Juan" o un teléfono "(11) 5555"
// rompían el filtro y la búsqueda no devolvía nada, sin ningún aviso.
export function limpiarParaFiltro(texto: string): string {
  return texto.replace(/[,()%*_\\"':;]/g, " ").replace(/\s+/g, " ").trim();
}

// Filtros del catálogo: qué valores guarda Stock para cada opción. Las opciones
// de la pantalla se escribían a mano y no coincidían con lo cargado
// ("Diesel" contra "Diésel", "Integral (AWD)" contra "AWD"): al elegirlas el
// catálogo quedaba vacío.
export const COMBUSTIBLE_A_VALORES: Record<string, string[]> = {
  Nafta: ["Nafta"],
  Diésel: ["Diésel", "Diesel", "Gasoil"],
  Diesel: ["Diésel", "Diesel", "Gasoil"],
  Eléctrico: ["Eléctrico"],
  GNC: ["GNC"],
  Híbrido: ["Híbrido"],
};

export const TRACCION_A_VALORES: Record<string, string[]> = {
  "4x2": ["4x2", "Delantera", "Trasera"],
  "4x4": ["4x4"],
  AWD: ["AWD", "Integral (AWD)"],
};

export const valoresDe = (mapa: Record<string, string[]>, elegidos: string[]) =>
  elegidos.flatMap((e) => mapa[e] ?? [e]);

// Tipo de vehículo del catálogo -> condición de `.or()` sobre categoria y
// carroceria (Stock carga las dos; la carrocería es opcional, así que un
// "Auto" sin carrocería aparece como sedán y como hatchback: no se puede
// distinguir).
const TIPO_A_CONDICIONES: Record<string, string[]> = {
  SUV: ["categoria.eq.SUV", "carroceria.eq.SUV"],
  Pickup: ["categoria.eq.Pickup/Camioneta", "categoria.eq.Camioneta", "carroceria.eq.Pick-Up"],
  Utilitarios: ["categoria.eq.Utilitario", "carroceria.eq.Furgón"],
  Auto: ["categoria.eq.Auto"],
  Sedán: ["carroceria.eq.Sedán", "and(categoria.eq.Auto,carroceria.is.null)"],
  Hatchback: ["carroceria.eq.Hatchback", "and(categoria.eq.Auto,carroceria.is.null)"],
};

export function filtroTipoVehiculo(tipos: string[]): string | null {
  const condiciones = new Set<string>();
  for (const t of tipos) for (const c of TIPO_A_CONDICIONES[t] ?? [`categoria.eq.${limpiarParaFiltro(t)}`]) condiciones.add(c);
  return condiciones.size ? [...condiciones].join(",") : null;
}
