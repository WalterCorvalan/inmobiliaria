import { describe, expect, it } from "vitest";
import { debeAvisarFueraDeHorario, debeMandarApertura, estaEnHorario, horarioDeConfig } from "./horarioBots";

// Argentina = UTC-3 (sin horario de verano).
const ar = (dia: string, hora: string) => new Date(`${dia}T${hora}:00-03:00`);

describe("horario de los bots", () => {
  it("de 7 a 23 en hora argentina, aunque el servidor esté en UTC", () => {
    const h = { inicio: 7, fin: 23 };
    expect(estaEnHorario(h, ar("2026-10-09", "06:59"))).toBe(false);
    expect(estaEnHorario(h, ar("2026-10-09", "07:00"))).toBe(true);
    expect(estaEnHorario(h, ar("2026-10-09", "22:59"))).toBe(true);
    expect(estaEnHorario(h, ar("2026-10-09", "23:00"))).toBe(false);
  });

  it("sin horario cargado (o inválido) usa 7 a 23", () => {
    expect(horarioDeConfig(null)).toEqual({ inicio: 7, fin: 23 });
    expect(horarioDeConfig({ horario_inicio: 22, horario_fin: 8 })).toEqual({ inicio: 7, fin: 23 });
    expect(horarioDeConfig({ horario_inicio: 8, horario_fin: 20 })).toEqual({ inicio: 8, fin: 20 });
  });

  it("un solo aviso de fuera de horario por noche", () => {
    const ahora = ar("2026-10-10", "01:30");
    expect(debeAvisarFueraDeHorario(null, ahora)).toBe(true);
    expect(debeAvisarFueraDeHorario(ar("2026-10-09", "23:20").toISOString(), ahora)).toBe(false);
    expect(debeAvisarFueraDeHorario(ar("2026-10-08", "23:20").toISOString(), ahora)).toBe(true);
  });
});

describe("mensaje de apertura de las 9", () => {
  const ahora = ar("2026-10-10", "09:00");
  const aviso = ar("2026-10-09", "23:40").toISOString();
  const base = { avisadoAt: aviso, aperturaAt: null, aiHabilitada: true, ultimoMensaje: { direccion: "out", created_at: aviso } };

  it("le escribe a quien recibió el aviso anoche y nadie le contestó", () => {
    expect(debeMandarApertura(base, ahora)).toBe(true);
    expect(debeMandarApertura({ ...base, ultimoMensaje: { direccion: "in", created_at: ar("2026-10-10", "02:00").toISOString() } }, ahora)).toBe(true);
  });

  it("no le escribe si alguien ya le contestó, si lo atiende una persona o si ya se mandó", () => {
    expect(debeMandarApertura({ ...base, ultimoMensaje: { direccion: "out", created_at: ar("2026-10-10", "07:30").toISOString() } }, ahora)).toBe(false);
    expect(debeMandarApertura({ ...base, aiHabilitada: false }, ahora)).toBe(false);
    expect(debeMandarApertura({ ...base, aperturaAt: ar("2026-10-10", "09:00").toISOString() }, ahora)).toBe(false);
  });

  it("un aviso viejo (de otra noche) no genera apertura", () => {
    expect(debeMandarApertura({ ...base, avisadoAt: ar("2026-10-08", "23:40").toISOString() }, ahora)).toBe(false);
    expect(debeMandarApertura({ ...base, avisadoAt: null }, ahora)).toBe(false);
  });
});
