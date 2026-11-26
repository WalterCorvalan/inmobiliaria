import { describe, expect, it } from "vitest";
import { agendaProxima, haceCuanto, hoyArgentina, leadsParaAtender, resumenInicio, sumarDiasISO, type LeadInicio, type VisitaInicio, embudoVentas, cuentaPorDia } from "./inicio";

const AHORA = new Date("2026-11-25T15:00:00Z"); // 12:00 en Argentina
const lead = (p: Partial<LeadInicio>): LeadInicio => ({ id: "x", canal: "whatsapp", nombre: "A", calificacion: null, estado_lead: "nuevo", unread_count: 0, last_message_at: null, created_at: "2026-11-20T10:00:00Z", es_basura: false, ...p });
const visita = (p: Partial<VisitaInicio>): VisitaInicio => ({ id: "v", nombre_cliente: "B", fecha_visita: "2026-11-25", horario_visita: "10:00", estado: "Pendiente", tipo: null, propiedad_codigo: null, ...p });

describe("inicio del panel", () => {
  it("usa el día de Argentina aunque en UTC ya sea mañana", () => {
    expect(hoyArgentina(new Date("2026-11-26T01:30:00Z"))).toBe("2026-11-25");
    expect(sumarDiasISO("2026-11-30", 1)).toBe("2026-12-01");
  });

  it("pone primero los calientes y deja afuera cerrados y basura", () => {
    const lista = leadsParaAtender([
      lead({ id: "tibio", calificacion: "tibio", unread_count: 2, last_message_at: "2026-11-25T14:00:00Z" }),
      lead({ id: "caliente", calificacion: "caliente", last_message_at: "2026-11-25T10:00:00Z" }),
      lead({ id: "perdido", calificacion: "caliente", estado_lead: "perdido" }),
      lead({ id: "basura", unread_count: 1, es_basura: true }),
      lead({ id: "frio-al-dia", calificacion: "frio" }),
    ]);
    expect(lista.map((l) => l.id)).toEqual(["caliente", "tibio"]);
  });

  it("arma la agenda desde hoy, sin cancelados, en orden", () => {
    const agenda = agendaProxima([
      visita({ id: "manana", fecha_visita: "2026-11-26", horario_visita: "09:00" }),
      visita({ id: "hoy-tarde", horario_visita: "16:00", estado: "Confirmada" }),
      visita({ id: "hoy", horario_visita: "11:00" }),
      visita({ id: "ayer", fecha_visita: "2026-11-24" }),
      visita({ id: "cancelada", estado: "Cancelada" }),
    ], "2026-11-25");
    expect(agenda.map((v) => v.id)).toEqual(["hoy", "hoy-tarde", "manana"]);
  });

  it("resume leads, cartera y tareas", () => {
    const r = resumenInicio({
      leads: [lead({ canal: "instagram", unread_count: 1, created_at: "2026-11-25T13:00:00Z" }), lead({ calificacion: "caliente" }), lead({ estado_lead: "convertido" })],
      visitas: [visita({}), visita({ fecha_visita: "2026-11-28" })],
      propiedades: [{ estado: "disponible", operacion: "venta" }, { estado: "reservada", operacion: "alquiler" }, { estado: "vendida", operacion: "venta" }, { estado: "disponible", operacion: "alquiler" }],
      tareas: [
        { id: "t1", titulo: "", tipo: null, fecha_vencimiento: "2026-11-24T15:00:00Z", completada: false },
        { id: "t2", titulo: "", tipo: null, fecha_vencimiento: "2026-11-25T20:00:00Z", completada: false },
        { id: "t3", titulo: "", tipo: null, fecha_vencimiento: "2026-11-24T15:00:00Z", completada: true },
      ],
    }, AHORA);
    expect(r).toMatchObject({ leadsActivos: 2, leadsNuevosHoy: 1, sinLeer: 1, calientes: 1, visitasHoy: 1, visitasSemana: 2, disponibles: 2, reservadas: 1, enVenta: 1, enAlquiler: 2, tareasVencidas: 1, tareasHoy: 1 });
    expect(r.porCanal.instagram).toBe(1);
  });

  it("dice hace cuánto en palabras", () => {
    expect(haceCuanto("2026-11-25T14:55:00Z", AHORA)).toBe("hace 5 min");
    expect(haceCuanto("2026-11-25T12:00:00Z", AHORA)).toBe("hace 3 h");
    expect(haceCuanto("2026-11-24T12:00:00Z", AHORA)).toBe("ayer");
  });
});

describe("embudoVentas", () => {
  it("cuenta cada etapa, acumula hacia atrás y saca la tasa de cierre", () => {
    const l = (estado_pipeline: string | null, es_basura = false) => ({ estado_pipeline, es_basura });
    const e = embudoVentas([l("sin_contactar"), l("contactado"), l("contactado"), l("visita"), l("cerrado"), l("perdido"), l(null), l("cerrado", true)]);
    expect(e.etapas.map((x) => [x.etapa, x.enEtapa, x.llegaron])).toEqual([
      ["sin_contactar", 1, 5], ["contactado", 2, 4], ["visita", 1, 2], ["negociacion", 0, 1], ["cerrado", 1, 1],
    ]);
    expect(e.total).toBe(6);
    expect(e.perdidos).toBe(1);
    expect(e.tasaCierre).toBe(17);
  });
  it("sin leads da todo en cero", () => {
    expect(embudoVentas([]).tasaCierre).toBe(0);
  });
});

describe("cuentaPorDia", () => {
  it("cuenta los últimos días terminando hoy, en hora de Argentina", () => {
    // 2026-11-26 01:00 UTC es todavía 25/11 en Argentina.
    expect(cuentaPorDia(["2026-11-26T15:00:00Z", "2026-11-26T01:00:00Z", "2026-11-20T15:00:00Z", "2026-11-10T15:00:00Z", null], "2026-11-26")).toEqual([1, 0, 0, 0, 0, 1, 1]);
  });
  it("cuenta los próximos días empezando hoy con fechas AAAA-MM-DD", () => {
    expect(cuentaPorDia(["2026-11-26", "2026-11-28", "2026-11-28", "2026-12-10"], "2026-11-26", 7, false)).toEqual([1, 0, 2, 0, 0, 0, 0]);
  });
});
