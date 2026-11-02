import { describe, expect, it } from "vitest";
import { necesitaLectura, telefonoDelCliente } from "./lectorCharlas";

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
