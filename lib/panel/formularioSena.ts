import type { Moneda } from "@/lib/moneda";

// Editar seña con el mismo formulario que Nueva seña (Walter, 20/10/2026: "tiene que aparecer exactamente el mismo
// formulario"). Pasa una fila de `senas` a los valores del formulario de NuevaSenaModal.tsx. Las columnas _ars/_usd son
// excluyentes: la que tiene valor decide la moneda de cada monto.

export type FilaSena = Record<string, unknown>;

export type ValoresFormularioSena = {
  sucursalId: string; vendedorId: string; fechaNacimiento: string; sexo: string;
  ventaValor: string; monedaVenta: Moneda; senaValor: string; monedaSena: Moneda;
  efectivoValor: string; monedaEfectivo: Moneda; patentValor: string; monedaPatent: Moneda; patentIncluido: boolean;
  tipoCambio: string; recibePermuta: boolean; permutaTasado: string;
  pagaEnCuotas: boolean; fechaPrimeraCuota: string; cantCuotas: string; cuotaRemanente: string;
  hayPrenda: boolean; bancoPrenda: string; prendaMonto: string; prendaExtra: boolean; prendaBoleto: string;
  cuotasPrenda: string; cuotaPrenda: string; seguroPrenda: string;
  contrataSeguro: boolean; seguroCompania: string; seguroImporte: string; observaciones: string;
};

const texto = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const hay = (v: unknown) => v !== null && v !== undefined && v !== "" && Number(v) !== 0;

/** Monto y moneda a partir del par de columnas _ars/_usd (si las dos están vacías, pesos y vacío). */
function montoYMoneda(ars: unknown, usd: unknown): [string, Moneda] {
  if (hay(usd) && !hay(ars)) return [texto(usd), "USD"];
  return [hay(ars) ? texto(ars) : "", "ARS"];
}

export function formularioDesdeSena(s: FilaSena): ValoresFormularioSena {
  const [ventaValor, monedaVenta] = montoYMoneda(s.venta_ars, s.venta_usd);
  const [senaValor, monedaSena] = montoYMoneda(s.sena_ars, s.sena_usd);
  const [efectivoValor, monedaEfectivo] = montoYMoneda(s.efectivo_ars, s.efectivo_usd);
  const [patentValor, monedaPatent] = montoYMoneda(s.patentamiento_transferencia_ars, s.patentamiento_transferencia_usd);
  const hayPrenda = !!s.banco_prenda || hay(s.prenda_monto) || hay(s.cant_cuotas_prenda) || hay(s.cuota_prenda_ars) || hay(s.seguro_prenda_ars);
  return {
    sucursalId: texto(s.sucursal_id), vendedorId: texto(s.vendedor_id),
    fechaNacimiento: texto(s.fecha_nacimiento).slice(0, 10), sexo: "",
    ventaValor, monedaVenta, senaValor, monedaSena, efectivoValor, monedaEfectivo, patentValor, monedaPatent,
    patentIncluido: !!s.patentamiento_incluido, tipoCambio: hay(s.tipo_cambio) ? texto(s.tipo_cambio) : "",
    recibePermuta: !!s.permuta_vehiculo_id || hay(s.permuta_tasado_ars), permutaTasado: hay(s.permuta_tasado_ars) ? texto(s.permuta_tasado_ars) : "",
    pagaEnCuotas: !!s.fecha_primera_cuota_remanente || hay(s.cant_cuotas_remanente) || hay(s.cuota_remanente_ars),
    fechaPrimeraCuota: texto(s.fecha_primera_cuota_remanente).slice(0, 10), cantCuotas: hay(s.cant_cuotas_remanente) ? texto(s.cant_cuotas_remanente) : "",
    cuotaRemanente: hay(s.cuota_remanente_ars) ? texto(s.cuota_remanente_ars) : "",
    hayPrenda, bancoPrenda: texto(s.banco_prenda), prendaMonto: hay(s.prenda_monto) ? texto(s.prenda_monto) : "",
    prendaExtra: hay(s.prenda_monto_boleto), prendaBoleto: hay(s.prenda_monto_boleto) ? texto(s.prenda_monto_boleto) : "",
    cuotasPrenda: hay(s.cant_cuotas_prenda) ? texto(s.cant_cuotas_prenda) : "", cuotaPrenda: hay(s.cuota_prenda_ars) ? texto(s.cuota_prenda_ars) : "",
    seguroPrenda: hay(s.seguro_prenda_ars) ? texto(s.seguro_prenda_ars) : "",
    contrataSeguro: !!s.seguro_compania || hay(s.seguro_importe_mensual), seguroCompania: texto(s.seguro_compania),
    seguroImporte: hay(s.seguro_importe_mensual) ? texto(s.seguro_importe_mensual) : "",
    observaciones: texto(s.notas),
  };
}
