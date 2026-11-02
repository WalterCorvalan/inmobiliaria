import { describe, it, expect } from "vitest";
import { calcularScore, prioridadDeScore, motivosPrioridad, ordenarPorPrioridad, diasDesde } from "./prioridadLeads";

const AHORA = new Date("2026-10-07T15:00:00Z").getTime();
const hace = (horas: number) => new Date(AHORA - horas * 3600_000).toISOString();
const lead = (o: Partial<Parameters<typeof calcularScore>[0]> = {}) => ({
  calificacion: null, estado_lead: "asignado", vendedor_id: "v", last_message_at: hace(100), sinRespuesta: false, esBasuraFinal: false, ...o,
});

describe("calcularScore / prioridadDeScore", () => {
  it("perdidos, convertidos y basura quedan sin prioridad", () => {
    for (const o of [{ estado_lead: "perdido" }, { estado_lead: "convertido" }, { esBasuraFinal: true }]) {
      const s = calcularScore(lead(o), AHORA);
      expect(s).toBe(-1);
      expect(prioridadDeScore(s)).toBeNull();
    }
  });

  it("un lead caliente y nuevo es prioridad alta", () => {
    expect(prioridadDeScore(calcularScore(lead({ calificacion: "caliente", estado_lead: "nuevo" }), AHORA))).toBe("alta");
  });

  it("un lead frío ya atendido es prioridad baja", () => {
    expect(prioridadDeScore(calcularScore(lead({ calificacion: "frio" }), AHORA))).toBe("baja");
  });

  it("sin calificar y sin vendedor sube a media o alta, no queda en baja", () => {
    expect(prioridadDeScore(calcularScore(lead({ vendedor_id: null, estado_lead: "nuevo" }), AHORA))).not.toBe("baja");
  });

  it("escribir en las últimas 24 h suma, pasado ese tiempo no", () => {
    const reciente = calcularScore(lead({ last_message_at: hace(2) }), AHORA);
    const viejo = calcularScore(lead({ last_message_at: hace(30) }), AHORA);
    expect(reciente - viejo).toBe(5);
  });

  it("los umbrales de nivel son 30 (media) y 60 (alta)", () => {
    expect(prioridadDeScore(29)).toBe("baja");
    expect(prioridadDeScore(30)).toBe("media");
    expect(prioridadDeScore(59)).toBe("media");
    expect(prioridadDeScore(60)).toBe("alta");
  });
});

describe("motivosPrioridad", () => {
  it("explica en palabras por qué el lead es prioritario", () => {
    expect(motivosPrioridad(lead({ calificacion: "caliente", estado_lead: "nuevo", vendedor_id: null, sinRespuesta: true })))
      .toEqual(["caliente", "cliente esperando respuesta", "nuevo", "sin vendedor"]);
    expect(motivosPrioridad(lead())).toEqual([]);
  });
});

describe("ordenarPorPrioridad", () => {
  const item = (id: string, prioridad: "alta" | "media" | "baja" | null, last: string | null, created = "2026-01-01T00:00:00Z") =>
    ({ id, prioridad, last_message_at: last, created_at: created });

  it("regresión 1/10: un lead de hoy va arriba de uno viejo del mismo nivel", () => {
    const orden = ordenarPorPrioridad([
      item("viejo-29-9", "alta", "2026-09-29T10:00:00Z"),
      item("hoy-15hs", "alta", "2026-10-07T15:00:00Z"),
    ]);
    expect(orden.map((l) => l.id)).toEqual(["hoy-15hs", "viejo-29-9"]);
  });

  it("el nivel manda sobre la fecha: una alta vieja va arriba de una media de hoy", () => {
    const orden = ordenarPorPrioridad([
      item("media-hoy", "media", "2026-10-07T15:00:00Z"),
      item("alta-vieja", "alta", "2026-09-01T10:00:00Z"),
      item("baja-hoy", "baja", "2026-10-07T16:00:00Z"),
    ]);
    expect(orden.map((l) => l.id)).toEqual(["alta-vieja", "media-hoy", "baja-hoy"]);
  });

  it("sin último mensaje usa la fecha de creación y no muta el arreglo original", () => {
    const original = [item("a", "alta", null, "2026-10-01T00:00:00Z"), item("b", "alta", null, "2026-10-05T00:00:00Z")];
    expect(ordenarPorPrioridad(original).map((l) => l.id)).toEqual(["b", "a"]);
    expect(original.map((l) => l.id)).toEqual(["a", "b"]);
  });
});

describe("diasDesde", () => {
  it("sin fecha es infinito (nunca cuenta como reciente)", () => {
    expect(diasDesde(null)).toBe(Infinity);
  });
});
