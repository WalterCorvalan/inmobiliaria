import { describe, expect, it } from "vitest";
import { avisoMensajeNoEnviado, avisoVentana, etiquetaDia, estadoVentana, textoRestante } from "./ventana24h";

describe("ventana de 24 horas", () => {
  const ultimo = "2026-10-10T12:59:00Z"; // sábado 9:59 en Argentina (caso Mateo)
  it("abierta, por vencer y vencida", () => {
    expect(estadoVentana(ultimo, new Date("2026-10-10T20:00:00Z"))?.estado).toBe("abierta");
    expect(estadoVentana(ultimo, new Date("2026-10-11T11:00:00Z"))?.estado).toBe("por_vencer");
    expect(estadoVentana(ultimo, new Date("2026-10-12T12:55:00Z"))?.estado).toBe("vencida");
    expect(estadoVentana(null, new Date())).toBeNull();
  });
  it("el aviso dice qué hacer y a qué hora", () => {
    const v = estadoVentana(ultimo, new Date("2026-10-11T11:00:00Z"));
    const a = avisoVentana("whatsapp", v)!;
    expect(a.titulo).toBe("Contestale antes de las 09:59 (quedan 1 h 59 min)");
    expect(a.detalle).toContain("plantilla aprobada");
    expect(avisoVentana("instagram", v)!.detalle).toContain("desde la app");
    // Vencida en Instagram: que conteste desde la app, que no cobra (21/10/2026).
    expect(avisoVentana("instagram", estadoVentana(ultimo, new Date("2026-10-12T12:55:00Z")))!.titulo).toBe("Contestale desde la app de Instagram");
    const vencida = avisoVentana("whatsapp", estadoVentana(ultimo, new Date("2026-10-12T12:55:00Z")))!;
    expect(vencida.plantilla).toBe(true);
    expect(avisoVentana("whatsapp", estadoVentana(ultimo, new Date("2026-10-10T20:00:00Z")))).toBeNull();
  });
  it("tiempo restante legible", () => {
    expect(textoRestante(40 * 60_000)).toBe("40 min");
    expect(textoRestante(2 * 3_600_000)).toBe("2 h");
    expect(textoRestante(30_000)).toBe("menos de 1 min");
  });
});

describe("separadores de día en el chat", () => {
  const ahora = new Date("2026-10-12T13:00:00Z"); // lunes 10:00 en Argentina
  it("hoy, ayer, el día de la semana y la fecha, como WhatsApp", () => {
    expect(etiquetaDia("2026-10-12T12:55:00Z", ahora)).toBe("Hoy");
    expect(etiquetaDia("2026-10-11T15:00:00Z", ahora)).toBe("Ayer");
    expect(etiquetaDia("2026-10-10T12:59:00Z", ahora)).toBe("sábado");
    expect(etiquetaDia("2026-10-01T15:00:00Z", ahora)).toBe("01/10/2026");
    // 01:00 UTC del lunes todavía es domingo en Argentina
    expect(etiquetaDia("2026-10-12T01:00:00Z", ahora)).toBe("Ayer");
  });
});

describe("permiso Human Agent de Meta (22/10/2026)", () => {
  it("con el permiso, Instagram y Messenger dan 7 días; WhatsApp sigue en 24 hs", async () => {
    const { horasVentana, estadoVentana: ev, avisoVentana: av } = await import("./ventana24h");
    expect(horasVentana("instagram", true)).toBe(168);
    expect(horasVentana("messenger", true)).toBe(168);
    expect(horasVentana("whatsapp", true)).toBe(24);
    expect(horasVentana("instagram", false)).toBe(24);
    const hace3Dias = new Date("2026-10-19T12:00:00Z");
    const ahora = new Date("2026-10-22T12:00:00Z");
    expect(ev(hace3Dias, ahora, horasVentana("instagram", true))?.estado).toBe("abierta");
    const vencida = ev(new Date("2026-10-10T12:00:00Z"), ahora, 168);
    expect(av("instagram", vencida, true)?.detalle).toContain("7 días");
  });
});

describe("aviso de mensaje que no salió (29/10/2026)", () => {
  it("pasadas las 24 hs pide mandar una plantilla", () => {
    const a = avisoMensajeNoEnviado("Jorge Rodríguez", "#131047 Re-engagement message");
    expect(a.titulo).toBe("No le llegó tu mensaje a Jorge Rodríguez");
    expect(a.mensaje).toMatch(/plantilla/);
  });
  it("otro error muestra el motivo", () => {
    expect(avisoMensajeNoEnviado("Ana", "#131026 Message undeliverable").mensaje).toMatch(/131026/);
    expect(avisoMensajeNoEnviado("Ana", null).mensaje).toMatch(/volvé a intentarlo/);
  });
});
