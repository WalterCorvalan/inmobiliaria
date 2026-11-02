// Plantillas de WhatsApp para los casos reales (Walter, 19/10/2026): se usan cuando pasaron 24 hs desde el último
// mensaje del cliente. Cada dato entre {{ }} lo completa el vendedor al mandarla; "datos" dice qué va en cada uno y
// "ejemplos" es lo que se le muestra a Meta para aprobarla. Todas como Utilidad: avisan de una consulta en curso.
// "actualizacion_precio" reemplaza a "bajó de precio" (Meta la cobraría como publicidad).
// Las tres de los mensajes automáticos (cumpleaños, cumpleaños con renovación y fin de pago, 20/10/2026) van como Marketing: las manda el sistema
// solo y cada envío se paga (lib/panel/mensajesAutomaticos.ts).

import {
  PLANTILLA_CUMPLEANOS, PLANTILLA_CUMPLEANOS_RENOVACION, PLANTILLA_FIN_DE_PAGO, TEXTO_CUMPLEANOS, TEXTO_CUMPLEANOS_RENOVACION, TEXTO_FIN_DE_PAGO,
} from "@/lib/panel/mensajesAutomaticos";

export type PlantillaSugerida = { nombre: string; titulo: string; cuerpo: string; datos: string[]; ejemplos: string[]; categoria?: "UTILITY" | "MARKETING" };

export const PLANTILLAS_SUGERIDAS: PlantillaSugerida[] = [
  {
    nombre: PLANTILLA_CUMPLEANOS,
    titulo: "Feliz cumpleaños (automático)",
    cuerpo: TEXTO_CUMPLEANOS,
    datos: ["Nombre del cliente"],
    ejemplos: ["Laura"],
    categoria: "MARKETING",
  },
  {
    nombre: PLANTILLA_CUMPLEANOS_RENOVACION,
    titulo: "Cumpleaños con oferta de renovar (automático)",
    cuerpo: TEXTO_CUMPLEANOS_RENOVACION,
    datos: ["Nombre del cliente", "Años desde la compra", "Auto"],
    ejemplos: ["Laura", "3", "Ford Ka"],
    categoria: "MARKETING",
  },
  {
    nombre: PLANTILLA_FIN_DE_PAGO,
    titulo: "Terminó de pagar (automático)",
    cuerpo: TEXTO_FIN_DE_PAGO,
    datos: ["Nombre del cliente", "Auto"],
    ejemplos: ["Martín", "Toyota Hilux"],
    categoria: "MARKETING",
  },
  {
    nombre: "respuesta_financiacion",
    titulo: "Financiación",
    cuerpo: "Hola {{1}}, ya tenemos la respuesta sobre la financiación que consultaste para el {{2}}. Respondé este mensaje y te contamos las opciones que hay.",
    datos: ["Nombre del cliente", "Auto"],
    ejemplos: ["Mateo", "Honda HR-V 2019"],
  },
  {
    nombre: "auto_encontrado",
    titulo: "Encontramos tu auto",
    cuerpo: "Hola {{1}}, encontramos un {{2}} como el que estabas buscando. ¿Querés que te mandemos fotos y precio? Respondé este mensaje.",
    datos: ["Nombre del cliente", "Auto"],
    ejemplos: ["Laura", "Toyota Corolla 2020"],
  },
  {
    nombre: "cotizacion_usado",
    titulo: "Cotización de su usado",
    cuerpo: "Hola {{1}}, ya tenemos la cotización de tu {{2}} para tomarlo como parte de pago. Respondé este mensaje y te pasamos el detalle.",
    datos: ["Nombre del cliente", "Su auto"],
    ejemplos: ["Martín", "Fiat Palio 2016"],
  },
  {
    nombre: "actualizacion_precio",
    titulo: "Cambio de precio",
    cuerpo: "Hola {{1}}, te avisamos que se actualizó el precio del {{2}} por el que consultaste. Respondé este mensaje y te pasamos el valor actualizado.",
    datos: ["Nombre del cliente", "Auto"],
    ejemplos: ["Sofía", "Ford EcoSport 2020"],
  },
  {
    nombre: "confirmar_visita",
    titulo: "Confirmar visita",
    cuerpo: "Hola {{1}}, te escribimos de Pfaffen Cars para confirmar tu visita del {{2}}. ¿Seguís pudiendo venir? Respondé este mensaje.",
    datos: ["Nombre del cliente", "Día y hora"],
    ejemplos: ["Diego", "lunes 20 a las 11"],
  },
  {
    nombre: "dato_faltante",
    titulo: "Falta un dato",
    cuerpo: "Hola {{1}}, para avanzar con {{2}} nos falta un dato. Respondé este mensaje y te contamos qué necesitamos.",
    datos: ["Nombre del cliente", "Qué trámite"],
    ejemplos: ["Carla", "la seña del Onix"],
  },
  {
    nombre: "retomar_consulta",
    titulo: "Retomar la charla",
    cuerpo: "Hola {{1}}, te escribe {{2}} de Pfaffen Cars por tu consulta. ¿Seguimos? Respondé este mensaje y te ayudamos.",
    datos: ["Nombre del cliente", "Tu nombre"],
    ejemplos: ["Juan", "Gabriel"],
  },
];

export const sugeridaPorNombre = (nombre: string) => PLANTILLAS_SUGERIDAS.find((p) => p.nombre === nombre);
