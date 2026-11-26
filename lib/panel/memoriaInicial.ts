// Memoria inicial del bot para una inmobiliaria nueva: respuestas fijas de ejemplo que el dueño revisa y cambia.
// Se cargan con un botón en Configuración > Empresa, solo las categorías que la empresa todavía no tiene.
export interface FilaMemoria { categoria: "saludo" | "horarios_ubicacion" | "pagos_financiacion" | "datos_empresa" | "fuera_horario" | "apertura"; palabras_clave: string[]; respuesta: string }

export function memoriaInicial(nombre: string): FilaMemoria[] {
  const n = nombre.trim() || "la inmobiliaria";
  return [
    { categoria: "saludo", palabras_clave: ["hola", "buenas"], respuesta: `¡Hola! Gracias por escribir a ${n}. ¿Buscás para comprar o alquilar, o querés vender o alquilar tu propiedad?` },
    { categoria: "horarios_ubicacion", palabras_clave: ["horario", "dirección", "donde"], respuesta: "Atendemos de lunes a viernes de 9 a 18 y los sábados de 9 a 13. Las visitas a las propiedades se coordinan dentro de ese horario. (Editá este texto con tus horarios y dirección reales.)" },
    { categoria: "pagos_financiacion", palabras_clave: ["requisitos", "garantía", "honorarios", "comisión"], respuesta: "Alquiler: contrato de 3 años, garantía propietaria o seguro de caución, recibo de sueldo. Honorarios: un mes de alquiler. Venta: honorarios del 3% para el comprador. (Editá este texto con tus condiciones reales.)" },
    { categoria: "datos_empresa", palabras_clave: ["tasación", "tasar", "vender mi"], respuesta: "Hacemos tasaciones sin cargo: un asesor visita la propiedad y te pasa un valor de mercado en 48 horas. (Editá este texto con lo que ofrece tu inmobiliaria.)" },
    { categoria: "fuera_horario", palabras_clave: [], respuesta: `Gracias por escribir a ${n}. Ahora estamos fuera de horario: te respondemos apenas abramos.` },
    { categoria: "apertura", palabras_clave: [], respuesta: "¡Buen día! Ya estamos atendiendo. ¿Seguís buscando propiedad? Contame y te paso opciones." },
  ];
}

/** Solo las categorías que faltan: nunca pisa lo que la empresa ya cargó. */
export function memoriaQueFalta(existentes: { categoria: string }[], nombre: string): FilaMemoria[] {
  const ya = new Set(existentes.map((e) => e.categoria));
  return memoriaInicial(nombre).filter((f) => !ya.has(f.categoria));
}
