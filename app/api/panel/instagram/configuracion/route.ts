import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { encrypt } from "@/lib/crypto";
import { registrarError } from "@/lib/panel/logger";
import { resumenToken } from "@/lib/panel/tokenActual";

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

export async function GET() {
  const { supabase, esAdmin } = await clienteAutenticado();
  if (!esAdmin) return NextResponse.json({ error: "Solo Admin puede ver esto." }, { status: 403 });

  const columnas = "ig_user_id, listo, webhook_verify_token, tono, updated_at, token_cifrado, token_iv, token_tag";
  let { data } = await supabase.from("instagram_configuracion").select(columnas).eq("id", true).maybeSingle();

  if (data && !data.webhook_verify_token) {
    const verifyToken = randomBytes(24).toString("hex");
    const { data: actualizado } = await supabase.from("instagram_configuracion").update({ webhook_verify_token: verifyToken }).eq("id", true)
      .select(columnas).maybeSingle();
    data = actualizado;
  }

  const { token_cifrado, token_iv, token_tag, ...config } = data || {};
  return NextResponse.json({ config: data ? config : data, tokenCargado: resumenToken(data) });
}

export async function POST(request: Request) {
  try {
    const { supabase, esAdmin } = await clienteAutenticado();
    if (!esAdmin) return NextResponse.json({ error: "Solo Admin puede modificar esto." }, { status: 403 });

    const body = await request.json();
    const igUserId = String(body.igUserId || "").trim();
    const accessToken = String(body.accessToken || "").trim();
    const tono = String(body.tono || "").trim();
    const regenerarVerifyToken = !!body.regenerarVerifyToken;

    if (!igUserId) return NextResponse.json({ error: "Falta el Instagram User ID (ig_user_id)." }, { status: 400 });

    const patch: Record<string, unknown> = { ig_user_id: igUserId, tono: tono || null, updated_at: new Date().toISOString() };

    if (accessToken) {
      const { cipher, iv, tag } = encrypt(accessToken);
      patch.token_cifrado = cipher;
      patch.token_iv = iv;
      patch.token_tag = tag;
    }

    if (regenerarVerifyToken) {
      patch.webhook_verify_token = randomBytes(24).toString("hex");
    }

    const { data: actual } = await supabase.from("instagram_configuracion").select("token_cifrado").eq("id", true).maybeSingle();
    patch.listo = !!(igUserId && (accessToken || actual?.token_cifrado));

    // .maybeSingle() -- .single() tira 500 ("Cannot coerce the result to a
    // single JSON object") si el update no devuelve fila, mismo fix que
    // messenger/configuracion y configs/vistas/perfiles (commit b0cd241).
    const { data, error } = await supabase.from("instagram_configuracion").update(patch).eq("id", true).select("ig_user_id, listo, webhook_verify_token, tono, updated_at, token_cifrado, token_iv, token_tag").maybeSingle();
    if (error) throw error;

    const { token_cifrado, token_iv, token_tag, ...config } = data || {};
    return NextResponse.json({ config: data ? config : data, tokenCargado: resumenToken(data) });
  } catch (error) {
    registrarError("api/panel/instagram/configuracion", error);
    return NextResponse.json({ error: "Error interno guardando la configuración." }, { status: 500 });
  }
}
