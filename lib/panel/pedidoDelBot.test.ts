import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/panel/logger", () => ({ registrarError: vi.fn() }));

import { cambiosDelPedido, finDelTelefono, pedidoDeLaMismaMarca, type FilaPedidoBot } from "./pedidoDelBot";

const fila: FilaPedidoBot = {
  telefono: "5491128859252", nombre_cliente: "cesar thola", marca: "Mercedes-Benz", modelo: "Sprinter",
  presupuesto_max: null, moneda: "ARS", puertas: null, vendedor_id: "v1", origen: "whatsapp",
};

describe("pedido del bot sin repetir (30/10/2026)", () => {
  it("el mismo número con y sin 54 9 es el mismo cliente", () => {
    expect(finDelTelefono("5491128859252")).toBe(finDelTelefono("1128859252"));
    expect(finDelTelefono("123")).toBeNull();
  });

  it("misma marca (aunque cambie la forma de escribirla) completa el pedido; otra marca es otro pedido", () => {
    const activos = [{ id: "p1", marca: "Mercedes Benz", nombre_cliente: "cesar", vendedor_id: "v1" }];
    expect(pedidoDeLaMismaMarca(activos, "mercedes-benz")?.id).toBe("p1");
    expect(pedidoDeLaMismaMarca(activos, "Ford")).toBeNull();
  });

  it("solo actualiza lo que el cliente dijo ahora y no pisa un nombre real con el de relleno", () => {
    const existente = { id: "p1", marca: "Ford", nombre_cliente: "Guillermo", vendedor_id: null };
    expect(cambiosDelPedido(existente, { ...fila, modelo: null, presupuesto_max: 30000, moneda: "USD", nombre_cliente: "Cliente de WhatsApp" }))
      .toEqual({ presupuesto_max: 30000, moneda: "USD", vendedor_id: "v1" });
    expect(cambiosDelPedido({ ...existente, vendedor_id: "v2" }, { ...fila, modelo: "1965 blanca", nombre_cliente: "Juan Guillermo Cabral" }))
      .toEqual({ modelo: "1965 blanca", nombre_cliente: "Juan Guillermo Cabral" });
  });
});
