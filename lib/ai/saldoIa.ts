import { supabaseEmpresa } from "@/lib/empresa/db";
import { createClient } from "@supabase/supabase-js";
import { crearAlerta } from "@/lib/panel/alertas";
import { costoFilaIaUsd, type FilaUsoIa } from "./costoIa";
import { factorAjusteIa, inicioDeMesUtc, proyeccionFinDeMes } from "./ajusteIa";

// Saldo estimado de la API de Anthropic y aviso cuando queda poco.
//
// Anthropic no ofrece ninguna forma de consultar el saldo restante por API, así que se ESTIMA: el admin carga cuánto
// cargó en la Consola de Anthropic y desde cuándo (Configuración > Empresa > IA), y acá se le resta el gasto estimado
// de todo lo que registra uso_ia_anthropic desde esa fecha (tokens x tarifa). Es una estimación: conviene recalibrarla
// de vez en cuando cargando el saldo real que muestra la Consola.
// Server-only (usa la service role): no importar desde componentes "use client".

const supabaseAdmin = () => supabaseEmpresa;

type GastoIa = { usd: number; tokensIn: number; tokensOut: number; porOrigen: Record<string, number> };

// Gasto de IA AJUSTADO a lo real, desde una fecha y sumado por origen: lo estimado (tokens x tarifa) multiplicado por
// la proporción real / estimado que sale de lo comprado y el saldo real (lib/ai/ajusteIa.ts). Es lo que muestran las
// pestañas de Marketing y la tarjeta de costo. `origenes` vacío = todos.
export async function gastoIaDesde(desde: string, origenes?: string[]): Promise<GastoIa> {
  const [crudo, factor] = await Promise.all([gastoIaCrudo(desde, origenes), factorIa()]);
  return { ...crudo, usd: crudo.usd * factor, porOrigen: Object.fromEntries(Object.entries(crudo.porOrigen).map(([k, v]) => [k, v * factor])) };
}

// Gasto ajustado DESDE LA ÚLTIMA COMPRA de crédito (14/10/2026, Walter: todo tiene que contarse desde la misma fecha
// para que cierre con la Consola). Sin compra cargada, los últimos 30 días. Sumado de todos los servicios da lo gastado
// desde la compra (comprado menos disponible).
export async function gastoIaDesdeCompra(origenes?: string[]): Promise<GastoIa & { desde: string; desdeCompra: boolean }> {
  const cfg = await leerConfigIa();
  const compra = cfg?.ia_credito_comprado_el && cfg.ia_credito_comprado_usd != null ? cfg.ia_credito_comprado_el : null;
  const desde = compra ?? new Date(Date.now() - 30 * 86400000).toISOString();
  const gasto = await gastoIaDesde(desde, origenes);
  return { ...gasto, desde, desdeCompra: !!compra };
}

type ConfigIa = {
  ia_saldo_inicial_usd: number | null; ia_saldo_desde: string | null; ia_alerta_saldo_usd: number | null;
  ia_credito_comprado_usd?: number | null; ia_credito_comprado_el?: string | null;
};
async function leerConfigIa(): Promise<ConfigIa | null> {
  const supabase = supabaseAdmin();
  // Con las columnas de la compra (migraciones/sql_ia_credito_comprado.sql); si el SQL no corrió, sin ellas.
  const completo = await supabase.from("configuracion_empresa").select("ia_saldo_inicial_usd, ia_saldo_desde, ia_alerta_saldo_usd, ia_credito_comprado_usd, ia_credito_comprado_el").maybeSingle();
  if (!completo.error) return completo.data as ConfigIa | null;
  const basico = await supabase.from("configuracion_empresa").select("ia_saldo_inicial_usd, ia_saldo_desde, ia_alerta_saldo_usd").maybeSingle();
  return basico.data as ConfigIa | null;
}

