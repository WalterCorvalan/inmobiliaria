import { describe, expect, it } from "vitest";
import { charlaQuieta, ocultarCharlasDelBotSinAsignar, seQuedaLaCharla, textoClienteDejoDeContestar } from "./asignacionWhatsapp";

const charlas = [
  { id: "bot", vendedor_id: null, ai_habilitada: true },
  { id: "mia", vendedor_id: "yo", ai_habilitada: true },
  { id: "sin-bot", vendedor_id: null, ai_habilitada: false },
  { id: "instagram", vendedor_id: null },
];

describe("quién ve las charlas de WhatsApp en las que habla el bot", () => {
  it("un vendedor no ve las que el bot todavía atiende sin vendedor", () => {
    expect(ocultarCharlasDelBotSinAsignar(charlas, { soyAdmin: false, soyEncargado: false }).map((c) => c.id)).toEqual(["mia", "sin-bot", "instagram"]);
  });

  it("admin y encargados las ven todas", () => {
    expect(ocultarCharlasDelBotSinAsignar(charlas, { soyAdmin: true, soyEncargado: false })).toHaveLength(4);
    expect(ocultarCharlasDelBotSinAsignar(charlas, { soyAdmin: false, soyEncargado: true })).toHaveLength(4);
  });
});

describe("quien escribe se queda la charla", () => {
  it("si vende", () => {
    expect(seQuedaLaCharla(["ventas"])).toBe(true);
    expect(seQuedaLaCharla(["encargado"])).toBe(true);
  });

  it("un admin que solo mira no", () => {
    expect(seQuedaLaCharla(["admin"])).toBe(false);
    expect(seQuedaLaCharla(null)).toBe(false);
  });
});

describe("el cliente dejó de contestar", () => {
  const ahora = new Date("2026-10-31T15:00:00Z");

  it("recién después de unos minutos sin mensajes", () => {
    expect(charlaQuieta({ ultimoMensaje: "2026-10-31T14:59:00Z", avisadaHasta: null, ahora })).toBe(false);
    expect(charlaQuieta({ ultimoMensaje: "2026-10-31T14:55:00Z", avisadaHasta: null, ahora })).toBe(true);
  });

  it("una sola vez por cada vez que se corta", () => {
    expect(charlaQuieta({ ultimoMensaje: "2026-10-31T14:55:00Z", avisadaHasta: "2026-10-31T14:55:00Z", ahora })).toBe(false);
    expect(charlaQuieta({ ultimoMensaje: "2026-10-31T14:55:00Z", avisadaHasta: "2026-10-31T14:40:00Z", ahora })).toBe(true);
  });

  it("el aviso cuenta lo último que preguntó el bot", () => {
    expect(textoClienteDejoDeContestar("¿Te queda bien el lunes 2 de noviembre a las 10?")).toBe(
      "El cliente dejó de contestar. Lo último que le preguntó el bot: \"¿Te queda bien el lunes 2 de noviembre a las 10?\". Fijate esta charla.",
    );
    expect(textoClienteDejoDeContestar(null)).toBe("El cliente dejó de contestar. Fijate esta charla.");
  });
});
