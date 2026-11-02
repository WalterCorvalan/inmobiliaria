import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/panel/logger", () => ({ registrarError: vi.fn() }));
vi.mock("@/lib/ai/estimarPrecioMercado", () => ({ estimarPrecioMercado: vi.fn() }));

import { filaPedidoDesdeChat } from "./pedidoDesdeChat";

const datos = (extra: Record<string, unknown> = {}) => ({
  timing: null, forma_pago: null, tiene_permuta: null, nombre: "Lucas", email: null, telefono: null,
  precio_pedido: "18 mil dólares",
  vehiculo_propio: { marca: "Volkswagen", modelo: "Gol Trend", anio: "2015", km: "120 mil" },
  ...extra,
});

describe("filaPedidoDesdeChat", () => {
  it("vender su auto va a Compra, con el precio como lo dijo", () => {
    expect(filaPedidoDesdeChat("VENTA", datos())).toEqual({
      tipo: "tasacion", marca: "Volkswagen", modelo: "Gol Trend", anio: 2015, kilometraje: 120000,
      precio_pedido: "18 mil dólares", auto_que_quiere: null,
    });
  });

  it("permuta solo si eligió un auto de nuestro stock", () => {
    expect(filaPedidoDesdeChat("COMPRA_CON_PERMUTA", datos())).toBeNull();
    expect(filaPedidoDesdeChat("COMPRA_CON_PERMUTA", datos({ auto_que_quiere: "Toyota Hilux 2020" }))?.tipo).toBe("permuta");
    expect(filaPedidoDesdeChat("COMPRA", datos({ tiene_permuta: true, auto_que_quiere: "Toyota Hilux 2020" }))?.auto_que_quiere).toBe("Toyota Hilux 2020");
  });

  it("sin marca, modelo, año y km no se carga; consignación y compra simple tampoco", () => {
    expect(filaPedidoDesdeChat("VENTA", datos({ vehiculo_propio: { marca: "Volkswagen", modelo: "Gol Trend", anio: "2015", km: null } }))).toBeNull();
    expect(filaPedidoDesdeChat("CONSIGNACION", datos())).toBeNull();
    expect(filaPedidoDesdeChat("COMPRA", datos({ auto_que_quiere: "Toyota Hilux 2020" }))).toBeNull();
  });
});
