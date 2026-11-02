// El bot de WhatsApp/Rodi guarda "dia_visita" tal cual lo dice el cliente
// ("lunes", "mañana", "el 15"), pero "visitas.fecha_visita" se compara como
// string ISO (VisitasClient filtra/ordena con ">= hoy") -- un texto crudo
// tipo "lunes" rompe ese orden/filtro y en la práctica la visita queda
// invisible. Esto resuelve el texto a una fecha ISO real antes de guardar,
// asumiendo el PRÓXIMO día que corresponda (si hoy es lunes y dice "lunes",
// es el lunes que viene, no hoy).
//
// Las cuentas se hacen con el día de hoy en Argentina (el servidor corre en hora UTC: de 21 a 24 hs ya sería mañana).
const DIAS = ["domingo", "lunes", "martes", "miercoles", "miércoles", "jueves", "viernes", "sabado", "sábado"];
const DIA_A_INDICE: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, "miércoles": 3, jueves: 4, viernes: 5, sabado: 6, "sábado": 6,
};
const NOMBRE_DIA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const NOMBRE_MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function aIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Hoy en Argentina, a las 00:00 UTC (todas las cuentas de abajo usan los métodos UTC).
function hoyEnArgentina(ahora: Date): Date {
  const [anio, mes, dia] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(ahora).split("-").map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia));
}

function sumarDias(d: Date, dias: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + dias);
  return r;
}

// "martes 14" cuando el 14 es miércoles: el día de la semana y el número no coinciden. Pasó con un cliente que dijo
// "martes 13" y después "martes 14:00" (la hora): el bot armó "martes 14" y la visita quedó el miércoles (10/10/2026).
// Se toma el día con ese nombre más cercano al número (a lo sumo 3 días de distancia) y se marca como dudosa.
function alDiaNombrado(d: Date, objetivo: number | undefined): { fecha: Date; dudosa: boolean } {
  if (objetivo === undefined || d.getUTCDay() === objetivo) return { fecha: d, dudosa: false };
  let delta = (objetivo - d.getUTCDay() + 7) % 7;
  if (delta > 3) delta -= 7;
  return { fecha: sumarDias(d, delta), dudosa: true };
}

// dudosa = el día de la semana no coincidía con el número; quien atienda tiene que confirmar la fecha con el cliente.
export function resolverFechaVisitaConControl(texto: string, ahora: Date = new Date()): { fecha: string; dudosa: boolean } {
  const t = texto.trim().toLowerCase();
  const hoy = hoyEnArgentina(ahora);

  if (/\bhoy\b/.test(t)) return { fecha: aIso(hoy), dudosa: false };
  if (/\bma[ñn]ana\b/.test(t)) return { fecha: aIso(sumarDias(hoy, 1)), dudosa: false };

  const diaEncontrado = DIAS.find((nombre) => t.includes(nombre));
  const objetivo = diaEncontrado ? DIA_A_INDICE[diaEncontrado] : undefined;

  const fechaExplicita = t.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (fechaExplicita) {
    const dia = Number(fechaExplicita[1]);
    const mes = Number(fechaExplicita[2]) - 1;
    let anio = fechaExplicita[3] ? Number(fechaExplicita[3]) : hoy.getUTCFullYear();
    if (anio < 100) anio += 2000;
    const d = new Date(Date.UTC(anio, mes, dia));
    if (!Number.isNaN(d.getTime())) {
      if (!fechaExplicita[3] && d < hoy) d.setUTCFullYear(d.getUTCFullYear() + 1);
      const r = alDiaNombrado(d, objetivo);
      return { fecha: aIso(r.fecha), dudosa: r.dudosa };
    }
  }

  if (diaEncontrado) {
    // "lunes 14" -- el prompt pide siempre la fecha puntual junto con el día de la semana. Si viene un número de día del
    // mes suelto, se usa ese número (mes actual, o el que viene si ya pasó), corregido si no cae en ese día de la semana.
    const numeroDia = t.match(/\b(\d{1,2})\b/);
    if (numeroDia) {
      const dia = Number(numeroDia[1]);
      if (dia >= 1 && dia <= 31) {
        const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), dia));
        if (d < hoy) d.setUTCMonth(d.getUTCMonth() + 1);
        if (!Number.isNaN(d.getTime())) {
          const r = alDiaNombrado(d, objetivo);
          return { fecha: aIso(r.fecha < hoy ? sumarDias(r.fecha, 7) : r.fecha), dudosa: r.dudosa };
        }
      }
    }

    let delta = (objetivo! - hoy.getUTCDay() + 7) % 7;
    if (delta === 0) delta = 7; // "el lunes" dicho un lunes = el próximo, no hoy
    return { fecha: aIso(sumarDias(hoy, delta)), dudosa: false };
  }

  // No se pudo resolver -- se guarda tal cual para no perder el dato, aunque
  // quede fuera del orden/filtro por fecha en el panel.
  return { fecha: texto, dudosa: false };
}

export function resolverFechaVisita(texto: string, ahora: Date = new Date()): string {
  return resolverFechaVisitaConControl(texto, ahora).fecha;
}

// Para el prompt de los bots: el bot no sabía qué día era y armaba fechas que no existen ("lunes 14 o lunes 21" en un
// octubre donde los lunes eran 12 y 19). Hoy y los próximos días, cada uno con su nombre.
// El día que el bot le propone al cliente para acercarse (Walter, 31/10/2026: "en vez de preguntar el día, sugerirle uno"):
// mañana, salvo que sea domingo (cerrado, lib/horarioAtencion.ts): ahí el lunes.
export function proximoDiaDeVisita(ahora: Date = new Date()): string {
  let d = sumarDias(hoyEnArgentina(ahora), 1);
  if (d.getUTCDay() === 0) d = sumarDias(d, 1);
  return `${NOMBRE_DIA[d.getUTCDay()]} ${d.getUTCDate()} de ${NOMBRE_MES[d.getUTCMonth()]}`;
}

export function calendarioParaBot(ahora: Date = new Date(), dias = 14): string {
  const hoy = hoyEnArgentina(ahora);
  const linea = (d: Date) => `${NOMBRE_DIA[d.getUTCDay()]} ${d.getUTCDate()} de ${NOMBRE_MES[d.getUTCMonth()]}`;
  const proximos = Array.from({ length: dias }, (_, i) => linea(sumarDias(hoy, i + 1))).join(", ");
  return `FECHA DE HOY — hoy es ${linea(hoy)} de ${hoy.getUTCFullYear()} (hora de Argentina). Próximos días: ${proximos}. Próximo día de visita para proponer: ${proximoDiaDeVisita(ahora)} (domingo cerrado).
Cuando confirmes o propongas un día de visita, usá SOLO fechas de esta lista, con el nombre del día que le corresponde. Si el cliente dice un día de la semana con un número que no coincide (por ejemplo "martes 14" cuando el 14 es miércoles), no elijas vos: preguntale cuál de los dos quiso decir.`;
}
