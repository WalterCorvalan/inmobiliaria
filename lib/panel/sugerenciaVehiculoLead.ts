// Ficha del lead en /panel/leads: si el lead no tiene un auto del stock vinculado, se sugieren los autos del stock
// que nombra el resumen de la IA o las notas (pedido de Walter del 12/10/2026: "el vehículo de interés debería
// cargarse solo"). No se vincula sin que alguien lo confirme: un auto nombrado puede ser el que el cliente quiere
// vender o consignar, no el que quiere comprar.
import { normalizarMarca } from "@/lib/vehiculos";

type AutoStock = { id: string; marca: string | null; modelo: string | null };

const palabras = (texto: string) => texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter(Boolean);

/** Autos del stock cuya marca y primera palabra del modelo aparecen en el texto. Como mucho `max`. */
export function sugerirVehiculosDelTexto<T extends AutoStock>(texto: string | null | undefined, stock: T[], max = 3): T[] {
  if (!texto?.trim()) return [];
  const enTexto = new Set(palabras(texto));
  const textoPegado = normalizarMarca(texto);
  return stock
    .filter((v) => {
      const marca = normalizarMarca(v.marca || "");
      const modelo = palabras(v.modelo || "")[0];
      return marca.length > 1 && !!modelo && modelo.length > 1 && textoPegado.includes(marca) && enTexto.has(modelo);
    })
    .slice(0, max);
}
