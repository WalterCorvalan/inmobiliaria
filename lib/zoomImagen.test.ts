import { describe, expect, it } from "vitest";
import { VISTA_INICIAL, ZOOM_MAX, limitarDesplazamiento, zoomEnPunto } from "./zoomImagen";

describe("zoom del visor de fotos", () => {
  it("el punto debajo del mouse queda en el mismo lugar al agrandar", () => {
    const punto = { x: 100, y: -40 };
    const v = zoomEnPunto(VISTA_INICIAL, 2, punto);
    expect(v).toEqual({ escala: 2, x: -100, y: 40 });
    // El punto de la foto que estaba en (100, -40) se dibuja en desplazamiento + escala × punto: otra vez (100, -40).
    expect(v.x + v.escala * punto.x).toBe(punto.x);
    expect(v.y + v.escala * punto.y).toBe(punto.y);
    // Y desde una vista ya agrandada y movida también.
    const w = zoomEnPunto({ escala: 2, x: 30, y: 10 }, 4, { x: -50, y: 20 });
    const enFoto = { x: (-50 - 30) / 2, y: (20 - 10) / 2 };
    expect(w.x + w.escala * enFoto.x).toBeCloseTo(-50);
    expect(w.y + w.escala * enFoto.y).toBeCloseTo(20);
  });

  it("no pasa del máximo y al volver a 1 queda centrada", () => {
    expect(zoomEnPunto(VISTA_INICIAL, 50, { x: 0, y: 0 }).escala).toBe(ZOOM_MAX);
    expect(zoomEnPunto({ escala: 3, x: 200, y: 90 }, 0.5, { x: 10, y: 10 })).toEqual(VISTA_INICIAL);
  });

  it("no deja arrastrar la foto más allá de su borde", () => {
    const foto = { ancho: 800, alto: 600 };
    const visor = { ancho: 1000, alto: 600 };
    // Con escala 2 la foto mide 1600 x 1200: sobresale 300 por lado a lo ancho y 300 a lo alto.
    expect(limitarDesplazamiento({ escala: 2, x: 999, y: -999 }, foto, visor)).toEqual({ escala: 2, x: 300, y: -300 });
    // Sin zoom no sobresale: queda centrada.
    expect(limitarDesplazamiento({ escala: 1, x: 50, y: 50 }, foto, visor)).toEqual({ escala: 1, x: 0, y: 0 });
  });
});
