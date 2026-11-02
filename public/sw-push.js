// Service worker de notificaciones push del panel (Web Push API). Solo se
// registra dentro de /panel (ver PushSubscribeButton.tsx) -- no interfiere
// con el sitio público, no cachea nada, su único trabajo es escuchar el
// evento "push" del navegador y mostrar la notificación nativa del
// dispositivo, y llevar al usuario al link correcto si la toca.

// La imagen de la notificación es el ícono del módulo al que lleva (27/10/2026, Walter: antes era siempre el logo
// blanco y negro). Se saca de la ruta: /panel/whatsapp?... usa /icons/panel/whatsapp.png. Las rutas cuyo ícono tiene
// otro nombre van en ICONO_ALIAS; lo que no es de un módulo muestra el logo redondo de Pfaffen Automotores.
const ICONOS_MODULO = new Set([
  "alertas", "autorizaciones", "calendario", "clientes", "cobros", "comisiones", "configuracion", "consignaciones",
  "correos", "cotizaciones", "dormidos", "errores", "expedientes", "facturacion", "financiaciones", "finanzas",
  "gestoria", "infracciones", "instagram", "leads", "liquidaciones", "marketing", "mensajes", "messenger",
  "mi-espacio", "mi-perfil", "mis-ventas", "nps", "oportunidades", "papelera", "pedidos", "peritajes", "postulaciones",
  "postventa", "reclamos", "recontactos", "reportes", "rodi", "senas", "service", "stock", "taller", "telefonos",
  "ventas", "visitas", "whatsapp",
]);
const ICONO_ALIAS = {
  "mi-dia": "mi-espacio",
  logs: "registro-cambios",
  "contenido-sitio": "registro-cambios",
  sueldos: "liquidador-sueldos",
  tareas: "tareas-leads",
  ayuda: "sugerencias",
};
function iconoDe(url) {
  const modulo = (String(url || "").match(/^\/panel\/([^/?#]+)/) || [])[1];
  if (modulo && ICONOS_MODULO.has(modulo)) return `/icons/panel/${modulo}.png`;
  if (modulo && ICONO_ALIAS[modulo]) return `/icons/panel/${ICONO_ALIAS[modulo]}.png`;
  return "/logo-placeholder.svg";
}

self.addEventListener("push", (event) => {
  let data = { title: "Inmobiliaria CRM", body: "", url: "/panel" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    /* payload no era JSON, se usa el default */
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Inmobiliaria CRM", {
      body: data.body || "",
      icon: iconoDe(data.url),
      badge: "/logo.png",
      data: { url: data.url || "/panel", alertaId: data.alertaId || null },
      tag: data.url || undefined,
      // Mensajes de la misma charla reemplazan la notificación anterior en vez de apilarse, pero vuelven a sonar.
      renotify: !!data.url,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/panel";
  const alertaId = event.notification.data?.alertaId;
  // Tocar la notificación cuenta como leerla: la alerta deja de figurar sin leer en la campanita (14/10/2026). Si falla
  // (sin sesión, sin conexión) no pasa nada, queda sin leer como antes.
  const marcarLeida = alertaId
    ? fetch("/api/panel/alertas/leida", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: alertaId }) }).catch(() => {})
    : Promise.resolve();
  event.waitUntil(
    Promise.all([marcarLeida, self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })])
  );
});
