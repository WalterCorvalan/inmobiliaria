// Filtro de mensajes salientes que un vendedor tipea a mano desde el panel
// (WhatsApp/Instagram) -- a diferencia del bot (que sigue un prompt), acá no
// hay ningún control sobre lo que un vendedor escribe en caliente. Bloquea
// insultos/lenguaje sexista antes de guardarlo y mandarlo por la API real,
// para que un mensaje así nunca le llegue a un cliente ni quede en el
// historial de WhatsApp Business.

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // saca acentos
}

const PALABRAS_PROHIBIDAS = [
  "boludo", "boluda", "pelotudo", "pelotuda", "forro", "forra", "gil", "gila",
  "estupido", "estupida", "imbecil", "idiota", "inutil", "sorete", "pajero",
  "hijo de puta", "hija de puta", "hdp", "conchudo", "conchuda", "la concha",
  "andate a la mierda", "andate a cagar", "sos un pelotudo", "sos una pelotuda",
  "puto de mierda", "puta de mierda", "negro de mierda", "negra de mierda",
];

// Comentarios sexistas/discriminatorios que no usan una mala palabra puntual
// -- capturados por frase, no por palabra suelta, para no bloquear mensajes
// legítimos (ej: "pollera" o "mujer" solos son inocentes).
const FRASES_PROHIBIDAS = [
  /pregunt\w*\s+(a\s+)?(su|tu)\s+(mujer|esposa|se[ñn]ora|marido|esposo)/,
  /necesita\w*\s+(una\s+)?pollera/,
  /(necesita|le falta)\w*\s+(ser\s+)?(m[áa]s\s+)?hombre/,
  /no\s+es\s+(un\s+)?hombre/,
  /vuelv\w+\s+(a\s+)?la\s+cocina/,
];

export function contieneLenguajeInapropiado(texto: string): { bloqueado: boolean; motivo?: string } {
  const t = normalizar(texto);
  for (const palabra of PALABRAS_PROHIBIDAS) {
    if (t.includes(normalizar(palabra))) {
      return { bloqueado: true, motivo: "El mensaje contiene lenguaje ofensivo." };
    }
  }
  for (const frase of FRASES_PROHIBIDAS) {
    if (frase.test(t)) {
      return { bloqueado: true, motivo: "El mensaje contiene un comentario inapropiado/discriminatorio." };
    }
  }
  return { bloqueado: false };
}
