import Link from "next/link";
import IconoPanel from "@/components/panel/IconoPanel";
import FotoPropiedad from "@/components/inmo/FotoPropiedad";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  agendaProxima, cuentaPorDia, embudoVentas, haceCuanto, tareaVencida, hoyArgentina, resumenInicio, sumarDiasISO,
  type CanalLead, type LeadInicio, type PropiedadInicio, type TareaInicio, type VisitaInicio,
} from "@/lib/panel/inicio";
import { especificaciones, formatearPrecio, ubicacion, OPERACION_LABEL, type Propiedad } from "@/lib/propiedades/propiedades";
import SeguimientoLeads, { type LeadSeguimiento } from "./SeguimientoLeads";

// Inicio del panel. Rediseño 26/11/2026 con las capturas de referencia de Walter (tableros de CRM corporativos): números
// con su dibujo en color, la agenda de la semana con la foto de la propiedad, el seguimiento de leads con botones, las
// propiedades destacadas con fotos grandes, el embudo, las tareas y la actividad del mes. Nada de íconos de línea simples.
export const metadata = { title: "Inicio | Inmobiliaria CRM" };

const CANAL: Record<CanalLead, { nombre: string; icono: string }> = {
  whatsapp: { nombre: "WhatsApp", icono: "/icons/panel/whatsapp.png" },
  instagram: { nombre: "Instagram", icono: "/icons/panel/instagram.png" },
  messenger: { nombre: "Messenger", icono: "/icons/panel/messenger.png" },
  rodi: { nombre: "Chat de la web", icono: "/icons/panel/contenido-sitio.png" },
  manual: { nombre: "Oficina", icono: "/icons/panel/leads.png" },
};

const ETAPA_TEXTO: Record<string, string> = { sin_contactar: "Sin contactar", contactado: "Contactados", visita: "Visitas", negociacion: "Negociación", cerrado: "Cerrados" };
const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function saludo(): string {
  const h = new Date(Date.now() - 3 * 3600000).getUTCHours();
  return h < 12 ? "Buen día" : h < 20 ? "Buenas tardes" : "Buenas noches";
}

type ConvBase = Omit<LeadInicio, "canal" | "nombre">;
type ConvWA = ConvBase & { whatsapp_contactos: { nombre_perfil: string | null; telefono: string | null } | null };
type ConvIG = ConvBase & { instagram_contactos: { username: string | null; nombre_perfil: string | null } | null };
type ConvMS = Omit<ConvBase, "es_basura"> & { messenger_contactos: { nombre_perfil: string | null } | null };
type ConvWeb = ConvBase & { nombre_contacto: string | null; telefono_contacto?: string | null };
type LeadManual = Pick<LeadInicio, "id" | "calificacion" | "estado_lead" | "created_at" | "es_basura"> & { nombre: string | null; telefono?: string | null };
type VisitaConAuto = VisitaInicio & { propiedad_id: string | null; vendedor_id: string | null };
type AutoInicio = PropiedadInicio & Pick<Propiedad, "id" | "codigo" | "titulo" | "tipo" | "operacion" | "precio" | "moneda" | "barrio" | "ciudad" | "direccion" | "ambientes" | "banos" | "cocheras" | "superficie_total" | "superficie_cubierta" | "propiedad_fotos" | "created_at">;
type LeadConTel = LeadInicio & { telefono: string | null };

// Cada fuente por separado: si una tabla falla, el resto de la pantalla sale igual.
async function filas<T>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>, etiqueta: string): Promise<T[]> {
  const { data, error } = await p;
  if (error) console.error(`[inicio] ${etiqueta}:`, error.message);
  return (data as T[] | null) ?? [];
}

