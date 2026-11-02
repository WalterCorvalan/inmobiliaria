import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NOMBRE_ASISTENTE_WEB } from "./asistenteWeb";

// Walter, 20/10/2026: el asistente se llama Paffy (un golden retriever). Por dentro sigue siendo Rodi.
describe("asistente del sitio", () => {
  it("se presenta como Paffy en la web", () => {
    expect(NOMBRE_ASISTENTE_WEB).toBe("Paffy");
    const chat = readFileSync(new URL("../components/FloatingChatbot.tsx", import.meta.url), "utf8");
    expect(chat).not.toMatch(/Soy Rodi|Rodi · Pfaffen/);
    const ruta = readFileSync(new URL("../app/api/panel/rodi/mensaje/route.ts", import.meta.url), "utf8");
    expect(ruta).toContain('generarRespuestaAgenteV2(historial, "panel-v2/rodi", NOMBRE_ASISTENTE_WEB');
  });
});
