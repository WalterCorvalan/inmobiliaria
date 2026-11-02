// Ajuste del gasto estimado de IA con los números reales de la Consola de Anthropic (14/10/2026, Walter: "el 15,21 no
// es un estimado, es lo que hay; lo gastado es la diferencia"). Puras, para poder probarlas.
//
// El panel estima cada consulta con tokens x tarifa (lib/ai/costoIa.ts), pero Anthropic cobra cosas que el panel no ve
// del todo (o redondea distinto). Con lo comprado y el saldo real se sabe cuánto se gastó DE VERDAD en ese período; si
// el panel estimó otra cosa en el mismo período, todas sus cuentas se multiplican por esa proporción. Así el total da
// lo real y el reparto entre servicios sigue la proporción de uso que el panel sí mide.

// Proporción real / estimado. Sin datos suficientes, 1 (sin ajuste). Se acota para que un dato mal cargado no
// dispare números absurdos.
export function factorAjusteIa({ compradoUsd, saldoRealUsd, estimadoUsd }: { compradoUsd: number | null; saldoRealUsd: number | null; estimadoUsd: number }): number {
  if (compradoUsd == null || saldoRealUsd == null || !(estimadoUsd > 0)) return 1;
  const real = compradoUsd - saldoRealUsd;
  if (!(real > 0)) return 1;
  return Math.min(5, Math.max(0.05, real / estimadoUsd));
}

// Cuánto se va a gastar en el mes al ritmo de lo que va del mes. `hoy` en UTC, como la Consola de Anthropic.
export function proyeccionFinDeMes(gastoMesUsd: number, hoy = new Date()): number {
  const dia = hoy.getUTCDate();
  const diasMes = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 0)).getUTCDate();
  if (!(dia > 0) || !(gastoMesUsd > 0)) return 0;
  return (gastoMesUsd / dia) * diasMes;
}

export function inicioDeMesUtc(hoy = new Date()): string {
  return new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1)).toISOString();
}
