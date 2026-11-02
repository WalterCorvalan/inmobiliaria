// Notificaciones push del panel (gratis, las manda el navegador). Lo usan el aviso de arriba del panel
// (components/panel/AvisoNotificacionesPush.tsx) y el botón de Mi espacio (PushSubscribeButton.tsx).
// 13/10/2026: no le llegaban a nadie porque el botón para activarlas estaba solo en Mi espacio, que los vendedores no
// pueden abrir, y en iPhone hace falta instalar el panel en la pantalla de inicio (public/panel.webmanifest).

export type AvisoPush = "nada" | "activar" | "instalar-iphone" | "bloqueadas";

// Qué mostrarle a cada uno. Pura, para poder probarla.
export function queAvisoPush(e: { soportado: boolean; activo: boolean; iphone: boolean; instalada: boolean; permiso: NotificationPermission | "desconocido"; descartado: boolean }): AvisoPush {
  if (e.activo || e.descartado) return "nada";
  // En iPhone el navegador no deja recibir notificaciones si el panel no está instalado como app. 14/10/2026: se mira
  // primero si el navegador las soporta; adivinar el aparato por su descripción fallaba (una Mac o un iPad pueden
  // presentarse como iPhone) y escondía el botón aunque las notificaciones anduvieran.
  if (!e.soportado) return e.iphone && !e.instalada ? "instalar-iphone" : "nada";
  if (e.permiso === "denied") return "bloqueadas";
  return "activar";
}

export function esIphone(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function estaInstalada(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function pushSoportado(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function base64AUint8(base64: string): Uint8Array {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + relleno).replace(/-/g, "+").replace(/_/g, "/");
  const crudo = atob(b64);
  return Uint8Array.from([...crudo].map((c) => c.charCodeAt(0)));
}

export async function suscripcionActual(): Promise<PushSubscription | null> {
  if (!pushSoportado()) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw-push.js");
    return reg ? await reg.pushManager.getSubscription() : null;
  } catch {
    return null;
  }
}

// Pide el permiso, registra el service worker y guarda la suscripción del dispositivo en el servidor.
export async function activarPush(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const permiso = await Notification.requestPermission();
    if (permiso !== "granted") return { ok: false, error: "No diste el permiso. Activalo desde la configuración del navegador (el candado al lado de la dirección)." };
    const reg = await navigator.serviceWorker.register("/sw-push.js");
    await navigator.serviceWorker.ready;
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) return { ok: false, error: "Las notificaciones todavía no están configuradas en el servidor." };
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64AUint8(publicKey) as BufferSource }));
    const res = await fetch("/api/panel/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
    if (!res.ok) return { ok: false, error: "No se pudo guardar en el servidor. Probá de nuevo en un momento." };
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo activar. Probá de nuevo en un momento." };
  }
}
