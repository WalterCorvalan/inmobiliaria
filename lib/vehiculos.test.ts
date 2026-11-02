import { describe, expect, it } from "vitest";
import { FILTRO_0KM, FILTRO_USADOS, FOTO_SIN_IMAGEN, esCeroKm, fotoPrincipal, textoKm } from "./vehiculos";

describe("fotoPrincipal", () => {
  it("devuelve la primera foto cargada", () => {
    expect(fotoPrincipal(["https://x/1.jpg", "https://x/2.jpg"])).toBe("https://x/1.jpg");
  });

  it("saltea entradas vacías", () => {
    expect(fotoPrincipal(["", "  ", null, "https://x/3.jpg"])).toBe("https://x/3.jpg");
  });

  it("sin fotos usa la imagen genérica", () => {
    expect(fotoPrincipal([])).toBe(FOTO_SIN_IMAGEN);
    expect(fotoPrincipal(null)).toBe(FOTO_SIN_IMAGEN);
    expect(fotoPrincipal(undefined)).toBe(FOTO_SIN_IMAGEN);
    expect(FOTO_SIN_IMAGEN).toBe("/sin-imagen.svg");
  });
});

describe("esCeroKm", () => {
  it("es 0 km solo con los kilómetros cargados en 0", () => {
    expect(esCeroKm({ km: 0 })).toBe(true);
    expect(esCeroKm({ km: "0" })).toBe(true);
    expect(esCeroKm({ km: 1 })).toBe(false);
    expect(esCeroKm({ km: 157000 })).toBe(false);
  });

  it("kilómetros vacíos = no se sabe: no es 0 km", () => {
    expect(esCeroKm({ km: null })).toBe(false);
    expect(esCeroKm({})).toBe(false);
    expect(esCeroKm({ km: "" })).toBe(false);
  });

  it("textoKm no muestra nada si no hay kilómetros cargados", () => {
    expect(textoKm({ km: 0 })).toBe("0 km");
    expect(textoKm({ km: 45000 })).toBe("45.000 km");
    expect(textoKm({ km: null })).toBeNull();
  });

  it("los filtros de la base usan la misma regla", () => {
    expect(FILTRO_0KM).toBe("km.eq.0");
    expect(FILTRO_USADOS).toBe("km.is.null,km.gt.0");
  });
});
