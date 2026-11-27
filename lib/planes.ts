// Planes Básico y Pro (precios aprobados por Walter el 23/11/2026, solo en pesos y abono mensual fijo, nunca comisión por
// operación). Por ahora es informativo: la demo muestra todo (como el Pro) y marca con "Pro" lo que no trae el Básico. Que el
// panel apague de verdad lo del Pro según el plan de cada inmobiliaria queda para la fase 2 (cuando se cobre la suscripción).

export type Plan = "basico" | "pro";

export const PLANES: Record<Plan, { nombre: string; precioMensual: number; para: string; vendedores: number }> = {
  basico: { nombre: "Básico", precioMensual: 59_900, para: "Para arrancar: WhatsApp, propiedades y visitas", vendedores: 2 },
  pro: { nombre: "Pro", precioMensual: 119_900, para: "Todos los canales, la plata y más asesores", vendedores: 6 },
};

export interface Funcion { grupo: string; nombre: string; detalle: string; basico: boolean | string; pro: boolean | string }

export const FUNCIONES: Funcion[] = [
  { grupo: "Canales", nombre: "WhatsApp con bot", detalle: "Responde, ofrece propiedades de tu cartera y agenda visitas", basico: true, pro: true },
  { grupo: "Canales", nombre: "Instagram y Messenger", detalle: "Los mensajes directos, con el mismo bot", basico: false, pro: true },
  { grupo: "Canales", nombre: "Chat de la web", detalle: "Un chat para pegar en tu página", basico: false, pro: true },
  { grupo: "Ventas", nombre: "Leads", detalle: "Todos los interesados en una lista, con temperatura", basico: true, pro: true },
  { grupo: "Ventas", nombre: "Visitas", detalle: "Agenda de la semana y recordatorios", basico: true, pro: true },
  { grupo: "Ventas", nombre: "Reservas y operaciones", detalle: "Cargar cada reserva y cada venta o alquiler cerrado", basico: true, pro: true },
  { grupo: "Ventas", nombre: "Seguimiento y tareas", detalle: "Embudo, tareas por lead y resumen de la IA", basico: false, pro: true },
  { grupo: "Cartera", nombre: "Propiedades", detalle: "Venta y alquiler con fotos, precio y estado", basico: true, pro: true },
  { grupo: "Cartera", nombre: "Finanzas", detalle: "Lo que entra y sale en dólares y pesos, y los honorarios", basico: false, pro: true },
  { grupo: "Equipo", nombre: "Asesores", detalle: "Usuarios del panel", basico: "Hasta 2", pro: "Hasta 6" },
  { grupo: "Equipo", nombre: "Oficinas", detalle: "Más de una oficina", basico: "1", pro: "Varias" },
];

/** Módulos del menú que vienen solo en el Pro (se marcan con la etiqueta "Pro"). */
export const MODULOS_PRO: ReadonlySet<string> = new Set(["instagram", "messenger", "rodi", "finanzas"]);

export function moduloEnPlan(modulo: string | undefined, plan: Plan): boolean {
  return plan === "pro" || !modulo || !MODULOS_PRO.has(modulo);
}

/** "$ 59.900" */
export function precioTexto(n: number): string {
  return `$ ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n)}`;
}
