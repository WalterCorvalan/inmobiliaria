// Alta de personas del equipo (dueño, encargado, asesor). Validación pura: la usa la ruta app/api/panel/equipo.
import { randomInt } from "node:crypto";

export const ROLES_EQUIPO = ["admin", "encargado", "ventas"] as const;
export type RolEquipo = (typeof ROLES_EQUIPO)[number];
export const ROL_LABEL: Record<RolEquipo, string> = { admin: "Dueño", encargado: "Encargado", ventas: "Asesor" };

export type AltaEquipo = { nombre: string; email: string; rol: RolEquipo; sucursal_id: string | null; whatsapp: string | null };

export function validarAlta(cuerpo: unknown): { ok: true; datos: AltaEquipo } | { ok: false; error: string } {
  const c = (cuerpo ?? {}) as Record<string, unknown>;
  const nombre = typeof c.nombre === "string" ? c.nombre.trim() : "";
  const email = typeof c.email === "string" ? c.email.trim().toLowerCase() : "";
  const rol = c.rol as RolEquipo;
  if (nombre.length < 2 || nombre.length > 80) return { ok: false, error: "Completá el nombre." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return { ok: false, error: "El email no es válido." };
  if (!ROLES_EQUIPO.includes(rol)) return { ok: false, error: "Elegí el rol." };
  const sucursal_id = typeof c.sucursal_id === "string" && /^[0-9a-f-]{36}$/i.test(c.sucursal_id) ? c.sucursal_id : null;
  const whatsapp = typeof c.whatsapp === "string" && c.whatsapp.trim() ? c.whatsapp.trim().slice(0, 30) : null;
  return { ok: true, datos: { nombre, email, rol, sucursal_id, whatsapp } };
}

/** Clave temporal fácil de dictar (sin 0/O ni 1/l): el dueño se la pasa a la persona y ella la cambia al entrar. */
export function claveTemporal(largo = 10): string {
  const letras = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < largo; i++) s += letras[randomInt(letras.length)];
  return s;
}
