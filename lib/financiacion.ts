// Cálculo aproximado del tope de financiación y cuota estimada -- usado
// tanto por el simulador propio del panel (Financiaciones) como por el
// simulador público de la ficha de auto (SimuladorFinanciacion.tsx /
// SolicitarFinanciacionForm.tsx). NO reemplaza al simulador real de
// decreditos (agencias2.decreditos.com), que además depende del perfil
// crediticio del cliente (algo que acá no podemos calcular). Sirve como
// número de referencia para la charla inicial con el cliente.
//
// Tabla de topes confirmada probando el simulador real de decreditos con
// autos/años reales (ver PR que agregó este archivo): sube 5 puntos por
// escalón, con 0km como escalón propio arriba del resto.
export interface TopeFinanciacion { anioDesde: number; anioHasta: number | null; pct: number }

export const TOPES_FINANCIACION_DEFAULT: TopeFinanciacion[] = [
  { anioDesde: 0, anioHasta: 2015, pct: 50 },
  { anioDesde: 2016, anioHasta: 2017, pct: 55 },
  { anioDesde: 2018, anioHasta: 2020, pct: 60 },
  { anioDesde: 2021, anioHasta: 9999, pct: 65 },
];
export const TOPE_0KM_DEFAULT = 70;

// TNA implícita derivada de la tabla "Tradicional - Desde" del simulador real
// (mejor perfil crediticio) -- es una aproximación, no la tasa exacta.
// Agrupada por año del vehículo (igual que TopeFinanciacion) además de por
// plazo -- pedido de la reunión del 22/9 ("pasar la tasa del 65% al 68% para
// unidades 2021 en adelante"). Arranca en un solo grupo cubriendo todos los
// años con los mismos valores de siempre -- el admin lo separa en más
// grupos desde Financiaciones > Configuración si necesita tasas distintas
// por antigüedad.
export interface TnaGrupo { anioDesde: number; anioHasta: number | null; tna: Record<string, number> }

export const TNA_POR_ANIO_Y_PLAZO_DEFAULT: TnaGrupo[] = [
  { anioDesde: 0, anioHasta: 9999, tna: { "12": 76, "18": 70, "24": 65, "36": 60, "48": 57 } },
];

export function tnaPctPorAnioYPlazo(anio: number, plazo: number, grupos: TnaGrupo[]): number | null {
  const fila = grupos.find((g) => anio >= g.anioDesde && anio <= (g.anioHasta ?? 9999));
  const tabla = fila?.tna ?? grupos[0]?.tna;
  return tabla?.[String(plazo)] ?? null;
}

export const GASTOS_PCT_DEFAULT = 11;
export const PLAZOS_DISPONIBLES = [12, 18, 24, 36, 48];

// UVA solo existe hasta 24 cuotas en decreditos, y la grilla real solo
// muestra la PRIMERA cuota (no es fija, se actualiza mes a mes por
// inflación/índice UVA) -- no hay forma de proyectar eso con una fórmula.
// Se aproxima como un % de descuento sobre la cuota Tradicional del mismo
// plazo, derivado comparando la grilla real (Tradicional Desde vs UVA
// Desde) para un mismo capital.
export const UVA_DESCUENTO_PCT_DEFAULT: Record<string, number> = { "12": 9.1, "18": 10.3, "24": 10.5 };
export const PLAZOS_CON_UVA = [12, 18, 24];

export function topePctPorAnio(anio: number, esOkm: boolean, topes: TopeFinanciacion[], tope0km: number): number {
  if (esOkm) return tope0km;
  const fila = topes.find((t) => anio >= t.anioDesde && anio <= (t.anioHasta ?? 9999));
  return fila?.pct ?? topes[0]?.pct ?? 50;
}

// Sistema francés de amortización, cuota fija.
export function calcularCuotaFrances(capital: number, tnaPct: number, meses: number): number {
  if (capital <= 0 || meses <= 0) return 0;
  const tasaMensual = tnaPct / 100 / 12;
  if (tasaMensual <= 0) return Math.round(capital / meses);
  const cuota = (capital * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -meses));
  return Math.round(cuota);
}
