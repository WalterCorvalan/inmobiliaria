import { describe, expect, it } from "vitest";
import { promptDemo } from "./botDemo";
import { DEMO_INMOBILIARIA } from "./inmobiliaria";

describe("promptDemo", () => {
  it("usa el prompt del bot real con el negocio, las oficinas y las propiedades de ejemplo", () => {
    const p = promptDemo(DEMO_INMOBILIARIA, "whatsapp");
    expect(p).toContain("Te llamás Lucía, el asistente virtual de Propiedades del Sur.");
    expect(p).toContain("Oficina Belgrano [identificador: belgrano]");
    expect(p).toContain("A102 · Alquiler · Departamento 2 ambientes en Belgrano");
    expect(p).toContain("Este chat es de WhatsApp");
  });
  it("en Instagram avisa que no tiene el teléfono", () => {
    expect(promptDemo(DEMO_INMOBILIARIA, "instagram")).toContain("mensaje directo de Instagram");
  });
});

describe("leads de ejemplo", () => {
  it("son 15, con ids únicos y todos con resumen y charla", () => {
    const ids = new Set(DEMO_INMOBILIARIA.leads.map((l) => l.id));
    expect(ids.size).toBe(15);
    for (const l of DEMO_INMOBILIARIA.leads) {
      expect(l.resumen.length, l.id).toBeGreaterThan(20);
      expect(l.charla.length, l.id).toBeGreaterThan(0);
    }
  });
});

describe("cada inmobiliaria con su configuración", () => {
  it("el segundo negocio cambia nombre, tono y reglas en el prompt", async () => {
    const { DEMO_INMOBILIARIA_2 } = await import("./inmobiliaria");
    const p = promptDemo(DEMO_INMOBILIARIA_2, "whatsapp");
    expect(p).toContain("Martínez & Asociados");
    expect(p).toContain("tono formal y sobrio");
    expect(p).toContain("NO se acepta seguro de caución");
    expect(p).not.toContain("Lomas de Zamora");
    expect(promptDemo(DEMO_INMOBILIARIA, "whatsapp")).toContain("seguro de caución");
  });
});
