import { describe, expect, it } from "vitest";
import { armarTextosAnuncio, nombreLegible } from "./textosAnuncio";

const ranger = { marca: "FORD", modelo: "RANGER DC 4X2 XL", anio: 2023, km: 38000, combustible: "Diésel", transmision: "Manual", sucursal: "Casa Central" };

describe("textos para el anuncio", () => {
  it("pasa el nombre en mayúsculas a uno legible, dejando siglas y números", () => {
    expect(nombreLegible("FORD", "RANGER DC 4X2 XL", 2023)).toBe("Ford Ranger DC 4X2 XL 2023");
  });
  it("con anticipo arma el gancho de financiación y lo repite en el mensaje de WhatsApp", () => {
    const t = armarTextosAnuncio(ranger, { monto: 12000000, moneda: "ARS" });
    expect(t.ganchoFinanciacion).toBe("Con $12.000.000 de anticipo te llevás este Ford Ranger DC 4X2 XL 2023.");
    expect(t.ganchoProducto).toBe("Ford Ranger DC 4X2 XL 2023 con solo 38.000 km.");
    expect(t.desarrollo).toBe("Diésel, Manual. Tomamos tu usado como parte de pago.");
    expect(t.cierre).toBe("Escribinos y te contamos cómo llevártelo, o vení a verlo a Casa Central.");
    expect(t.mensajeWhatsapp).toBe("Hola, me interesa el Ford Ranger DC 4X2 XL 2023 (38.000 km, anticipo $12.000.000). ¿Sigue disponible?");
    expect(t.anuncioCompleto.startsWith("Con $12.000.000 de anticipo")).toBe(true);
  });
  it("sin anticipo no inventa financiación y arranca por el producto", () => {
    const t = armarTextosAnuncio(ranger, null);
    expect(t.ganchoFinanciacion).toBeNull();
    expect(t.anuncioCompleto.startsWith("Ford Ranger DC 4X2 XL 2023 con solo 38.000 km.")).toBe(true);
    expect(t.mensajeWhatsapp).toBe("Hola, me interesa el Ford Ranger DC 4X2 XL 2023 (38.000 km). ¿Sigue disponible?");
  });
  it("0 km, muchos km y km sin cargar", () => {
    expect(armarTextosAnuncio({ ...ranger, km: 0 }, null).ganchoProducto).toBe("Ford Ranger DC 4X2 XL 2023 0 km, listo para entregar.");
    expect(armarTextosAnuncio({ ...ranger, km: 120000 }, null).ganchoProducto).toBe("Ford Ranger DC 4X2 XL 2023 con 120.000 km.");
    expect(armarTextosAnuncio({ ...ranger, km: null, combustible: null, transmision: null, sucursal: null }, { monto: 5000, moneda: "USD" })).toMatchObject({
      ganchoProducto: "Ford Ranger DC 4X2 XL 2023.",
      desarrollo: "Tomamos tu usado como parte de pago.",
      cierre: "Escribinos y te contamos cómo llevártelo.",
      mensajeWhatsapp: "Hola, me interesa el Ford Ranger DC 4X2 XL 2023 (anticipo USD 5.000). ¿Sigue disponible?",
    });
  });
});
