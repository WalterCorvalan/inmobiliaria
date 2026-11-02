import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/crypto";
import { getInstagramUserProfile } from "@/lib/meta/client";
import { registrarError } from "@/lib/panel/logger";

// Backfill manual (botón en Configuración > Instagram, 25/9): completa el
// @usuario real de los contactos de Instagram que quedaron guardados con
// username null -- leads que llegaron por DM antes del fix que resuelve el
// username en el webhook (ver webhooks/instagram/[token]/route.ts). No es un
// cron, corre bajo demanda porque es un trabajo de una sola vez (los
// contactos NUEVOS ya se resuelven solos desde el webhook).

const supabaseServicio = createClient(
  process.env.NEXT_PUBLIC_SUPABASE2_URL!,
  process.env.SUPABASE2_SERVICE_ROLE_KEY!
);

async function clienteAutenticado() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE2_URL!,
    process.env.NEXT_PUBLIC_SUPABASE2_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: perfil } = await supabase.from("perfiles").select("roles").eq("id", user.id).maybeSingle();
  return perfil?.roles?.some((r: string) => r === "admin" || r === "director") ?? false;
}

export async function POST() {
  const esAdmin = await clienteAutenticado();
  if (!esAdmin) return NextResponse.json({ error: "Solo Admin puede hacer esto." }, { status: 403 });

  const { data: config } = await supabaseServicio.from("instagram_configuracion").select("token_cifrado, token_iv, token_tag").eq("id", true).maybeSingle();
  if (!config?.token_cifrado || !config.token_iv || !config.token_tag) {
    return NextResponse.json({ error: "Instagram no está conectado todavía." }, { status: 400 });
  }
  const tokenPlano = decrypt(config.token_cifrado, config.token_iv, config.token_tag);

  // Tope por corrida para no pegarle una ráfaga enorme a la API de Meta de
  // una sola vez -- si hay más de 200 pendientes, el botón se puede volver a
  // apretar, los ya resueltos no se vuelven a pedir.
  const { data: contactos } = await supabaseServicio.from("instagram_contactos").select("id, ig_user_id").is("username", null).limit(200);
  if (!contactos || contactos.length === 0) return NextResponse.json({ resueltos: 0, pendientes: 0 });

  let resueltos = 0;
  let fallidos = 0;
  for (const contacto of contactos) {
    try {
      const perfil = await getInstagramUserProfile(tokenPlano, contacto.ig_user_id);
      if (perfil.username) {
        await supabaseServicio.from("instagram_contactos").update({ username: perfil.username }).eq("id", contacto.id);
        resueltos++;
      } else {
        fallidos++;
      }
    } catch (err) {
      fallidos++;
      registrarError("api/panel/instagram/backfill-usernames", err, { contactoId: contacto.id, igUserId: contacto.ig_user_id });
    }
  }

  const { count: pendientes } = await supabaseServicio.from("instagram_contactos").select("id", { count: "exact", head: true }).is("username", null);

  return NextResponse.json({ resueltos, fallidos, pendientes: pendientes ?? 0 });
}
