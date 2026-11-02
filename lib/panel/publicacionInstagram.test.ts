import { describe, it, expect } from "vitest";
import { armarTextoInstagram, esFotoJpg, puedePublicarEnInstagram, revisarPublicacion } from "./publicacionInstagram";

describe("puedePublicarEnInstagram", () => {
  it("admin, director y encargado sí; ventas y sin rol no", () => {
    expect(puedePublicarEnInstagram(["admin"])).toBe(true);
    expect(puedePublicarEnInstagram(["director"])).toBe(true);
    expect(puedePublicarEnInstagram(["ventas", "encargado"])).toBe(true);
    expect(puedePublicarEnInstagram(["ventas"])).toBe(false);
    expect(puedePublicarEnInstagram(null)).toBe(false);
  });
});

describe("armarTextoInstagram", () => {
  it("auto, datos, precio, financiación, sucursal y hashtags", () => {
    const texto = armarTextoInstagram({ marca: "MERCEDES-BENZ", modelo: "C200 AVANTGARDE", anio: 2019, km: 48000, combustible: "Nafta", transmision: "Automática", sucursal: "Casa Central", precioArs: 32500000 });
    expect(texto).toBe(
      [
        "Mercedes-benz C200 Avantgarde 2019",
        "48.000 km · Nafta · Automática",
        "Precio: $32.500.000",
        "",
        "Financiación y tomamos tu usado como parte de pago.",
        "Escribinos por mensaje directo o por WhatsApp, o vení a verlo a Casa Central.",
        "",
        "#PfaffenCars #Mercedesbenz #C200 #Usados #ZonaNorte",
      ].join("\n"),
    );
  });
  it("0 km, sin precio ni sucursal", () => {
    const texto = armarTextoInstagram({ marca: "Karry", modelo: "Pick Up", anio: 2026, km: 0 });
    expect(texto).toContain("0 km");
    expect(texto).not.toContain("Precio");
    expect(texto).toContain("por WhatsApp.");
    expect(texto.endsWith("#PfaffenCars #Karry #Pick #0km #ZonaNorte")).toBe(true);
  });
  it("precio en dólares si no hay en pesos", () => {
    expect(armarTextoInstagram({ marca: "Toyota", modelo: "Hilux", anio: 2020, km: null, precioUsd: 28000 })).toContain("Precio: USD 28.000");
  });
});

describe("revisarPublicacion", () => {
  const delAuto = ["https://f.com/1.jpg", "https://f.com/2.jpg"];
  it("acepta fotos del auto con un texto normal", () => {
    expect(revisarPublicacion(["https://f.com/2.jpg"], delAuto, "Hola")).toBeNull();
  });
  it("frena sin fotos, con fotos ajenas, repetidas o de más", () => {
    expect(revisarPublicacion([], delAuto, "x")).toMatch(/al menos una/);
    expect(revisarPublicacion(["https://otro.com/x.jpg"], delAuto, "x")).toMatch(/no es de este auto/);
    expect(revisarPublicacion(["https://f.com/1.jpg", "https://f.com/1.jpg"], delAuto, "x")).toMatch(/repetida/);
    expect(revisarPublicacion(Array.from({ length: 11 }, (_, i) => `https://f.com/${i}.jpg`), delAuto, "x")).toMatch(/hasta 10/);
  });
  it("frena textos largos o con más de 30 hashtags", () => {
    expect(revisarPublicacion(["https://f.com/1.jpg"], delAuto, "a".repeat(2201))).toMatch(/2201 caracteres/);
    expect(revisarPublicacion(["https://f.com/1.jpg"], delAuto, Array.from({ length: 31 }, (_, i) => `#t${i}`).join(" "))).toMatch(/31 hashtags/);
  });
});

describe("esFotoJpg", () => {
  it("reconoce jpg y jpeg, con o sin parámetros", () => {
    expect(esFotoJpg("https://f.com/a.JPG")).toBe(true);
    expect(esFotoJpg("https://f.com/a.jpeg?v=2")).toBe(true);
    expect(esFotoJpg("https://f.com/a.webp")).toBe(false);
    expect(esFotoJpg("https://f.com/a.png")).toBe(false);
  });
});
