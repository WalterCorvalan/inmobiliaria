// Formato de WhatsApp en el panel (Walter, 23/11/2026): el bot escribe *negrita* y _cursiva_, que en el teléfono del
// cliente se ven bien, pero el panel mostraba los asteriscos tal cual. Estas funciones parten el texto en pedazos para
// dibujarlos como en WhatsApp (ChatClient.tsx) y limpian las marcas en la vista previa de la lista de charlas.

export type TramoWhatsapp = { texto: string; negrita?: boolean; cursiva?: boolean; tachado?: boolean };

// Mismas reglas que WhatsApp: la marca pegada al texto (sin espacio adentro) y con un espacio, signo o borde afuera.
const MARCA = /(^|[\s(¡¿"'“])([*_~])(?=\S)([^\n]*?\S)\2(?=$|[\s.,;:!?)"'”])/g;

const ESTILO: Record<string, keyof Omit<TramoWhatsapp, "texto">> = { "*": "negrita", _: "cursiva", "~": "tachado" };

/** Parte un mensaje en tramos con su estilo. Un tramo puede ser negrita y cursiva a la vez ("*_así_*"). */
export function tramosWhatsapp(texto: string, base: Omit<TramoWhatsapp, "texto"> = {}): TramoWhatsapp[] {
  const salida: TramoWhatsapp[] = [];
  let desde = 0;
  for (const m of texto.matchAll(MARCA)) {
    const inicio = (m.index ?? 0) + m[1].length;
    if (inicio > desde) salida.push({ ...base, texto: texto.slice(desde, inicio) });
    salida.push(...tramosWhatsapp(m[3], { ...base, [ESTILO[m[2]]]: true }));
    desde = (m.index ?? 0) + m[0].length;
  }
  if (desde < texto.length) salida.push({ ...base, texto: texto.slice(desde) });
  return salida.filter((t) => t.texto);
}

/** El texto sin las marcas, para la vista previa de una línea. */
export function sinMarcasWhatsapp(texto: string): string {
  return tramosWhatsapp(texto).map((t) => t.texto).join("");
}
