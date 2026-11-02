// API de conversiones de Meta: el servidor le manda a Meta las consultas que el Pixel del navegador puede perder
// (bloqueadores, Safari, el celular que cambia a WhatsApp antes de que salga el pedido). Mismo event_id que el Pixel:
// Meta junta los dos y cuenta una sola. Plan: docs/marketing/medicion.md.
//
// Solo en el servidor: usa el token de Meta (META_CAPI_TOKEN, lo carga Walter en Vercel, nunca va al repositorio).
import { createHash } from "node:crypto";
import { armarEvento, type ContactoConversion, type EventoWeb } from "@/lib/conversiones";
import { normalizarWhatsappAR } from "@/lib/whatsappPublico";

const VERSION_GRAPH = "v21.0";

export function sha256(valor: string): string {
  return createHash("sha256").update(valor).digest("hex");
}

/** Meta pide el mail en minúsculas y sin espacios, y el teléfono solo con números y el código de país. */
export function datosPersonaMeta(contacto: ContactoConversion | null | undefined): { em?: string[]; ph?: string[] } {
  const datos: { em?: string[]; ph?: string[] } = {};
  const email = contacto?.email?.trim().toLowerCase();
  if (email && email.includes("@")) datos.em = [sha256(email)];
  const telefono = normalizarWhatsappAR(contacto?.telefono ?? null);
  if (telefono) datos.ph = [sha256(telefono)];
  return datos;
}

export interface ContextoPedido {
  eventId: string;
  url: string | null;
  ip: string | null;
  userAgent: string | null;
  /** Cookies del Pixel (_fbp y _fbc): ayudan a que Meta reconozca a la misma persona. */
  fbp?: string | null;
  fbc?: string | null;
  contacto?: ContactoConversion | null;
  /** Segundos desde 1970; se pasa para poder probarlo. */
  ahora?: number;
}

/** Arma el evento tal como lo pide la API de conversiones. Devuelve null si ese evento no va a Meta. */
export function armarEventoCapi(evento: EventoWeb, ctx: ContextoPedido) {
  const armado = armarEvento(evento);
  if (!armado.meta || armado.meta.desde === "navegador") return null;
  const params = Object.fromEntries(Object.entries(armado.meta.params).filter(([, v]) => v !== undefined));
  return {
    event_name: armado.meta.nombre,
    event_time: ctx.ahora ?? Math.floor(Date.now() / 1000),
    event_id: ctx.eventId,
    action_source: "website",
    ...(ctx.url ? { event_source_url: ctx.url } : {}),
    user_data: {
      ...datosPersonaMeta(ctx.contacto),
      ...(ctx.ip ? { client_ip_address: ctx.ip } : {}),
      ...(ctx.userAgent ? { client_user_agent: ctx.userAgent } : {}),
      ...(ctx.fbp ? { fbp: ctx.fbp } : {}),
      ...(ctx.fbc ? { fbc: ctx.fbc } : {}),
    },
    custom_data: params,
  };
}

/**
 * Manda el evento a Meta. Sin el ID del Pixel o sin el token no hace nada (en local, o antes de que Walter los cargue
 * en Vercel). Nunca tira error: medir no puede romper una consulta.
 */
export async function enviarEventoMeta(evento: EventoWeb, ctx: ContextoPedido): Promise<{ enviado: boolean; motivo?: string }> {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const token = process.env.META_CAPI_TOKEN;
  if (!pixelId || !token) return { enviado: false, motivo: "sin configurar" };
  const dato = armarEventoCapi(evento, ctx);
  if (!dato) return { enviado: false, motivo: "no va a Meta" };
  try {
    const cuerpo: Record<string, unknown> = { data: [dato] };
    // Para la pantalla "Probar eventos" de Meta: se carga el código ahí mismo, mientras se prueba, y después se borra.
    if (process.env.META_CAPI_TEST_CODE) cuerpo.test_event_code = process.env.META_CAPI_TEST_CODE;
    const res = await fetch(`https://graph.facebook.com/${VERSION_GRAPH}/${pixelId}/events?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    if (!res.ok) return { enviado: false, motivo: `Meta respondió ${res.status}` };
    return { enviado: true };
  } catch {
    return { enviado: false, motivo: "sin conexión con Meta" };
  }
}

/** Lee las cookies del Pixel de un encabezado Cookie. */
export function cookiesPixel(cookieHeader: string | null): { fbp: string | null; fbc: string | null } {
  const buscar = (nombre: string) => {
    const m = (cookieHeader ?? "").match(new RegExp(`(?:^|;\\s*)${nombre}=([^;]+)`));
    return m ? decodeURIComponent(m[1]) : null;
  };
  return { fbp: buscar("_fbp"), fbc: buscar("_fbc") };
}
