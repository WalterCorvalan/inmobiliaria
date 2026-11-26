// Círculo del cliente en la ficha del lead (Walter, 3/11/2026): foto de perfil si Meta la dio,
// y si no hay (WhatsApp nunca da) o el link se venció, la inicial con un color propio de cada persona.

/** Días que se reusa el link de la foto antes de pedirlo de nuevo a Meta (el link se vence a los pocos días). */
export const DIAS_FOTO_PERFIL = 1;

export function necesitaRefrescarFoto(actualizadaAt: string | null | undefined, ahora: Date = new Date()): boolean {
  if (!actualizadaAt) return true;
  const t = new Date(actualizadaAt).getTime();
  if (Number.isNaN(t)) return true;
  return ahora.getTime() - t >= DIAS_FOTO_PERFIL * 86400000;
}

/** Hasta 2 letras: "Juan Pérez" → "JP", "@juanp" → "JU". Sin nombre real: "?". */
export function inicialesDeLead(nombre: string | null | undefined): string {
  const limpio = (nombre || "").replace(/^@/, "").trim();
  if (!limpio || /^[\d\s+()-]+$/.test(limpio)) return "?";
  const partes = limpio.split(/\s+/);
  return ((partes[0][0] || "") + (partes[1]?.[0] || partes[0][1] || "")).toUpperCase();
}

/** Solo número o sin nombre: no hay inicial que mostrar, se dibuja un ícono de persona. */
export function esNombreSinLetras(nombre: string | null | undefined): boolean {
  return inicialesDeLead(nombre) === "?";
}

// Fondo y letra, con contraste suficiente en claro y oscuro. Misma persona = mismo color siempre.
const COLORES_AVATAR = [
  "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
  "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
  "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200",
  "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200",
  "bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-200",
  "bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-200",
  "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200",
];

export function colorDeAvatar(nombre: string | null | undefined): string {
  const clave = (nombre || "").replace(/^@/, "").trim().toLowerCase();
  let h = 0;
  for (let i = 0; i < clave.length; i++) h = (h * 31 + clave.charCodeAt(i)) >>> 0;
  return COLORES_AVATAR[h % COLORES_AVATAR.length];
}
