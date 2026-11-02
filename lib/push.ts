import webpush from "web-push";
import { registrarError } from "@/lib/panel/logger";

// Notificaciones push nativas del navegador/celular (Web Push API): usa el service worker del propio panel y no
// depende de ninguna cuenta de terceros. El usuario acepta las notificaciones una vez desde el dispositivo (Mi perfil →
// Notificaciones); eso genera una "subscription" que se guarda en push_subscriptions y es lo que se usa acá.

let configurado = false;
function asegurarConfigurado() {
  if (configurado) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) throw new Error("Faltan las VAPID keys (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)");
  webpush.setVapidDetails("mailto:sistemas@pfaffenautos.com.ar", publicKey, privateKey);
  configurado = true;
}

export function pushConfigurado(): boolean {
  return !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export type PushSubscriptionRow = { endpoint: string; p256dh: string; auth: string };

// Devuelve true si el envío fue exitoso, false si la suscripción ya no es
// válida (navegador desinstalado, permiso revocado, etc.) -- en ese caso el
// caller debe borrar la fila de push_subscriptions, no reintentar.
// alertaId: al tocar la notificación, public/sw-push.js marca esa alerta como leída en la campanita.
export async function enviarPush(sub: PushSubscriptionRow, payload: { titulo: string; mensaje?: string | null; link?: string | null; alertaId?: string }): Promise<{ ok: boolean; expirada: boolean }> {
  asegurarConfigurado();
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify({ title: payload.titulo, body: payload.mensaje || "", url: payload.link || "/panel", alertaId: payload.alertaId || null })
    );
    return { ok: true, expirada: false };
  } catch (err: any) {
    // 404/410 = la suscripción ya no existe del lado del navegador (Gone).
    const expirada = err?.statusCode === 404 || err?.statusCode === 410;
    // 14/10/2026: el rechazo queda en Errores del sistema con el servicio (Apple, Google, Mozilla) y el motivo. Antes
    // solo iba a los registros de Vercel y no había forma de saber por qué a un iPhone no le llegaba (caso Fede).
    if (!expirada) {
      const servicio = sub.endpoint.split("/")[2] || "desconocido";
      registrarError("push:envio-rechazado", new Error(`${servicio} respondió ${err?.statusCode ?? "sin código"}: ${String(err?.body || err?.message || err).slice(0, 300)}`), { servicio, statusCode: err?.statusCode ?? null });
    }
    return { ok: false, expirada };
  }
}
