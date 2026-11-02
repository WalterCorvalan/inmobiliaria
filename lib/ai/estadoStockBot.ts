// Qué hace el bot con los autos que no están libres para vender (Walter, 30/10/2026, caso Corolla 2019 de la historia:
// estaba en preparación, el bot no lo veía y le ofreció el 2026 como si fuera ese):
//  - En preparación: lo ve. Dice que lo tenemos y que hay que confirmar si está disponible para la venta. Nunca dice el
//    precio ni agenda una visita para verlo: le pasa la charla al vendedor para que se fije.
//  - Reservado o señado: dice que ya está señado y ofrece autos parecidos, como la ficha del catálogo ("También te
//    podría interesar" = misma marca, "Precio similar" = ±15%).
//  - "El de la historia", "el de la publicación", "el que mostraron", "el rojo": si el cliente no dijo el año, no
//    confirma nada; le pide el modelo y el año para fijarse.

//  - Vendido hace poco (Walter, 2/11/2026, caso Fiat Duna Weekend): si el cliente pregunta por un modelo puntual que no
//    está y se vendió en los últimos 30 días, dice que ese ya se vendió (sin precio ni visita) y ofrece parecidos. Se
//    mira en las ventas cerradas (marca y modelo de la venta), así sirve aunque el auto nunca se cargó en Stock.
//    Sigue siendo lead: el bot atiende y después decide si lo pasa al vendedor.

import { marcasQueCoinciden, modelosQueCoinciden } from "@/lib/ai/busquedaStock";

export const ESTADOS_QUE_VE_EL_BOT = ["disponible", "reservado", "señado", "en_preparacion"];
export const ESTADOS_SENADO = ["reservado", "señado"];

export const DIAS_VENDIDO_RECIENTE = 30;

export const esVendido = (estado: string | null | undefined) => estado === "vendido";
export const esEnPreparacion = (estado: string | null | undefined) => estado === "en_preparacion";
export const esSenado = (estado: string | null | undefined) => !!estado && ESTADOS_SENADO.includes(estado);

/** Nota para la IA sobre una unidad que no está libre. Null si está disponible. */
export function notaDeEstado(estado: string | null | undefined): string | null {
  if (esEnPreparacion(estado)) {
    return "⏳ EN PREPARACIÓN — NO digas el precio ni agendes visita para verlo. Decile que lo tenemos y que hay que confirmar si está disponible para la venta, que un asesor se lo confirma. Marcá \"handoff\": true con \"resumen_handoff\" = \"Pregunta por <marca modelo año>, que está en preparación: confirmar si se puede vender\".";
  }
  if (esSenado(estado)) {
    return "🔒 SEÑADO — ya está señado, no se puede vender. Decíselo y ofrecele las unidades parecidas de la lista (las marcadas \"parecido a\").";
  }
  if (esVendido(estado)) {
    return "❌ VENDIDO HACE POCO — ese auto ya se vendió. Decíselo, NO digas precio, NO agendes visita para verlo y ofrecele las unidades parecidas de la lista (las marcadas \"parecido a\"). Si le interesa algo parecido seguí la charla normal.";
  }
  return null;
}

export type VentaParaBot = { vehiculo_marca: string | null; vehiculo_modelo: string | null; fecha_cierre: string | null };

/** Fecha (YYYY-MM-DD) desde la que una venta cerrada cuenta como "reciente". */
export function desdeVentaReciente(hoy: Date = new Date()): string {
  const d = new Date(hoy.getTime() - DIAS_VENDIDO_RECIENTE * 86400000);
  return d.toISOString().slice(0, 10);
}

/** Ventas recientes cuyo modelo (y marca, si el cliente la dijo) coinciden con lo que pidió. */
export function ventasRecientesQueCoinciden(
  ventas: VentaParaBot[],
  marca: string | null | undefined,
  modelo: string | null | undefined,
  hoy: Date = new Date(),
): VentaParaBot[] {
  if (!modelo) return [];
  const desde = desdeVentaReciente(hoy);
  const recientes = ventas.filter((v) => v.fecha_cierre && v.fecha_cierre.slice(0, 10) >= desde && v.vehiculo_modelo);
  const modelos = modelosQueCoinciden(modelo, recientes.map((v) => v.vehiculo_modelo as string));
  return recientes.filter((v) => {
    if (!modelos.includes(v.vehiculo_modelo as string)) return false;
    return !marca || !v.vehiculo_marca || marcasQueCoinciden(marca, [v.vehiculo_marca]).length > 0;
  });
}

const REFERENCIA_VAGA = /historia|publicaci|posteo|\bpost\b|publicad|(que|lo que) (mostraron|subieron|publicaron|pusieron)|\bel (rojo|blanco|negro|gris|azul|verde|plateado|bordo)\b|\bla (roja|blanca|negra|gris|azul|verde|plateada|bordo)\b/i;
const ANIO = /\b(19[5-9]\d|20[0-4]\d)\b/;

/**
 * ¿El cliente habla de un auto puntual que vio (historia, publicación, "el rojo") sin decir el año? Mira el último
 * mensaje para la referencia y los últimos mensajes del cliente para el año.
 */
export function referenciaVagaSinAnio(mensajesCliente: string[]): boolean {
  const ultimo = mensajesCliente[mensajesCliente.length - 1] ?? "";
  if (!REFERENCIA_VAGA.test(ultimo)) return false;
  return !mensajesCliente.slice(-4).some((m) => ANIO.test(m));
}

// Se suma al prompt de la búsqueda cuando referenciaVagaSinAnio() da true.
export const NOTA_REFERENCIA_VAGA = `
IMPORTANTE — EL CLIENTE HABLA DE UN AUTO PUNTUAL QUE VIO (historia, publicación, "el que mostraron", "el rojo") SIN DECIR EL AÑO: vos no ves la historia ni la publicación, así que no sabés cuál es. NO digas "sí, lo tenemos", NO muestres precios y NO agendes visita. Contestale corto: "Te confirmo si lo tenemos: ¿me decís el modelo y el año?". Cuando te lo diga, recién ahí buscás y confirmás.`;
