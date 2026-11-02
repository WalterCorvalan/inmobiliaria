import { describe, expect, it } from "vitest";
import { ORIGENES_CLIENTE, esOrigenClienteValido, etiquetaOrigen, normalizarOrigenCliente } from "./origenesCliente";

describe("orígenes de cliente", () => {
  // Esta lista la fija el dueño. Si este test falla NO se cambia el test: se revierte el cambio a la lista.
  it("son exactamente estos 10, en este orden (Llamada la sumó el dueño el 21/10/2026)", () => {
    expect([...ORIGENES_CLIENTE]).toEqual(["Instagram", "Facebook", "MercadoLibre", "Rodi", "Messenger", "Web", "Salón", "WhatsApp", "Llamada", "Otro"]);
  });

  it("los valores válidos se reconocen y los viejos no", () => {
    for (const o of ORIGENES_CLIENTE) expect(esOrigenClienteValido(o)).toBe(true);
    for (const viejo of ["Showroom", "Referido", "Google Ads", "Cliente anterior", "", null, undefined]) expect(esOrigenClienteValido(viejo)).toBe(false);
  });

  it("normaliza siempre a uno de los 10", () => {
    expect(normalizarOrigenCliente("Showroom")).toBe("Salón");
    expect(normalizarOrigenCliente("Referido")).toBe("Otro");
    expect(normalizarOrigenCliente("Google Ads")).toBe("Otro");
    expect(normalizarOrigenCliente("Cliente anterior")).toBe("Otro");
    expect(normalizarOrigenCliente(null)).toBe("Otro");
    expect(normalizarOrigenCliente("")).toBe("Otro");
    expect(normalizarOrigenCliente("mercado libre")).toBe("MercadoLibre");
    expect(normalizarOrigenCliente("salon")).toBe("Salón");
    expect(normalizarOrigenCliente("MESSENGER")).toBe("Messenger");
    for (const o of ORIGENES_CLIENTE) expect(normalizarOrigenCliente(o)).toBe(o);
    for (const raro of ["xyz", "Facebook Ads", "  "]) expect(esOrigenClienteValido(normalizarOrigenCliente(raro))).toBe(true);
  });

  it("se guarda Rodi pero en pantalla se lee Paffy (Walter, 20/10/2026)", () => {
    expect(ORIGENES_CLIENTE).toContain("Rodi");
    expect(etiquetaOrigen("Rodi")).toBe("Paffy");
    expect(etiquetaOrigen("rodi")).toBe("Paffy");
    expect(etiquetaOrigen("WhatsApp")).toBe("WhatsApp");
    expect(etiquetaOrigen(null)).toBe("");
  });
});
