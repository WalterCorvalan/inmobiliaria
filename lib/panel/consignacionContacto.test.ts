import { describe, it, expect } from "vitest";
import { diasSinContacto, esConsignacionFria, DIAS_CONSIGNACION_FRIA } from "./consignacionContacto";

const HOY = "2026-10-08";

describe("contacto de una consignación", () => {
  it("cuenta desde el último contacto; si no hay, desde el alta", () => {
    expect(diasSinContacto({ ultimo_contacto: "2026-10-01", fecha_alta: "2026-08-29" }, HOY)).toBe(7);
    expect(diasSinContacto({ fecha_alta: "2026-08-29" }, HOY)).toBe(40);
    expect(diasSinContacto({ created_at: "2026-10-08T15:00:00Z" }, HOY)).toBe(0);
    expect(diasSinContacto({}, HOY)).toBeNull();
  });

  it("fría desde los 10 días, solo si sigue activa", () => {
    const hace = (d: number) => new Date(Date.UTC(2026, 9, 8 - d)).toISOString().slice(0, 10);
    expect(esConsignacionFria({ estado: "publicado", ultimo_contacto: hace(DIAS_CONSIGNACION_FRIA) }, HOY)).toBe(true);
    expect(esConsignacionFria({ estado: "publicado", ultimo_contacto: hace(DIAS_CONSIGNACION_FRIA - 1) }, HOY)).toBe(false);
    expect(esConsignacionFria({ estado: "consignado", fecha_alta: "2026-01-01" }, HOY)).toBe(false);
    expect(esConsignacionFria({ estado: "cancelado", fecha_alta: "2026-01-01" }, HOY)).toBe(false);
  });
});
