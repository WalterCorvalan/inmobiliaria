import {
  User, Car, FileText, BarChart3, CreditCard, Bell, DollarSign, FolderKanban,
  MessageSquareWarning, BellRing, SearchCode, Repeat, AlarmClock, MessageCircle,
  PhoneCall, Gift, AlertTriangle, Bot, Briefcase, KeyRound, CalendarCheck,
  Calculator, Eye, CheckCircle2, ShieldAlert, Trophy,
} from "lucide-react";
import { iconoModuloDeAlerta } from "@/lib/panel/iconoAlerta";

// Mapeo único de tipo de alerta -> ícono/color/link, compartido por
// NotificationBell y el Centro de Alertas. Antes cada uno tenía su propia
// copia con solo 5 tipos mapeados (cliente/vehiculo/cotizacion/resumen/
// suscripcion) — los otros 14 tipos que fue sumando cada módulo (ventas,
// expedientes, reclamos, pedidos, comisiones, chat) caían todos en el mismo
// ícono de campana gris genérico. Sumarlos acá, en un solo lugar, evita que
// un tipo nuevo quede sin mapear en un componente y sí en el otro.
export const TIPO_ICON: Record<string, any> = {
  cliente: User,
  vehiculo: Car,
  cotizacion: FileText,
  resumen: BarChart3,
  suscripcion: CreditCard,
  venta: DollarSign,
  expediente_nuevo: FolderKanban,
  expediente_pedido_atencion: BellRing,
  reclamo_asignado: MessageSquareWarning,
  reclamo_pedido_atencion: BellRing,
  pedido_match: SearchCode,
  pedido_busqueda_match: SearchCode,
  pedido_reasignado: Repeat,
  pedido_reconfirmar: AlarmClock,
  nuevo_mensaje_chat: MessageCircle,
  handoff_chat: PhoneCall,
  comision_pedido_cambio: DollarSign,
  comision_bono_pedido: Gift,
  operacion_caida_devolver_sena: AlertTriangle,
  rodi_nuevo_mensaje: Bot,
  rodi_handoff: Bot,
  postulacion: Briefcase,
  consignacion_nueva: KeyRound,
  visita_nueva: CalendarCheck,
  lead_tasacion_nuevo: Calculator,
  vista_seguimiento: Eye,
  precio_a_confirmar: DollarSign,
  precio_confirmado_respuesta: CheckCircle2,
  precio_actualizado: Car,
  movimiento_pendiente: DollarSign,
  sobrante_registro: DollarSign,
  nuevo_lead: User,
  mi_resumen_diario: BarChart3,
  resumen_diario: BarChart3,
  mi_resumen_semanal: BarChart3,
  objetivo_cumplido: Trophy,
  lead_auto_parecido: Car,
  resumen_diario_empresa: BarChart3,
  informe_marketing: BarChart3,
  cheque_por_vencer: AlarmClock,
  finanzas_vencimiento: AlarmClock,
  documento_cliente_subido: FileText,
  autorizacion_pendiente: ShieldAlert,
  nuevo_mensaje_interno: MessageCircle,
};

export const TIPO_COLOR: Record<string, string> = {
  cliente: "bg-purple-100 text-purple-600 dark:bg-purple-500/15 dark:text-purple-300",
  vehiculo: "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300",
  cotizacion: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  resumen: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",
  suscripcion: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
  venta: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  expediente_nuevo: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
  expediente_pedido_atencion: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
  reclamo_asignado: "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300",
  reclamo_pedido_atencion: "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300",
  pedido_match: "bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300",
  pedido_busqueda_match: "bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300",
  pedido_reasignado: "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400",
  pedido_reconfirmar: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  nuevo_mensaje_chat: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  handoff_chat: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
  comision_pedido_cambio: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  comision_bono_pedido: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  operacion_caida_devolver_sena: "bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300",
  rodi_nuevo_mensaje: "bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-300",
  rodi_handoff: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
  postulacion: "bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300",
  consignacion_nueva: "bg-purple-100 text-purple-600 dark:bg-purple-500/15 dark:text-purple-300",
  visita_nueva: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",
  lead_tasacion_nuevo: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  vista_seguimiento: "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
  precio_a_confirmar: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  precio_confirmado_respuesta: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  precio_actualizado: "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300",
  movimiento_pendiente: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  sobrante_registro: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  nuevo_lead: "bg-purple-100 text-purple-600 dark:bg-purple-500/15 dark:text-purple-300",
  mi_resumen_diario: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",
  resumen_diario: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",
  mi_resumen_semanal: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",
  objetivo_cumplido: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  lead_auto_parecido: "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
  resumen_diario_empresa: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",
  informe_marketing: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",
  cheque_por_vencer: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
  finanzas_vencimiento: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
  documento_cliente_subido: "bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300",
  autorizacion_pendiente: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
  nuevo_mensaje_interno: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
};

