// Orígenes de un vehículo (vehiculos.origen): cómo entró a la agencia. Tiene que coincidir con el CHECK
// vehiculos_origen_check de la base. Fuente única para el alta de Stock y para los autos cargados a mano desde Señas y
// Cotizaciones (api/panel/vehiculos/crear-incompleto).
// 12/10/2026: el selector de vehículos mandaba "Comprado" por defecto, la base lo rechazaba y el auto no se guardaba
// ("violates check constraint vehiculos_origen_check"). Todo valor que venga de afuera pasa por normalizarOrigenVehiculo.
export const ORIGENES_VEHICULO = ["Compra", "Consignación", "Permuta", "Otro"] as const;
export type OrigenVehiculo = (typeof ORIGENES_VEHICULO)[number];

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function normalizarOrigenVehiculo(valor: string | null | undefined): OrigenVehiculo | null {
  if (valor == null || valor.trim() === "") return null;
  const v = sinTildes(valor);
  if (v.startsWith("compra")) return "Compra";
  if (v.startsWith("consign")) return "Consignación";
  if (v.startsWith("permuta")) return "Permuta";
  return "Otro";
}
