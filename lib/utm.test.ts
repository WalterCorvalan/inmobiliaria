import { describe, expect, it } from "vitest";
import { origenDesde } from "./utm";

describe("origenDesde", () => {
  it("con utm_source usa el canal de Pautas y guarda los valores crudos", () => {
    expect(origenDesde("?utm_source=facebook&utm_medium=ads&utm_campaign=hilux-octubre", "")).toEqual({
      utm_source: "facebook", utm_medium: "ads", utm_campaign: "hilux-octubre", canal: "Meta Ads",
    });
    expect(origenDesde("?utm_source=Google", "")?.canal).toBe("Google Ads");
  });

  it("una fuente desconocida queda tal cual", () => {
    expect(origenDesde("?utm_source=volante", "")?.canal).toBe("volante");
  });

  it("sin utm usa el sitio que lo mandó", () => {
    expect(origenDesde("", "https://www.instagram.com/")?.canal).toBe("Instagram (orgánico)");
    expect(origenDesde("", "https://www.google.com/search?q=pfaffen")?.canal).toBe("Google (orgánico)");
  });

  it("sin utm ni referrer conocido no inventa origen", () => {
    expect(origenDesde("", "")).toBeNull();
    expect(origenDesde("", "https://www.pfaffencars.com/catalogo")).toBeNull();
    expect(origenDesde("", "no es una url")).toBeNull();
  });
});

describe("origenDesde con el etiquetado automático de Google Ads", () => {
  it("gclid, gbraid o wbraid sin utm es Google Ads, aunque el referrer sea google.com", () => {
    for (const p of ["gclid=abc", "gbraid=xyz", "wbraid=xyz"]) {
      expect(origenDesde(`?${p}`, "https://www.google.com/")).toEqual({ utm_source: "google", utm_medium: "cpc", utm_campaign: null, canal: "Google Ads" });
    }
  });

  it("si además trae utm, mandan los utm (tienen la campaña)", () => {
    expect(origenDesde("?utm_source=google&utm_campaign=hilux&gclid=abc", "")?.utm_campaign).toBe("hilux");
  });
});

describe("origenDesde con un link marcado como orgánico (29/10/2026)", () => {
  it("la ficha de Google Maps con utm_medium=organic es Google orgánico, no Google Ads", () => {
    expect(origenDesde("?utm_source=google&utm_medium=organic", "")?.canal).toBe("Google (orgánico)");
    expect(origenDesde("?utm_source=google&utm_medium=local&utm_campaign=ficha-maps", "")).toEqual({ utm_source: "google", utm_medium: "local", utm_campaign: "ficha-maps", canal: "Google (orgánico)" });
  });
  it("un link en la bio de Instagram es Instagram orgánico", () => {
    expect(origenDesde("?utm_source=instagram&utm_medium=bio", "")?.canal).toBe("Instagram (orgánico)");
  });
  it("el anuncio sigue siendo anuncio", () => {
    expect(origenDesde("?utm_source=google&utm_medium=cpc", "")?.canal).toBe("Google Ads");
    expect(origenDesde("?utm_source=google", "")?.canal).toBe("Google Ads");
  });
});
