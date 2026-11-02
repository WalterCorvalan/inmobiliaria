import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONDICION_SITIO_PUBLICO, scriptDiferido, seMideEnRuta } from "./medicionSoloSitio";

describe("la medición es solo del sitio público", () => {
  it("el panel no se mide; el sitio, sí", () => {
    expect(seMideEnRuta("/panel")).toBe(false);
    expect(seMideEnRuta("/panel/leads")).toBe(false);
    expect(seMideEnRuta("/")).toBe(true);
    expect(seMideEnRuta("/catalogo/ford-ranger")).toBe(true);
    expect(seMideEnRuta("/panelito")).toBe(true);
  });

  it("la condición de los scripts dice lo mismo que la función", () => {
    for (const ruta of ["/panel", "/panel/leads", "/", "/catalogo", "/panelito"]) {
      const location = { pathname: ruta };
      expect(new Function("location", `return ${CONDICION_SITIO_PUBLICO};`)(location)).toBe(seMideEnRuta(ruta));
    }
  });

  it("Analytics, el Pixel y Clarity usan la condición antes de arrancar", () => {
    for (const archivo of ["components/GoogleAnalytics.tsx", "components/MetaPixel.tsx", "components/MicrosoftClarity.tsx"]) {
      expect(readFileSync(archivo, "utf8")).toContain("CONDICION_SITIO_PUBLICO");
    }
  });

  it("la carga diferida es JavaScript válido, espera a que la página esté libre y no se dispara al desplazarse", () => {
    const js = scriptDiferido("window.cargado = true;", 1500);
    expect(() => new Function(js)).not.toThrow();
    expect(js).toContain("requestIdleCallback");
    expect(js).toContain("1500");
    expect(js).not.toContain("scroll");
  });

  it("los tres usan la carga diferida", () => {
    for (const archivo of ["components/GoogleAnalytics.tsx", "components/MetaPixel.tsx", "components/MicrosoftClarity.tsx"]) {
      expect(readFileSync(archivo, "utf8")).toContain("scriptDiferido(cargar");
    }
  });
});
