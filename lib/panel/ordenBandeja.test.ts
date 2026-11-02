import { describe, it, expect } from "vitest";
import { fechaDeLlegada, ordenarPorLlegada } from "./ordenBandeja";

const c = (id: string, o: Record<string, unknown> = {}) => ({ id, calificacion: null as string | null, ...o });

describe("fechaDeLlegada", () => {
  it("usa la más reciente entre last_message_at, el último mensaje y la creación", () => {
    expect(fechaDeLlegada(c("a", { last_message_at: "2026-10-01T10:00:00Z", ultimo_mensaje: { created_at: "2026-10-05T10:00:00Z" } })))
      .toBe(new Date("2026-10-05T10:00:00Z").getTime());
  });
  it("sin ninguna fecha vale 0 y no rompe", () => {
    expect(fechaDeLlegada(c("a"))).toBe(0);
    expect(fechaDeLlegada(c("a", { last_message_at: "no-es-fecha" }))).toBe(0);
  });
});

describe("ordenarPorLlegada", () => {
  it("la charla con last_message_at nulo pero mensaje de hoy no queda abajo (caso Instagram)", () => {
    const lista = [
      c("vieja", { last_message_at: "2026-09-25T10:00:00Z" }),
      c("sinCampo", { last_message_at: null, ultimo_mensaje: { created_at: "2026-10-07T20:27:00Z" } }),
      c("lunes", { last_message_at: "2026-10-05T10:00:00Z" }),
    ];
    expect(ordenarPorLlegada(lista).map((x) => x.id)).toEqual(["sinCampo", "lunes", "vieja"]);
  });
  it("no muta el arreglo original", () => {
    const lista = [c("a", { last_message_at: "2026-01-01T00:00:00Z" }), c("b", { last_message_at: "2026-02-01T00:00:00Z" })];
    ordenarPorLlegada(lista);
    expect(lista.map((x) => x.id)).toEqual(["a", "b"]);
  });
});

// Walter, 29/10/2026: una sola lista por llegada; la temperatura no sube una charla vieja por encima de una nueva.
describe("ordenarPorLlegada sin agrupar por temperatura", () => {
  it("una charla fría recién llegada queda arriba de una caliente vieja", () => {
    const lista = [
      c("calienteViejo", { calificacion: "caliente", last_message_at: "2026-10-01T10:00:00Z" }),
      c("tibio", { calificacion: "tibio", last_message_at: "2026-10-06T10:00:00Z" }),
      c("frioNuevo", { calificacion: "frio", last_message_at: "2026-10-07T11:00:00Z" }),
    ];
    expect(ordenarPorLlegada(lista).map((x) => x.id)).toEqual(["frioNuevo", "tibio", "calienteViejo"]);
  });
});
