import { describe, expect, it } from "vitest";
import { iconoModuloDeAlerta } from "./iconoAlerta";

describe("ícono de la alerta = el del módulo de donde viene (30/10/2026)", () => {
  it("usa el ícono del menú según a dónde lleva la alerta", () => {
    expect(iconoModuloDeAlerta("/panel/expedientes?expediente=1")).toBe("/icons/panel/expedientes.png");
    expect(iconoModuloDeAlerta("/panel/calendario")).toBe("/icons/panel/calendario.png");
    expect(iconoModuloDeAlerta("/panel")).toBe("/icons/panel/dashboard.png");
    expect(iconoModuloDeAlerta("/panel/mi-dia")).toBe("/icons/panel/mi-dia.png");
  });

  it("los chats llevan el ícono de su canal, también en los links viejos", () => {
    expect(iconoModuloDeAlerta("/panel/instagram?conversacion=a")).toBe("/icons/panel/instagram.png");
    expect(iconoModuloDeAlerta("/panel/whatsapp?canal=messenger&conversacion=a")).toBe("/icons/panel/messenger.png");
    expect(iconoModuloDeAlerta("/panel/presupuestos/1")).toBe("/icons/panel/cotizaciones.png");
  });

  it("sin link o sin módulo con ícono: null (queda el ícono por tipo)", () => {
    expect(iconoModuloDeAlerta(null)).toBeNull();
    expect(iconoModuloDeAlerta("/panel/no-existe")).toBeNull();
    expect(iconoModuloDeAlerta("https://otro.com")).toBeNull();
  });
});
