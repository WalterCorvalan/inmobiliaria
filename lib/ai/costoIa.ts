// Costo en dólares de las consultas a la API de Anthropic, a partir de los tokens que registra uso_ia_anthropic.
// Una sola fuente para el saldo estimado (saldoIa.ts) y las tarjetas de costo de Marketing: antes cada página tenía su
// propia cuenta con la tarifa de Haiku y la cotización de mercado (que usa Sonnet, más caro) salía 3 veces más barata.
//
// 14/10/2026: cada fila guarda el modelo que respondió (columna "modelo") y se cobra con la tarifa de ese modelo. Las
// filas viejas, sin modelo, se cobran como antes según el origen (Haiku 4.5, o Sonnet 5 en la cotización de mercado):
// así cambiar de modelo no reescribe el gasto que ya pasó.

// USD por millón de tokens (entrada / salida), tarifas de Anthropic.
export const TARIFA_HAIKU = { entrada: 1, salida: 5 }; // Claude Haiku 4.5
export const TARIFA_HAIKU_55 = { entrada: 0.1, salida: 0.5 }; // Claude Haiku 5.5 (pedidos de hasta 100.000 tokens)
// Claude Sonnet 5. Hasta el 14/10/2026 estaba con la tarifa de Sonnet 4 (3 / 15) y la tarjeta de costo mostraba la
// cotización un 50 % más cara de lo real.
export const TARIFA_SONNET = { entrada: 2, salida: 10 };

// Modelos en uso. Si se cambia uno, agregar su tarifa en TARIFAS_POR_MODELO.
export const MODELO_BOTS = "claude-haiku-5-5"; // bots, gerente y buscador (lib/ai/indexV2.ts)
export const MODELO_COTIZACION = "claude-sonnet-5"; // precio de mercado (lib/ai/estimarPrecioMercado.ts)
export const MODELO_OCR_CEDULA = "claude-haiku-5-5"; // cédula verde (app/api/panel/ocr-cedula/route.ts)
export const MODELO_OCR_DNI = MODELO_OCR_CEDULA; // DNI al cargar un cliente (app/api/panel/ocr-dni/route.ts)
export const ORIGEN_IA_OCR_CEDULA = "panel-v2/ocr-cedula";
export const ORIGEN_IA_OCR_DNI = "panel-v2/ocr-dni";

const TARIFAS_POR_MODELO: Record<string, { entrada: number; salida: number }> = {
  "claude-haiku-4-5": TARIFA_HAIKU,
  "claude-haiku-4-5-20251001": TARIFA_HAIKU,
  "claude-haiku-5-5": TARIFA_HAIKU_55,
  "claude-sonnet-5": TARIFA_SONNET,
};
const ORIGENES_SONNET = new Set(["panel-v2/cotizacion-mercado"]);
const ORIGENES_HAIKU_55 = new Set([ORIGEN_IA_OCR_CEDULA, ORIGEN_IA_OCR_DNI]);

// Lo que se cobra aparte de los tokens (14/10/2026, Walter: "todo lo que se pueda contar se debe contar"):
// - cada búsqueda en internet (la cotización de mercado busca precios): US$ 10 cada 1.000;
// - la caché de pedidos: escribirla cuesta 1,25 veces la tarifa de entrada y leerla 0,1 veces.
export const USD_POR_BUSQUEDA_WEB = 0.01;
const FACTOR_CACHE_ESCRITURA = 1.25;
const FACTOR_CACHE_LECTURA = 0.1;

export type FilaUsoIa = {
  origen?: string | null; modelo?: string | null; input_tokens?: number | null; output_tokens?: number | null;
  busquedas_web?: number | null; cache_escritura_tokens?: number | null; cache_lectura_tokens?: number | null;
};

// Nombre para mostrar de cada origen (Marketing → Métricas generales y Configuración → Empresa → IA).
export const NOMBRE_ORIGEN_IA: Record<string, string> = {
  "panel-v2/webhooks/whatsapp": "Bot de WhatsApp",
  "panel-v2/webhooks/instagram": "Bot de Instagram",
  "panel-v2/webhooks/messenger": "Bot de Messenger",
  "panel-v2/rodi": "Chat de la web",
  "api/buscar-ia": "Buscador del catálogo",
  "gerente_dashboard": "Gerente del Cockpit",
  "panel-v2/cotizacion-mercado": "Precio de mercado (cotizador web y tasador)",
  "panel-v2/ocr-cedula": "Escaneo de cédula verde",
  "panel-v2/ocr-dni": "Escaneo de DNI",
};

export function tarifaDeFila(fila: FilaUsoIa): { entrada: number; salida: number } {
  if (fila.modelo && TARIFAS_POR_MODELO[fila.modelo]) return TARIFAS_POR_MODELO[fila.modelo];
  if (fila.origen && ORIGENES_HAIKU_55.has(fila.origen)) return TARIFA_HAIKU_55;
  if (fila.origen && ORIGENES_SONNET.has(fila.origen)) return TARIFA_SONNET;
  return TARIFA_HAIKU;
}

export function costoFilaIaUsd(fila: FilaUsoIa): number {
  const t = tarifaDeFila(fila);
  const tokens = ((fila.input_tokens || 0) / 1_000_000) * t.entrada + ((fila.output_tokens || 0) / 1_000_000) * t.salida;
  const cache = ((fila.cache_escritura_tokens || 0) / 1_000_000) * t.entrada * FACTOR_CACHE_ESCRITURA
    + ((fila.cache_lectura_tokens || 0) / 1_000_000) * t.entrada * FACTOR_CACHE_LECTURA;
  return tokens + cache + (fila.busquedas_web || 0) * USD_POR_BUSQUEDA_WEB;
}

export function costoIaUsd(filas: FilaUsoIa[]): number {
  return filas.reduce((acc, f) => acc + costoFilaIaUsd(f), 0);
}
