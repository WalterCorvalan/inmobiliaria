import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/panel/logger", () => ({ registrarError: vi.fn() }));

import { filaConsignacionDesdeChat } from "./consignacionDesdeChat";
import { detallePedidoConsignacion } from "./consignacionPedido";

const datos = (extra: Record<string, unknown> = {}) => ({
  timing: null, forma_pago: null, tiene_permuta: null, nombre: "Damián", email: null, telefono: null,
  precio_pedido: "11.000 dólares limpios", zona: "oficina-1",
  vehiculo_propio: { marca: "Jeep", modelo: "Compass", anio: "2014", km: "120.000" },
  ...extra,
});

describe("filaConsignacionDesdeChat", () => {
  it("arma la consignación con el auto, el precio que pide el dueño y la descripción como la web", () => {
    expect(filaConsignacionDesdeChat("CONSIGNACION", datos())).toEqual({
      vehiculo_descripcion: "Jeep Compass 2014 120.000 km",
      vehiculo_marca: "Jeep", vehiculo_modelo: "Compass", vehiculo_anio: 2014, vehiculo_km: 120000,
      precio_pedido: "11.000 dólares limpios",
    });
  });

  it("solo si es consignación y están marca, modelo, año y kilómetros", () => {
    expect(filaConsignacionDesdeChat("VENTA", datos())).toBeNull();
    expect(filaConsignacionDesdeChat("COMPRA_CON_PERMUTA", datos())).toBeNull();
    const auto = { marca: "Jeep", modelo: "Compass", anio: "2014", km: "120.000" };
    expect(filaConsignacionDesdeChat("CONSIGNACION", datos({ vehiculo_propio: { ...auto, marca: null } }))).toBeNull();
    expect(filaConsignacionDesdeChat("CONSIGNACION", datos({ vehiculo_propio: { ...auto, modelo: null } }))).toBeNull();
    expect(filaConsignacionDesdeChat("CONSIGNACION", datos({ vehiculo_propio: { ...auto, anio: "14" } }))).toBeNull();
    expect(filaConsignacionDesdeChat("CONSIGNACION", datos({ vehiculo_propio: { ...auto, km: null } }))).toBeNull();
  });

  it("precio y zona no se exigen; los km se entienden como los dice el cliente", () => {
    const auto = { marca: "Jeep", modelo: "Compass", anio: "2014" };
    expect(filaConsignacionDesdeChat("CONSIGNACION", datos({ precio_pedido: null, vehiculo_propio: { ...auto, km: "0" } }))?.vehiculo_km).toBe(0);
    expect(filaConsignacionDesdeChat("CONSIGNACION", datos({ vehiculo_propio: { ...auto, km: "120 mil" } }))?.vehiculo_km).toBe(120000);
    expect(filaConsignacionDesdeChat("CONSIGNACION", datos({ vehiculo_propio: { ...auto, km: "85k" } }))?.vehiculo_km).toBe(85000);
    expect(filaConsignacionDesdeChat("CONSIGNACION", datos({ vehiculo_propio: { ...auto, km: "no sé" } }))).toBeNull();
  });
});

describe("detallePedidoConsignacion", () => {
  it("precio, zona y chat de donde vino", () => {
    expect(detallePedidoConsignacion({ precio_pedido: "11.000 dólares limpios", sucursal_nombre: "Oficina 1", chat_link: "/panel/whatsapp?conversacion=abc", vehiculo_km: 120000 }))
      .toBe("Pide 11.000 dólares limpios · Oficina 1 · por WhatsApp");
  });
  it("una charla vieja sin km lo avisa", () => {
    expect(detallePedidoConsignacion({ chat_link: "/panel/instagram?conversacion=abc", vehiculo_km: null })).toBe("por Instagram · faltan km");
  });
  it("las del formulario de la web no muestran nada", () => {
    expect(detallePedidoConsignacion({})).toBeNull();
  });
});
