import { describe, expect, it } from "vitest";
import { calendarioParaBot, proximoDiaDeVisita, resolverFechaVisita, resolverFechaVisitaConControl } from "./fechas";

// Sábado 10/10/2026, 11:24 en Argentina (14:24 UTC): cuando escribió el cliente del caso real.
const SABADO_10 = new Date("2026-10-10T14:24:00Z");

describe("resolverFechaVisitaConControl", () => {
  it("martes 14 cuando el 14 es miércoles: toma el martes 13 y la marca dudosa (caso real del 10/10/2026)", () => {
    expect(resolverFechaVisitaConControl("martes 14", SABADO_10)).toEqual({ fecha: "2026-10-13", dudosa: true });
  });

  it("día y número que coinciden: tal cual, sin dudas", () => {
    expect(resolverFechaVisitaConControl("martes 13", SABADO_10)).toEqual({ fecha: "2026-10-13", dudosa: false });
    expect(resolverFechaVisitaConControl("lunes 12", SABADO_10)).toEqual({ fecha: "2026-10-12", dudosa: false });
  });

  it("lunes 14 (el 14 es miércoles): el lunes más cercano es el 12", () => {
    expect(resolverFechaVisitaConControl("lunes 14", SABADO_10)).toEqual({ fecha: "2026-10-12", dudosa: true });
  });

  it("fecha con barra y día que no coincide también se corrige", () => {
    expect(resolverFechaVisitaConControl("martes 14/10", SABADO_10)).toEqual({ fecha: "2026-10-13", dudosa: true });
    expect(resolverFechaVisitaConControl("15/10", SABADO_10)).toEqual({ fecha: "2026-10-15", dudosa: false });
  });

  it("solo el día de la semana: el próximo", () => {
    expect(resolverFechaVisita("martes", SABADO_10)).toBe("2026-10-13");
    expect(resolverFechaVisita("sábado", SABADO_10)).toBe("2026-10-17");
  });

  it("hoy y mañana usan la hora de Argentina (a las 22 hs en Argentina en UTC ya es el día siguiente)", () => {
    const sabadoNoche = new Date("2026-10-11T01:00:00Z"); // sábado 10, 22:00 en Argentina
    expect(resolverFechaVisita("hoy", sabadoNoche)).toBe("2026-10-10");
    expect(resolverFechaVisita("mañana", sabadoNoche)).toBe("2026-10-11");
  });

  it("el número de hoy es hoy, no el mes que viene", () => {
    expect(resolverFechaVisita("sábado 10", SABADO_10)).toBe("2026-10-10");
  });

  it("texto que no se entiende se guarda tal cual", () => {
    expect(resolverFechaVisitaConControl("cuando pueda", SABADO_10)).toEqual({ fecha: "cuando pueda", dudosa: false });
  });
});

describe("calendarioParaBot", () => {
  it("dice qué día es hoy y los próximos con su nombre", () => {
    const texto = calendarioParaBot(SABADO_10);
    expect(texto).toContain("hoy es sábado 10 de octubre de 2026");
    expect(texto).toContain("lunes 12 de octubre");
    expect(texto).toContain("martes 13 de octubre");
    expect(texto).toContain("sábado 24 de octubre");
  });
});

describe("proximoDiaDeVisita", () => {
  it("propone mañana", () => {
    expect(proximoDiaDeVisita(new Date("2026-10-12T15:00:00Z"))).toBe("martes 13 de octubre");
  });

  it("el domingo está cerrado: un sábado propone el lunes", () => {
    expect(proximoDiaDeVisita(SABADO_10)).toBe("lunes 12 de octubre");
    expect(calendarioParaBot(SABADO_10)).toContain("Próximo día de visita para proponer: lunes 12 de octubre");
  });

  it("cambia de mes", () => {
    expect(proximoDiaDeVisita(new Date("2026-10-31T15:00:00Z"))).toBe("lunes 2 de noviembre");
  });
});
