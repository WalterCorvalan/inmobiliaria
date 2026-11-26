import Link from "next/link";
import IconoPanel from "@/components/panel/IconoPanel";
import type { ReactNode } from "react";
import { AlertTriangle, ArrowRight, Filter, PieChart, Building2, CalendarClock, CheckCircle2, Clock, Flame, KeyRound, MessageSquareDot, Plus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  agendaProxima, embudoVentas, haceCuanto, tareaVencida, hoyArgentina, leadsParaAtender, resumenInicio, sumarDiasISO,
  type CanalLead, type LeadInicio, type PropiedadInicio, type TareaInicio, type VisitaInicio,
} from "@/lib/panel/inicio";

// Inicio del panel (rediseño 25/11/2026, pedido de Walter): en vez de entrar directo a Leads, una pantalla con lo que hay
// que atender hoy (leads calientes o sin leer, visitas, tareas) y el estado de la cartera de propiedades.
export const metadata = { title: "Inicio | Inmobiliaria CRM" };

const CANAL: Record<CanalLead, { nombre: string; icono: string }> = {
  whatsapp: { nombre: "WhatsApp", icono: "/icons/panel/whatsapp.png" },
  instagram: { nombre: "Instagram", icono: "/icons/panel/instagram.png" },
  messenger: { nombre: "Messenger", icono: "/icons/panel/messenger.png" },
  rodi: { nombre: "Chat de la web", icono: "/icons/panel/contenido-sitio.png" },
  manual: { nombre: "Oficina", icono: "/icons/panel/leads.png" },
};

