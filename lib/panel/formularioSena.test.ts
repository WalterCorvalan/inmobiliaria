import { describe, expect, it } from "vitest";
import { formularioDesdeSena } from "./formularioSena";

describe("editar seña con el formulario de Nueva seña", () => {
  it("cada monto toma la moneda de la columna que tiene valor", () => {
    const f = formularioDesdeSena({ venta_usd: 20000, venta_ars: null, sena_ars: 1000000, efectivo_usd: 500, patentamiento_transferencia_ars: 300000, tipo_cambio: 1450 });
    expect([f.ventaValor, f.monedaVenta]).toEqual(["20000", "USD"]);
    expect([f.senaValor, f.monedaSena]).toEqual(["1000000", "ARS"]);
    expect([f.efectivoValor, f.monedaEfectivo]).toEqual(["500", "USD"]);
    expect([f.patentValor, f.monedaPatent]).toEqual(["300000", "ARS"]);
    expect(f.tipoCambio).toBe("1450");
  });

  it("abre las partes opcionales que tienen datos y deja cerradas las vacías", () => {
    const con = formularioDesdeSena({ banco_prenda: "Santander", prenda_monto: 5000000, prenda_monto_boleto: 6000000, seguro_compania: "La Caja", cant_cuotas_remanente: 6, permuta_tasado_ars: 8000000 });
    expect(con.hayPrenda && con.prendaExtra && con.contrataSeguro && con.pagaEnCuotas && con.recibePermuta).toBe(true);
    expect(con.prendaBoleto).toBe("6000000");
    const sin = formularioDesdeSena({ prenda_monto: 0, seguro_importe_mensual: null });
    expect(sin.hayPrenda || sin.contrataSeguro || sin.pagaEnCuotas || sin.recibePermuta || sin.prendaExtra).toBe(false);
    expect(sin.ventaValor).toBe("");
    expect(sin.monedaVenta).toBe("ARS");
  });

  it("trae notas, sucursal, vendedor y fechas sin la hora", () => {
    const f = formularioDesdeSena({ notas: "Llama el lunes", sucursal_id: "s1", vendedor_id: "v1", fecha_nacimiento: "1990-05-03T00:00:00", fecha_primera_cuota_remanente: "2026-11-10" });
    expect(f).toMatchObject({ observaciones: "Llama el lunes", sucursalId: "s1", vendedorId: "v1", fechaNacimiento: "1990-05-03", fechaPrimeraCuota: "2026-11-10" });
  });
});
