// Empresa de quien llama a una ruta del panel (usuario logueado). Las rutas que usan la clave de servicio se envuelven con
// `conEmpresaDeSesion`: si no hay sesión o la empresa está suspendida responde 401 y no corre nada; si hay, todo lo que la
// ruta haga con `supabaseEmpresa` queda atado a la empresa del usuario (ver lib/empresa/db.ts).
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { dentroDeEmpresa } from "@/lib/empresa/db";

export async function clienteDeSesion() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE2_URL!, process.env.NEXT_PUBLIC_SUPABASE2_PUBLISHABLE_KEY!, {
    cookies: { getAll: () => cookieStore.getAll() },
  });
}

/** Empresa del usuario logueado (null si no hay sesión, si el perfil está inactivo o si la empresa está suspendida). */
export async function empresaDeLaSesion(): Promise<string | null> {
  const supabase = await clienteDeSesion();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.rpc("mi_empresa_id");
  return typeof data === "string" ? data : null;
}

export function conEmpresaDeSesion<A extends unknown[]>(manejador: (...args: A) => Promise<Response>): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    const empresaId = await empresaDeLaSesion();
    if (!empresaId) return Response.json({ error: "Sesión inválida o empresa suspendida." }, { status: 401 });
    return dentroDeEmpresa(empresaId, () => manejador(...args));
  };
}
