// Propiedades que el bot puede ofrecer. Solo entran las disponibles (las reservadas se nombran como reservadas para que el
// bot no las ofrezca como libres). Función pura: la carga de la base está en lib/ai/agenteV2.ts y la demo pasa las suyas.
import { formatearPrecio, especificaciones, ubicacion, TIPO_LABEL, OPERACION_LABEL, type Propiedad } from "@/lib/propiedades/propiedades";

export type PropiedadParaBot = Pick<Propiedad,
  "codigo" | "titulo" | "tipo" | "operacion" | "estado" | "precio" | "moneda" | "expensas" | "direccion" | "barrio" | "ciudad"
  | "ambientes" | "banos" | "cocheras" | "superficie_total" | "superficie_cubierta" | "descripcion"> & { dormitorios?: number | null };

/** Máximo de propiedades que entran en el prompt: más que esto encarece cada mensaje sin mejorar la respuesta. */
export const MAX_PROPIEDADES_BOT = 60;
const MAX_DESCRIPCION = 160;

const miles = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

/** Una línea por propiedad: "- [A103] Alquiler · Departamento · 2 amb. · 48 m² · Cabildo 2300, Belgrano · $ 780.000/mes + expensas $ 95.000 · ..." */
export function lineaPropiedad(p: PropiedadParaBot): string {
  const precio = formatearPrecio(p);
  const expensas = p.expensas && Number(p.expensas) > 0 ? ` + expensas $ ${miles.format(Number(p.expensas))}` : "";
  const desc = p.descripcion?.trim() ? ` · ${p.descripcion.trim().replace(/\s+/g, " ").slice(0, MAX_DESCRIPCION)}` : "";
  const partes = [
    OPERACION_LABEL[p.operacion],
    TIPO_LABEL[p.tipo],
    ...especificaciones(p),
    ubicacion(p) || null,
    `${precio.monto}${precio.sufijo}${expensas}`,
  ].filter(Boolean);
  const reservada = p.estado === "reservada" ? " (RESERVADA: no la ofrezcas como libre)" : "";
  return `- [${p.codigo || "sin código"}] ${p.titulo}${reservada}: ${partes.join(" · ")}${desc}`;
}

/** Solo disponibles y reservadas, primero las disponibles, con tope. */
export function propiedadesOfrecibles<T extends PropiedadParaBot>(lista: T[]): T[] {
  return lista
    .filter((p) => p.estado === "disponible" || p.estado === "reservada")
    .sort((a, b) => (a.estado === b.estado ? 0 : a.estado === "disponible" ? -1 : 1))
    .slice(0, MAX_PROPIEDADES_BOT);
}

/** Bloque del prompt. Sin propiedades cargadas, vacío: el bot sigue atendiendo como siempre (sin catálogo). */
export function bloquePropiedades(lista: PropiedadParaBot[] | null | undefined): string {
  const ofrecibles = propiedadesOfrecibles(lista ?? []);
  if (ofrecibles.length === 0) return "";
  return `
PROPIEDADES (cartera real cargada por la empresa; es la ÚNICA lista que existe):
${ofrecibles.map(lineaPropiedad).join("\n")}

CÓMO OFRECER PROPIEDADES
- Si preguntan por una propiedad puntual, buscala en la lista (por código, calle, barrio o descripción) y contestá con sus datos tal cual: código, precio y expensas. Si no está o está reservada, decilo.
- Si buscan algo (zona, presupuesto, ambientes, venta o alquiler), ofrecé como mucho 3 que encajen, una por renglón, con *código*, precio y lo más importante. Si falta un dato clave (venta o alquiler, zona o presupuesto), preguntalo antes de listar.
- Si no hay nada que encaje, decilo con honestidad y ofrecé la más parecida (aclarando en qué difiere) o avisarle cuando entre algo. NUNCA inventes una propiedad, un precio ni un dato que no esté en la lista.
- Datos que no figuran (mascotas, apto crédito, orientación, etc.): "eso lo confirmo con el asesor" y seguí.
- Cuando el cliente elige una, completá "propiedad_codigo" con su código exacto.
`;
}
