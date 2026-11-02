import { describe, expect, it } from "vitest";
import { autoDeLaCharla, destinoDelLead, vendedorDelAuto } from "./asignacionPorAuto";

const perfiles = [
  { id: "gabriel", roles: ["encargado", "ventas"], sucursal_id: "central" },
  { id: "fede", roles: ["ventas"], sucursal_id: "central" },
  { id: "julian", roles: ["ventas"], sucursal_id: "central" },
  { id: "lucas", roles: ["encargado", "ventas"], sucursal_id: "torcuato" },
  { id: "walter", roles: ["admin"], sucursal_id: null },
  { id: "baja", roles: ["ventas"], sucursal_id: "torcuato", activo: false },
];

describe("a quién va el lead según el auto (21/10/2026)", () => {
  it("manda el vendedor asignado al auto", () => {
    expect(vendedorDelAuto({ vendedor_asignado_id: "julian", sucursal_id: "central" }, perfiles)).toBe("julian");
  });

  it("sin vendedor asignado, el único que vende en la sucursal del auto (Don Torcuato → Lucas)", () => {
    expect(vendedorDelAuto({ vendedor_asignado_id: null, sucursal_id: "torcuato" }, perfiles)).toBe("lucas");
    expect(vendedorDelAuto({ vendedor_asignado_id: null, sucursal_id: "central" }, perfiles)).toBeNull(); // hay varios: ronda
    expect(vendedorDelAuto({ vendedor_asignado_id: "baja", sucursal_id: "torcuato" }, perfiles)).toBe("lucas");
  });

  it("consignación va a Gabriel; un pase a mano no se toca; si ya lo tiene, no cambia", () => {
    const base = { vendedorDelAuto: "lucas", gabrielId: "gabriel", vendedorActual: "fede", asignadoAMano: false };
    expect(destinoDelLead(base)).toBe("lucas");
    expect(destinoDelLead({ ...base, intencion: "CONSIGNACION" })).toBe("gabriel");
    expect(destinoDelLead({ ...base, asignadoAMano: true })).toBeNull();
    expect(destinoDelLead({ ...base, vendedorActual: "lucas" })).toBeNull();
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
