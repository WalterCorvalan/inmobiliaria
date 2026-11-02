import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { encrypt, decrypt } from "@/lib/crypto";
import { validatePhoneNumber } from "@/lib/meta/client";
import { registrarError } from "@/lib/panel/logger";
import { resumenToken } from "@/lib/panel/tokenActual";
import { empresaActual } from "@/lib/empresa/db";
import { conEmpresaDeSesion } from "@/lib/empresa/sesion";
import { parcheDeCredenciales, separarSecretos } from "@/lib/empresa/credenciales";

// Confirma contra la API de Meta a qué número real corresponde el
// phone_number_id cargado -- antes no había forma de verificar en el panel
// que el ID pegado correspondiera de verdad al número de WhatsApp que se
// piensa que es (ej: el de terminación 7000), solo se podía chequear a mano
// en Meta Business Suite. Best-effort: si falla (token vencido, ID mal
// cargado) no rompe la pantalla, solo no muestra el número confirmado.
async function numeroConfirmado(phoneNumberId: string | null, tokenCifrado: string | null, tokenIv: string | null, tokenTag: string | null) {
  if (!phoneNumberId || !tokenCifrado || !tokenIv || !tokenTag) return null;
  try {
    const token = decrypt(tokenCifrado, tokenIv, tokenTag);
    const info = await validatePhoneNumber(phoneNumberId, token);
    return { numero: info.display_phone_number, nombreVerificado: info.verified_name };
  } catch (err) {
    registrarError("api/panel/whatsapp/configuracion:validar-numero", err, { phoneNumberId });
    return null;
  }
}

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

async function GET_() {
  const { supabase, esAdmin } = await clienteAutenticado();
  if (!esAdmin) return NextResponse.json({ error: "Solo Admin puede ver esto." }, { status: 403 });

  let { data } = await supabase.from("whatsapp_configuracion").select("phone_number_id, waba_id, listo, bot_nombre, webhook_verify_token, updated_at, horario_inicio, horario_fin, tono, token_cifrado, token_iv, token_tag, app_id, app_secret_cifrado, app_secret_iv, app_secret_tag").eq("empresa_id", empresaActual()).maybeSingle();

  if (data && !data.webhook_verify_token) {
    const verifyToken = randomBytes(24).toString("hex");
    const { data: actualizado } = await supabase.from("whatsapp_configuracion").update({ webhook_verify_token: verifyToken }).eq("empresa_id", empresaActual())
      .select("phone_number_id, waba_id, listo, bot_nombre, webhook_verify_token, updated_at, horario_inicio, horario_fin, tono, token_cifrado, token_iv, token_tag, app_id, app_secret_cifrado, app_secret_iv, app_secret_tag").maybeSingle();
    data = actualizado;
  }

  const numeroConfirmadoData = data ? await numeroConfirmado(data.phone_number_id, data.token_cifrado, data.token_iv, data.token_tag) : null;
  const { config, secretos } = separarSecretos(data || {});

  return NextResponse.json({ config, numeroConfirmado: numeroConfirmadoData, tokenCargado: resumenToken(data), secretos });
}

async function POST_(request: Request) {
  try {
    const { supabase, esAdmin } = await clienteAutenticado();
    if (!esAdmin) return NextResponse.json({ error: "Solo Admin puede modificar esto." }, { status: 403 });

    const body = await request.json();
    const phoneNumberId = String(body.phoneNumberId || "").trim();
    const wabaId = String(body.wabaId || "").trim() || null;
    const accessToken = String(body.accessToken || "").trim();
    const botNombre = String(body.botNombre || "").trim() || null;
    const regenerarVerifyToken = !!body.regenerarVerifyToken;
    const tono = String(body.tono || "").trim() || null;
    let horarioInicio = Number(body.horarioInicio);
    let horarioFin = Number(body.horarioFin);
    if (!Number.isInteger(horarioInicio) || horarioInicio < 0 || horarioInicio > 23) horarioInicio = 7;
    if (!Number.isInteger(horarioFin) || horarioFin < 1 || horarioFin > 24) horarioFin = 23;
    if (horarioFin <= horarioInicio) return NextResponse.json({ error: "El horario de fin debe ser posterior al de inicio." }, { status: 400 });

    if (!phoneNumberId) return NextResponse.json({ error: "Falta el Identificador del número (phone_number_id)." }, { status: 400 });

    const patch: Record<string, unknown> = { phone_number_id: phoneNumberId, waba_id: wabaId, bot_nombre: botNombre, tono, horario_inicio: horarioInicio, horario_fin: horarioFin, updated_at: new Date().toISOString() };
    Object.assign(patch, parcheDeCredenciales(body, "whatsapp"));

    if (accessToken) {
      const { cipher, iv, tag } = encrypt(accessToken);
      patch.token_cifrado = cipher;
      patch.token_iv = iv;
      patch.token_tag = tag;
    }

    if (regenerarVerifyToken) {
      patch.webhook_verify_token = randomBytes(24).toString("hex");
    }

    const { data: actual } = await supabase.from("whatsapp_configuracion").select("token_cifrado, token_iv, token_tag, app_id, app_secret_cifrado, app_secret_iv, app_secret_tag").eq("empresa_id", empresaActual()).maybeSingle();
    patch.listo = !!(phoneNumberId && (accessToken || actual?.token_cifrado));

    // .maybeSingle() -- .single() tira 500 ("Cannot coerce the result to a
    // single JSON object") si el update no devuelve fila, mismo fix que
    // instagram/messenger/configuracion y configs/vistas/perfiles (commit
    // b0cd241). A diferencia de esos, acá el resto de la función SÍ asume
    // "data" no nulo (data.phone_number_id, etc.) -- se corta antes con un
    // error explícito en vez de reventar con un null.
    const { data, error } = await supabase.from("whatsapp_configuracion").update(patch).eq("empresa_id", empresaActual()).select("phone_number_id, waba_id, listo, bot_nombre, webhook_verify_token, updated_at, horario_inicio, horario_fin, tono, token_cifrado, token_iv, token_tag, app_id, app_secret_cifrado, app_secret_iv, app_secret_tag").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "No se pudo guardar la configuración." }, { status: 500 });

    const numeroConfirmadoData = await numeroConfirmado(data.phone_number_id, data.token_cifrado, data.token_iv, data.token_tag);
    const { config, secretos } = separarSecretos(data);

    return NextResponse.json({ config, numeroConfirmado: numeroConfirmadoData, tokenCargado: resumenToken(data), secretos });
  } catch (error) {
    registrarError("api/panel/whatsapp/configuracion", error);
    return NextResponse.json({ error: "Error interno guardando la configuración." }, { status: 500 });
  }
}

export const GET = conEmpresaDeSesion(GET_);
export const POST = conEmpresaDeSesion(POST_);
