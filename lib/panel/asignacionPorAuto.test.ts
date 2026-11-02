import { describe, expect, it } from "vitest";
import { autoDeLaCharla, destinoDelLead, vendedorDelAuto } from "./asignacionPorAuto";

const perfiles = [
  { id: "encargada-1", roles: ["encargado", "ventas"], sucursal_id: "oficina-1" },
  { id: "asesor-1", roles: ["ventas"], sucursal_id: "oficina-1" },
  { id: "asesor-2", roles: ["ventas"], sucursal_id: "oficina-1" },
  { id: "encargado-2", roles: ["encargado", "ventas"], sucursal_id: "oficina-2" },
  { id: "dueno", roles: ["admin"], sucursal_id: null },
  { id: "baja", roles: ["ventas"], sucursal_id: "oficina-2", activo: false },
];

describe("a quién va el lead según la propiedad", () => {
  it("manda el vendedor asignado al auto", () => {
    expect(vendedorDelAuto({ vendedor_asignado_id: "asesor-2", sucursal_id: "oficina-1" }, perfiles)).toBe("asesor-2");
  });

  it("sin vendedor asignado, el único que vende en la oficina de la propiedad", () => {
    expect(vendedorDelAuto({ vendedor_asignado_id: null, sucursal_id: "oficina-2" }, perfiles)).toBe("encargado-2");
    expect(vendedorDelAuto({ vendedor_asignado_id: null, sucursal_id: "oficina-1" }, perfiles)).toBeNull(); // hay varios: ronda
    expect(vendedorDelAuto({ vendedor_asignado_id: "baja", sucursal_id: "oficina-2" }, perfiles)).toBe("encargado-2");
  });

  it("la consignación sigue la ronda; un pase a mano no se toca; si ya lo tiene, no cambia", () => {
    const base = { vendedorDelAuto: "encargado-2", vendedorActual: "asesor-1", asignadoAMano: false };
    expect(destinoDelLead(base)).toBe("encargado-2");
    expect(destinoDelLead({ ...base, intencion: "CONSIGNACION" })).toBeNull();
    expect(destinoDelLead({ ...base, asignadoAMano: true })).toBeNull();
    expect(destinoDelLead({ ...base, vendedorActual: "encargado-2" })).toBeNull();
    expect(destinoDelLead({ ...base, vendedorDelAuto: null })).toBeNull();
  });
});

describe("auto del stock vinculado a la charla (29/10/2026)", () => {
  it("consignación o venta del auto del cliente: se saca el auto del stock", () => {
    expect(autoDeLaCharla("gr-sport", "CONSIGNACION")).toBeNull();
    expect(autoDeLaCharla(null, "VENTA")).toBeNull();
  });
  it("compra o permuta: queda el auto que eligió", () => {
    expect(autoDeLaCharla("gr-sport", "COMPRA")).toBe("gr-sport");
    expect(autoDeLaCharla("gr-sport", "COMPRA_CON_PERMUTA")).toBe("gr-sport");
  });
  it("sin auto en foco: no se toca lo que había", () => {
    expect(autoDeLaCharla(null, "COMPRA")).toBeUndefined();
    expect(autoDeLaCharla(undefined, null)).toBeUndefined();
  });
});
