import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { getPhoneNumberStatus, getWabaVerificationStatus, MetaApiError } from "@/lib/meta/client";
import { decrypt } from "@/lib/crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE2_URL!,
  process.env.SUPABASE2_SERVICE_ROLE_KEY!
);

// Chequeo en vivo del estado real de envío contra la API de Meta -- para que
// el equipo pueda verificar ustedes mismos si ya se destrabó la
// verificación del negocio (error #141010, ver lib/meta/erroresWhatsapp.ts)
// sin depender de herramientas externas ni de mí.
export async function GET(request: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE2_URL!,
    process.env.NEXT_PUBLIC_SUPABASE2_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { data: perfil } = await supabase.from("perfiles").select("roles").eq("id", user.id).single();
  if (!perfil?.roles?.some((r: string) => r === "admin" || r === "director") && !perfil?.roles?.includes("encargado")) {
    return NextResponse.json({ error: "Solo admin o encargado." }, { status: 403 });
  }

  const { data: config } = await supabaseAdmin.from("whatsapp_configuracion").select("*").eq("id", true).maybeSingle();
  if (!config?.listo || !config.token_cifrado || !config.phone_number_id || !config.waba_id) {
    return NextResponse.json({ error: "Faltan credenciales cargadas en Configuración → WhatsApp." }, { status: 400 });
  }

  try {
    const token = decrypt(config.token_cifrado, config.token_iv, config.token_tag);
    const [numero, waba] = await Promise.all([
      getPhoneNumberStatus(config.phone_number_id, token),
      getWabaVerificationStatus(config.waba_id, token),
    ]);

    // Un número DISCONNECTED no está conectado a la Cloud API: no sale ningún mensaje aunque el negocio esté verificado.
    const numeroDesconectado = numero.status === "DISCONNECTED";
    const puedeEnviar = waba.business_verification_status === "verified" && !numeroDesconectado;

    // Diagnóstico del token (nunca devuelve el token): qué permisos tiene de
    // verdad y sobre qué cuentas de WhatsApp. Un envío que falla con #200 casi
    // siempre es un permiso que falta (whatsapp_business_messaging) o una cuenta
    // distinta de la dueña del número.
    const base = `${process.env.META_GRAPH_BASE_URL ?? "https://graph.facebook.com"}/${process.env.META_GRAPH_API_VERSION ?? "v25.0"}`;
    const diag = await fetch(`${base}/debug_token?input_token=${encodeURIComponent(token)}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => {
        const d = j?.data;
        if (!d) return { error: j?.error?.message ?? "sin datos" };
        return {
          tipo: d.type, appId: d.app_id, valido: d.is_valid, vence: d.expires_at === 0 ? "nunca" : d.expires_at,
          permisos: d.scopes ?? [],
          permisosPorCuenta: (d.granular_scopes ?? []).map((g: any) => ({ permiso: g.scope, cuentas: g.target_ids ?? "ninguna: el permiso no está asignado a una cuenta concreta" })),
        };
      })
      .catch(() => ({ error: "no se pudo consultar" }));

    // Cómo está registrado el número (Cloud API propia, otro proveedor o app de
    // WhatsApp Business) y qué apps están suscritas a la cuenta.
    const auth = { headers: { Authorization: `Bearer ${token}` } };
    const campos = "platform_type,account_mode,status,code_verification_status,name_status,messaging_limit_tier,is_official_business_account,is_pin_enabled,throughput";
    const numeroDetalle = await fetch(`${base}/${config.phone_number_id}?fields=${campos}`, auth).then((r) => r.json()).catch(() => ({ error: "no se pudo consultar" }));
    const appsSuscritas = await fetch(`${base}/${config.waba_id}/subscribed_apps`, auth).then((r) => r.json()).then((j) => j?.data?.map((a: any) => ({ app: a?.whatsapp_business_api_data?.name ?? a?.name, id: a?.whatsapp_business_api_data?.id })) ?? { error: j?.error?.message }).catch(() => ({ error: "no se pudo consultar" }));

    // Meta publica por qué no se puede enviar: health_status.can_send_message
    // (AVAILABLE / LIMITED / BLOCKED) con los errores y la solución posible por
    // cada entidad (app, número, cuenta, negocio). Es la respuesta directa a un
    // #200 que no se explica con los permisos del token.
    const saludNumero = await fetch(`${base}/${config.phone_number_id}?fields=health_status`, auth).then((r) => r.json()).catch(() => ({ error: "no se pudo consultar" }));
    const camposWaba = "health_status,ownership_type,account_review_status,primary_funding_id,on_behalf_of_business_info,owner_business_info,currency,country,is_enabled_for_insights";
    const wabaDetalle = await fetch(`${base}/${config.waba_id}?fields=${camposWaba}`, auth).then((r) => r.json()).catch(() => ({ error: "no se pudo consultar" }));

    // Qué números tiene realmente cada cuenta de WhatsApp: la del panel y, si se
    // pasa ?comparar=ID, otra (ej. la que muestra la consola de Developers).
    // Sirve para saber a cuál pertenece el número cuando dos pantallas de Meta
    // muestran IDs de cuenta distintos.
    const idsCuentas = [config.waba_id, new URL(request.url).searchParams.get("comparar")].filter((x): x is string => !!x && /^\d+$/.test(x));
    const cuentas = await Promise.all(idsCuentas.map(async (id) => ({
      id,
      datos: await fetch(`${base}/${id}?fields=name,currency,timezone_id,business_verification_status`, auth).then((r) => r.json()).catch(() => ({ error: "no se pudo consultar" })),
      numeros: await fetch(`${base}/${id}/phone_numbers?fields=id,display_phone_number,verified_name,status,platform_type`, auth).then((r) => r.json()).catch(() => ({ error: "no se pudo consultar" })),
    })));

    return NextResponse.json({
      ok: true,
      cuentas,
      saludNumero,
      wabaDetalle,
      numeroDetalle,
      appsSuscritas,
      tokenDiagnostico: diag,
      wabaDelNumero: config.waba_id,
      numero: { display: numero.display_phone_number, verificado: numero.verified_name, calidad: numero.quality_rating || null, estado: numero.status || null },
      negocio: { nombre: waba.name || null, verificacion: waba.business_verification_status || "desconocido" },
      puedeEnviar,
      numeroDesconectado,
      // Si la cuenta tiene una línea de pago asociada en Meta (no dice si tiene fondos). null = Meta no lo informó.
      pagoAsociado: typeof wabaDetalle?.primary_funding_id === "string" ? true : wabaDetalle?.error ? null : false,
      mensaje: numeroDesconectado
        ? "El negocio está verificado, pero el número figura DESCONECTADO de la API de WhatsApp: no sale ningún mensaje hasta registrarlo (botón de abajo)."
        : puedeEnviar
        ? "El negocio está verificado en Meta — el envío no debería estar bloqueado por este motivo."
        : `El negocio figura "${waba.business_verification_status || "desconocido"}" en Meta. Mientras no diga "verified", ningún mensaje sale (ver Verificación de la Empresa en Meta Business Suite).`,
    });
  } catch (err) {
    const mensaje = err instanceof MetaApiError ? err.message : "Error consultando la API de Meta.";
    return NextResponse.json({ error: mensaje }, { status: 502 });
  }
}
