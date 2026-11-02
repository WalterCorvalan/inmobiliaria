import { describe, expect, it } from "vitest";
import { queAvisoPush } from "./pushCliente";

const base = { soportado: true, activo: false, iphone: false, instalada: false, permiso: "default" as const, descartado: false };

describe("aviso para activar las notificaciones push", () => {
  it("a quien no las tiene activadas le ofrece activarlas", () => {
    expect(queAvisoPush(base)).toBe("activar");
  });
  it("en iPhone sin instalar el panel le explica cómo instalarlo (sin eso iPhone no las deja)", () => {
    expect(queAvisoPush({ ...base, iphone: true, soportado: false })).toBe("instalar-iphone");
    expect(queAvisoPush({ ...base, iphone: true, instalada: true })).toBe("activar");
  });
  it("si el navegador soporta notificaciones, ofrece activarlas aunque parezca un iPhone sin instalar (14/10: el botón no aparecía)", () => {
    expect(queAvisoPush({ ...base, iphone: true, instalada: false, soportado: true })).toBe("activar");
  });
  it("si las bloqueó en el navegador se lo dice", () => {
    expect(queAvisoPush({ ...base, permiso: "denied" })).toBe("bloqueadas");
  });
  it("no molesta a quien ya las activó o cerró el aviso", () => {
    expect(queAvisoPush({ ...base, activo: true })).toBe("nada");
    expect(queAvisoPush({ ...base, descartado: true })).toBe("nada");
  });
});
