// Bloque de "sugerirCierre" (charla larga) — extraído sin cambios.
// Devuelve exactamente el valor del ternario original (sin newline extra); el llamador decide el espaciado alrededor.
export function bloqueCierreSugerido(sugerirCierre?: boolean): string {
  return `${sugerirCierre ? `\nLa charla ya viene larga y en este momento hay mucha gente escribiendo a la vez — sé más eficiente: resumí en una sola pregunta lo que falta para cerrar el tema (en vez de ir pregunta por pregunta), y si el cliente ya dio lo esencial, ofrecé derivarlo con un asesor para resolver el resto más rápido en persona. Podés mencionar con naturalidad que hay bastante consulta en este momento, sin sonar como excusa robótica.` : ""}`;
}
