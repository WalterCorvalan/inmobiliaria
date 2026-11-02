import { describe, it, expect } from "vitest";
import { esSoloEmoji, tipoDeReaccion, respuestaAReaccionHistoria, respuestaAMencionHistoria, textoDeRespuestaAHistoria } from "./reaccionHistoria";

describe("esSoloEmoji", () => {
  it("detecta uno o varios emojis, con variaciones", () => {
    for (const t of ["😂", "❤️", "👍🏽", "😂😂", " 🔥 "]) expect(esSoloEmoji(t)).toBe(true);
  });
  it("rechaza texto, mezcla y vacío", () => {
    for (const t of ["hola", "😂 jaja", "", "   ", null, undefined]) expect(esSoloEmoji(t as string)).toBe(false);
  });
});

describe("tipoDeReaccion", () => {
  it("clasifica por emoji", () => {
    expect(tipoDeReaccion("😂")).toBe("risa");
    expect(tipoDeReaccion("🤣🤣")).toBe("risa");
    expect(tipoDeReaccion("❤️")).toBe("agrado");
    expect(tipoDeReaccion("🔥")).toBe("agrado");
    expect(tipoDeReaccion("😮")).toBe("sorpresa");
    expect(tipoDeReaccion("😡")).toBe("disgusto");
    expect(tipoDeReaccion("🚗")).toBe("otra");
  });
  it("el disgusto gana si viene mezclado", () => {
    expect(tipoDeReaccion("😂😡")).toBe("disgusto");
  });
});

describe("respuestaAReaccionHistoria", () => {
  it("siempre invita a ver el stock y nunca pregunta qué pasó", () => {
    for (const e of ["😂", "❤️", "😮", "😡", "🚗"]) {
      const r = respuestaAReaccionHistoria(e);
      expect(r).toContain("propiedad");
      expect(r).not.toMatch(/qué pasó|malas noticias/i);
    }
  });
  it("cambia el tono según la reacción", () => {
    expect(respuestaAReaccionHistoria("😂")).toContain("reír");
    expect(respuestaAReaccionHistoria("😡")).toContain("Lamentamos");
  });
});

describe("mención y respuesta a historia", () => {
  it("la mención se agradece e invita al catálogo", () => {
    const r = respuestaAMencionHistoria();
    expect(r).toContain("mencionarnos");
    expect(r).toContain("propiedad");
  });
  it("la respuesta a una historia queda marcada como tal", () => {
    expect(textoDeRespuestaAHistoria("  ¿cuánto sale?  ")).toBe('Respondió a tu historia: "¿cuánto sale?"');
  });
});