const TEMPERATURA: Record<string, { texto: string; clase: string }> = {
  caliente: { texto: "Caliente", clase: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30" },
  tibio: { texto: "Tibio", clase: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30" },
  frio: { texto: "Frío", clase: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30" },
};

function nombreDia(fecha: string, hoy: string): string {
  if (fecha === hoy) return "Hoy";
  if (fecha === sumarDiasISO(hoy, 1)) return "Mañana";
  const d = new Date(`${fecha}T12:00:00Z`);
  const txt = d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", timeZone: "UTC" });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

function saludo(): string {
  const h = new Date(Date.now() - 3 * 3600000).getUTCHours();
  return h < 12 ? "Buen día" : h < 20 ? "Buenas tardes" : "Buenas noches";
}

type ConvBase = Omit<LeadInicio, "canal" | "nombre">;
type ConvWA = ConvBase & { whatsapp_contactos: { nombre_perfil: string | null; telefono: string | null } | null };
type ConvIG = ConvBase & { instagram_contactos: { username: string | null; nombre_perfil: string | null } | null };
type ConvMS = Omit<ConvBase, "es_basura"> & { messenger_contactos: { nombre_perfil: string | null } | null };
type ConvWeb = ConvBase & { nombre_contacto: string | null };
type LeadManual = Pick<LeadInicio, "id" | "calificacion" | "estado_lead" | "created_at" | "es_basura"> & { nombre: string | null };

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

  const [perfil, wa, ig, ms, web, manuales, visitas, propiedades, tareas] = await Promise.all([
    user ? supabase.from("perfiles").select("nombre").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    filas<ConvWA>(supabase.from("whatsapp_conversaciones").select(`${convEtapa}, whatsapp_contactos ( nombre_perfil, telefono )`).order("last_message_at", { ascending: false }).limit(500), "whatsapp"),
    filas<ConvIG>(supabase.from("instagram_conversaciones").select(`${convEtapa}, instagram_contactos ( username, nombre_perfil )`).order("last_message_at", { ascending: false }).limit(500), "instagram"),
    filas<ConvMS>(supabase.from("messenger_conversaciones").select(`id, calificacion, estado_lead, unread_count, last_message_at, created_at, estado_pipeline, messenger_contactos ( nombre_perfil )`).order("last_message_at", { ascending: false }).limit(500), "messenger"),
    filas<ConvWeb>(supabase.from("rodi_conversaciones").select(`${conv}, nombre_contacto`).order("last_message_at", { ascending: false }).limit(500), "web"),
    filas<LeadManual>(supabase.from("leads_manuales").select("id, calificacion, estado_lead, created_at, es_basura, nombre").order("created_at", { ascending: false }).limit(500), "manuales"),
    filas<VisitaInicio>(supabase.from("visitas").select("id, nombre_cliente, fecha_visita, horario_visita, estado, tipo, propiedad_codigo").gte("fecha_visita", hoy).order("fecha_visita").limit(200), "visitas"),
    filas<PropiedadInicio>(supabase.from("propiedades").select("estado, operacion").limit(2000), "propiedades"),
    filas<TareaInicio>(supabase.from("tareas_lead").select("id, titulo, tipo, fecha_vencimiento, completada").eq("completada", false).order("fecha_vencimiento").limit(200), "tareas"),
  ]);

  const leads: LeadInicio[] = [
    ...wa.map((c) => ({ ...c, canal: "whatsapp" as const, nombre: c.whatsapp_contactos?.nombre_perfil || c.whatsapp_contactos?.telefono || "Sin nombre" })),
    ...ig.map((c) => ({ ...c, canal: "instagram" as const, nombre: c.instagram_contactos?.username ? `@${c.instagram_contactos.username}` : c.instagram_contactos?.nombre_perfil || "Sin nombre" })),
    ...ms.map((c) => ({ ...c, es_basura: false, canal: "messenger" as const, nombre: c.messenger_contactos?.nombre_perfil || "Contacto de Messenger" })),
    ...web.map((c) => ({ ...c, canal: "rodi" as const, nombre: c.nombre_contacto || "Visitante de la web" })),
    ...manuales.map((c) => ({ ...c, canal: "manual" as const, unread_count: 0, last_message_at: c.created_at, nombre: c.nombre || "Sin nombre" })),
  ];

  const r = resumenInicio({ leads, visitas, propiedades, tareas });
  const atender = leadsParaAtender(leads);
  const agenda = agendaProxima(visitas, hoy, 7).slice(0, 6);
  const tareasUrgentes = tareas.filter((t) => t.fecha_vencimiento && hoyArgentina(new Date(t.fecha_vencimiento)) <= hoy).slice(0, 4);
  const primerNombre = ((perfil as { data: { nombre?: string } | null }).data?.nombre || "").split(" ")[0];
  const fechaLarga = new Date(`${hoy}T12:00:00Z`).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const maxCanal = Math.max(1, ...Object.values(r.porCanal));
  const totalCanal = Object.values(r.porCanal).reduce((a, b) => a + b, 0);
  const embudo = embudoVentas(leads);

  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 py-5 md:px-8 md:py-7 space-y-5">
      {/* Saludo + acciones rápidas */}
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 first-letter:uppercase">{fechaLarga}</p>
          <h2 className="mt-0.5 text-[22px] md:text-[24px] font-semibold tracking-tight text-slate-900 dark:text-white">
            {saludo()}{primerNombre ? `, ${primerNombre}` : ""}
          </h2>
          <p className="mt-1 text-[14px] text-slate-500 dark:text-slate-400">
            {atender.length > 0 ? `Tenés ${atender.length} ${atender.length === 1 ? "lead" : "leads"} para atender y ${r.visitasHoy} ${r.visitasHoy === 1 ? "visita" : "visitas"} hoy.` : "Todo al día: no hay leads esperando respuesta."}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 md:flex md:gap-2.5">
          <Accion href="/panel/leads" icono={<Plus className="w-4 h-4" />} primaria>Nuevo lead</Accion>
          <Accion href="/panel/propiedades" icono={<Building2 className="w-4 h-4" />}>Propiedad</Accion>
          <Accion href="/panel/visitas" icono={<CalendarClock className="w-4 h-4" />}>Agendar</Accion>
        </div>
      </section>

      {/* Números del día */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumen">
        <Numero href="/panel/leads" icono={<Users className="w-[18px] h-[18px]" />} tono="marca" titulo="Leads activos" valor={r.leadsActivos} detalle={r.leadsNuevosHoy > 0 ? `${r.leadsNuevosHoy} ${r.leadsNuevosHoy === 1 ? "nuevo" : "nuevos"} hoy` : "en seguimiento"} />
        <Numero href="/panel/leads" icono={<MessageSquareDot className="w-[18px] h-[18px]" />} tono="rosa" titulo="Esperan respuesta" valor={r.sinLeer} detalle={`${r.calientes} ${r.calientes === 1 ? "caliente" : "calientes"}`} />
        <Numero href="/panel/visitas" icono={<CalendarClock className="w-[18px] h-[18px]" />} tono="ambar" titulo="Visitas hoy" valor={r.visitasHoy} detalle={`${r.visitasSemana} en los próximos 7 días`} />
        <Numero href="/panel/propiedades" icono={<Building2 className="w-[18px] h-[18px]" />} tono="verde" titulo="Propiedades disponibles" valor={r.disponibles} detalle={`${r.reservadas} ${r.reservadas === 1 ? "reservada" : "reservadas"} · ${r.enVenta} venta · ${r.enAlquiler} alquiler`} />
      </section>

      {/* Embudo y canales: lo analítico arriba, como en los tableros de CRM (rediseño corporativo 26/11/2026). */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Tarjeta className="lg:col-span-3" titulo="Embudo de ventas" icono={<Filter className="w-4 h-4 text-slate-400" />} extra={embudo.total > 0 ? <span className="text-[12px] text-slate-500 dark:text-slate-400">Cierre <b className="font-semibold text-slate-900 dark:text-white tabular-nums">{embudo.tasaCierre}%</b></span> : null}>
          {embudo.total === 0 ? (
            <Vacio texto="Todavía no hay leads con etapa cargada." />
          ) : (
            <ul className="px-4 py-4 md:px-5 space-y-3">
              {embudo.etapas.map((e, i) => {
                const base = embudo.etapas[0].llegaron || 1;
                const pct = Math.round((e.llegaron / base) * 100);
                return (
                  <li key={e.etapa} className="grid grid-cols-[112px_1fr_44px] items-center gap-3">
                    <span className="text-[13px] font-medium text-slate-600 dark:text-slate-300 truncate">{ETAPA_TEXTO[e.etapa]}</span>
                    <span className="h-7 rounded-md bg-slate-50 dark:bg-white/[0.04] overflow-hidden">
                      <span className="flex h-full items-center rounded-md px-2 text-[11.5px] font-semibold text-white tabular-nums" style={{ width: `${Math.max(pct, 6)}%`, background: `color-mix(in srgb, var(--marca) ${100 - i * 15}%, white)` }}>{e.llegaron}</span>
                    </span>
                    <span className="text-right text-[12px] tabular-nums text-slate-500 dark:text-slate-400">{pct}%</span>
                  </li>
                );
              })}
              {embudo.perdidos > 0 && <li className="pt-1 text-[12px] text-slate-500 dark:text-slate-400">{embudo.perdidos} {embudo.perdidos === 1 ? "lead perdido" : "leads perdidos"} fuera del embudo.</li>}
            </ul>
          )}
        </Tarjeta>
        <Tarjeta className="lg:col-span-2" titulo="Leads por canal" icono={<PieChart className="w-4 h-4 text-slate-400" />} extra={<span className="text-[12px] text-slate-500 dark:text-slate-400"><b className="font-semibold text-slate-900 dark:text-white tabular-nums">{totalCanal}</b> activos</span>}>
          <ul className="space-y-3.5 px-4 py-4 md:px-5">
            {(Object.keys(CANAL) as CanalLead[]).map((c) => (
              <li key={c} className="flex items-center gap-3">
                <IconoPanel src={CANAL[c].icono} alt="" className="w-[18px] h-[18px] shrink-0" />
                <span className="w-28 shrink-0 truncate text-[13px] font-medium text-slate-600 dark:text-slate-300">{CANAL[c].nombre}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
                  <span className="block h-full rounded-full bg-indigo-600" style={{ width: `${(r.porCanal[c] / maxCanal) * 100}%` }} />
                </span>
                <span className="w-6 shrink-0 text-right text-[13px] font-semibold tabular-nums">{r.porCanal[c]}</span>
              </li>
            ))}
          </ul>
        </Tarjeta>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Leads para atender */}
        <Tarjeta className="lg:col-span-3" titulo="Para atender ahora" icono={<Flame className="w-4 h-4 text-rose-500" />} href="/panel/leads" verTodo="Ver leads">
          {atender.length === 0 ? (
            <Vacio texto="No hay leads calientes ni mensajes sin leer." />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-white/5">
              {atender.map((l) => {
                const temp = TEMPERATURA[l.calificacion || ""];
                return (
                  <li key={`${l.canal}-${l.id}`}>
                    <Link href={`/panel/leads?lead=${l.id}&origen=${l.canal}`} className="flex items-center gap-3 px-4 py-3 md:px-5 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors">
                      <span className="relative shrink-0">
                        <span className="flex w-10 h-10 items-center justify-center rounded-full bg-slate-100 dark:bg-white/10 text-[14px] font-bold text-slate-600 dark:text-slate-200">
                          {l.nombre.replace("@", "").charAt(0).toUpperCase()}
                        </span>
                        <IconoPanel src={CANAL[l.canal].icono} alt={CANAL[l.canal].nombre} className="absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full bg-white dark:bg-[#141414] p-px" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-slate-900 dark:text-white">{l.nombre}</span>
                        <span className="block truncate text-[12.5px] text-slate-500 dark:text-slate-400">{CANAL[l.canal].nombre} · {haceCuanto(l.last_message_at || l.created_at)}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {(l.unread_count ?? 0) > 0 && (
                          <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center" title="Mensajes sin leer">{l.unread_count}</span>
                        )}
                        {temp && <span className={`hidden sm:inline-flex rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ring-1 ring-inset ${temp.clase}`}>{temp.texto}</span>}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Tarjeta>

        {/* Agenda */}
        <Tarjeta className="lg:col-span-2" titulo="Agenda de la semana" icono={<CalendarClock className="w-4 h-4 text-amber-500" />} href="/panel/visitas" verTodo="Ver agenda">
          {agenda.length === 0 ? (
            <Vacio texto="No hay visitas en los próximos 7 días." />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-white/5">
              {agenda.map((v) => (
                <li key={v.id} className="flex items-center gap-3 px-4 py-3 md:px-5">
                  <div className={`w-14 shrink-0 rounded-lg py-1.5 text-center ${v.fecha_visita === hoy ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300" : "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300"}`}>
                    <p className="text-[10.5px] font-semibold leading-none">{nombreDia(v.fecha_visita, hoy).split(" ")[0]}</p>
                    <p className="mt-1 text-[13.5px] font-semibold leading-none tabular-nums">{(v.horario_visita || "").slice(0, 5) || "—"}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold text-slate-900 dark:text-white">{v.nombre_cliente || "Sin nombre"}</p>
                    <p className="truncate text-[12.5px] text-slate-500 dark:text-slate-400">
                      {v.propiedad_codigo ? `Visita · ${v.propiedad_codigo}` : "Visita"}
                    </p>
                  </div>
                  {v.estado === "Confirmada"
                    ? <CheckCircle2 className="w-[18px] h-[18px] shrink-0 text-emerald-500" aria-label="Confirmada" />
                    : <Clock className="w-[18px] h-[18px] shrink-0 text-slate-300 dark:text-slate-600" aria-label="Pendiente" />}
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Tareas */}
        <Tarjeta titulo="Tareas de hoy" icono={<AlertTriangle className="w-4 h-4 text-rose-500" />} href="/panel/leads?modo=tareas" verTodo="Ver tareas">
          {tareasUrgentes.length === 0 ? (
            <Vacio texto="Sin tareas para hoy." />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-white/5">
              {tareasUrgentes.map((t) => {
                const vencida = tareaVencida(t);
                return (
                  <li key={t.id} className="flex items-start gap-3 px-4 py-3 md:px-5">
                    <span className={`mt-1.5 w-2 h-2 shrink-0 rounded-full ${vencida ? "bg-rose-500" : "bg-amber-400"}`} aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold text-slate-800 dark:text-slate-100">{t.titulo}</p>
                      <p className={`text-[12px] ${vencida ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-slate-500 dark:text-slate-400"}`}>
                        {t.tipo ? `${t.tipo} · ` : ""}{vencida ? "Vencida" : `Hoy ${new Date(t.fecha_vencimiento!).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" })}`}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Tarjeta>

        {/* Cartera */}
        <Tarjeta titulo="Tu cartera" icono={<KeyRound className="w-4 h-4 text-indigo-500" />} href="/panel/propiedades" verTodo="Ver propiedades">
          <dl className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-white/5">
            {[["Disponibles", r.disponibles], ["En venta", r.enVenta], ["En alquiler", r.enAlquiler]].map(([t, n]) => (
              <div key={t} className="px-4 py-5 text-center">
                <dd className="text-[26px] font-extrabold leading-none tabular-nums text-slate-900 dark:text-white">{n}</dd>
                <dt className="mt-1.5 text-[12px] font-medium text-slate-500 dark:text-slate-400">{t}</dt>
              </div>
            ))}
          </dl>
          {r.reservadas > 0 && <p className="border-t border-slate-100 px-5 py-3 text-[12.5px] text-slate-500 dark:border-white/5 dark:text-slate-400">{r.reservadas} {r.reservadas === 1 ? "propiedad reservada" : "propiedades reservadas"}: el bot las nombra como reservadas.</p>}
        </Tarjeta>

      </section>
    </div>
  );
}

const ETAPA_TEXTO: Record<string, string> = { sin_contactar: "Sin contactar", contactado: "Contactados", visita: "Visitas", negociacion: "Negociación", cerrado: "Cerrados" };

function Accion({ href, icono, children, primaria = false }: { href: string; icono: ReactNode; children: ReactNode; primaria?: boolean }) {
  return (
    <Link
      href={href}
      className={`inline-flex flex-col md:flex-row items-center justify-center gap-1 md:gap-1.5 rounded-lg px-2 md:px-3.5 h-auto md:h-9 py-2.5 md:py-0 text-[12.5px] md:text-[13px] font-semibold transition-colors ${
        primaria
          ? "bg-[#0145F2] text-white hover:bg-[#0138c9] shadow-sm"
          : "bg-white text-slate-700 border border-[#E2E5EA] hover:bg-slate-50 dark:bg-white/5 dark:text-slate-200 dark:border-white/10 dark:hover:bg-white/10"
      }`}
    >
      {icono}
      <span className="truncate">{children}</span>
    </Link>
  );
}

const TONOS = {
  marca: "text-indigo-600 dark:text-indigo-300",
  rosa: "text-rose-600 dark:text-rose-300",
  ambar: "text-amber-600 dark:text-amber-300",
  verde: "text-emerald-600 dark:text-emerald-300",
};

function Numero({ href, icono, tono, titulo, valor, detalle }: { href: string; icono: ReactNode; tono: keyof typeof TONOS; titulo: string; valor: number; detalle: string }) {
  return (
    <Link href={href} className="group rounded-xl bg-white p-4 md:p-5 border border-[#E7E9EE] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors hover:border-slate-300 dark:bg-[#131316] dark:border-white/[0.08] dark:hover:border-white/20">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400 truncate">{titulo}</p>
        <span className={`flex w-8 h-8 items-center justify-center rounded-lg bg-slate-50 dark:bg-white/[0.05] ${TONOS[tono]}`}>{icono}</span>
      </div>
      <p className="mt-2 text-[28px] font-semibold leading-none tracking-tight tabular-nums text-slate-900 dark:text-white">{valor}</p>
      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between gap-2">
        <p className="truncate text-[12px] text-slate-500 dark:text-slate-400">{detalle}</p>
        <ArrowRight className="w-3.5 h-3.5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 dark:text-slate-600" aria-hidden="true" />
      </div>
    </Link>
  );
}

function Tarjeta({ titulo, icono, href, verTodo, extra, className = "", children }: { titulo: string; icono: ReactNode; href?: string; verTodo?: string; extra?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={`overflow-hidden rounded-xl bg-white border border-[#E7E9EE] shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:bg-[#131316] dark:border-white/[0.08] ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 md:px-5 dark:border-white/[0.06]">
        <h3 className="flex items-center gap-2 text-[14px] font-semibold text-slate-900 dark:text-white">{icono}{titulo}</h3>
        {extra}
        {href && verTodo && (
          <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
            {verTodo} <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function Vacio({ texto }: { texto: string }) {
  return <p className="px-5 py-8 text-center text-[13px] text-slate-400">{texto}</p>;
}
