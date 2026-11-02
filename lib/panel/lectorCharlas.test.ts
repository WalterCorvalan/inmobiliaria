import { describe, expect, it } from "vitest";
import { autoPorTexto, fusionarProspeccion, necesitaLectura, prospeccionDeRespuesta, telefonoDelCliente } from "./lectorCharlas";

const stock = [
  { id: "ranger23", marca: "FORD", modelo: "RANGER DC 4X2 XL", anio: 2023, km: 38000, color: "Blanco" },
  { id: "ranger19", marca: "FORD", modelo: "RANGER DC 4X4 LIMITED", anio: 2019, km: 90000, color: "Gris" },
  { id: "onix16", marca: "CHEVROLET", modelo: "ONIX 1.4 N LT", anio: 2016, km: 100000, color: "Gris" },
];

describe("cuándo se lee una charla", () => {
  const ahora = new Date("2026-10-17T12:00:00Z");
  it("espera a que la charla lleve 5 minutos quieta", () => {
    expect(necesitaLectura({ ultimoMensaje: "2026-10-17T11:58:00Z", leidoHasta: null, ahora })).toBe(false);
    expect(necesitaLectura({ ultimoMensaje: "2026-10-17T11:50:00Z", leidoHasta: null, ahora })).toBe(true);
  });
  it("vuelve a leerla solo si hubo mensajes después de la última lectura", () => {
    expect(necesitaLectura({ ultimoMensaje: "2026-10-17T11:50:00Z", leidoHasta: "2026-10-17T11:50:00Z", ahora })).toBe(false);
    expect(necesitaLectura({ ultimoMensaje: "2026-10-17T11:50:00Z", leidoHasta: "2026-10-17T10:00:00Z", ahora })).toBe(true);
    expect(necesitaLectura({ ultimoMensaje: null, leidoHasta: null, ahora })).toBe(false);
  });
});

describe("auto nombrado en la charla, sin IA", () => {
  it("el mensaje automático del catálogo identifica el auto", () => {
    expect(autoPorTexto(["Hola, me interesa el Ford Ranger DC 4X2 XL 2023 (38.000 km). ¿Sigue disponible?"], stock)).toBe("ranger23");
  });
  it("con el modelo y el año alcanza", () => {
    expect(autoPorTexto(["hola la onix 2016 sigue?"], stock)).toBe("onix16");
  });
  it("si hay dudas no elige: decide la IA", () => {
    expect(autoPorTexto(["tienen alguna ford ranger?"], stock)).toBeNull();
    expect(autoPorTexto(["busco una camioneta"], stock)).toBeNull();
  });
});

describe("teléfono que deja el cliente", () => {
  it("lo toma si habla de teléfono o si el mensaje es casi solo el número", () => {
    expect(telefonoDelCliente(["hola", "mi número es 01123916007"])).toBe("01123916007");
    expect(telefonoDelCliente(["11 2391-6007"])).toBe("11 2391-6007");
  });
  it("no confunde otros números", () => {
    expect(telefonoDelCliente(["tengo un palio 2016 con 170000 km"])).toBeNull();
    expect(telefonoDelCliente(["el código de la publicación es 12345678 y quería saber el precio del auto que tienen"])).toBeNull();
  });
});

describe("Cómo compra: el lector completa, no pisa", () => {
  it("rellena lo vacío y respeta lo cargado por el vendedor", () => {
    const nueva = prospeccionDeRespuesta({ resumen: "", vehiculo_id: null, solo_vende_su_auto: false, formas_pago: ["permuta", "efectivo"], usado: { marca: "VW", modelo: "Gol", anio: 2015, km: 90000 }, anticipo: { monto: 5000, moneda: "USD" }, cuando: "este_mes" });
    expect(nueva.formasPago).toEqual(["permuta"]);
    const r = fusionarProspeccion({ anticipo: { monto: 8000000, moneda: "ARS" } }, nueva);
    expect(r.anticipo).toEqual({ monto: 8000000, moneda: "ARS" });
    expect(r.usado).toEqual({ marca: "VW", modelo: "Gol", anio: 2015, km: 90000 });
    expect(r.formasPago).toEqual(["permuta"]);
    expect(r.cuando).toBe("este_mes");
  });
});
