// Cuentas del visor de fotos con zoom (components/modals/VisorFotosModal.tsx). La foto se dibuja centrada y se le aplica
// translate(x, y) scale(escala) con origen en el centro. Los puntos se miden desde el centro del visor.

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 5;

export type Vista = { escala: number; x: number; y: number };
export const VISTA_INICIAL: Vista = { escala: 1, x: 0, y: 0 };

const limitar = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

// Lo que la foto agrandada sobresale del visor, por lado: hasta ahí se puede arrastrar. Si no sobresale, queda centrada.
export function limitarDesplazamiento(v: Vista, foto: { ancho: number; alto: number }, visor: { ancho: number; alto: number }): Vista {
  const maxX = Math.max(0, (foto.ancho * v.escala - visor.ancho) / 2);
  const maxY = Math.max(0, (foto.alto * v.escala - visor.alto) / 2);
  return { escala: v.escala, x: limitar(v.x, -maxX, maxX), y: limitar(v.y, -maxY, maxY) };
}

// Cambia el zoom dejando quieto el punto de la foto que está debajo de `punto` (el mouse, o el centro de los dos dedos).
export function zoomEnPunto(v: Vista, nuevaEscala: number, punto: { x: number; y: number }): Vista {
  const escala = limitar(nuevaEscala, ZOOM_MIN, ZOOM_MAX);
  if (escala === ZOOM_MIN) return VISTA_INICIAL;
  const k = escala / v.escala;
  return { escala, x: punto.x - (punto.x - v.x) * k, y: punto.y - (punto.y - v.y) * k };
}
