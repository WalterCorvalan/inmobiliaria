import { describe, expect, it } from "vitest";
import { combinarDatos, resumenDesdeDatos } from "./resumenPlantilla";
import { frasesDelResumen } from "@/lib/panel/resaltarResumen";
import { etiquetaDeFrase } from "@/lib/panel/formatoResumen";

describe("combinarDatos", () => {
  it("un null no borra lo que ya se sabía y un dato nuevo lo pisa", () => {
    const a = combinarDatos({ nombre: "Ana", presupuesto: "USD 100.000" }, { nombre: null, presupuesto: "USD 120.000", zona: "belgrano" });
    expect(a).toEqual({ nombre: "Ana", presupuesto: "USD 120.000", zona: "belgrano" });
  });
});

describe("resumenDesdeDatos", () => {
  it("charla sin datos: dice el canal y que falta saber qué busca", () => {
    const r = resumenDesdeDatos({ datos: {}, canal: "instagram", calificacion: null, queBusca: "propiedad" });
    expect(r).toBe("Escribió por Instagram y todavía no dijo qué propiedad busca.\nPendiente: que un asesor lo contacte y definir qué propiedad le interesa.");
  });
  it("charla completa: cada dato con su nombre y la visita con la oficina", () => {
    const r = resumenDesdeDatos({
      datos: { interes: "Alquilar un 2 ambientes en Belgrano.", presupuesto: "$ 700.000 por mes", dia_visita: "jueves 19", horario_visita: "11:00", zona: "belgrano", telefono: "11 5555 1234" },
      canal: "whatsapp", calificacion: "caliente", queBusca: "propiedad", nombreSucursal: (s) => (s === "belgrano" ? "Oficina Belgrano" : null),
    });
    expect(r.split("\n")).toEqual([
      "Quiere alquilar un 2 ambientes en Belgrano.",
      "Presupuesto: $ 700.000 por mes.",
      "Visita: jueves 19 a las 11:00 en Oficina Belgrano.",
      "Teléfono: 11 5555 1234.",
      "Temperatura: caliente.",
      "Pendiente: que un asesor confirme la visita.",
    ]);
  });
  it("la ficha lo parte en las mismas frases y reconoce los nombres de dato", () => {
    const r = resumenDesdeDatos({ datos: { interes: "comprar una casa", presupuesto: "USD 150.000" }, canal: "messenger", calificacion: "tibio", queBusca: "propiedad" });
    const frases = frasesDelResumen(r);
    expect(frases).toHaveLength(4);
    expect(etiquetaDeFrase(frases[1])?.etiqueta).toBe("Presupuesto");
  });
});
