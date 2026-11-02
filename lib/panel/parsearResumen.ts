// Lee el texto de una alerta de resumen (informe de marketing, resumen diario, semanal...) y lo separa en secciones
// para mostrarlo ordenado (components/panel/ResumenAlertaModal.tsx y la lista de Alertas). El texto lo arman los
// crons siempre igual: una línea por dato, "EMOJI Título: valor", y debajo de algunas ("💡 Sugerencias:") renglones
// que empiezan con "• ". No cambia lo que dice el informe, solo cómo se lee (pedido de Walter del 16/10/2026).

export interface ItemResumen {
  titulo: string | null;
  texto: string;
}

export interface SeccionResumen {
  emoji: string;
  titulo: string | null;
  /** El dato principal ("32 (+88% vs la semana anterior)"). Vacío si la sección es solo una lista. */
  principal: string;
  /** Partes separadas por " · " ("Instagram 15", "WhatsApp 13"). */
  chips: string[];
  /** Lo que sigue al dato principal después de un punto ("Sin resultados: …"). */
  detalle: string | null;
  /** Renglones "• …" que van debajo (sugerencias, qué revisar afuera). */
  items: ItemResumen[];
}

function separarTitulo(texto: string): { titulo: string | null; resto: string } {
  const i = texto.indexOf(":");
  if (i <= 0) return { titulo: null, resto: texto };
  return { titulo: texto.slice(0, i).trim(), resto: texto.slice(i + 1).trim() };
}

export function parsearResumen(mensaje: string): SeccionResumen[] {
  const secciones: SeccionResumen[] = [];
  for (const cruda of mensaje.split("\n")) {
    const linea = cruda.trim();
    if (!linea) continue;

    if (linea.startsWith("•")) {
      const { titulo, resto } = separarTitulo(linea.replace(/^•\s*/, ""));
      const item = { titulo: resto ? titulo : null, texto: resto || linea.replace(/^•\s*/, "") };
      if (secciones.length > 0) secciones[secciones.length - 1].items.push(item);
      else secciones.push({ emoji: "•", titulo: null, principal: "", chips: [], detalle: null, items: [item] });
      continue;
    }

    const espacio = linea.indexOf(" ");
    const tieneEmoji = espacio > 0 && !/^[\p{L}\p{N}]/u.test(linea);
    const emoji = tieneEmoji ? linea.slice(0, espacio) : "•";
    const texto = tieneEmoji ? linea.slice(espacio + 1) : linea;
    const { titulo, resto } = separarTitulo(texto);
    const cuerpo = titulo === null ? texto : resto;

    const punto = cuerpo.indexOf(". ");
    let principal = punto >= 0 ? cuerpo.slice(0, punto) : cuerpo;
    let detalle: string | null = punto >= 0 ? cuerpo.slice(punto + 2).trim() : null;
    let chips: string[] = [];
    if (principal.includes(" · ")) {
      chips = principal.split(" · ").map((x) => x.trim()).filter(Boolean);
      principal = "";
    } else if (detalle && detalle.includes(" · ")) {
      chips = detalle.split(" · ").map((x) => x.trim()).filter(Boolean);
      detalle = null;
    }
    secciones.push({ emoji, titulo, principal: principal.trim(), chips, detalle: detalle || null, items: [] });
  }
  return secciones;
}

/** Versión corta para la lista de alertas: un renglón por dato, sin las listas de sugerencias. */
export function renglonesCortos(secciones: SeccionResumen[], max = 4): { renglones: string[]; restantes: number } {
  const datos = secciones.filter((s) => s.items.length === 0);
  const renglones = datos.slice(0, max).map((s) => {
    const valor = s.principal || s.chips.slice(0, 3).join(" · ");
    return `${s.emoji} ${s.titulo ? `${s.titulo}: ` : ""}${valor}`;
  });
  return { renglones, restantes: secciones.length - renglones.length };
}
