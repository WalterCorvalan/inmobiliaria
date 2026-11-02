import { describe, it, expect } from "vitest";
import { TIPO_ICON, TIPO_COLOR, TIPO_VER, TIPOS_RESUMEN } from "./alertaMeta";

// Regresión 5/10: el cron de resumen diario manda el tipo "resumen_diario",
// pero TIPOS_RESUMEN (y los mapas de ícono/color/texto) solo tenían los
// nombres viejos, así que la alerta nunca abría como resumen y salía con
// ícono genérico. Un tipo nuevo tiene que quedar mapeado en los cuatro lugares.
describe("alertaMeta", () => {
  it("todos los tipos de resumen que mandan los crons están reconocidos", () => {
    for (const tipo of ["resumen_diario", "mi_resumen_diario", "mi_resumen_semanal", "resumen_diario_empresa", "informe_marketing"]) {
      expect(TIPOS_RESUMEN.has(tipo), `falta ${tipo} en TIPOS_RESUMEN`).toBe(true);
    }
  });

  it("cada tipo de resumen tiene ícono, color y texto del botón", () => {
    for (const tipo of TIPOS_RESUMEN) {
      expect(TIPO_ICON[tipo], `ícono de ${tipo}`).toBeDefined();
      expect(TIPO_COLOR[tipo], `color de ${tipo}`).toBeDefined();
      expect(TIPO_VER[tipo], `texto de ${tipo}`).toBeDefined();
    }
  });

  it("los tres mapas tienen las mismas claves", () => {
    const claves = (o: object) => Object.keys(o).sort();
    expect(claves(TIPO_COLOR)).toEqual(claves(TIPO_ICON));
    expect(claves(TIPO_VER)).toEqual(claves(TIPO_ICON));
  });
});
