// Cuando alguien reacciona con un emoji a una historia nuestra, Instagram lo
// manda como un DM que trae solo el emoji (más reply_to.story). La IA, sin
// contexto, inventaba cosas ("¿qué pasó?, ¿no te gustó?"): se contesta con un
// texto fijo según el tipo de emoji, siempre invitando a ver el stock.

const URL_CATALOGO = "https://www.pfaffencars.com/catalogo";
const EMOJI = /[\p{Extended_Pictographic}\p{Emoji_Modifier}]/u;

const RISA = ["😂", "🤣", "😆", "😄", "😁", "😅", "😹"];
const AGRADO = ["❤", "😍", "🥰", "😘", "💙", "🔥", "👏", "👍", "🙌", "💯", "🤩", "😎", "💪", "👌", "😊"];
const SORPRESA = ["😮", "😲", "🤯", "😱", "😳"];
const DISGUSTO = ["😢", "😭", "😡", "😠", "👎", "😤", "🤢", "😒", "🙄"];

export type TipoReaccion = "risa" | "agrado" | "sorpresa" | "disgusto" | "otra";

export function esSoloEmoji(texto: string | null | undefined): boolean {
  const limpio = (texto ?? "").replace(/[\s‍️]/g, "");
  if (!limpio) return false;
  return [...limpio].every((c) => EMOJI.test(c) || c === "❤");
}

export function tipoDeReaccion(texto: string): TipoReaccion {
  const t = texto.replace(/️/g, "");
  const tiene = (lista: string[]) => lista.some((e) => t.includes(e));
  if (tiene(DISGUSTO)) return "disgusto";
  if (tiene(RISA)) return "risa";
  if (tiene(SORPRESA)) return "sorpresa";
  if (tiene(AGRADO)) return "agrado";
  return "otra";
}

export function respuestaAReaccionHistoria(texto: string): string {
  const cierre = `Si estás buscando auto, mirá todo nuestro stock acá: ${URL_CATALOGO}\nContanos qué modelo te interesa y te asesoramos. 🚗`;
  switch (tipoDeReaccion(texto)) {
    case "risa":
      return `¡Qué bueno que te hizo reír! 😄 Gracias por seguirnos.\n${cierre}`;
    case "agrado":
      return `¡Gracias! Nos alegra que te haya gustado. 🙌\n${cierre}`;
    case "sorpresa":
      return `¡Gracias por mirar nuestra historia! 😮\n${cierre}`;
    case "disgusto":
      return `Lamentamos que no te haya gustado. Si querés contarnos qué esperabas ver, te leemos.\n${cierre}`;
    default:
      return `¡Gracias por ver nuestra historia!\n${cierre}`;
  }
}

// Alguien nos menciona (@) en su propia historia: llega como adjunto
// "story_mention", sin texto. Se agradece y se invita a ver el stock.
export function respuestaAMencionHistoria(): string {
  return `¡Gracias por mencionarnos en tu historia! 🙌\nSi estás buscando auto, mirá todo nuestro stock acá: ${URL_CATALOGO}\nContanos qué modelo te interesa y te asesoramos. 🚗`;
}

// Respuesta de texto a una historia nuestra ("¿cuánto sale ese auto?"): se
// guarda con este prefijo para que la IA sepa que habla de una historia y no
// de un auto que ya estaban viendo en la charla.
export function textoDeRespuestaAHistoria(texto: string): string {
  return `Respondió a tu historia: "${texto.trim()}"`;
}
