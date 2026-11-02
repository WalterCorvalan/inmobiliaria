import { describe, it, expect } from "vitest";
import { evaluarWhatsapp, evaluarTokenCanal, evaluarWebhooks, debeAvisar, estadoTokenDeRespuesta, UMBRAL_FIRMA, type HechosWhatsapp } from "./saludIntegraciones";

const sano: HechosWhatsapp = { token: "ok", numeroEstado: "CONNECTED", negocioVerificacion: "verified", pagoAsociado: true, erroresPago24h: 0 };

describe("evaluarWhatsapp", () => {
  it("todo bien: sin hallazgos", () => { expect(evaluarWhatsapp(sano)).toEqual([]); });
  it("token vencido es lo único que se avisa (el resto no se puede saber)", () => {
    const r = evaluarWhatsapp({ ...sano, token: "vencido", numeroEstado: "DISCONNECTED" });
    expect(r.map((h) => h.clave)).toEqual(["wa-token"]);
  });
  it("número desconectado es crítico", () => {
    const r = evaluarWhatsapp({ ...sano, numeroEstado: "DISCONNECTED" });
    expect(r[0]).toMatchObject({ clave: "wa-numero", gravedad: "critica" });
    expect(r[0].titulo).toContain("DISCONNECTED");
  });
  it("estados transitorios (PENDING) o desconocidos no avisan", () => {
    expect(evaluarWhatsapp({ ...sano, numeroEstado: "PENDING" })).toEqual([]);
    expect(evaluarWhatsapp({ ...sano, numeroEstado: null })).toEqual([]);
  });
  it("negocio sin verificar es crítico", () => {
    expect(evaluarWhatsapp({ ...sano, negocioVerificacion: "not_verified" })[0].clave).toBe("wa-negocio");
    expect(evaluarWhatsapp({ ...sano, negocioVerificacion: null })).toEqual([]);
  });
  it("mensajes fallidos por pago son críticos y reemplazan el aviso de método faltante", () => {
    const r = evaluarWhatsapp({ ...sano, erroresPago24h: 2, pagoAsociado: false });
    expect(r.map((h) => h.clave)).toEqual(["wa-pago-error"]);
    expect(r[0].mensaje).toContain("2 mensajes");
  });
  it("sin método de pago asociado (y sin errores) es solo atención", () => {
    expect(evaluarWhatsapp({ ...sano, pagoAsociado: false })[0]).toMatchObject({ clave: "wa-pago-sin-metodo", gravedad: "atencion" });
    expect(evaluarWhatsapp({ ...sano, pagoAsociado: null })).toEqual([]);
  });
  it("un solo mensaje fallido usa el singular", () => {
    expect(evaluarWhatsapp({ ...sano, erroresPago24h: 1 })[0].mensaje).toMatch(/^1 mensaje no salieron/);
  });
});

describe("evaluarTokenCanal", () => {
  it("solo avisa si el token venció", () => {
    expect(evaluarTokenCanal("Instagram", "ok")).toEqual([]);
    expect(evaluarTokenCanal("Messenger", "desconocido")).toEqual([]);
    const r = evaluarTokenCanal("Messenger", "vencido");
    expect(r[0]).toMatchObject({ clave: "messenger-token", link: "/panel/configuracion/messenger" });
  });
});

describe("evaluarWebhooks", () => {
  it("avisa desde el umbral, por canal", () => {
    expect(evaluarWebhooks({ Instagram: UMBRAL_FIRMA - 1, Messenger: 0 })).toEqual([]);
    const r = evaluarWebhooks({ Instagram: UMBRAL_FIRMA, Messenger: 1 });
    expect(r.map((h) => h.clave)).toEqual(["webhook-instagram"]);
  });
});

describe("debeAvisar", () => {
  const ahora = new Date("2026-10-09T12:00:00Z").getTime();
  it("sin aviso previo, avisa", () => { expect(debeAvisar(null, ahora, 12)).toBe(true); });
  it("no repite dentro de la ventana y repite después", () => {
    expect(debeAvisar("2026-10-09T05:00:00Z", ahora, 12)).toBe(false);
    expect(debeAvisar("2026-10-08T23:00:00Z", ahora, 12)).toBe(true);
  });
  it("una fecha rota cuenta como sin aviso", () => { expect(debeAvisar("basura", ahora, 12)).toBe(true); });
});

describe("estadoTokenDeRespuesta", () => {
  it("190 es token vencido; otros fallos no se interpretan", () => {
    expect(estadoTokenDeRespuesta({ ok: true })).toBe("ok");
    expect(estadoTokenDeRespuesta({ ok: false, codigoError: 190 })).toBe("vencido");
    expect(estadoTokenDeRespuesta({ ok: false, codigoError: 4 })).toBe("desconocido");
    expect(estadoTokenDeRespuesta({ ok: false })).toBe("desconocido");
  });
});
