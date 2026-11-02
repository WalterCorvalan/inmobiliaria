// Envuelve window.gtag para no repetir el chequeo "existe/no existe" (dev
// local sin GA_MEASUREMENT_ID, o gtag todavía no cargó) en cada componente.
// Uso: trackEvent("click_whatsapp", { seccion: "ficha_auto", auto_id: id })
export function trackEvent(nombre: string, params?: Record<string, string | number | boolean>) {
  if (typeof window === "undefined") return;
  const gtag = (window as any).gtag;
  if (typeof gtag !== "function") return;
  gtag("event", nombre, params);
}
