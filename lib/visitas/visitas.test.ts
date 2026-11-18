import { describe, it, expect } from "vitest";
import { agruparPorDia, diasDeSemana, etiquetaSemana, filtrarVisitas, inicioDeSemana, linkConfirmarPorWhatsapp, minutosDeHorario, visitasEnConflicto, type Visita } from "./visitas";

const v = (p: Partial<Visita>): Visita => ({
  id: "1", nombre_cliente: "Ana Pérez", telefono_cliente: "1144445555", fecha_visita: "2026-11-19", horario_visita: "10:00", sucursal: "Belgrano",
  estado: "Pendiente", vendedor_id: null, propiedad_id: null, propiedad_codigo: null, notas: null, canal_origen: null, created_at: "", ...p,
});

describe("agenda de visitas", () => {
  it("la semana arranca el lunes", () => {
    const lunes = inicioDeSemana(new Date(2026, 10, 18)); // miércoles 18/11
    expect(diasDeSemana(lunes)[0]).toBe("2026-11-16");
    expect(diasDeSemana(lunes)[6]).toBe("2026-11-22");
    expect(etiquetaSemana(lunes)).toBe("16 al 22 de noviembre");
    expect(etiquetaSemana(inicioDeSemana(new Date(2026, 11, 1)))).toBe("30 de noviembre al 6 de diciembre");
  });

  it("ordena por horario y deja el texto libre al final", () => {
    expect(minutosDeHorario("9:30")).toBe(570);
    expect(minutosDeHorario("15 hs")).toBe(900);
    expect(minutosDeHorario("a la mañana")).toBe(1440);
    const dias = agruparPorDia([v({ id: "a", horario_visita: "a la tarde" }), v({ id: "b", horario_visita: "9:00" })], ["2026-11-19", "2026-11-20"]);
    expect(dias[0].visitas.map((x) => x.id)).toEqual(["b", "a"]);
    expect(dias[1].visitas).toEqual([]);
  });

  it("filtra por oficina, asesor y estado", () => {
    const lista = [v({ id: "a", vendedor_id: "x" }), v({ id: "b", sucursal: "Lomas" }), v({ id: "c", estado: "Cancelada" })];
    expect(filtrarVisitas(lista, { sucursal: "Lomas" }).map((x) => x.id)).toEqual(["b"]);
    expect(filtrarVisitas(lista, { vendedorId: "x" }).map((x) => x.id)).toEqual(["a"]);
    expect(filtrarVisitas(lista, { vendedorId: "sin" }).map((x) => x.id)).toEqual(["b", "c"]);
    expect(filtrarVisitas(lista, { estado: "Cancelada" }).map((x) => x.id)).toEqual(["c"]);
  });

  it("marca conflictos solo entre visitas activas de la misma oficina y horario", () => {
    const c = visitasEnConflicto([v({ id: "a" }), v({ id: "b" }), v({ id: "c", estado: "Cancelada" }), v({ id: "d", sucursal: "Lomas" })]);
    expect([...c].sort()).toEqual(["a", "b"]);
  });

  it("arma el link de WhatsApp para confirmar", () => {
    const l = linkConfirmarPorWhatsapp(v({}), "Propiedades del Sur");
    expect(l?.startsWith("https://wa.me/5491144445555?text=")).toBe(true);
    expect(decodeURIComponent(l!)).toContain("Hola Ana");
    expect(linkConfirmarPorWhatsapp(v({ telefono_cliente: "sin dato" }), "X")).toBeNull();
  });
});
