// Auto que el cliente entrega en permuta dentro de un presupuesto. Desde el
// 6/10 (pedido de Walter: "mostrar todo") se muestra completo al cliente en el
// link y en el PDF, incluido el valor de toma; las fotos solo en el link (el
// PDF no lleva fotos). También sirve para que el encargado evalúe la toma. Se guarda como lista en presupuestos.permutas (jsonb) con los
// mismos nombres de campo que la permuta de Ventas (NuevaVentaModal.tsx) para
// poder precargarla ahí y, cuando se compra el auto, cargarlo al stock.
// Los campos de detalle (version en adelante) se sumaron después: los
// presupuestos viejos no los tienen, por eso son opcionales al leer.
export interface PermutaPresupuesto {
  valor: string; moneda: "ARS" | "USD";
  marca: string; modelo: string; anio: string; km: string; patente: string; color: string; condicion: string;
  segmento: string; combustible: string;
  fotos: string[];
  version?: string;
  duenos?: string;
  service?: string;
  chapaPintura?: string;
  cubiertas?: string;
  choques?: string;
  detalles?: string;
}

export const CONDICIONES_PERMUTA = ["Excelente", "Muy bueno", "Bueno", "Regular"];
export const OPCIONES_SERVICE = ["Oficial al día", "Parcial", "No oficial", "Sin datos"];
export const OPCIONES_ESTADO_PARTE = ["Bueno", "Regular", "Malo"];
export const OPCIONES_CHOQUES = ["Sin choques", "Choques leves", "Choque fuerte"];

export const nuevaPermutaPresupuesto = (): PermutaPresupuesto => ({
  valor: "", moneda: "USD", marca: "", modelo: "", anio: "", km: "", patente: "", color: "", condicion: "Muy bueno", segmento: "", combustible: "", fotos: [],
  version: "", duenos: "", service: "", chapaPintura: "", cubiertas: "", choques: "", detalles: "",
});

// Filas "dato: valor" de una permuta para mostrarla (link público, PDF y
// detalle del panel). Solo las que tienen algo cargado.
export function filasPermuta(pm: Partial<PermutaPresupuesto>): [string, string][] {
  const filas: [string, string | null | undefined][] = [
    ["Vehículo", [pm.marca, pm.modelo, pm.version].filter(Boolean).join(" ")],
    ["Año", pm.anio],
    ["Kilometraje", pm.km ? `${Number(pm.km).toLocaleString("es-AR")} km` : null],
    ["Dominio", pm.patente],
    ["Color", pm.color],
    ["Combustible", pm.combustible],
    ["Segmento", pm.segmento],
    ["Estado general", pm.condicion],
    ["Dueños anteriores", pm.duenos],
    ["Service", pm.service],
    ["Chapa y pintura", pm.chapaPintura],
    ["Cubiertas", pm.cubiertas],
    ["Choques", pm.choques],
    ["Detalles", pm.detalles],
    ["Valor de toma", pm.valor ? `${pm.moneda === "ARS" ? "$" : "US$"} ${Number(pm.valor).toLocaleString("es-AR")}` : null],
  ];
  return filas.filter((f): f is [string, string] => !!f[1] && String(f[1]).trim() !== "");
}

// Una permuta sin ningún dato cargado no se guarda.
export const permutaTieneDatos = (p: PermutaPresupuesto) => !!(p.marca.trim() || p.modelo.trim() || p.valor || p.patente.trim() || p.fotos.length);
