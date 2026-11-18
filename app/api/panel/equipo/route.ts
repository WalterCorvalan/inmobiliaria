import { NextResponse } from "next/server";
import { clienteServicio, supabaseEmpresa, empresaActual } from "@/lib/empresa/db";
import { clienteDeSesion, conEmpresaDeSesion } from "@/lib/empresa/sesion";
import { claveTemporal, validarAlta } from "@/lib/panel/equipo";
import { registrarError } from "@/lib/panel/logger";

// Alta de una persona del equipo. Solo el dueño. Crea el usuario de acceso (mail + clave temporal) y su perfil en la
// empresa del dueño. La clave se devuelve UNA vez para que el dueño se la pase; no se guarda en ningún lado.
export const POST = conEmpresaDeSesion(async (req: Request) => {
  const sesion = await clienteDeSesion();
  const { data: esDueno } = await sesion.rpc("soy_dueno");
  if (esDueno !== true) return NextResponse.json({ error: "Solo el dueño puede sumar personas al equipo." }, { status: 403 });

  const v = validarAlta(await req.json().catch(() => null));
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const { nombre, email, rol, sucursal_id, whatsapp } = v.datos;

  if (sucursal_id) {
    const { data: suc } = await supabaseEmpresa.from("sucursales").select("id").eq("id", sucursal_id).maybeSingle();
    if (!suc) return NextResponse.json({ error: "Esa oficina no existe." }, { status: 400 });
  }

  const clave = claveTemporal();
  const admin = clienteServicio().auth.admin;
  const { data: creado, error: errUsuario } = await admin.createUser({ email, password: clave, email_confirm: true, user_metadata: { nombre } });
  if (errUsuario || !creado.user) {
    const repetido = /already|registered|exists/i.test(errUsuario?.message ?? "");
    if (!repetido) registrarError("api/panel/equipo:crear-usuario", errUsuario, { empresa: empresaActual() });
    return NextResponse.json({ error: repetido ? "Ese email ya tiene una cuenta (un email = una empresa)." : "No se pudo crear el usuario." }, { status: repetido ? 409 : 500 });
  }

  const { data: perfil, error: errPerfil } = await supabaseEmpresa.from("perfiles")
    .insert({ id: creado.user.id, nombre, roles: [rol], sucursal_id, whatsapp, activo: true })
    .select("id, nombre, roles, sucursal_id, whatsapp, activo").single();
  if (errPerfil) {
    // Sin perfil el usuario no sirve: se borra para que el dueño pueda reintentar con el mismo email.
    await admin.deleteUser(creado.user.id).catch(() => {});
    registrarError("api/panel/equipo:crear-perfil", errPerfil, { empresa: empresaActual() });
    return NextResponse.json({ error: "No se pudo crear el perfil." }, { status: 500 });
  }
  return NextResponse.json({ perfil: { ...perfil, email }, claveTemporal: clave });
});
