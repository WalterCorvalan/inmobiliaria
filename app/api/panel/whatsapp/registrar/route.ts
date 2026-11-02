import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { getPhoneNumberStatus, registerPhoneNumber, MetaApiError } from "@/lib/meta/client";
import { traducirErrorMeta } from "@/lib/meta/erroresWhatsapp";
import { registrarError } from "@/lib/panel/logger";
import { decrypt } from "@/lib/crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE2_URL!,
  process.env.SUPABASE2_SERVICE_ROLE_KEY!
);

const BodySchema = z.object({ pin: z.string().regex(/^\d{6}$/, "El PIN son 6 números.") });

// Conecta el número de WhatsApp a la Cloud API (estado DISCONNECTED -> CONNECTED) con el token ya guardado, sin
// tener que usar la consola de Meta. Solo admin: es el número de producción. El token nunca sale en la respuesta.
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE2_URL!,
    process.env.NEXT_PUBLIC_SUPABASE2_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { data: perfil } = await supabase.from("perfiles").select("roles").eq("id", user.id).single();
  if (!perfil?.roles?.some((r: string) => r === "admin" || r === "director")) return NextResponse.json({ error: "Solo administradores." }, { status: 403 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });

  const { data: config } = await supabaseAdmin.from("whatsapp_configuracion").select("*").eq("id", true).maybeSingle();
  if (!config?.listo || !config.token_cifrado || !config.phone_number_id) {
    return NextResponse.json({ error: "Faltan credenciales cargadas en Configuración → WhatsApp." }, { status: 400 });
  }

  try {
    const token = decrypt(config.token_cifrado, config.token_iv, config.token_tag);
    await registerPhoneNumber(config.phone_number_id, token, parsed.data.pin);
    const numero = await getPhoneNumberStatus(config.phone_number_id, token);
    return NextResponse.json({ ok: true, estado: numero.status ?? null });
  } catch (err) {
    registrarError("api/panel/whatsapp/registrar", err, { phoneNumberId: config.phone_number_id });
    const crudo = err instanceof MetaApiError ? err.message : "Error registrando el número en Meta.";
    const traducido = traducirErrorMeta(crudo);
    return NextResponse.json({ error: traducido ? `${traducido.titulo}. ${traducido.explicacion}` : crudo }, { status: 502 });
  }
}
