"use server";

import { revalidatePath } from "next/cache";
import { clienteServicio } from "@/lib/empresa/db";
import { clienteDeSesion } from "@/lib/empresa/sesion";
import { validarAltaEmpresa } from "@/lib/superadmin/altaEmpresa";
import { claveTemporal } from "@/lib/panel/equipo";
import { memoriaInicial } from "@/lib/panel/memoriaInicial";

// Acciones del panel de superadmin. Cada una vuelve a comprobar que quien llama está en la tabla superadmins.
async function exigirSuperadmin(): Promise<string> {
  const sesion = await clienteDeSesion();
  const { data: { user } } = await sesion.auth.getUser();
  if (!user) throw new Error("Sin sesión.");
  const { data } = await clienteServicio().from("superadmins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!data) throw new Error("Solo el equipo de la plataforma.");
  return user.id;
}

export type ResultadoAlta = { ok: true; email: string; clave: string; slug: string } | { ok: false; error: string };

/** Crea la empresa, su configuración, la memoria inicial del bot y el usuario del dueño (clave temporal que se muestra una vez). */
export async function crearEmpresa(_previo: ResultadoAlta | null, form: FormData): Promise<ResultadoAlta> {
  try { await exigirSuperadmin(); } catch (e) { return { ok: false, error: (e as Error).message }; }
  const v = validarAltaEmpresa({ nombre: form.get("nombre"), slug: form.get("slug"), duenoNombre: form.get("duenoNombre"), duenoEmail: form.get("duenoEmail") });
  if (!v.ok) return v;
  const { nombre, slug, duenoNombre, duenoEmail } = v.datos;
  const db = clienteServicio();

  const { data: empresa, error: errEmpresa } = await db.from("empresas").insert({ nombre, slug }).select("id").single();
  if (errEmpresa) return { ok: false, error: /duplicate/i.test(errEmpresa.message) ? "Ya existe una empresa con ese identificador." : errEmpresa.message };

  const deshacer = async (userId?: string) => {
    if (userId) await db.auth.admin.deleteUser(userId).catch(() => {});
    await db.from("empresas").delete().eq("id", empresa.id);
  };

  const clave = claveTemporal();
  const { data: creado, error: errUsuario } = await db.auth.admin.createUser({ email: duenoEmail, password: clave, email_confirm: true, user_metadata: { nombre: duenoNombre } });
  if (errUsuario || !creado.user) { await deshacer(); return { ok: false, error: /already|registered|exists/i.test(errUsuario?.message ?? "") ? "Ese email ya tiene cuenta (un email = una empresa)." : "No se pudo crear el usuario del dueño." }; }

  const pasos = await Promise.all([
    db.from("perfiles").insert({ id: creado.user.id, empresa_id: empresa.id, nombre: duenoNombre, roles: ["admin"], activo: true }),
    db.from("configuracion_empresa").insert({ empresa_id: empresa.id, branding_nombre: nombre }),
    db.from("whatsapp_memoria").insert(memoriaInicial(nombre).map((f, i) => ({ ...f, orden: i, empresa_id: empresa.id }))),
  ]);
  const fallo = pasos.find((p) => p.error);
  if (fallo?.error) { await deshacer(creado.user.id); return { ok: false, error: `No se pudo terminar el alta: ${fallo.error.message}` }; }

  revalidatePath("/superadmin");
  return { ok: true, email: duenoEmail, clave, slug };
}

export async function cambiarEstadoEmpresa(form: FormData): Promise<void> {
  await exigirSuperadmin();
  const id = String(form.get("id") ?? "");
  const estado = form.get("estado") === "suspendida" ? "suspendida" : "activa";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await clienteServicio().from("empresas").update({ estado }).eq("id", id);
  revalidatePath("/superadmin");
}
