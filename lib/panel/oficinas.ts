// Oficinas (tabla sucursales): identificador para el bot y texto del horario. Funciones puras.

/** "Lomas de Zamora" → "lomas-de-zamora". Es el identificador que el bot devuelve en "zona". */
export function slugDeNombre(nombre: string): string {
  return nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

const DIAS_CORTOS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function hora(n: number): string {
  const h = Math.floor(n);
  const m = Math.round((n - h) * 60);
  return m ? `${h}:${String(m).padStart(2, "0")}` : `${h}`;
}

/** "lunes a viernes de 9 a 18". Días 0 = domingo … 6 = sábado (como la tabla). */
export function textoHorario(o: { diaDesde: number; diaHasta: number; horaDesde: number; horaHasta: number }): string {
  const dias = o.diaDesde === o.diaHasta ? DIAS_CORTOS[o.diaDesde] : `${DIAS_CORTOS[o.diaDesde]} a ${DIAS_CORTOS[o.diaHasta]}`;
  return `${dias} de ${hora(o.horaDesde)} a ${hora(o.horaHasta)}`;
}

export { DIAS_CORTOS };
