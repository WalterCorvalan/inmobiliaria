"use client";

// Mapea utm_source (o el dominio de referrer si no hay UTM) al mismo
// vocabulario que ya usa /panel/marketing/pautas y /panel/marketing/embudo
// ("Google Ads", "Meta Ads", "MercadoLibre") para que el gasto cargado a mano
// y el origen real del lead terminen hablando el mismo idioma.
const MAPA_FUENTE: Record<string, string> = {
  google: "Google Ads",
  adwords: "Google Ads",
  facebook: "Meta Ads",
  instagram: "Meta Ads",
  meta: "Meta Ads",
  mercadolibre: "MercadoLibre",
  meli: "MercadoLibre",
  whatsapp: "WhatsApp",
};

const MAPA_REFERRER: Record<string, string> = {
  "google.com": "Google (orgánico)",
  "facebook.com": "Facebook (orgánico)",
  "instagram.com": "Instagram (orgánico)",
  "mercadolibre.com.ar": "MercadoLibre (orgánico)",
  "mercadolibre.com": "MercadoLibre (orgánico)",
};

// utm_medium que dice que la visita NO es un anuncio (la ficha de Google Maps, un posteo, un link en la bio): sin esto
// "utm_source=google&utm_medium=organic" quedaba como "Google Ads" y sumaba visitas gratis al gasto pagado (29/10/2026).
const MEDIOS_ORGANICOS = new Set(["organic", "organico", "orgánico", "local", "gmb", "maps", "social", "bio", "referral"]);
const MAPA_FUENTE_ORGANICA: Record<string, string> = {
  google: "Google (orgánico)",
  facebook: "Facebook (orgánico)",
  instagram: "Instagram (orgánico)",
  meta: "Facebook (orgánico)",
  mercadolibre: "MercadoLibre (orgánico)",
  meli: "MercadoLibre (orgánico)",
};

const esMedioOrganico = (medium: string | null) => !!medium && MEDIOS_ORGANICOS.has(medium.toLowerCase());

export interface OrigenEntrada {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  canal: string | null;
}

// El origen se guarda al ENTRAR al sitio (UtmTracker en el layout público) y los formularios lo leen al enviar.
// Antes se leía de la dirección en el momento del envío: quien entraba por un anuncio, miraba autos y después cotizaba
// ya no tenía los utm_* en la dirección y el lead quedaba sin origen (Pautas y Embudo no lo contaban).
const CLAVE_ORIGEN = "crm_origen_entrada";
// Pasado este tiempo sin volver a entrar por un link con origen, se deja de atribuir (ventana usual de una campaña).
const VIGENCIA_ORIGEN_MS = 30 * 24 * 60 * 60 * 1000;

/** Origen a partir de la dirección y el referrer de la página de entrada. null si no hay nada que atribuir. */
export function origenDesde(search: string, referrer: string): OrigenEntrada | null {
  const params = new URLSearchParams(search);
  const utm_source = params.get("utm_source")?.trim() || null;
  const utm_medium = params.get("utm_medium")?.trim() || null;
  const utm_campaign = params.get("utm_campaign")?.trim() || null;
  if (utm_source) {
    const fuente = utm_source.toLowerCase();
    if (esMedioOrganico(utm_medium)) {
      return { utm_source, utm_medium, utm_campaign, canal: MAPA_FUENTE_ORGANICA[fuente] || `${utm_source} (orgánico)` };
    }
    return { utm_source, utm_medium, utm_campaign, canal: MAPA_FUENTE[fuente] || utm_source };
  }
  // Etiquetado automático de Google Ads (está activado en la cuenta): el anuncio llega con ?gclid= (o gbraid/wbraid en
  // iPhone) y sin utm_*. Sin esto quedaba como "Google (orgánico)" por el referrer y el gasto no se cruzaba con nada
  // (27/10/2026).
  if (params.get("gclid") || params.get("gbraid") || params.get("wbraid")) {
    return { utm_source: "google", utm_medium: "cpc", utm_campaign: null, canal: "Google Ads" };
  }
  try {
    if (referrer) {
      const host = new URL(referrer).hostname.replace(/^www\./, "");
      for (const dominio in MAPA_REFERRER) {
        if (host.includes(dominio)) return { utm_source: null, utm_medium: null, utm_campaign: null, canal: MAPA_REFERRER[dominio] };
      }
    }
  } catch {
    // referrer inválido o bloqueado por el navegador: no es crítico
  }
  return null;
}

function leerGuardado(ahora = Date.now()): OrigenEntrada | null {
  try {
    const crudo = localStorage.getItem(CLAVE_ORIGEN);
    if (!crudo) return null;
    const { origen, guardadoEn } = JSON.parse(crudo) as { origen: OrigenEntrada; guardadoEn: number };
    return ahora - guardadoEn < VIGENCIA_ORIGEN_MS ? origen : null;
  } catch {
    return null;
  }
}

/**
 * Lo llama UtmTracker al entrar a cualquier página pública. Un link con utm_* siempre pisa lo guardado (la campaña
 * más reciente es la que trajo al cliente esta vez); un referrer orgánico solo se guarda si no había nada.
 */
export function guardarOrigenDeEntrada(): void {
  if (typeof window === "undefined") return;
  const origen = origenDesde(window.location.search, document.referrer);
  if (!origen) return;
  // Lo orgánico (referrer, o un link marcado como orgánico) no pisa un anuncio guardado: el anuncio fue el que lo trajo.
  if ((!origen.utm_source || esMedioOrganico(origen.utm_medium)) && leerGuardado()) return;
  try {
    localStorage.setItem(CLAVE_ORIGEN, JSON.stringify({ origen, guardadoEn: Date.now() }));
  } catch {
    // almacenamiento bloqueado (modo privado): se sigue usando la dirección actual
  }
}

// Orden: utm_* en la dirección actual, después lo guardado al entrar, y por último el referrer. El referrer va último
// porque al navegar dentro del sitio sigue siendo el de la entrada: quien llegó por un anuncio de Google (utm) y
// cotizó dos páginas después tiene referrer google.com, y sin este orden quedaba como "Google (orgánico)".
function origenActual(): OrigenEntrada | null {
  if (typeof window === "undefined") return null;
  const enDireccion = origenDesde(window.location.search, "");
  return enDireccion ?? leerGuardado() ?? origenDesde("", document.referrer);
}

// A diferencia de getCanalOrigen (que mapea a un balde legible y descarta
// medium/campaign), esto devuelve los 3 valores crudos tal cual vinieron en la
// URL de entrada: sin esto nunca se puede saber qué campaña puntual trajo un
// lead, solo la plataforma en general.
export function getUtmRaw(): { utm_source: string | null; utm_medium: string | null; utm_campaign: string | null } {
  const o = origenActual();
  return { utm_source: o?.utm_source ?? null, utm_medium: o?.utm_medium ?? null, utm_campaign: o?.utm_campaign ?? null };
}

export function getCanalOrigen(): string | null {
  return origenActual()?.canal ?? null;
}

/** Lo que mandan los formularios y el chat de la web a sus rutas (ver lib/panel/origenWeb.ts). */
export function datosDeOrigen(): { canalOrigen: string | null; utmSource: string | null; utmMedium: string | null; utmCampaign: string | null } {
  const o = origenActual();
  return { canalOrigen: o?.canal ?? null, utmSource: o?.utm_source ?? null, utmMedium: o?.utm_medium ?? null, utmCampaign: o?.utm_campaign ?? null };
}
