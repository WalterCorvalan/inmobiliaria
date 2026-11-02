// Alertas de "salud" de las integraciones (WhatsApp, Instagram, Messenger): en vez de enterarse porque un cliente se queja,
// el panel avisa a los admin cuando algo se rompe (token vencido, número desconectado, tarjeta de Meta sin fondos,
// webhooks rechazados). Acá solo está la decisión (qué es un problema y cómo se le explica al equipo); las consultas a Meta
// y el envío de la alerta viven en app/api/cron/panel/salud-integraciones/route.ts.

export type Gravedad = "critica" | "atencion";

export interface Hallazgo {
  clave: string;
  gravedad: Gravedad;
  titulo: string;
  mensaje: string;
  link: string;
}

// "desconocido" = no se pudo consultar a Meta (sin red, Meta caído, no configurado): nunca se avisa por eso.
export type EstadoToken = "ok" | "vencido" | "desconocido";

export interface HechosWhatsapp {
  token: EstadoToken;
  numeroEstado: string | null;
  negocioVerificacion: string | null;
  // La cuenta tiene un método de pago asociado en Meta (no dice si tiene fondos). null = Meta no lo informó.
  pagoAsociado: boolean | null;
  // Mensajes de las últimas 24 h que fallaron por el error #131042 (problema de pago).
  erroresPago24h: number;
}

const LINK_WHATSAPP = "/panel/configuracion/whatsapp";
const ESTADOS_NUMERO_GRAVES = ["DISCONNECTED", "FLAGGED", "RESTRICTED", "BANNED", "DELETED"];

export function evaluarWhatsapp(h: HechosWhatsapp): Hallazgo[] {
  if (h.token === "vencido") {
    return [{
      clave: "wa-token", gravedad: "critica", link: LINK_WHATSAPP,
      titulo: "WhatsApp: el token de acceso venció o fue revocado",
      mensaje: "WhatsApp no puede enviar ni recibir hasta cargar un token nuevo en Configuración → WhatsApp.",
    }];
  }
  const hallazgos: Hallazgo[] = [];
  if (h.numeroEstado && ESTADOS_NUMERO_GRAVES.includes(h.numeroEstado.toUpperCase())) {
    hallazgos.push({
      clave: "wa-numero", gravedad: "critica", link: LINK_WHATSAPP,
      titulo: `WhatsApp: el número figura ${h.numeroEstado}`,
      mensaje: "El número no está conectado a la API y no sale ningún mensaje. En Configuración → WhatsApp → Verificar estado hay un botón para registrarlo de nuevo.",
    });
  }
  if (h.negocioVerificacion && h.negocioVerificacion !== "verified") {
    hallazgos.push({
      clave: "wa-negocio", gravedad: "critica", link: LINK_WHATSAPP,
      titulo: "WhatsApp: el negocio dejó de estar verificado en Meta",
      mensaje: `Meta lo informa como "${h.negocioVerificacion}". Mientras no diga "verified", no salen mensajes. Se resuelve en Meta Business Suite → Verificación de la empresa.`,
    });
  }
  if (h.erroresPago24h > 0) {
    hallazgos.push({
      clave: "wa-pago-error", gravedad: "critica", link: LINK_WHATSAPP,
      titulo: "WhatsApp: problema de pago en Meta",
      mensaje: `${h.erroresPago24h} mensaje${h.erroresPago24h === 1 ? "" : "s"} no salieron en las últimas 24 horas por un problema de pago (error #131042). Revisá que la tarjeta de la cuenta de WhatsApp tenga fondos: Meta Business Suite → Facturación y pagos. Las plantillas y los resúmenes automáticos quedan frenados hasta resolverlo.`,
    });
  } else if (h.pagoAsociado === false) {
    hallazgos.push({
      clave: "wa-pago-sin-metodo", gravedad: "atencion", link: LINK_WHATSAPP,
      titulo: "WhatsApp: la cuenta no tiene método de pago asociado",
      mensaje: "Las plantillas y los mensajes de marketing no van a salir. Cargá una tarjeta en Meta Business Suite → Facturación y pagos.",
    });
  }
  return hallazgos;
}

export function evaluarTokenCanal(canal: "Instagram" | "Messenger", token: EstadoToken): Hallazgo[] {
  if (token !== "vencido") return [];
  return [{
    clave: `${canal.toLowerCase()}-token`, gravedad: "critica", link: `/panel/configuracion/${canal.toLowerCase()}`,
    titulo: `${canal}: el token de acceso venció o fue revocado`,
    mensaje: `${canal} no puede responder hasta volver a conectar la cuenta en Configuración → ${canal}.`,
  }];
}

// Errores de firma de los webhooks en la ventana indicada: Meta manda los mensajes pero el sistema los rechaza (secreto de la app mal cargado).
export const UMBRAL_FIRMA = 3;
export const HORAS_FIRMA = 6;

export function evaluarWebhooks(erroresFirmaPorCanal: Record<string, number>): Hallazgo[] {
  return Object.entries(erroresFirmaPorCanal)
    .filter(([, n]) => n >= UMBRAL_FIRMA)
    .map(([canal, n]) => ({
      clave: `webhook-${canal.toLowerCase()}`, gravedad: "critica" as const, link: "/panel/errores",
      titulo: `${canal}: se están rechazando los mensajes entrantes`,
      mensaje: `${n} mensajes de Meta se rechazaron por firma inválida en las últimas ${HORAS_FIRMA} horas, así que no llegan a la bandeja. Suele ser el secreto de la app mal cargado en Vercel (META_APP_SECRET / INSTAGRAM_APP_SECRET). Detalle en Errores del sistema.`,
    }));
}

// No repite el mismo aviso antes de `horas` desde el último (por clave y persona).
export function debeAvisar(ultimoAvisoISO: string | null | undefined, ahoraMs: number, horas: number): boolean {
  if (!ultimoAvisoISO) return true;
  const t = new Date(ultimoAvisoISO).getTime();
  if (!Number.isFinite(t)) return true;
  return ahoraMs - t >= horas * 3600000;
}

// Clasifica la respuesta de la API de Meta al consultar con un token: 190 = token inválido/vencido; cualquier otro fallo = no se sabe.
export function estadoTokenDeRespuesta(r: { ok: boolean; codigoError?: number | null }): EstadoToken {
  if (r.ok) return "ok";
  return r.codigoError === 190 ? "vencido" : "desconocido";
}
