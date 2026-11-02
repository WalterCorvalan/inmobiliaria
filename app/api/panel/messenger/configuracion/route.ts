import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { encrypt } from "@/lib/crypto";
import { registrarError } from "@/lib/panel/logger";
import { resumenToken } from "@/lib/panel/tokenActual";

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
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE2_URL!, process.env.SUPABASE2_SERVICE_ROLE_KEY!);
  const { error } = await admin.from("messenger_configuracion").upsert({ id: true }, { onConflict: "id", ignoreDuplicates: true });
  if (error) registrarError("api/panel/messenger/configuracion:crear-fila", error);
  return admin;
}

export async function GET() {
  const { esAdmin } = await clienteAutenticado();
  if (!esAdmin) return NextResponse.json({ error: "Solo Admin puede ver esto." }, { status: 403 });
  const supabase = await clienteConfiguracion();

  const columnas = "page_id, listo, verify_token, tono, updated_at, token_cifrado, token_iv, token_tag";
  let { data } = await supabase.from("messenger_configuracion").select(columnas).eq("id", true).maybeSingle();

  if (data && !data.verify_token) {
    const verifyToken = randomBytes(24).toString("hex");
    const { data: actualizado } = await supabase.from("messenger_configuracion").update({ verify_token: verifyToken }).eq("id", true)
      .select(columnas).maybeSingle();
    data = actualizado;
  }

  const { token_cifrado, token_iv, token_tag, ...config } = data || {};
  return NextResponse.json({ config: data ? config : data, tokenCargado: resumenToken(data) });
}

export async function POST(request: Request) {
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

    if (accessToken) {
      const { cipher, iv, tag } = encrypt(accessToken);
      patch.token_cifrado = cipher;
      patch.token_iv = iv;
      patch.token_tag = tag;
    }

    if (regenerarVerifyToken) {
      patch.verify_token = randomBytes(24).toString("hex");
    }

    const { data: actual } = await supabase.from("messenger_configuracion").select("token_cifrado").eq("id", true).maybeSingle();
    patch.listo = !!(pageId && (accessToken || actual?.token_cifrado));

    // .maybeSingle() en vez de .single() -- este último tira "Cannot coerce
    // the result to a single JSON object" (500) si el update devuelve 0
    // filas (fila inexistente o RLS bloqueando el SELECT posterior al
    // update), en vez de simplemente data=null. Mismo fix ya aplicado en
    // configs/vistas/perfiles (commit b0cd241), faltaba acá.
    const { data, error } = await supabase.from("messenger_configuracion").update(patch).eq("id", true).select("page_id, listo, verify_token, tono, updated_at, token_cifrado, token_iv, token_tag").maybeSingle();
    if (error) throw error;

    const { token_cifrado, token_iv, token_tag, ...config } = data || {};
    return NextResponse.json({ config: data ? config : data, tokenCargado: resumenToken(data) });
  } catch (error) {
    registrarError("api/panel/messenger/configuracion", error);
    return NextResponse.json({ error: "Error interno guardando la configuración." }, { status: 500 });
  }
}
