import type { CategoriaNotif, PrioridadAlerta } from "./alertas";

// Nivel de cada alerta elegido por el admin (13/10/2026, como el panel viejo): en Configuración → Empresa → Alertas
// cada categoría queda en "Por defecto", Alta, Media o Baja. Ordena la campanita y el Centro de Alertas. (El reenvío de
// las de nivel Alta por WhatsApp se sacó el 14/10/2026: los avisos llegan al celular como notificación push.)
// Las alertas que crea el código pasan su categoría a crearAlerta(); las que crea la base (mensajes y derivaciones de
// los canales) no la traen, así que se deduce del tipo con categoriaDeTipo().

export type NivelAlerta = "alta" | "media" | "baja";
export type NivelesAlertas = Partial<Record<CategoriaNotif, NivelAlerta>>;

export const CATEGORIAS_NOTIF: { key: CategoriaNotif; icono: string; label: string; desc: string }[] = [
  { key: "leads", icono: "🆕", label: "Leads nuevos, reasignados y sin responder", desc: "Lead nuevo, mensaje o derivación de un canal, lead reasignado o que lleva demasiadas horas sin respuesta, y visitas." },
  { key: "mensajes", icono: "💬", label: "Mensajes nuevos de clientes", desc: "Cada mensaje que entra por WhatsApp, Instagram, Messenger o el chat de la web en una charla tuya." },
  { key: "nps", icono: "📊", label: "Encuestas NPS (nota baja)", desc: "Cuando un cliente responde la encuesta de atención con una nota baja (0-6)." },
  { key: "clientes", icono: "👤", label: "Clientes (nuevos, sin contactar, VIP)", desc: "Alta de clientes, clientes sin contactar a tiempo y VIP sin seguimiento." },
  { key: "reclamos", icono: "📣", label: "Reclamos", desc: "Asignaciones, comentarios, pedidos de atención y reclamos estancados." },
  { key: "pedidos_atencion_expedientes", icono: "📣", label: "Pedidos de atención en expedientes", desc: "Cuando un sector te pide atención en un expediente (y sus respuestas)." },
  { key: "expedientes", icono: "📁", label: "Expedientes (trámites y vencimientos)", desc: "Trámites demorados, por vencer, confirmaciones, transferencias y reventas." },
  { key: "gestoria", icono: "🏛", label: "Gestoría (vencimientos)", desc: "Gestorías vencidas o próximas a vencer." },
  { key: "consignacion", icono: "🤝", label: "Consignación", desc: "Precio/tipo pendiente de cargar y consignaciones por vencer." },
  { key: "stock", icono: "🚚", label: "Stock (preparación, parados, mandatos)", desc: "Autos nuevos, en preparación, sin movimiento, mandatos por vencer y entregas." },
  { key: "cambios_precio", icono: "💰", label: "Cambios de precio en stock", desc: "Cuando cambia el precio de un vehículo del stock." },
  { key: "ventas", icono: "🛒", label: "Ventas y operaciones", desc: "Nuevas ventas, operaciones confirmadas (totales y parciales) y reservas." },
  { key: "cotizaciones", icono: "📄", label: "Cotizaciones", desc: "Cotizaciones nuevas y respuestas de clientes." },
  { key: "pedidos_wishlist", icono: "✨", label: "Autos para un pedido (y pedidos reasignados)", desc: "Cuando entra un auto que matchea un pedido del wishlist, un pedido que se te reasigna, y pedidos sin novedad." },
  { key: "service_sla", icono: "🔧", label: "Service / posventa (SLA)", desc: "Cuando un service supera su SLA de atención." },
  { key: "taller", icono: "🔧", label: "Taller: pedidos y respuestas del cliente", desc: "Un pedido de presupuesto que entró por la web o por el bot, una cotización que pidió un vendedor, y cuando el cliente aprueba o rechaza el presupuesto desde su celular." },
  { key: "gerente_ia", icono: "🩰", label: "Alertas del Gerente IA", desc: "Alertas que detecta el Gerente IA (clientes molestos, oportunidades, riesgos)." },
  { key: "oportunidades_red", icono: "🤝", label: "Oportunidades entre agencias", desc: "Cuando un pedido matchea stock de otra agencia (tablero de oportunidades)." },
  { key: "seguimientos", icono: "⏰", label: "Seguimientos vencidos", desc: "Cuando se te pasa la fecha de un seguimiento que tenías con un lead." },
  { key: "logros", icono: "🏆", label: "Logros y performance (Top Seller)", desc: "Avisos de cercanía a Top Seller / niveles y tu resumen semanal de performance." },
  { key: "comisiones", icono: "💹", label: "Comisiones (cambios manuales)", desc: "Cambios manuales de comisión, comisiones sueltas y marcadas como pagadas." },
  { key: "finanzas", icono: "🏦", label: "Movimientos y eliminaciones de finanzas", desc: "Egresos grandes, cheques y cuotas que vencen y eliminaciones de movimientos." },
  { key: "fraude", icono: "🛡", label: "Alertas de fraude", desc: "Cambios sospechosos detectados en operaciones (bajas de precio grandes, señas reducidas, comisiones fuera de lo normal)." },
];

