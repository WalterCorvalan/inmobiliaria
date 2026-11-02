import { describe, expect, it } from "vitest";
import { asegurarPedidoDeDatosWeb, respuestaFinanciacionWeb, preguntaPorCienPorCiento, respuestaMencionaFinanciacionInventada, respuestaSeguraConFinanciacionReal } from "./financiacionBot";
import { formatearFinanciacion, type FinanciacionInfo } from "./promptsV2";

const info: FinanciacionInfo = {
  topes: [{ anioDesde: 0, anioHasta: 2015, pct: 50 }, { anioDesde: 2016, anioHasta: null, pct: 65 }],
  tope0km: 70,
  tna: [{ anioDesde: 0, anioHasta: 9999, tna: { "12": 62, "24": 57 } }],
  gastosPct: 3,
};

describe("financiación en el bot (decisión de Walter del 12/10/2026)", () => {
  it("respuesta general: sí financiamos, topes reales, nombre completo y CUIL juntos, y nada más", () => {
    const r = respuestaSeguraConFinanciacionReal(info, "Hola, ¿financian?");
    expect(r).toBe(
      "Sí, financiamos hasta entre el 50% y el 65% del valor en usados, según el año del auto, y hasta el 70% en 0 km. Para darte más información, pasame tu nombre completo y tu CUIL, así chequeamos qué monto te ofrece el banco.",
    );
  });

  it("si preguntan por el 100%: sí, todas las financiaciones del mercado, nombre completo y CUIL", () => {
    const r = respuestaSeguraConFinanciacionReal(info, "Los créditos 100 % financiados, ¿se pueden consultar por acá?");
    expect(r).toMatch(/^Sí, financiamos hasta el 100%/);
    expect(r).toMatch(/todas las financiaciones del mercado \(crédito prendario, Banco Nación y Banco Provincia\)/);
    expect(r).toMatch(/nombre completo y tu CUIL/);
  });

  it("nunca da la tasa ni ofrece calcular juntos", () => {
    for (const msg of ["¿financian?", "¿financian el 100%?"]) {
      const r = respuestaSeguraConFinanciacionReal(info, msg);
      expect(r).not.toMatch(/TNA|tasa|calcul/i);
    }
    expect(formatearFinanciacion(info)).not.toMatch(/desde \d+% TNA|simulador/);
  });

  it("descarta una respuesta de la IA que nombra la tasa o un % inventado; acepta el 100% y los topes", () => {
    expect(respuestaMencionaFinanciacionInventada("Financiamos con tasas desde 57% TNA.", info)).toBe(true);
    expect(respuestaMencionaFinanciacionInventada("Financiamos hasta el 80% del auto.", info)).toBe(true);
    expect(respuestaMencionaFinanciacionInventada("Sí, financiamos hasta el 100% con crédito prendario.", info)).toBe(false);
    for (const msg of ["¿financian?", "¿financian el 100%?"]) {
      expect(respuestaMencionaFinanciacionInventada(respuestaSeguraConFinanciacionReal(info, msg), info)).toBe(false);
    }
  });

  it("reconoce cuándo preguntan por el 100%", () => {
    expect(preguntaPorCienPorCiento("financian el 100%?")).toBe(true);
    expect(preguntaPorCienPorCiento("cien por ciento financiado")).toBe(true);
    expect(preguntaPorCienPorCiento("¿financian el total del auto?")).toBe(true);
    expect(preguntaPorCienPorCiento("¿tienen financiación?")).toBe(false);
  });
});

describe("Paffy (chat de la web): financiación en dos pasos (Walter, 31/10/2026)", () => {
  it("paso 1: topes, el 100% y qué auto quiere financiar; sin datos ni link", () => {
    expect(respuestaFinanciacionWeb(info)).toBe(
      "Sí, tenemos financiación propia: en usados, entre el 50% y el 65% del valor según el año, y en 0 km hasta el 70%. Con créditos bancarios (crédito prendario, Banco Nación y Banco Provincia) se puede llegar al 100%. ¿Qué auto te gustaría financiar?",
    );
    expect(respuestaMencionaFinanciacionInventada(respuestaFinanciacionWeb(info), info)).toBe(false);
  });

  it("solo Paffy cambia: WhatsApp, Instagram y Messenger siguen igual", () => {
    expect(formatearFinanciacion(info, false, true)).toContain("¿Qué auto te gustaría financiar?");
    expect(formatearFinanciacion(info, false, true)).toContain("tu nombre completo, tu teléfono y tu CUIL");
    expect(formatearFinanciacion(info)).not.toContain("¿Qué auto te gustaría financiar?");
    expect(formatearFinanciacion(info, true)).not.toContain("¿Qué auto te gustaría financiar?");
  });

  it("paso 2 asegurado: si muestra stock y cierra con otra pregunta, la cambia por el pedido con CUIL", () => {
    const antes = respuestaFinanciacionWeb(info);
    expect(asegurarPedidoDeDatosWeb("Tenemos estos Corolla:\n\n🚗 Corolla 2022\n\n¿Cuál te interesa?", antes)).toBe(
      "Tenemos estos Corolla:\n\n🚗 Corolla 2022\n\nPasame tu nombre completo, tu teléfono y tu CUIL, y un asesor te arma los números y te contacta.",
    );
    expect(asegurarPedidoDeDatosWeb("Pasame tu CUIL", antes)).toBe("Pasame tu CUIL");
    expect(asegurarPedidoDeDatosWeb("¿Cuál te interesa?", "Hola")).toBe("¿Cuál te interesa?");
  });
});
