import { describe, expect, it } from "vitest";
import { chatDelLink, contestado, nombreDelCliente,corresponderAvisoSinContestar, enHorarioDeAtencion, esperaDesde, msHabilesEntre, tocaRepetir } from "./clienteSinContestar";

// Hora argentina = UTC-3: "2026-10-21T12:00:00Z" son las 9 del miércoles 21/10.
const ar = (fechaHora: string) => new Date(`${fechaHora}:00-03:00`);
const m = (direccion: "in" | "out", hora: string, ai = false) => ({ direccion, ai_generado: ai, created_at: ar(`2026-10-21T${hora}`).toISOString() });

describe("esperaDesde", () => {
  it("sin bot: desde el primer mensaje del cliente sin contestar", () => {
    const conv = { ai_habilitada: false, handoff_at: null };
    expect(esperaDesde(conv, [m("in", "09:00"), m("out", "09:10"), m("in", "10:00"), m("in", "10:30")])).toEqual(ar("2026-10-21T10:00"));
  });

  it("si la persona ya contestó, no espera", () => {
    expect(esperaDesde({ ai_habilitada: false, handoff_at: null }, [m("in", "10:00"), m("out", "10:05")])).toBeNull();
  });

  it("lo que contesta el bot no cuenta, y el reloj arranca cuando le pasa la charla al vendedor", () => {
    const conv = { ai_habilitada: false, handoff_at: ar("2026-10-21T10:20").toISOString() };
    const mensajes = [m("in", "10:00"), m("out", "10:01", true), m("in", "10:10"), m("out", "10:11", true)];
    expect(esperaDesde(conv, mensajes)).toEqual(ar("2026-10-21T10:20"));
  });

  it("con el bot conversando, no le toca a una persona", () => {
    expect(esperaDesde({ ai_habilitada: true, handoff_at: null }, [m("in", "10:00"), m("out", "10:01", true)])).toBeNull();
  });

  it("si el bot atiende pero no contestó (bot apagado o caído), cuenta desde el mensaje sin respuesta", () => {
    expect(esperaDesde({ ai_habilitada: true, handoff_at: null }, [m("in", "10:00"), m("out", "10:01", true), m("in", "11:00")])).toEqual(ar("2026-10-21T11:00"));
  });
});

describe("horario de atención", () => {
  it("cuenta solo las horas de atención", () => {
    // Miércoles 17 a jueves 10: 1 h del miércoles + 1 h del jueves.
    expect(msHabilesEntre(ar("2026-10-21T17:00"), ar("2026-10-22T10:00"))).toBe(2 * 3_600_000);
    // Sábado 12 a lunes 10: 1 h del sábado, domingo cerrado, 1 h del lunes.
    expect(msHabilesEntre(ar("2026-10-24T12:00"), ar("2026-10-26T10:00"))).toBe(2 * 3_600_000);
  });

  it("un mensaje de las 23 no hace sonar el celular a la madrugada", () => {
    const espera = ar("2026-10-21T23:00");
    expect(corresponderAvisoSinContestar(espera, ar("2026-10-22T01:00"))).toBe(false);
    expect(corresponderAvisoSinContestar(espera, ar("2026-10-22T11:00"))).toBe(true);
  });

  it("sábado a la tarde y domingo, cerrado", () => {
    expect(enHorarioDeAtencion(ar("2026-10-24T12:59"))).toBe(true);
    expect(enHorarioDeAtencion(ar("2026-10-24T13:00"))).toBe(false);
    expect(enHorarioDeAtencion(ar("2026-10-25T11:00"))).toBe(false);
  });
});

describe("repetición", () => {
  const base = { push_repeticiones: 0, push_ultimo_at: null, created_at: ar("2026-10-21T10:00").toISOString() };

  it("cada 30 minutos, hasta 3 veces", () => {
    expect(tocaRepetir(base, ar("2026-10-21T10:20"))).toBe(false);
    expect(tocaRepetir(base, ar("2026-10-21T10:30"))).toBe(true);
    expect(tocaRepetir({ ...base, push_repeticiones: 1, push_ultimo_at: ar("2026-10-21T10:30").toISOString() }, ar("2026-10-21T10:45"))).toBe(false);
    expect(tocaRepetir({ ...base, push_repeticiones: 3 }, ar("2026-10-21T12:00"))).toBe(false);
  });

  it("'cliente sin contestar' no tiene paso extra: al encargado no se le avisa", () => {
    expect(tocaRepetir({ ...base, push_repeticiones: 3, push_ultimo_at: ar("2026-10-21T11:30").toISOString() }, ar("2026-10-21T12:00"))).toBe(false);
  });

  it("nombreDelCliente: el del perfil, o el teléfono / @usuario, o 'un cliente'", () => {
    expect(nombreDelCliente("whatsapp", { whatsapp_contactos: { nombre_perfil: "Rodolfo Vidal", telefono: "549111" } })).toBe("Rodolfo Vidal");
    expect(nombreDelCliente("whatsapp", { whatsapp_contactos: { nombre_perfil: null, telefono: "549111" } })).toBe("549111");
    expect(nombreDelCliente("instagram", { instagram_contactos: { nombre_perfil: "", username: "martin.g" } })).toBe("@martin.g");
    expect(nombreDelCliente("rodi", { nombre_contacto: "Damián", telefono_contacto: null })).toBe("Damián");
    expect(nombreDelCliente("messenger", { messenger_contactos: null })).toBe("un cliente");
  });

  it("contestado: solo cuenta la respuesta de una persona", () => {
    expect(contestado([m("in", "10:00"), m("out", "10:01", true)])).toBe(false);
    expect(contestado([m("in", "10:00"), m("out", "10:05")])).toBe(true);
  });

  it("fuera de horario no suena", () => {
    expect(tocaRepetir(base, ar("2026-10-21T19:00"))).toBe(false);
  });
});

describe("chatDelLink", () => {
  it("saca el canal y la charla del link del aviso", () => {
    expect(chatDelLink("/panel/instagram?conversacion=abc")).toEqual({ canal: "instagram", conversacionId: "abc" });
    expect(chatDelLink("/panel/rodi?conversacion=xyz")).toEqual({ canal: "rodi", conversacionId: "xyz" });
    expect(chatDelLink("/panel/whatsapp?tab=leads&lead=1")).toBeNull();
    expect(chatDelLink("/panel/ventas")).toBeNull();
  });
});