// Proporción real / estimado entre la compra del crédito y el día en que se cargó el saldo real. Sin compra cargada, 1.
async function factorIa(cfg?: ConfigIa | null): Promise<number> {
  const c = cfg === undefined ? await leerConfigIa() : cfg;
  const comprado = c?.ia_credito_comprado_usd != null ? Number(c.ia_credito_comprado_usd) : null;
  const saldoReal = c?.ia_saldo_inicial_usd != null ? Number(c.ia_saldo_inicial_usd) : null;
  if (comprado == null || saldoReal == null || !c?.ia_credito_comprado_el || !c.ia_saldo_desde) return 1;
  const estimado = await gastoIaCrudo(c.ia_credito_comprado_el, undefined, c.ia_saldo_desde);
  return factorAjusteIa({ compradoUsd: comprado, saldoRealUsd: saldoReal, estimadoUsd: estimado.usd });
}

// Gasto ESTIMADO (tokens x tarifa, sin ajustar) entre dos fechas, sumado por origen (tarifas en costoIa.ts). Se lee por
// páginas: PostgREST corta en 1000 filas y cada respuesta del bot es una fila.
async function gastoIaCrudo(desde: string, origenes?: string[], hasta?: string): Promise<GastoIa> {
  const supabase = supabaseAdmin();
  const porOrigen: Record<string, number> = {};
  let tokensIn = 0;
  let tokensOut = 0;
  // Con la columna "modelo" (14/10/2026) cada fila se cobra con su modelo; si el SQL todavía no corrió, sin ella.
  const OPCIONES = [
    "origen, modelo, input_tokens, output_tokens, busquedas_web, cache_escritura_tokens, cache_lectura_tokens",
    "origen, modelo, input_tokens, output_tokens",
    "origen, input_tokens, output_tokens",
  ];
  let opcion = 0;
  let columnas = OPCIONES[0];
  for (let pagina = 0; pagina < 200; pagina++) {
    let q = supabase.from("uso_ia_anthropic").select(columnas).gte("created_at", desde);
    if (origenes?.length) q = q.in("origen", origenes);
    if (hasta) q = q.lt("created_at", hasta);
    const { data: crudo, error } = await q.order("created_at").range(pagina * 1000, pagina * 1000 + 999);
    if (error && opcion < OPCIONES.length - 1 && /column|columna|does not exist/i.test(error.message)) { columnas = OPCIONES[++opcion]; pagina--; continue; }
    const data = crudo as unknown as FilaUsoIa[] | null;
    if (error || !data) break;
    data.forEach((r) => {
      porOrigen[r.origen || "desconocido"] = (porOrigen[r.origen || "desconocido"] || 0) + costoFilaIaUsd(r);
      tokensIn += r.input_tokens || 0;
      tokensOut += r.output_tokens || 0;
    });
    if (data.length < 1000) break;
  }
  return { usd: Object.values(porOrigen).reduce((a, b) => a + b, 0), tokensIn, tokensOut, porOrigen };
}

export interface EstimacionSaldoIa {
  configurado: boolean;
  saldoInicialUsd: number | null; // saldo REAL de la Consola el día que se cargó
  desde: string | null;
  umbralUsd: number;
  gastadoUsd: number; // desde que se cargó el saldo real, ajustado
  restanteUsd: number | null;
  porOrigen: { origen: string; usd: number }[];
  // 14/10/2026: compra del crédito y cuentas del mes (todo ajustado a lo real).
  compradoUsd: number | null;
  compradoEl: string | null;
  factorAjuste: number;
  gastoMesUsd: number;
  proyeccionMesUsd: number;
  gastoDesdeCompraUsd: number | null; // real: comprado menos disponible
  ritmoDiarioUsd: number; // desde la compra (o en el mes, si no hay compra cargada)
  diasQueAlcanza: number | null; // al ritmo de este mes
  fechaQueSeAcaba: string | null;
  alcanzaFinDeMes: boolean | null;
}

