// Helpers para columnas `date` (sin hora) de Postgres. `new Date("YYYY-MM-DD")`
// las parsea como medianoche UTC — en un huso negativo como Argentina
// (UTC-3), formatearlas con toLocaleDateString las corre un día para atrás.
// Con estos helpers se arman/leen siempre en hora LOCAL, no UTC.

export function hoyLocalISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseFechaLocal(fechaISO: string): Date {
  const [y, m, d] = fechaISO.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function fmtFechaLocal(fechaISO: string, opts?: Intl.DateTimeFormatOptions): string {
  return parseFechaLocal(fechaISO).toLocaleDateString("es-AR", opts);
}

// "Hoy" en Argentina (UTC-3, sin horario de verano) como fecha al mediodía local. El servidor de Vercel corre en UTC:
// entre las 21:00 y las 24:00 de Argentina ya "era mañana" y el día y el mes saltaban 3 horas antes. Con el mediodía
// local, getDate/getMonth dan el mismo día en el servidor y en una PC.
export function hoyArgentina(): Date {
  const ar = new Date(Date.now() - 3 * 3600000);
  return new Date(ar.getUTCFullYear(), ar.getUTCMonth(), ar.getUTCDate(), 12);
}
