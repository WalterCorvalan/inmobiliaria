import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEmpresa as supabaseAdmin, empresaActual } from "@/lib/empresa/db";
import { requestPhoneNumberCode, verifyPhoneNumberCode, MetaApiError } from "@/lib/meta/client";
import { traducirErrorMeta } from "@/lib/meta/erroresWhatsapp";
import { registrarError } from "@/lib/panel/logger";
import { decrypt } from "@/lib/crypto";
import { conEmpresaDeSesion } from "@/lib/empresa/sesion";


const BodySchema = z.discriminatedUnion("accion", [
  z.object({ accion: z.literal("pedir"), metodo: z.enum(["SMS", "VOICE"]) }),
  z.object({ accion: z.literal("confirmar"), codigo: z.string().regex(/^\d{6}$/, "El código son 6 números.") }),
]);

// Verificación del número por código (SMS o llamada), el paso que Meta pide con el error #133006 antes de poder
// registrarlo (ver /api/panel/whatsapp/registrar). Solo admin. El token nunca sale en la respuesta.
async function POST_(request: Request) {
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

  const { data: config } = await supabaseAdmin.from("whatsapp_configuracion").select("*").eq("empresa_id", empresaActual()).maybeSingle();
  if (!config?.listo || !config.token_cifrado || !config.phone_number_id) {
    return NextResponse.json({ error: "Faltan credenciales cargadas en Configuración → WhatsApp." }, { status: 400 });
  }

  try {
    const token = decrypt(config.token_cifrado, config.token_iv, config.token_tag);
    if (parsed.data.accion === "pedir") await requestPhoneNumberCode(config.phone_number_id, token, parsed.data.metodo);
    else await verifyPhoneNumberCode(config.phone_number_id, token, parsed.data.codigo);
    return NextResponse.json({ ok: true });
  } catch (err) {
    registrarError("api/panel/whatsapp/verificar-numero", err, { phoneNumberId: config.phone_number_id, accion: parsed.data.accion });
    const crudo = err instanceof MetaApiError ? err.message : "Error verificando el número en Meta.";
    const traducido = traducirErrorMeta(crudo);
    return NextResponse.json({ error: traducido ? `${traducido.titulo}. ${traducido.explicacion}` : crudo }, { status: 502 });
  }
}

export const POST = conEmpresaDeSesion(POST_);