export async function estimarSaldoIa(): Promise<EstimacionSaldoIa> {
  const cfg = await leerConfigIa();
  const umbralUsd = Number(cfg?.ia_alerta_saldo_usd ?? 5);
  const saldoInicial = cfg?.ia_saldo_inicial_usd != null ? Number(cfg.ia_saldo_inicial_usd) : null;
  const desde: string | null = cfg?.ia_saldo_desde ?? null;
  const compradoUsd = cfg?.ia_credito_comprado_usd != null ? Number(cfg.ia_credito_comprado_usd) : null;
  const compradoEl = cfg?.ia_credito_comprado_el ?? null;
  const vacio = { compradoUsd, compradoEl, factorAjuste: 1, gastoMesUsd: 0, proyeccionMesUsd: 0, gastoDesdeCompraUsd: null, ritmoDiarioUsd: 0, diasQueAlcanza: null, fechaQueSeAcaba: null, alcanzaFinDeMes: null };
  if (saldoInicial == null || !desde) return { configurado: false, saldoInicialUsd: saldoInicial, desde, umbralUsd, gastadoUsd: 0, restanteUsd: null, porOrigen: [], ...vacio };

  const hoy = new Date();
  const [factor, desdeSaldo, delMes] = await Promise.all([factorIa(cfg), gastoIaCrudo(desde), gastoIaCrudo(inicioDeMesUtc(hoy))]);
  const gastoPorOrigen = Object.fromEntries(Object.entries(desdeSaldo.porOrigen).map(([k, v]) => [k, v * factor]));
  const gastadoUsd = desdeSaldo.usd * factor;
  const restanteUsd = saldoInicial - gastadoUsd;
  const gastoMesUsd = delMes.usd * factor;
  const gastoDesdeCompraUsd = compradoUsd != null && compradoEl ? Math.max(0, compradoUsd - restanteUsd) : null;
  const diasDesdeCompra = compradoEl ? Math.max(1, (hoy.getTime() - new Date(compradoEl + "T00:00:00Z").getTime()) / 86400000) : null;
  const ritmoDiarioUsd = gastoDesdeCompraUsd != null && diasDesdeCompra ? gastoDesdeCompraUsd / diasDesdeCompra : gastoMesUsd / Math.max(1, hoy.getUTCDate());
  const diasQueAlcanza = ritmoDiarioUsd > 0 ? Math.max(0, restanteUsd) / ritmoDiarioUsd : null;
  const diasQueFaltanDelMes = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 0)).getUTCDate() - hoy.getUTCDate();
  return {
    configurado: true, saldoInicialUsd: saldoInicial, desde, umbralUsd, gastadoUsd, restanteUsd,
    porOrigen: Object.entries(gastoPorOrigen).map(([origen, usd]) => ({ origen, usd })).sort((a, b) => b.usd - a.usd),
    compradoUsd, compradoEl, factorAjuste: factor, gastoMesUsd, proyeccionMesUsd: proyeccionFinDeMes(gastoMesUsd, hoy), gastoDesdeCompraUsd, ritmoDiarioUsd,
    diasQueAlcanza, fechaQueSeAcaba: diasQueAlcanza == null ? null : new Date(hoy.getTime() + diasQueAlcanza * 86400000).toISOString(), alcanzaFinDeMes: diasQueAlcanza == null ? null : diasQueAlcanza >= diasQueFaltanDelMes,
  };
}

// Avisa a los admin (alerta en el panel). No repite el aviso dentro de `minHoras`.
export async function avisarSaldoIa(titulo: string, mensaje: string, minHoras: number): Promise<{ avisado: boolean }> {
  const supabase = supabaseAdmin();
  const { data: cfg } = await supabase.from("configuracion_empresa").select("ia_alerta_enviada_en").maybeSingle();
  if (cfg?.ia_alerta_enviada_en && Date.now() - new Date(cfg.ia_alerta_enviada_en).getTime() < minHoras * 3600000) return { avisado: false };

  const { data: admins } = await supabase.from("perfiles").select("id").overlaps("roles", ["admin", "director"]).eq("activo", true);
  for (const a of admins || []) {
    await crearAlerta(supabase, a.id, titulo, { mensaje, link: "/panel/configuracion/empresa", tipo: "ia_saldo", prioridad: "alta" });
  }
  await supabase.from("configuracion_empresa").update({ ia_alerta_enviada_en: new Date().toISOString() });
  return { avisado: true };
}

// Se llama cuando Anthropic rechaza una consulta por falta de crédito (aviso real, no estimado).
export function avisarSaldoAgotado() {
  avisarSaldoIa(
    "Se quedó sin crédito la API de Anthropic",
    "Anthropic rechazó una consulta por falta de saldo. El bot, el buscador y el gerente dejan de responder con IA hasta que cargues crédito en console.anthropic.com.",
    6
  ).catch(() => {});
}
