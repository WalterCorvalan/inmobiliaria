// A dónde lleva el clic en una notificación (campanita, página de Alertas,
// aviso emergente). El `link` se guarda en la alerta cuando se crea, así que
// las alertas viejas quedan con rutas que después cambiaron. Bug real
// (8/10/2026): los mensajes de Instagram se guardaban con
// "/panel/whatsapp?canal=instagram&conversacion=…" (de cuando WhatsApp e
// Instagram compartían bandeja); desde que /panel/whatsapp muestra solo
// WhatsApp, ese clic abría WhatsApp y no encontraba la conversación.
// Esta función traduce las rutas viejas a las actuales; se aplica al hacer
// clic, así sirve también para las alertas ya guardadas.

export function destinoAlerta(link: string | null | undefined): string | null {
  if (!link) return null;
  const [ruta, query = ""] = link.split("?");
  const params = new URLSearchParams(query);

  // Bandejas separadas por canal (/panel/whatsapp, /panel/instagram, /panel/messenger).
  if (ruta === "/panel/whatsapp" || ruta === "/panel/conversaciones") {
    const canal = params.get("canal");
    if (canal === "instagram" || canal === "messenger") {
      params.delete("canal");
      const resto = params.toString();
      return `/panel/${canal}${resto ? `?${resto}` : ""}`;
    }
    if (ruta === "/panel/conversaciones") return `/panel/whatsapp${query ? `?${query}` : ""}`;
  }

  // Presupuestos pasó a ser parte de Cotizaciones (6/10/2026).
  if (ruta.startsWith("/panel/presupuestos")) {
    return ruta.replace("/panel/presupuestos", "/panel/cotizaciones") + (query ? `?${query}` : "");
  }

  return link;
}
