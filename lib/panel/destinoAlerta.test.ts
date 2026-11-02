import { describe, expect, it } from "vitest";
import { destinoAlerta } from "./destinoAlerta";

describe("destinoAlerta", () => {
  it("un mensaje de Instagram guardado con la ruta vieja abre la bandeja de Instagram", () => {
    expect(destinoAlerta("/panel/whatsapp?canal=instagram&conversacion=abc")).toBe("/panel/instagram?conversacion=abc");
  });

  it("lo mismo para Messenger", () => {
    expect(destinoAlerta("/panel/whatsapp?canal=messenger&conversacion=abc")).toBe("/panel/messenger?conversacion=abc");
  });

  it("los de WhatsApp quedan igual", () => {
    expect(destinoAlerta("/panel/whatsapp?conversacion=abc")).toBe("/panel/whatsapp?conversacion=abc");
    expect(destinoAlerta("/panel/whatsapp?tab=leads&lead=1&origen=whatsapp")).toBe("/panel/whatsapp?tab=leads&lead=1&origen=whatsapp");
  });

  it("presupuestos viejos van a cotizaciones", () => {
    expect(destinoAlerta("/panel/presupuestos/imprimir/123")).toBe("/panel/cotizaciones/imprimir/123");
  });

  it("la vieja bandeja unificada va a WhatsApp", () => {
    expect(destinoAlerta("/panel/conversaciones?conversacion=x")).toBe("/panel/whatsapp?conversacion=x");
  });

  it("el resto no se toca", () => {
    expect(destinoAlerta("/panel/ventas")).toBe("/panel/ventas");
    expect(destinoAlerta(null)).toBeNull();
  });
});
