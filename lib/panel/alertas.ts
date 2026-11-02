import type { SupabaseClient } from "@supabase/supabase-js";
import { puedeVerModulo } from "./permisosModulos";
import { categoriaDeTipo, nivelDeAlerta, type NivelesAlertas } from "./nivelesAlertas";

// Niveles elegidos en Configuración → Empresa → Alertas. Se leen una vez por minuto, no en cada alerta.
let nivelesCache: { valor: NivelesAlertas; hasta: number } | null = null;
async function nivelesElegidos(supabase: SupabaseClient): Promise<NivelesAlertas> {
  if (nivelesCache && nivelesCache.hasta > Date.now()) return nivelesCache.valor;
  const { data } = await supabase.from("configuracion_empresa").select("alertas_niveles").maybeSingle();
  const valor = (data?.alertas_niveles as NivelesAlertas) || {};
  nivelesCache = { valor, hasta: Date.now() + 60_000 };
  return valor;
}

export type PrioridadAlerta = "alta" | "media" | "baja" | "novedad";

// Helper genérico para que los módulos avisen sin reinventar el insert cada
// vez.
//
// "modulo" es opcional (no todos los llamados lo pasan todavía) -- cuando
// se pasa, no se manda la alerta si el destinatario tiene ese módulo
// apagado para su rol (visibilidad_sector), para no avisarle de algo a lo
// que después no puede ni entrar (ej: un vendedor sin acceso a Reclamos
// asignado a un reclamo).
// Categorías tal cual las lista Mi Espacio → Notificaciones (NotificacionesTab.tsx)
// -- ahí el usuario elige qué apagar, pero hasta ahora nada leía esa
// preferencia y apagar una categoría no evitaba ningún aviso.
export type CategoriaNotif =
  | "leads" | "mensajes" | "nps" | "clientes" | "reclamos" | "pedidos_atencion_expedientes" | "expedientes"
  | "gestoria" | "consignacion" | "stock" | "cambios_precio" | "ventas" | "cotizaciones"
  | "pedidos_wishlist" | "service_sla" | "taller" | "gerente_ia" | "oportunidades_red"
  | "logros" | "comisiones" | "finanzas" | "fraude" | "suscripcion" | "seguimientos";

export async function crearAlerta(
  supabase: SupabaseClient,
  destinatarioId: string,
  titulo: string,
  opciones?: { mensaje?: string; link?: string; tipo?: string; prioridad?: PrioridadAlerta; modulo?: string; categoriaNotif?: CategoriaNotif }
) {
  if (opciones?.modulo && !(await puedeVerModulo(supabase, destinatarioId, opciones.modulo))) {
    return;
  }
  // La categoría que se pasa o, si no, la que sale del tipo (27/10/2026: antes solo se miraba la que se pasaba y apagar
  // una categoría no frenaba las alertas que solo traían el tipo).
  const categoria = opciones?.categoriaNotif ?? categoriaDeTipo(opciones?.tipo);
  if (categoria) {
    const { data: prefs } = await supabase.from("espacio_notif_prefs").select("desactivadas").eq("perfil_id", destinatarioId).maybeSingle();
    if (prefs?.desactivadas?.includes(categoria)) return;
  }
  // WhatsApp (y otros previews de link) hacen su propio fetch de la URL
  // pública para generar la vista previa antes de que el cliente la abra de
  // verdad -- eso duplica la visita real. Si ya hay una alerta idéntica
  // (mismo destinatario+tipo+link) en los últimos 30s, no duplicar.
  if (opciones?.tipo && opciones?.link) {
    const haceTreintaSeg = new Date(Date.now() - 30_000).toISOString();
    const { data: reciente } = await supabase
      .from("alertas")
      .select("id")
      .eq("destinatario_id", destinatarioId)
      .eq("tipo", opciones.tipo)
      .eq("link", opciones.link)
      .gte("created_at", haceTreintaSeg)
      .maybeSingle();
    if (reciente) return;
  }
  const { error } = await supabase.from("alertas").insert({
    destinatario_id: destinatarioId,
    titulo,
    mensaje: opciones?.mensaje || null,
    link: opciones?.link || null,
    tipo: opciones?.tipo || "general",
    // El nivel elegido por el admin para la categoría manda sobre el que trae la alerta (lib/panel/nivelesAlertas.ts).
    prioridad: nivelDeAlerta({ tipo: opciones?.tipo, prioridad: opciones?.prioridad || "novedad", categoria: opciones?.categoriaNotif }, await nivelesElegidos(supabase).catch(() => ({}))),
  });
  // Antes se ignoraba el error de insert (ej: RLS bloqueando el destinatario)
  // sin dejar rastro -- la alerta simplemente no aparecía y no había forma
  // de saber por qué.
  if (error) console.error("[crearAlerta] no se pudo insertar", error);
}
