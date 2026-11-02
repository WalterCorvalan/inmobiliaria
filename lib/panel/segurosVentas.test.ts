import { describe, expect, it } from "vitest";
import { separarPorSeguro, telefonoComprador } from "./segurosVentas";

describe("ventas con y sin seguro", () => {
  const ventas = [
    { id: "a", fecha_cierre: "2026-08-01", seguro_contratado: true },
    { id: "b", fecha_cierre: "2026-10-01", seguro_contratado: false },
    { id: "c", fecha_cierre: "2026-09-01", seguro_contratado: null },
    { id: "d", fecha_cierre: "2026-10-05", seguro_contratado: true },
  ];

  it("separa y ordena de la más nueva a la más vieja; sin dato cuenta como sin seguro", () => {
    const { con, sin } = separarPorSeguro(ventas);
    expect(con.map((v) => v.id)).toEqual(["d", "a"]);
    expect(sin.map((v) => v.id)).toEqual(["b", "c"]);
  });

  it("usa el celular antes que el fijo", () => {
    expect(telefonoComprador({ id: "x", comprador_telefono: "4742-2121", comprador_telefono_celular: "11 2345 6789" })).toBe("11 2345 6789");
    expect(telefonoComprador({ id: "x", comprador_telefono: "4742-2121" })).toBe("4742-2121");
    expect(telefonoComprador({ id: "x", comprador_telefono: " " })).toBeNull();
  });
});

describe("link del cotizador de La Caja (22/10/2026)", () => {
  it("le agrega el número de socio si no lo trae, y no toca otros links", async () => {
    const { linkCotizadorConSocio } = await import("./segurosVentas");
    expect(linkCotizadorConSocio("https://cotizadorsocios.lacaja.com.ar/seguro-auto-socios/")).toBe("https://cotizadorsocios.lacaja.com.ar/seguro-auto-socios/?socio=22791");
    expect(linkCotizadorConSocio("https://cotizadorsocios.lacaja.com.ar/seguro-auto-socios/?socio=111")).toContain("socio=111");
    expect(linkCotizadorConSocio(null)).toContain("socio=22791");
    expect(linkCotizadorConSocio("https://otro.com/x")).toBe("https://otro.com/x");
  });
});
