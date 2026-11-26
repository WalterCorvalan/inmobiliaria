// Código que cada inmobiliaria pega en su web para tener el chat (una línea antes de </body>).
// El script (public/chat-web.js) dibuja el botón flotante y abre /chat/<empresa> en un iframe.

/** Identificador público de una empresa: minúsculas, números y guiones (como empresas.slug). */
export function slugValido(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 80;
}

/** "https://crm.ejemplo.com/" → "https://crm.ejemplo.com". */
export function origenLimpio(origen: string): string {
  return origen.trim().replace(/\/+$/, "");
}

export function codigoParaPegar(o: { origen: string; empresa: string; color?: string | null }): string {
  if (!slugValido(o.empresa)) throw new Error("Identificador de empresa inválido");
  const color = o.color && /^#[0-9A-Fa-f]{6}$/.test(o.color) ? ` data-color="${o.color}"` : "";
  return `<script src="${origenLimpio(o.origen)}/chat-web.js" data-empresa="${o.empresa}"${color} defer></script>`;
}
