import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseEmpresa, empresaActual } from "@/lib/empresa/db";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { encrypt } from "@/lib/crypto";
import { registrarError } from "@/lib/panel/logger";
import { resumenToken } from "@/lib/panel/tokenActual";
import { conEmpresaDeSesion } from "@/lib/empresa/sesion";
import { parcheDeCredenciales, separarSecretos } from "@/lib/empresa/credenciales";

// Mismo patrón que /api/panel/instagram/configuracion, salvo el acceso a la
// tabla (ver clienteConfiguracion).

async function clienteAutenticado() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE2_URL!,
    process.env.NEXT_PUBLIC_SUPABASE2_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, esAdmin: false };
  const { data: perfil } = await supabase.from("perfiles").select("roles").eq("id", user.id).maybeSingle();
  return { supabase, esAdmin: perfil?.roles?.some((r: string) => r === "admin" || r === "director") ?? false };
}

// messenger_configuracion es una sola fila (id = true). En producción la fila
// no existía (el GET devolvía config null, sin URL ni Verify Token para cargar
// en Meta) y, una vez creada, las políticas de la tabla no dejan modificarla
// con la sesión del usuario: "Guardar" respondía OK pero el update tocaba 0
// filas. Por eso, una vez comprobado que quien pide es admin, la tabla se lee
// y escribe con la clave de servicio (igual que el webhook), y la fila se crea
// si falta.
async function clienteConfiguracion() {
  // La fila de la empresa la crea el alta de la empresa; se lee y escribe con la clave de servicio ya atada a ella.
  return supabaseEmpresa;
}

async function GET_() {
  const { esAdmin } = await clienteAutenticado();
  if (!esAdmin) return NextResponse.json({ error: "Solo Admin puede ver esto." }, { status: 403 });
  const supabase = await clienteConfiguracion();

  const columnas = "page_id, listo, verify_token, tono, updated_at, token_cifrado, token_iv, token_tag, app_id, app_secret_cifrado, app_secret_iv, app_secret_tag";
  let { data } = await supabase.from("messenger_configuracion").select(columnas).eq("empresa_id", empresaActual()).maybeSingle();

  if (data && !data.verify_token) {
    const verifyToken = randomBytes(24).toString("hex");
    const { data: actualizado } = await supabase.from("messenger_configuracion").update({ verify_token: verifyToken }).eq("empresa_id", empresaActual())
      .select(columnas).maybeSingle();
    data = actualizado;
  }

  const { config, secretos } = separarSecretos(data || {});
  return NextResponse.json({ config, tokenCargado: resumenToken(data), secretos });
}

async function POST_(request: Request) {
  try {
    const { esAdmin } = await clienteAutenticado();
    if (!esAdmin) return NextResponse.json({ error: "Solo Admin puede modificar esto." }, { status: 403 });
    const supabase = await clienteConfiguracion();

    const body = await request.json();
    const pageId = String(body.pageId || "").trim();
    const accessToken = String(body.accessToken || "").trim();
    const tono = String(body.tono || "").trim();
    const regenerarVerifyToken = !!body.regenerarVerifyToken;

    if (!pageId) return NextResponse.json({ error: "Falta el Page ID." }, { status: 400 });

    const patch: Record<string, unknown> = { page_id: pageId, tono: tono || null, updated_at: new Date().toISOString() };
    Object.assign(patch, parcheDeCredenciales(body, "messenger"));

    if (accessToken) {
      const { cipher, iv, tag } = encrypt(accessToken);
      patch.token_cifrado = cipher;
      patch.token_iv = iv;
      patch.token_tag = tag;
    }

    if (regenerarVerifyToken) {
      patch.verify_token = randomBytes(24).toString("hex");
    }

    const { data: actual } = await supabase.from("messenger_configuracion").select("token_cifrado").eq("empresa_id", empresaActual()).maybeSingle();
    patch.listo = !!(pageId && (accessToken || actual?.token_cifrado));

    // .maybeSingle() en vez de .single() -- este último tira "Cannot coerce
    // the result to a single JSON object" (500) si el update devuelve 0
    // filas (fila inexistente o RLS bloqueando el SELECT posterior al
    // update), en vez de simplemente data=null. Mismo fix ya aplicado en
    // configs/vistas/perfiles (commit b0cd241), faltaba acá.
    const { data, error } = await supabase.from("messenger_configuracion").update(patch).eq("empresa_id", empresaActual()).select("page_id, listo, verify_token, tono, updated_at, token_cifrado, token_iv, token_tag, app_id, app_secret_cifrado, app_secret_iv, app_secret_tag").maybeSingle();
    if (error) throw error;

    const { config, secretos } = separarSecretos(data || {});
    return NextResponse.json({ config, tokenCargado: resumenToken(data), secretos });
  } catch (error) {
    registrarError("api/panel/messenger/configuracion", error);
    return NextResponse.json({ error: "Error interno guardando la configuración." }, { status: 500 });
  }
}

export const GET = conEmpresaDeSesion(GET_);
export const POST = conEmpresaDeSesion(POST_);
