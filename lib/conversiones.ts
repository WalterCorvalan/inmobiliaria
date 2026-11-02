// Conversiones de la web: una sola función registra cada acción en Google Analytics, en el Pixel de Meta y (para las
// consultas) en la API de conversiones de Meta desde el servidor, con el mismo event_id para que Meta no la cuente dos
// veces. Plan, tabla de eventos y cuentas: docs/marketing/medicion.md.
//
// Las consultas de formularios se registran cuando el CRM respondió que la guardó, no al tocar "Enviar".

/** Formularios del sitio que dejan una consulta en el CRM. El nombre va a Analytics como parámetro `formulario`. */
export type FormularioConsulta =
  | "cotizar_usado"
  | "vender_auto"
  | "consignar"
  | "financiacion"
  | "simulador_financiacion"
  | "agendar_visita"
  | "visita_auto"
  | "consulta_favoritos"
  | "reserva_landing"
  | "busqueda_sin_resultados"
  | "avisame_outlet"
  | "pedido_seguro";

export interface AutoEvento {
  id: string;
  marca?: string | null;
  modelo?: string | null;
  anio?: number | null;
  precio?: number | null;
  moneda?: "ARS" | "USD" | null;
}

export type EventoWeb =
  | { tipo: "whatsapp"; ubicacion: string }
  | { tipo: "llamada"; ubicacion: string }
  | { tipo: "formulario"; formulario: FormularioConsulta; auto?: AutoEvento }
  // Rodi guarda el teléfono del lado del servidor: ahí se manda el evento a Meta (app/api/panel/rodi/mensaje).
  | { tipo: "rodi" }
  // Pedido de presupuesto del taller: es un servicio, no una consulta de compra o venta de autos. Se mide aparte para
  // no mezclarlo con lo que optimizan los anuncios.
  | { tipo: "taller" }
  | { tipo: "ver_auto"; auto: AutoEvento }
  | { tipo: "busqueda"; termino: string };

export type EventoMeta = "Contact" | "Lead" | "ViewContent" | "Search";

export interface EventoArmado {
  ga: { nombre: string; params: Record<string, unknown> };
  /**
   * `navegador`: solo el Pixel. `ambos`: Pixel y API de conversiones con el mismo event_id. `servidor`: solo la API
   * de conversiones, la manda la ruta que guardó la consulta. `null`: no va a Meta.
   */
  meta: { nombre: EventoMeta; params: Record<string, unknown>; desde: "navegador" | "ambos" | "servidor" } | null;
  /** Cuenta como consulta real (se marca como evento clave en Analytics y se importa a Google Ads). */
  esConsulta: boolean;
}

function datosAuto(auto?: AutoEvento) {
  if (!auto) return {};
  return {
    auto_id: auto.id,
    ...(auto.marca ? { marca: auto.marca } : {}),
    ...(auto.modelo ? { modelo: auto.modelo } : {}),
  };
}

export function armarEvento(e: EventoWeb): EventoArmado {
  switch (e.tipo) {
    case "whatsapp":
      return {
        ga: { nombre: "contacto_whatsapp", params: { ubicacion: e.ubicacion } },
        meta: { nombre: "Contact", params: { content_category: "whatsapp" }, desde: "ambos" },
        esConsulta: true,
      };
    case "llamada":
      return {
        ga: { nombre: "contacto_llamada", params: { ubicacion: e.ubicacion } },
        meta: { nombre: "Contact", params: { content_category: "llamada" }, desde: "ambos" },
        esConsulta: true,
      };
    case "formulario":
      return {
        ga: { nombre: "generate_lead", params: { formulario: e.formulario, ...datosAuto(e.auto) } },
        meta: {
          nombre: "Lead",
          params: { content_name: e.formulario, ...(e.auto ? { content_ids: [e.auto.id], content_type: "vehicle" } : {}) },
          desde: "ambos",
        },
        esConsulta: true,
      };
    case "rodi":
      return {
        ga: { nombre: "generate_lead", params: { formulario: "rodi" } },
        meta: { nombre: "Lead", params: { content_name: "rodi" }, desde: "servidor" },
        esConsulta: true,
      };
    case "taller":
      return { ga: { nombre: "solicitud_taller", params: {} }, meta: null, esConsulta: false };
    case "ver_auto": {
      const { auto } = e;
      const nombre = [auto.marca, auto.modelo, auto.anio].filter(Boolean).join(" ");
      const valor = auto.precio && auto.moneda ? { value: auto.precio, currency: auto.moneda } : {};
      return {
        ga: { nombre: "view_item", params: { ...valor, items: [{ item_id: auto.id, item_name: nombre || auto.id, ...(auto.marca ? { item_brand: auto.marca } : {}) }] } },
        // content_ids es el vehicle_id del catálogo de Meta (app/api/meta-catalog/feed): así el anuncio dinámico
        // reconoce qué auto vio la persona.
        meta: { nombre: "ViewContent", params: { content_ids: [auto.id], content_type: "vehicle", content_name: nombre || undefined, ...valor }, desde: "navegador" },
        esConsulta: false,
      };
    }
    case "busqueda":
      return {
        ga: { nombre: "search", params: { search_term: e.termino } },
        meta: { nombre: "Search", params: { search_string: e.termino }, desde: "navegador" },
        esConsulta: false,
      };
  }
}

/** Los tipos que la ruta pública /api/conversiones acepta reenviar a Meta. Rodi lo manda su propia ruta. */
export const TIPOS_DESDE_NAVEGADOR_A_SERVIDOR = ["whatsapp", "llamada", "formulario"] as const;

export interface ContactoConversion {
  telefono?: string | null;
  email?: string | null;
}

function nuevoEventId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

type Ventana = Window & { gtag?: (...args: unknown[]) => void; fbq?: (...args: unknown[]) => void };

/**
 * Registra una acción de la web. Si Analytics o el Pixel no están cargados (en local, sin las variables de Vercel)
 * no hace nada con ellos. Nunca tira error: medir no puede romper un formulario.
 */
export function registrarEvento(evento: EventoWeb, contacto?: ContactoConversion): void {
  if (typeof window === "undefined") return;
  try {
    const armado = armarEvento(evento);
    const eventId = nuevoEventId();
    const w = window as Ventana;
    if (typeof w.gtag === "function") w.gtag("event", armado.ga.nombre, armado.ga.params);
    if (!armado.meta) return;
    if (armado.meta.desde !== "servidor" && typeof w.fbq === "function") {
      w.fbq("track", armado.meta.nombre, armado.meta.params, { eventID: eventId });
    }
    if (armado.meta.desde === "ambos") {
      // keepalive: un toque a WhatsApp en el celular cambia de app enseguida y el pedido tiene que salir igual.
      fetch("/api/conversiones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evento, eventId, url: window.location.href, contacto: contacto ?? null }),
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Medir nunca rompe la página.
  }
}
