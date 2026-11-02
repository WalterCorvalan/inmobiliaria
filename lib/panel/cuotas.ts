// Reglas de planes de cuotas (ventas financiadas y deudas de la agencia), puras para poder probarlas.

// Suma meses a una fecha "AAAA-MM-DD" conservando el día; si el mes de destino no tiene ese día, queda en su último día.
// new Date(...).setMonth() desbordaba: el 31/1 + 1 mes daba el 3/3 (y no el 28/2), y de ahí se corrían todas las cuotas siguientes.
export function sumarMeses(fechaISO: string, meses: number): string {
  const [anio, mes, dia] = fechaISO.slice(0, 10).split("-").map(Number);
  const indice = (mes - 1) + meses;
  const anioDestino = anio + Math.floor(indice / 12);
  const mesDestino = ((indice % 12) + 12) % 12;
  const ultimoDia = new Date(anioDestino, mesDestino + 1, 0).getDate();
  const diaDestino = Math.min(dia, ultimoDia);
  return `${anioDestino}-${String(mesDestino + 1).padStart(2, "0")}-${String(diaDestino).padStart(2, "0")}`;
}

// Reparte un total en `n` cuotas de centavos exactos: todas iguales y la última absorbe la diferencia, así la suma da el total.
// (Redondear cada cuota por separado dejaba, por ejemplo, 3 cuotas de 33,33 sobre un saldo de 100.)
export function repartirEnCuotas(total: number, n: number): number[] {
  if (!(n > 0) || !(total > 0)) return Array.from({ length: Math.max(0, n) }, () => 0);
  const centavos = Math.round(total * 100);
  const base = Math.floor(centavos / n);
  const cuotas = Array.from({ length: n }, () => base);
  cuotas[n - 1] += centavos - base * n;
  return cuotas.map((c) => c / 100);
}

// Plan de cuotas de una venta financiada: monto, número y vencimiento de cada una. Sin saldo para financiar (la seña,
// la permuta, el efectivo o la financiera ya cubren el precio) no hay plan: antes se creaban igual N cuotas de $ 0 que
// llenaban Cobros (13/10/2026, una venta con 36 cuotas en cero).
export function planDeCuotas(saldo: number, n: number, fechaInicio: string): { cuota_actual: number; cuota_total: number; monto: number; vencimiento: string }[] {
  if (!(saldo > 0) || !(n > 0)) return [];
  return repartirEnCuotas(saldo, n).map((monto, i) => ({ cuota_actual: i + 1, cuota_total: n, monto, vencimiento: sumarMeses(fechaInicio, i + 1) }));
}

// "Plan automático" de Finanzas → Cuotas → A cobrar (13/10/2026, como el panel viejo): reparte un total en `n` cuotas
// desde el primer vencimiento que se elige, cada `cadaMeses` meses (1 mensual, 2 bimestral, 12 anual). A diferencia de
// planDeCuotas, la primera cuota vence en esa misma fecha y no un mes después.
export function planDesdePrimerVencimiento(total: number, n: number, primerVencimiento: string, cadaMeses = 1): { cuota_actual: number; cuota_total: number; monto: number; vencimiento: string }[] {
  if (!(total > 0) || !(n > 0) || !Number.isInteger(n) || !/^\d{4}-\d{2}-\d{2}/.test(primerVencimiento)) return [];
  return repartirEnCuotas(total, n).map((monto, i) => ({ cuota_actual: i + 1, cuota_total: n, monto, vencimiento: sumarMeses(primerVencimiento, cadaMeses * i) }));
}
