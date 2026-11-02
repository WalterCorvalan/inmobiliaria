import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NOMBRE_ASISTENTE_WEB } from "./asistenteWeb";

describe("asistente del sitio", () => {
  it("se presenta con el nombre por defecto en la web", () => {
    expect(NOMBRE_ASISTENTE_WEB).toBe("Asistente");
    const chat = readFileSync(new URL("../components/FloatingChatbot.tsx", import.meta.url), "utf8");
    expect(chat).not.toMatch(/Soy Rodi|Rodi · /);
    const ruta = readFileSync(new URL("../app/api/panel/rodi/mensaje/route.ts", import.meta.url), "utf8");
    expect(ruta).toContain('generarRespuestaAgenteV2(historial, "panel-v2/rodi", { nombreBot: NOMBRE_ASISTENTE_WEB');
  });
});
