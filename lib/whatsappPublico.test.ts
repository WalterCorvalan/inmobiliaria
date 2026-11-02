import { describe, expect, it } from "vitest";
import { normalizarWhatsappAR } from "./whatsappPublico";

describe("normalizarWhatsappAR", () => {
  it("arma 549 + número desde cualquier forma de escribirlo", () => {
    expect(normalizarWhatsappAR("11 2190-7000")).toBe("5491121907000");
    expect(normalizarWhatsappAR("+54 9 11 5652-0726")).toBe("5491156520726");
    expect(normalizarWhatsappAR("541156520726")).toBe("5491156520726");
    expect(normalizarWhatsappAR("011 15 5652-0726")).toBe("5491156520726");
    expect(normalizarWhatsappAR("5491156520726")).toBe("5491156520726");
  });

  it("vacío o demasiado corto no es un número", () => {
    expect(normalizarWhatsappAR("")).toBeNull();
    expect(normalizarWhatsappAR(null)).toBeNull();
    expect(normalizarWhatsappAR("1234")).toBeNull();
  });
});

describe("normalizarWhatsappAR", () => {
  it("un número guardado sin código de país (como en perfiles) sale con 549 (13/10/2026: Meta leía el 1 como Estados Unidos)", () => {
    expect(normalizarWhatsappAR("1157998065")).toBe("5491157998065");
    expect(normalizarWhatsappAR("11 5652-0726")).toBe("5491156520726");
  });
});
