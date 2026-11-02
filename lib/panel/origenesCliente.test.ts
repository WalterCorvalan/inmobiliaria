import { describe, expect, it } from "vitest";
import { ORIGENES_CLIENTE, esOrigenClienteValido, etiquetaOrigen, normalizarOrigenCliente } from "./origenesCliente";

describe("orígenes de cliente", () => {
  // Esta lista la fija el dueño. Si este test falla NO se cambia el test: se revierte el cambio a la lista.
  it("son exactamente estos 11, en este orden (definidos por el dueño el 2/11/2026)", () => {
    expect([...ORIGENES_CLIENTE]).toEqual(["Zonaprop", "Argenprop", "MercadoLibre", "Instagram", "Facebook", "Messenger", "WhatsApp", "Web", "Oficina", "Llamada", "Otro"]);
  });

  it("los valores válidos se reconocen y los viejos no", () => {
    for (const o of ORIGENES_CLIENTE) expect(esOrigenClienteValido(o)).toBe(true);
    for (const viejo of ["Showroom", "Rodi", "Salón", "Referido", "Google Ads", "Cliente anterior", "", null, undefined]) expect(esOrigenClienteValido(viejo)).toBe(false);
  });

  it("normaliza siempre a uno de los 11", () => {
    expect(normalizarOrigenCliente("Showroom")).toBe("Oficina");
    expect(normalizarOrigenCliente("Rodi")).toBe("Web");
    expect(normalizarOrigenCliente("Referido")).toBe("Otro");
    expect(normalizarOrigenCliente("Google Ads")).toBe("Otro");
    expect(normalizarOrigenCliente("Cliente anterior")).toBe("Otro");
    expect(normalizarOrigenCliente(null)).toBe("Otro");
    expect(normalizarOrigenCliente("")).toBe("Otro");
    expect(normalizarOrigenCliente("mercado libre")).toBe("MercadoLibre");
    expect(normalizarOrigenCliente("salon")).toBe("Oficina");
    expect(normalizarOrigenCliente("zona prop")).toBe("Zonaprop");
    expect(normalizarOrigenCliente("MESSENGER")).toBe("Messenger");
    for (const o of ORIGENES_CLIENTE) expect(normalizarOrigenCliente(o)).toBe(o);
    for (const raro of ["xyz", "Facebook Ads", "  "]) expect(esOrigenClienteValido(normalizarOrigenCliente(raro))).toBe(true);
  });

  it("el chat de la web se guarda Rodi por dentro pero en pantalla se lee Chat web", () => {
    expect(ORIGENES_CLIENTE).not.toContain("Rodi");
    expect(etiquetaOrigen("Rodi")).toBe("Chat web");
    expect(etiquetaOrigen("rodi")).toBe("Chat web");
    expect(etiquetaOrigen("WhatsApp")).toBe("WhatsApp");
    expect(etiquetaOrigen(null)).toBe("");
  });
});
