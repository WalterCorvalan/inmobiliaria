import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { encrypt } from "@/lib/crypto";
import { registrarError } from "@/lib/panel/logger";

// Business Login for Instagram: intercambia el "code" de
// /oauth/authorize por un access token real (a diferencia del botón
// "Generar identificador" del dashboard de Meta, que no sirve para el Send
// API -- ver ARCHITECTURE si existe, o el hilo del 24/9 sobre el error
// "Cannot parse access token" código 190). Dos pasos según doc oficial de
// Meta: code -> short-lived token -> long-lived token (60 días).
const INSTAGRAM_APP_ID = "1891064935199738"; // público, mismo que aparece en la URL de /oauth/authorize

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

export async function POST(request: Request) {
  try {
    const { supabase, esAdmin } = await clienteAutenticado();
    if (!esAdmin) return NextResponse.json({ error: "Solo Admin puede hacer esto." }, { status: 403 });

    const { code, redirectUri } = await request.json();
    if (!code || !redirectUri) return NextResponse.json({ error: "Falta el code o el redirectUri." }, { status: 400 });

    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) return NextResponse.json({ error: "META_APP_SECRET no está configurada en el servidor." }, { status: 500 });

    // 1) code -> short-lived token (form-urlencoded, no JSON)
    const form = new URLSearchParams({
      client_id: INSTAGRAM_APP_ID,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    });
    const resCorto = await fetch("https://api.instagram.com/oauth/access_token", { method: "POST", body: form });
    const dataCorto = await resCorto.json().catch(() => ({}));
    if (!resCorto.ok || !dataCorto.access_token) {
      throw new Error(dataCorto?.error_message || dataCorto?.error?.message || `Meta rechazó el code (status ${resCorto.status}).`);
    }
    const igUserId = String(dataCorto.user_id);

    // 2) short-lived -> long-lived (60 días)
    const urlLargo = `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(appSecret)}&access_token=${encodeURIComponent(dataCorto.access_token)}`;
    const resLargo = await fetch(urlLargo);
    const dataLargo = await resLargo.json().catch(() => ({}));
    if (!resLargo.ok || !dataLargo.access_token) {
      throw new Error(dataLargo?.error?.message || `No se pudo canjear el token de larga duración (status ${resLargo.status}).`);
    }

    const { cipher, iv, tag } = encrypt(dataLargo.access_token);
    const { data, error } = await supabase.from("instagram_configuracion").update({
      ig_user_id: igUserId,
      token_cifrado: cipher,
      token_iv: iv,
      token_tag: tag,
      listo: true,
      updated_at: new Date().toISOString(),
    }).eq("id", true).select("ig_user_id, listo, webhook_verify_token, tono, updated_at").single();
    if (error) throw error;

    return NextResponse.json({ config: data, expiresInDias: Math.round((dataLargo.expires_in ?? 0) / 86400) });
  } catch (error) {
    registrarError("api/panel/instagram/oauth-callback", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error intercambiando el code." }, { status: 500 });
  }
}
