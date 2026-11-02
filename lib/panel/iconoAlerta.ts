// Ícono de una alerta = el del módulo de donde viene, el mismo del menú de la izquierda (Walter, 30/10/2026: "si viene
// de expediente que tenga el ícono de expediente"). Sale de a dónde lleva el "Ver más" (link), así sirve también para
// las alertas ya guardadas. Las de chats llevan el ícono del canal (WhatsApp, Instagram, Messenger, Paffy). Si el link
// no apunta a un módulo con ícono, null: queda el ícono por tipo de components/panel/alertaMeta.tsx.
import { destinoAlerta } from "@/lib/panel/destinoAlerta";

// Íconos de public/icons/panel cuyo nombre es igual a la ruta del módulo.
const CON_ICONO = new Set([
  "alertas", "autorizaciones", "ayuda", "contenido-sitio", "mi-dia", "calendario", "clientes", "cobros", "comisiones", "configuracion", "consignaciones",
  "correos", "cotizaciones", "dormidos", "errores", "expedientes", "facturacion", "financiaciones", "finanzas",
  "gestoria", "infracciones", "instagram", "leads", "liquidaciones", "marketing", "mensajes", "messenger", "mi-espacio",
  "mi-perfil", "mis-ventas", "nps", "oportunidades", "papelera", "pedidos", "peritajes", "postulaciones", "postventa",
  "reclamos", "recontactos", "reportes", "rodi", "senas", "service", "stock", "taller", "telefonos", "tesoreria",
  "ventas", "visitas", "whatsapp",
]);

// Rutas con otro ícono en el menú (PanelLayoutClient.tsx).
const OTRO_ICONO: Record<string, string> = {
  "": "dashboard", logs: "registro-cambios",
  sueldos: "liquidador-sueldos", presupuestos: "cotizaciones", conversaciones: "whatsapp",
};

export function iconoModuloDeAlerta(link: string | null | undefined): string | null {
  const destino = destinoAlerta(link);
  if (!destino || !destino.startsWith("/panel")) return null;
  const modulo = destino.split("?")[0].split("#")[0].replace(/^\/panel\/?/, "").split("/")[0];
  const nombre = modulo in OTRO_ICONO ? OTRO_ICONO[modulo] : CON_ICONO.has(modulo) ? modulo : null;
  return nombre ? `/icons/panel/${nombre}.png` : null;
}
