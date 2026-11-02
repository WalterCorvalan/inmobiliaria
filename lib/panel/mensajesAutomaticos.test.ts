import { describe, expect, it } from "vitest";
import { aniosEntre, compraParaRenovar, primerNombre, telefonoParaWhatsapp, terminanDePagarEnElMes } from "./mensajesAutomaticos";

describe("fin de pago", () => {
  it("toma la última cuota de cada venta sumando agencia y financiera", () => {
    const cuotas = [
      { cliente_id: "c1", venta_id: "v1", vencimiento: "2026-09-10" },
      { cliente_id: "c1", venta_id: "v1", vencimiento: "2026-10-10" }, // última, de la agencia
      { cliente_id: "c2", venta_id: "v2", vencimiento: "2026-10-05" },
      { cliente_id: "c2", venta_id: "v2", vencimiento: "2026-12-05" }, // la financiera sigue hasta diciembre
      { cliente_id: null, venta_id: "v3", vencimiento: "2026-10-01" },
    ];
    expect(terminanDePagarEnElMes(cuotas, "2026-10")).toEqual([{ cliente_id: "c1", venta_id: "v1" }]);
    expect(terminanDePagarEnElMes(cuotas, "2026-12")).toEqual([{ cliente_id: "c2", venta_id: "v2" }]);
  });
});

describe("teléfono para WhatsApp", () => {
  it("lo deja como 549 + área + número", () => {
    expect(telefonoParaWhatsapp("11 2190-7000")).toBe("5491121907000");
    expect(telefonoParaWhatsapp("011 15 2190 7000")).toBe("5491121907000");
    expect(telefonoParaWhatsapp("+54 9 11 2190 7000")).toBe("5491121907000");
    expect(telefonoParaWhatsapp("5491121907000")).toBe("5491121907000");
    expect(telefonoParaWhatsapp("4742-2121")).toBeNull();
    expect(telefonoParaWhatsapp(null)).toBeNull();
  });
  it("saluda por el primer nombre", () => {
    expect(primerNombre("Juan Carlos")).toBe("Juan");
    expect(primerNombre("")).toBe("");
  });
});

describe("cumpleaños con oferta de renovar", () => {
  it("cuenta años completos", () => {
    expect(aniosEntre("2023-10-21", "2026-10-20")).toBe(2);
    expect(aniosEntre("2023-10-20", "2026-10-20")).toBe(3);
    expect(aniosEntre("2022-03-01", "2026-10-20")).toBe(4);
  });

  it("toma la última compra y solo si ya pasaron 3 años", () => {
    const vieja = { id: "v1", fecha_cierre: "2022-05-10" };
    const nueva = { id: "v2", fecha_cierre: "2025-01-15" };
    expect(compraParaRenovar([vieja], "2026-10-20")).toEqual({ venta: vieja, anios: 4 });
    // Volvió a comprar hace menos de 3 años: no se le ofrece renovar.
    expect(compraParaRenovar([vieja, nueva], "2026-10-20")).toBeNull();
    expect(compraParaRenovar([], "2026-10-20")).toBeNull();
    expect(compraParaRenovar([{ id: "v3", fecha_cierre: null }], "2026-10-20")).toBeNull();
  });

  it("los años se pueden cambiar", () => {
    expect(compraParaRenovar([{ id: "v1", fecha_cierre: "2024-10-01" }], "2026-10-20", 2)?.anios).toBe(2);
  });
});
