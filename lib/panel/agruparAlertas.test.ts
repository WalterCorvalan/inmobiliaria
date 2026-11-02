import { describe, it, expect } from "vitest";
import { agruparAlertas } from "./agruparAlertas";

const a = (id: string, titulo: string, leida = true, tipo = "cliente") =>
  ({ id, tipo, prioridad: "media", titulo, mensaje: null, link: null, leida, created_at: "2026-10-07T00:00:00Z" });

describe("agruparAlertas", () => {
  it("junta las repetidas (mismo tipo y título) y cuenta cuántas son", () => {
    const r = agruparAlertas([a("1", "Sin contactar"), a("2", "Otra"), a("3", "Sin contactar")]);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ id: "1", contador: 2, idsGrupo: ["1", "3"] });
    expect(r[1]).toMatchObject({ id: "2", contador: 1 });
  });

  it("el grupo queda sin leer si alguna de las repetidas lo está", () => {
    expect(agruparAlertas([a("1", "X", true), a("2", "X", false)])[0].leida).toBe(false);
    expect(agruparAlertas([a("1", "X", true), a("2", "X", true)])[0].leida).toBe(true);
  });

  it("mismo título pero distinto tipo no se agrupan", () => {
    expect(agruparAlertas([a("1", "X", true, "cliente"), a("2", "X", true, "venta")])).toHaveLength(2);
  });

  it("conserva el orden de aparición (la primera es la más reciente)", () => {
    expect(agruparAlertas([a("1", "B"), a("2", "A"), a("3", "B")]).map((x) => x.titulo)).toEqual(["B", "A"]);
  });
});