export default async function InicioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const hoy = hoyArgentina();
  const conv = "id, calificacion, estado_lead, unread_count, last_message_at, created_at, es_basura";
  // Solo WhatsApp, Instagram y Messenger guardan la etapa del embudo.
  const convEtapa = `${conv}, estado_pipeline`;
  const lunes = sumarDiasISO(hoy, -((new Date(`${hoy}T12:00:00Z`).getUTCDay() + 6) % 7));

  const [perfil, wa, ig, ms, web, manuales, visitas, vehiculos, tareas, equipo] = await Promise.all([
    user ? supabase.from("perfiles").select("nombre").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    filas<ConvWA>(supabase.from("whatsapp_conversaciones").select(`${convEtapa}, whatsapp_contactos ( nombre_perfil, telefono )`).order("last_message_at", { ascending: false }).limit(500), "whatsapp"),
    filas<ConvIG>(supabase.from("instagram_conversaciones").select(`${convEtapa}, instagram_contactos ( username, nombre_perfil )`).order("last_message_at", { ascending: false }).limit(500), "instagram"),
    filas<ConvMS>(supabase.from("messenger_conversaciones").select(`id, calificacion, estado_lead, unread_count, last_message_at, created_at, estado_pipeline, messenger_contactos ( nombre_perfil )`).order("last_message_at", { ascending: false }).limit(500), "messenger"),
    filas<ConvWeb>(supabase.from("rodi_conversaciones").select(`${conv}, nombre_contacto, telefono_contacto`).order("last_message_at", { ascending: false }).limit(500), "web"),
    filas<LeadManual>(supabase.from("leads_manuales").select("id, calificacion, estado_lead, created_at, es_basura, nombre, telefono").order("created_at", { ascending: false }).limit(500), "manuales"),
    filas<VisitaConAuto>(supabase.from("visitas").select("id, nombre_cliente, fecha_visita, horario_visita, estado, tipo, propiedad_codigo, propiedad_id, vendedor_id").gte("fecha_visita", lunes).order("fecha_visita").limit(300), "visitas"),
    filas<AutoInicio>(supabase.from("propiedades").select("id, codigo, titulo, tipo, operacion, estado, precio, moneda, barrio, ciudad, direccion, ambientes, banos, cocheras, superficie_total, superficie_cubierta, created_at, propiedad_fotos ( id, url, orden, es_portada )").order("created_at", { ascending: false }).limit(2000), "propiedades"),
    filas<TareaInicio>(supabase.from("tareas_lead").select("id, titulo, tipo, fecha_vencimiento, completada").eq("completada", false).order("fecha_vencimiento").limit(200), "tareas"),
    filas<{ id: string; nombre: string | null }>(supabase.from("perfiles").select("id, nombre").limit(200), "equipo"),
  ]);

  const leads: LeadConTel[] = [
    ...wa.map((c) => ({ ...c, canal: "whatsapp" as const, telefono: c.whatsapp_contactos?.telefono || null, nombre: c.whatsapp_contactos?.nombre_perfil || c.whatsapp_contactos?.telefono || "Sin nombre" })),
    ...ig.map((c) => ({ ...c, canal: "instagram" as const, telefono: null, nombre: c.instagram_contactos?.username ? `@${c.instagram_contactos.username}` : c.instagram_contactos?.nombre_perfil || "Sin nombre" })),
    ...ms.map((c) => ({ ...c, es_basura: false, canal: "messenger" as const, telefono: null, nombre: c.messenger_contactos?.nombre_perfil || "Contacto de Messenger" })),
    ...web.map((c) => ({ ...c, canal: "rodi" as const, telefono: c.telefono_contacto || null, nombre: c.nombre_contacto || "Visitante de la web" })),
    ...manuales.map((c) => ({ ...c, canal: "manual" as const, unread_count: 0, last_message_at: c.created_at, telefono: c.telefono || null, nombre: c.nombre || "Sin nombre" })),
  ];

  const r = resumenInicio({ leads, visitas: visitas.filter((v) => v.fecha_visita >= hoy), propiedades: vehiculos, tareas });
  const agenda = agendaProxima(visitas, hoy, 6).slice(0, 5) as VisitaConAuto[];
  const tareasLista = tareas.slice(0, 5);
  const primerNombre = ((perfil as { data: { nombre?: string } | null }).data?.nombre || "").split(" ")[0];
  const fechaCorta = new Date(`${hoy}T12:00:00Z`).toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const embudo = embudoVentas(leads);
  const nombreDe = (id: string | null) => equipo.find((p) => p.id === id)?.nombre || "Sin asesor";
  const autoDe = (id: string | null) => vehiculos.find((v) => v.id === id) ?? null;
  const precioTexto = (p: AutoInicio) => { const f = formatearPrecio(p); return `${f.monto}${f.sufijo ? ` ${f.sufijo}` : ""}`; };

  // Mini gráficos de las tarjetas de números: últimos 7 días.
  const leadsPorDia = cuentaPorDia(leads.filter((l) => !l.es_basura).map((l) => l.created_at), hoy);
  const sinLeerPorDia = cuentaPorDia(leads.filter((l) => (l.unread_count ?? 0) > 0).map((l) => l.last_message_at || l.created_at), hoy);

  // Semana de lunes a domingo, con la cantidad de citas de cada día.
  const semana = Array.from({ length: 7 }, (_, i) => {
    const fecha = sumarDiasISO(lunes, i);
    const d = new Date(`${fecha}T12:00:00Z`);
    return { fecha, dia: DIAS_CORTOS[d.getUTCDay()], numero: d.getUTCDate(), citas: visitas.filter((v) => v.fecha_visita === fecha && v.estado !== "Cancelada").length };
  });
  const finSemana = semana[6];
  const rangoSemana = `${semana[0].numero} al ${finSemana.numero} de ${new Date(`${finSemana.fecha}T12:00:00Z`).toLocaleDateString("es-AR", { month: "long", timeZone: "UTC" })}`;

  // Seguimiento: los activos, primero los que esperan respuesta y los calientes.
  const PESO: Record<string, number> = { caliente: 3, tibio: 2, frio: 1 };
  const seguimiento: LeadSeguimiento[] = leads
    .filter((l) => !l.es_basura && !["convertido", "perdido"].includes(l.estado_lead || ""))
    .sort((a, b) => ((b.unread_count ?? 0) > 0 ? 1 : 0) - ((a.unread_count ?? 0) > 0 ? 1 : 0) || (PESO[b.calificacion || ""] ?? 0) - (PESO[a.calificacion || ""] ?? 0) || (b.last_message_at || b.created_at).localeCompare(a.last_message_at || a.created_at))
    .slice(0, 30)
    .map((l) => ({ id: l.id, canal: l.canal, nombre: l.nombre, calificacion: l.calificacion, estado: l.estado_lead || "nuevo", telefono: l.telefono, sinLeer: l.unread_count ?? 0, detalle: `${CANAL[l.canal].nombre} · ${haceCuanto(l.last_message_at || l.created_at)}` }));

  // Propiedades destacadas: primero las que tienen fotos, después las más nuevas.
  const destacados = vehiculos
    .filter((v) => v.estado === "disponible")
    .sort((a, b) => (b.propiedad_fotos?.length ? 1 : 0) - (a.propiedad_fotos?.length ? 1 : 0))
    .slice(0, 3);

  // Actividad: leads de los últimos 30 días y las citas de los próximos 7, día por día.
  const leadsMes = cuentaPorDia(leads.filter((l) => !l.es_basura).map((l) => l.created_at), hoy, 30).reduce((a, b) => a + b, 0);
  const citasProximas = cuentaPorDia(visitas.filter((v) => v.estado !== "Cancelada").map((v) => v.fecha_visita), hoy, 7, false);
  const maxCitas = Math.max(1, ...citasProximas);
  const vendidos = vehiculos.filter((v) => v.estado === "vendida" || v.estado === "alquilada").length;

  return (
    <div className="mx-auto w-full max-w-[1360px] px-4 py-5 md:px-8 md:py-7 space-y-5">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-[22px] md:text-[26px] font-semibold tracking-tight text-slate-900 dark:text-white">{saludo()}{primerNombre ? `, ${primerNombre}` : ""}</h2>
          <p className="mt-1 text-[14px] text-slate-500 dark:text-slate-400">Tu inmobiliaria hoy: leads, visitas, propiedades y operaciones en un solo lugar.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden md:inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-[#E2E5EA] bg-white text-[13px] font-medium text-slate-700 dark:bg-white/5 dark:border-white/10 dark:text-slate-200 first-letter:uppercase">
            <IconoPanel src="/icons/panel/calendario.png" alt="" className="w-4 h-4" />{fechaCorta}
          </span>
          <Accion href="/panel/propiedades">Cargar propiedad</Accion>
          <Accion href="/panel/visitas?nuevo=1">Agendar</Accion>
          <Accion href="/panel/leads" primaria>+ Nuevo lead</Accion>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumen">
        <Numero href="/panel/leads" icono="/icons/panel/leads.png" fondo="bg-indigo-50 dark:bg-indigo-500/15" titulo="Leads activos" valor={r.leadsActivos} extra={<MiniBarras valores={leadsPorDia} titulo="Leads nuevos por día, últimos 7 días" />} detalle={r.leadsNuevosHoy > 0 ? `${r.leadsNuevosHoy} ${r.leadsNuevosHoy === 1 ? "nuevo" : "nuevos"} hoy` : "en seguimiento"} />
        <Numero href="/panel/leads" icono="/icons/panel/mensajes.png" fondo="bg-rose-50 dark:bg-rose-500/15" titulo="Esperan respuesta" valor={r.sinLeer} extra={<MiniBarras valores={sinLeerPorDia} tono="#E11D48" titulo="Charlas sin leer por día" />} detalle={`${r.calientes} ${r.calientes === 1 ? "caliente" : "calientes"}`} />
        <Numero href="/panel/visitas" icono="/icons/panel/calendario.png" fondo="bg-amber-50 dark:bg-amber-500/15" titulo="Visitas esta semana" valor={r.visitasSemana} detalle={`${r.visitasHoy} hoy`} />
        <Numero href="/panel/propiedades" icono="/icons/panel/consignaciones.png" fondo="bg-emerald-50 dark:bg-emerald-500/15" titulo="Propiedades disponibles" valor={r.disponibles} extra={<Proporcion partes={[[r.disponibles, "#059669", "Disponibles"], [r.reservadas, "#F59E0B", "Reservadas"]]} />} detalle={`${r.reservadas} ${r.reservadas === 1 ? "reservada" : "reservadas"} · ${r.enVenta} venta · ${r.enAlquiler} alquiler`} />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Tarjeta className="xl:col-span-2" titulo="Agenda de la semana" icono="/icons/panel/calendario.png" href="/panel/visitas" verTodo="Ver agenda" extra={<span className="hidden sm:inline text-[12px] text-slate-500 dark:text-slate-400">{rangoSemana}</span>}>
          <div className="grid grid-cols-7 gap-1.5 px-4 md:px-5 pt-4">
            {semana.map((d) => {
              const esHoy = d.fecha === hoy;
              return (
                <div key={d.fecha} className={`rounded-lg py-2 text-center ${esHoy ? "menu-activo text-white shadow-sm" : "bg-slate-50 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300"}`}>
                  <p className={`text-[11px] font-medium ${esHoy ? "text-white/80" : "text-slate-400"}`}>{d.dia}</p>
                  <p className="text-[16px] font-semibold leading-tight tabular-nums">{d.numero}</p>
                  <p className="mt-0.5 h-1.5 flex justify-center gap-0.5" aria-label={`${d.citas} citas`}>
                    {Array.from({ length: Math.min(d.citas, 3) }, (_, i) => <span key={i} className={`w-1.5 h-1.5 rounded-full ${esHoy ? "bg-white" : "menu-activo"}`} />)}
                  </p>
                </div>
              );
            })}
          </div>
          {agenda.length === 0 ? (
            <Vacio texto="No hay visitas en los próximos días." />
          ) : (
            <ul className="p-3 md:p-4 space-y-2">
              {agenda.map((v) => {
                const auto = autoDe(v.propiedad_id);
                const esHoy = v.fecha_visita === hoy;
                return (
                  <li key={v.id} className={`flex items-center gap-3 rounded-lg border p-2.5 ${esHoy ? "border-indigo-200 bg-indigo-50/50 dark:border-indigo-500/30 dark:bg-indigo-500/10" : "border-slate-100 dark:border-white/[0.06]"}`}>
                    <div className="w-[52px] md:w-[64px] shrink-0 text-center">
                      <p className="text-[14px] font-semibold tabular-nums text-slate-900 dark:text-white">{(v.horario_visita || "").slice(0, 5) || "—"}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{esHoy ? "Hoy" : DIAS_CORTOS[new Date(`${v.fecha_visita}T12:00:00Z`).getUTCDay()]}</p>
                    </div>
                    <div className="w-[64px] md:w-[76px] shrink-0 rounded-md overflow-hidden">
                      {auto ? <FotoPropiedad propiedad={auto} sinCartel /> : <div className="aspect-[4/3] bg-slate-100 dark:bg-white/5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold text-slate-900 dark:text-white">{auto ? auto.titulo : v.propiedad_codigo ? `Propiedad ${v.propiedad_codigo}` : "Visita"}</p>
                      <p className="truncate text-[12px] text-slate-500 dark:text-slate-400">{auto ? ubicacion(auto) || "Visita" : "Visita"} · {v.nombre_cliente || "Sin nombre"}</p>
                    </div>
                    <p className="hidden md:block w-[130px] shrink-0 truncate text-[12px] text-slate-500 dark:text-slate-400">{nombreDe(v.vendedor_id)}</p>
                    <Estado texto={v.estado} />
                  </li>
                );
              })}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta titulo="Seguimiento de leads" icono="/icons/panel/leads.png" href="/panel/leads" verTodo="Ver todos">
          <SeguimientoLeads leads={seguimiento} rutaAgendar="/panel/visitas?nuevo=1" />
        </Tarjeta>
      </section>

      <Tarjeta titulo="Propiedades destacadas" icono="/icons/panel/consignaciones.png" href="/panel/propiedades" verTodo="Ver propiedades">
        {destacados.length === 0 ? (
          <Vacio texto="Cargá propiedades para verlas acá." />
        ) : (
          <div className="grid grid-cols-1 gap-3 p-3 md:p-4 sm:grid-cols-2 lg:grid-cols-3">
            {destacados.map((v) => (
              <Link key={v.id} href="/panel/propiedades" className="group overflow-hidden rounded-lg border border-slate-100 dark:border-white/[0.06] hover:shadow-md transition-shadow">
                <div className="relative [&_.im-photo]:rounded-none [&_.im-photo]:aspect-[16/10]">
                  <FotoPropiedad propiedad={v} sinCartel />
                  <span className="absolute top-2.5 left-2.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">Disponible</span>
                  <span className="absolute top-2.5 right-2.5 rounded-full bg-slate-900/80 px-2.5 py-0.5 text-[11px] font-semibold text-white">{OPERACION_LABEL[v.operacion]}</span>
                </div>
                <div className="p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[14.5px] font-semibold text-slate-900 dark:text-white leading-snug line-clamp-2">{v.titulo}</p>
                    <p className="shrink-0 text-[15px] font-semibold tabular-nums text-slate-900 dark:text-white">{precioTexto(v)}</p>
                  </div>
                  <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-slate-500 dark:text-slate-400">
                    <span>{ubicacion(v)}</span>{especificaciones(v).slice(0, 2).map((e) => <span key={e}>{e}</span>)}<span className="font-mono text-slate-400">{v.codigo}</span>
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Tarjeta>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Tarjeta titulo="Embudo de ventas" icono="/icons/panel/oportunidades.png" extra={embudo.total > 0 ? <span className="text-[12px] text-slate-500 dark:text-slate-400">Cierre <b className="font-semibold text-slate-900 dark:text-white tabular-nums">{embudo.tasaCierre}%</b></span> : null}>
          {embudo.total === 0 ? (
            <Vacio texto="Todavía no hay leads con etapa cargada." />
          ) : (
            <ul className="px-4 py-4 md:px-5 space-y-2.5">
              {embudo.etapas.map((e, i) => {
                const pct = Math.round((e.llegaron / (embudo.etapas[0].llegaron || 1)) * 100);
                return (
                  <li key={e.etapa}>
                    <div className="flex justify-between text-[12.5px]"><span className="font-medium text-slate-600 dark:text-slate-300">{ETAPA_TEXTO[e.etapa]}</span><span className="tabular-nums text-slate-500">{e.llegaron} · {pct}%</span></div>
                    <div className="mt-1 h-2 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.max(pct, 4)}%`, background: `color-mix(in srgb, var(--marca) ${100 - i * 15}%, white)` }} /></div>
                  </li>
                );
              })}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta titulo="Mis tareas" icono="/icons/panel/tareas-leads.png" href="/panel/leads?modo=tareas" verTodo="Ver tareas" extra={<span className="text-[12px] text-slate-500 dark:text-slate-400">{tareas.length} pendientes</span>}>
          {tareasLista.length === 0 ? (
            <Vacio texto="Sin tareas pendientes." />
          ) : (
            <ul className="px-4 py-3 md:px-5 space-y-1">
              {tareasLista.map((t) => {
                const vencida = tareaVencida(t);
                return (
                  <li key={t.id}>
                    <Link href="/panel/leads?modo=tareas" className="flex items-start gap-3 rounded-md px-1 py-2 hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                      <span className="mt-0.5 w-4 h-4 shrink-0 rounded border-[1.5px] border-slate-300 dark:border-slate-600" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium text-slate-800 dark:text-slate-100">{t.titulo}</span>
                        <span className={`block text-[11.5px] ${vencida ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-slate-500 dark:text-slate-400"}`}>
                          {t.tipo ? `${t.tipo} · ` : ""}{vencida ? "Vencida" : t.fecha_vencimiento ? new Date(t.fecha_vencimiento).toLocaleString("es-AR", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" }) : "Sin fecha"}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta titulo="Actividad del mes" icono="/icons/panel/reportes.png">
          <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-white/[0.06] border-b border-slate-100 dark:border-white/[0.06]">
            {[["Leads", leadsMes], ["Visitas", r.visitasSemana], ["Cerradas", vendidos]].map(([t, n]) => (
              <div key={t} className="px-3 py-3 text-center">
                <p className="text-[20px] font-semibold tabular-nums text-slate-900 dark:text-white">{n}</p>
                <p className="text-[11.5px] text-slate-500 dark:text-slate-400">{t}</p>
              </div>
            ))}
          </div>
          <div className="px-4 md:px-5 pt-4 pb-3">
            <p className="text-[11.5px] font-medium text-slate-500 dark:text-slate-400">Citas de los próximos 7 días</p>
            <div className="mt-2 flex items-end gap-1.5 h-[92px]">
              {citasProximas.map((n, i) => (
                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                  <span className="text-[11px] font-semibold tabular-nums text-slate-600 dark:text-slate-300">{n}</span>
                  <span className="w-full max-w-[30px] rounded-t-md" style={{ height: `${Math.max(4, (n / maxCitas) * 60)}px`, background: "var(--marca)", opacity: i === 0 ? 1 : n > 0 ? 0.45 : 0.15 }} />
                  <span className="text-[10.5px] text-slate-400">{i === 0 ? "Hoy" : DIAS_CORTOS[new Date(`${sumarDiasISO(hoy, i)}T12:00:00Z`).getUTCDay()]}</span>
                </div>
              ))}
            </div>
          </div>
        </Tarjeta>
      </section>
    </div>
  );
}

function Accion({ href, children, primaria = false }: { href: string; children: ReactNode; primaria?: boolean }) {
  return (
    <Link href={href} className={`inline-flex items-center justify-center rounded-lg px-3.5 h-9 text-[13px] font-semibold transition-colors ${primaria ? "menu-activo text-white shadow-sm hover:opacity-90" : "bg-white text-slate-700 border border-[#E2E5EA] hover:bg-slate-50 dark:bg-white/5 dark:text-slate-200 dark:border-white/10 dark:hover:bg-white/10"}`}>
      {children}
    </Link>
  );
}

function Numero({ href, icono, fondo, titulo, valor, detalle, extra }: { href: string; icono: string; fondo: string; titulo: string; valor: number; detalle: string; extra?: ReactNode }) {
  return (
    <Link href={href} className="group rounded-xl bg-white p-4 md:p-5 border border-[#E7E9EE] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors hover:border-slate-300 dark:bg-[#131316] dark:border-white/[0.08] dark:hover:border-white/20">
      <div className="flex items-start gap-3">
        <span className={`flex w-10 h-10 shrink-0 items-center justify-center rounded-lg ${fondo}`}><IconoPanel src={icono} alt="" className="w-[22px] h-[22px]" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[26px] font-semibold leading-none tracking-tight tabular-nums text-slate-900 dark:text-white">{valor}</p>
          <p className="mt-1.5 text-[12.5px] font-medium text-slate-500 dark:text-slate-400 truncate">{titulo}</p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-end justify-between gap-2 min-h-[32px]">
        <p className="truncate text-[12px] text-slate-500 dark:text-slate-400">{detalle}</p>
        <span className="hidden sm:block">{extra}</span>
      </div>
    </Link>
  );
}

/** Siete barritas: el día de hoy resaltado. */
function MiniBarras({ valores, titulo, tono = "var(--marca)" }: { valores: number[]; titulo: string; tono?: string }) {
  const max = Math.max(1, ...valores);
  return (
    <span className="flex items-end gap-[3px] h-6 shrink-0" role="img" aria-label={`${titulo}: ${valores.join(", ")}`} title={titulo}>
      {valores.map((v, i) => <span key={i} className="w-[6px] rounded-[2px]" style={{ height: `${Math.max(3, (v / max) * 24)}px`, background: tono, opacity: i === valores.length - 1 ? 1 : v > 0 ? 0.35 : 0.15 }} />)}
    </span>
  );
}

/** Barra partida con la leyenda abajo. */
function Proporcion({ partes }: { partes: [number, string, string][] }) {
  const total = partes.reduce((a, [n]) => a + n, 0) || 1;
  return (
    <span className="block w-[84px] shrink-0">
      <span className="flex h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-white/10">
        {partes.map(([n, color, nombre]) => <span key={nombre} style={{ width: `${(n / total) * 100}%`, background: color }} />)}
      </span>
      <span className="mt-1.5 flex justify-between text-[10.5px] text-slate-500 dark:text-slate-400 tabular-nums">
        {partes.map(([n, color, nombre]) => <span key={nombre} className="flex items-center gap-1" title={nombre}><span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />{n}</span>)}
      </span>
    </span>
  );
}

function Estado({ texto }: { texto: string }) {
  const clase = texto === "Confirmada" ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30"
    : texto === "Pendiente" ? "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30"
    : "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-white/10 dark:text-slate-300 dark:ring-white/10";
  return <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${clase}`}>{texto}</span>;
}

function Tarjeta({ titulo, icono, href, verTodo, extra, className = "", children }: { titulo: string; icono?: string; href?: string; verTodo?: string; extra?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={`overflow-hidden rounded-xl bg-white border border-[#E7E9EE] shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:bg-[#131316] dark:border-white/[0.08] ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 md:px-5 dark:border-white/[0.06]">
        <h3 className="flex items-center gap-2 text-[14px] font-semibold text-slate-900 dark:text-white">{icono && <IconoPanel src={icono} alt="" className="w-[18px] h-[18px]" />}{titulo}</h3>
        <div className="flex items-center gap-3">
          {extra}
          {href && verTodo && <Link href={href} className="shrink-0 text-[12.5px] font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">{verTodo} →</Link>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Vacio({ texto }: { texto: string }) {
  return <p className="px-5 py-8 text-center text-[13px] text-slate-400">{texto}</p>;
}
