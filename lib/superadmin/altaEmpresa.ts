// Alta de una inmobiliaria nueva desde el panel de superadmin (equipo de la plataforma). Validación pura.
import { slugValido } from "@/lib/chatWeb/codigoParaPegar";
import { slugDeNombre } from "@/lib/panel/oficinas";

export type AltaEmpresa = { nombre: string; slug: string; duenoNombre: string; duenoEmail: string };

export function validarAltaEmpresa(f: { nombre?: unknown; slug?: unknown; duenoNombre?: unknown; duenoEmail?: unknown }): { ok: true; datos: AltaEmpresa } | { ok: false; error: string } {
  const nombre = String(f.nombre ?? "").trim();
  const slug = (String(f.slug ?? "").trim() || slugDeNombre(nombre)).toLowerCase();
  const duenoNombre = String(f.duenoNombre ?? "").trim();
  const duenoEmail = String(f.duenoEmail ?? "").trim().toLowerCase();
  if (nombre.length < 2 || nombre.length > 100) return { ok: false, error: "Completá el nombre de la inmobiliaria." };
  if (!slugValido(slug)) return { ok: false, error: "El identificador solo puede tener minúsculas, números y guiones." };
  if (duenoNombre.length < 2) return { ok: false, error: "Completá el nombre del dueño." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(duenoEmail)) return { ok: false, error: "El email del dueño no es válido." };
  return { ok: true, datos: { nombre, slug, duenoNombre, duenoEmail } };
}