export const TIPO_VER: Record<string, string> = {
  cliente: "Ver Clientes",
  vehiculo: "Ver Stock",
  cotizacion: "Ver Cotizaciones",
  resumen: "Ver resumen",
  suscripcion: "Ir a Configuración",
  venta: "Ver Ventas",
  expediente_nuevo: "Ver Expedientes",
  expediente_pedido_atencion: "Ver Expedientes",
  reclamo_asignado: "Ver Reclamos",
  reclamo_pedido_atencion: "Ver Reclamos",
  pedido_match: "Ver Pedidos",
  pedido_busqueda_match: "Ver Pedidos",
  pedido_reasignado: "Ver Pedidos",
  pedido_reconfirmar: "Ver Pedidos",
  nuevo_mensaje_chat: "Ver Conversaciones",
  handoff_chat: "Ver Conversaciones",
  comision_pedido_cambio: "Ver Comisiones",
  comision_bono_pedido: "Ver Comisiones",
  operacion_caida_devolver_sena: "Ver Ventas",
  rodi_nuevo_mensaje: "Ver Rodi",
  rodi_handoff: "Ver Rodi",
  postulacion: "Ver Postulaciones",
  consignacion_nueva: "Ver Consignaciones",
  visita_nueva: "Ver Visitas",
  lead_tasacion_nuevo: "Ver Cotizaciones",
  vista_seguimiento: "Ver operación",
  precio_a_confirmar: "Revisar precio",
  precio_confirmado_respuesta: "Ver Ventas",
  precio_actualizado: "Ver Stock",
  movimiento_pendiente: "Ver Finanzas",
  sobrante_registro: "Ver Finanzas",
  nuevo_lead: "Ver Clientes",
  mi_resumen_diario: "Ver resumen",
  resumen_diario: "Ver mi resumen",
  mi_resumen_semanal: "Ver resumen",
  objetivo_cumplido: "Ver Comisiones",
  lead_auto_parecido: "Ver interesados",
  resumen_diario_empresa: "Ver resumen",
  informe_marketing: "Ver informe",
  cheque_por_vencer: "Ver Finanzas",
  finanzas_vencimiento: "Ver Finanzas",
  documento_cliente_subido: "Ver operación",
  autorizacion_pendiente: "Ver Autorizaciones",
  nuevo_mensaje_interno: "Ver Mensajes",
};

/** Texto del botón de una alerta: las que llevan a "Mi día" lo dicen (26/10/2026); el resto, según su tipo. */
export function textoVerAlerta(tipo: string | null | undefined, link: string | null | undefined, defecto: string): string {
  if (link?.startsWith("/panel/mi-dia")) return "Ver en Mi día";
  return (tipo && TIPO_VER[tipo]) || defecto;
}

export const ICONO_DEFECTO = Bell;
export const COLOR_DEFECTO = "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300";

// Alertas de "resumen" (cron jobs de mi-resumen/mi-resumen-semanal/
// resumen-empresa) traen todo lo importante en su propio `mensaje`
// (multi-línea) -- "Ver más" en estas no debe navegar de una, sino abrir un
// modal con el resumen completo (el `link` queda como acceso opcional
// dentro del modal, no como acción del click).
// "resumen_diario" (pedido 1/10): el cron unificado (app/api/cron/panel/
// mi-resumen/route.ts) manda ESE tipo, pero este set seguía con los 3
// nombres viejos de antes de la unificación ("mi_resumen_diario",
// "resumen_diario_empresa" -- ver el comentario de ese route.ts) -- como
// nunca coincidía, la alerta no abría el modal y en cambio navegaba directo
// al link, con ícono/color genéricos (TIPO_ICON/TIPO_COLOR tampoco lo
// tenían mapeado). Bug real, no solo de diseño.
export const TIPOS_RESUMEN = new Set(["mi_resumen_diario", "resumen_diario", "mi_resumen_semanal", "resumen_diario_empresa", "informe_marketing"]);

// Ícono de la alerta: el del módulo de donde viene, como en el menú (lib/panel/iconoAlerta.ts). Si el link no apunta
// a un módulo con ícono, el de su tipo (TIPO_ICON) o la campana.
const COLOR_CON_ICONO_MODULO = "bg-white dark:bg-white/10";

export function colorIconoAlerta(tipo: string | null | undefined, link: string | null | undefined): string {
  return iconoModuloDeAlerta(link) ? COLOR_CON_ICONO_MODULO : TIPO_COLOR[tipo || ""] || COLOR_DEFECTO;
}

export function IconoAlerta({ tipo, link }: { tipo: string | null | undefined; link: string | null | undefined }) {
  const modulo = iconoModuloDeAlerta(link);
  // eslint-disable-next-line @next/next/no-img-element
  if (modulo) return <img src={modulo} alt="" className="w-5 h-5 object-contain" />;
  const Icon = TIPO_ICON[tipo || ""] || ICONO_DEFECTO;
  return <Icon className="w-4 h-4" />;
}
