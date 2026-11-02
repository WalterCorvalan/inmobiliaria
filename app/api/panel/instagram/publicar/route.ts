import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { decrypt } from "@/lib/crypto";
import { publicarFotosInstagram } from "@/lib/meta/client";
import { puedePublicarEnInstagram, revisarPublicacion, MAX_CARACTERES_INSTAGRAM, MAX_FOTOS_INSTAGRAM } from "@/lib/panel/publicacionInstagram";
import { registrarError } from "@/lib/panel/logger";
import { rateLimit, ipDesdeRequest } from "@/lib/rateLimit";

// Publica un auto en el feed de Instagram desde la ficha (Stock → ficha → Marketing), 26/10/2026. Usa la cuenta
// conectada en Configuración → Instagram (instagram_configuracion, el mismo token que los mensajes). Una foto sale
// como publicación común; varias, como carrusel. Las reglas (quién puede, qué fotos, largo del texto) están en
// lib/panel/publicacionInstagram.ts.

// Un carrusel de 10 fotos espera a que Instagram procese cada una: puede pasar los 10 segundos.
export const maxDuration = 60;

const Schema = z.object({
  vehiculoId: z.string().uuid(),
  fotos: z.array(z.string().url()).min(1).max(MAX_FOTOS_INSTAGRAM),
  texto: z.string().trim().min(1).max(MAX_CARACTERES_INSTAGRAM),
});

const supabaseAdmin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE2_URL!, process.env.SUPABASE2_SERVICE_ROLE_KEY!);

export async function POST(request: Request) {
  const limite = await rateLimit(ipDesdeRequest(request), { limite: 5, ventanaMs: 60 * 1000, proyecto: "v2" });
  if (!limite.ok) return NextResponse.json({ error: "Demasiadas publicaciones seguidas. Esperá un momento." }, { status: 429 });

  const cookieStore = await cookies();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE2_URL!, process.env.NEXT_PUBLIC_SUPABASE2_PUBLISHABLE_KEY!, {
    cookies: { getAll: () => cookieStore.getAll() },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { data: perfil } = await supabase.from("perfiles").select("roles").eq("id", user.id).maybeSingle();
  if (!puedePublicarEnInstagram(perfil?.roles)) {
    return NextResponse.json({ error: "Solo admin, director o encargado pueden publicar en Instagram." }, { status: 403 });
  }

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Faltan las fotos o el texto." }, { status: 400 });
  const { vehiculoId, fotos, texto } = parsed.data;

  const admin = supabaseAdmin();
  const { data: vehiculo } = await admin.from("vehiculos").select("fotos").eq("id", vehiculoId).maybeSingle();
  if (!vehiculo) return NextResponse.json({ error: "No se encontró el auto." }, { status: 404 });
  const problema = revisarPublicacion(fotos, (vehiculo.fotos as string[] | null) ?? [], texto);
  if (problema) return NextResponse.json({ error: problema }, { status: 400 });

  const { data: config } = await admin.from("instagram_configuracion").select("ig_user_id, token_cifrado, token_iv, token_tag, listo").eq("id", true).maybeSingle();
  if (!config?.listo || !config.ig_user_id || !config.token_cifrado || !config.token_iv || !config.token_tag) {
    return NextResponse.json({ error: "Instagram no está conectado. Conectalo en Configuración → Instagram." }, { status: 409 });
  }

  try {
    const token = decrypt(config.token_cifrado, config.token_iv, config.token_tag);
    const publicado = await publicarFotosInstagram(config.ig_user_id, token, fotos, texto);
    return NextResponse.json({ ok: true, permalink: publicado.permalink });
  } catch (err) {
    await registrarError("instagram:publicar", err, { vehiculoId, fotos: fotos.length });
    const mensaje = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: `Instagram no aceptó la publicación: ${mensaje}` }, { status: 502 });
  }
}
