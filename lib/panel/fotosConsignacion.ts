// Fotos del auto que manda el cliente al consignar desde la web. Mínimo 5 para que el asesor pueda
// evaluar el estado del auto sin pedirlas de nuevo por WhatsApp.
export const MIN_FOTOS_CONSIGNACION = 5;
export const MAX_FOTOS_CONSIGNACION = 20;

export function fotosConsignacionValidas(fotos: readonly string[] | null | undefined): boolean {
  return !!fotos && fotos.length >= MIN_FOTOS_CONSIGNACION && fotos.length <= MAX_FOTOS_CONSIGNACION;
}