// Tipo exacto → categoría. Lo que no está acá se resuelve por las reglas de abajo.
const POR_TIPO: Record<string, CategoriaNotif> = {
  visita_nueva: "leads", visita_sin_resultado: "leads", lead_tasacion_nuevo: "leads", lead_asignado: "leads", lead_sin_asignar: "leads",
  handoff_chat: "leads", whatsapp_handoff: "leads", lead_caliente_sin_atender: "leads", ventana_24h: "leads", mensaje_no_enviado: "leads", cliente_sin_contestar: "leads", cliente_sin_contestar_encargado: "leads", test_drive_agendado: "leads",
  lead_convertido: "ventas",
  cumpleanos_cliente: "clientes", renovador_auto_nuevo: "clientes",
  nps_nota_baja: "nps", nps_recordatorio: "nps",
  consignacion_nueva: "consignacion",
  presupuesto_abierto: "cotizaciones",
  cliente: "clientes",
  expediente_mensaje: "pedidos_atencion_expedientes",
  expediente_por_vencer: "expedientes", expediente_demorado: "expedientes", doc_pendiente_expediente: "expedientes",
  consignacion_sin_contacto: "consignacion",
  vehiculo: "stock", mandato_por_vencer: "stock",
  venta: "ventas", venta_recordatorio_vencido: "ventas", vista_seguimiento: "ventas", documento_cliente_subido: "ventas",
  cotizacion: "cotizaciones",
  pedido_match: "pedidos_wishlist", pedido_nuevo: "pedidos_wishlist", pedido_sin_novedades: "pedidos_wishlist",
  service_sin_contactar: "service_sla", postventa_recordatorio_vencido: "service_sla",
  finanzas_vencimiento: "finanzas", cuota_cobrar_vencimiento: "finanzas", cuota_pagar_vencimiento: "finanzas",
  cheque_por_vencer: "finanzas", cheque_vencido: "finanzas", autorizacion_pendiente: "finanzas", ia_saldo: "finanzas",
  mi_resumen_semanal: "logros", objetivo_cumplido: "logros",
  tarea_lead_vencida: "seguimientos",
};

export function categoriaDeTipo(tipo: string | null | undefined): CategoriaNotif | null {
  if (!tipo) return null;
  if (POR_TIPO[tipo]) return POR_TIPO[tipo];
  const t = tipo.toLowerCase();
  // Cada mensaje nuevo de una charla (nuevo_mensaje_chat, rodi_nuevo_mensaje: más de 100 por mes) tiene su categoría:
  // Walter quiere que el vendedor se entere (13/10/2026).
  if (t.includes("nuevo_mensaje") || t.includes("mensaje_entrante")) return "mensajes";
  // El aviso de que otro vendedor respondió es informativo: sin categoría.
  if (t.endsWith("_respondido")) return null;
  // Avisos de los canales que crea la base (derivación a un vendedor, lead nuevo o asignado).
  if (t.startsWith("lead") || /whatsapp|instagram|messenger|rodi|handoff/.test(t)) return "leads";
  if (t.startsWith("reclamo")) return "reclamos";
  if (t.startsWith("taller")) return "taller";
  if (t.startsWith("comision")) return "comisiones";
  if (t.startsWith("fraude")) return "fraude";
  if (t.startsWith("gestoria")) return "gestoria";
  if (t.startsWith("precio")) return "cambios_precio";
  if (t.startsWith("cuota") || t.startsWith("cheque") || t.startsWith("movimiento")) return "finanzas";
  return null;
}

// El nivel con el que se muestra: el elegido para su categoría o, si no hay, el propio.
export function nivelDeAlerta(a: { tipo?: string | null; prioridad?: string | null; categoria?: CategoriaNotif | null }, niveles: NivelesAlertas | null | undefined): PrioridadAlerta {
  const cat = a.categoria ?? categoriaDeTipo(a.tipo);
  const elegido = cat ? niveles?.[cat] : undefined;
  if (elegido) return elegido;
  return (a.prioridad as PrioridadAlerta) || "novedad";
}

// Qué categorías le pueden llegar a cada rol (Walter, 27/10/2026: "comisiones no la debe ver el vendedor"). Mi perfil →
// Notificaciones muestra solo estas; admin y director ven todas. Un rol que no está acá ve todas, para no esconderle
// nada por error.
const CATEGORIAS_POR_ROL: Record<string, CategoriaNotif[]> = {
  ventas: ["leads", "mensajes", "seguimientos", "clientes", "reclamos", "ventas", "cotizaciones", "pedidos_wishlist", "stock", "cambios_precio", "taller", "logros"],
  encargado: [
    "leads", "mensajes", "seguimientos", "clientes", "reclamos", "ventas", "cotizaciones", "pedidos_wishlist", "stock", "cambios_precio", "taller", "logros",
    "nps", "consignacion", "pedidos_atencion_expedientes", "expedientes", "service_sla", "gerente_ia", "oportunidades_red", "comisiones",
  ],
  finanzas: ["finanzas", "comisiones", "ventas", "expedientes", "pedidos_atencion_expedientes", "gestoria"],
  gestoria: ["expedientes", "pedidos_atencion_expedientes", "gestoria", "reclamos", "ventas"],
  taller: ["taller", "stock", "service_sla", "pedidos_atencion_expedientes"],
};

export function categoriasParaRoles(roles: string[] | null | undefined): typeof CATEGORIAS_NOTIF {
  const r = roles ?? [];
  if (r.some((x) => x === "admin" || x === "director") || !r.some((x) => CATEGORIAS_POR_ROL[x])) return CATEGORIAS_NOTIF;
  const permitidas = new Set(r.flatMap((x) => CATEGORIAS_POR_ROL[x] ?? []));
  return CATEGORIAS_NOTIF.filter((cat) => permitidas.has(cat.key));
}

/** Si la persona apagó la categoría de esta alerta en Mi perfil → Notificaciones. */
export function alertaApagada(tipo: string | null | undefined, desactivadas: string[] | null | undefined): boolean {
  const cat = categoriaDeTipo(tipo);
  return !!cat && (desactivadas ?? []).includes(cat);
}
