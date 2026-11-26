"use client";

// Hay dos versiones de esta pantalla según el diseño que cada uno elige en Mi Perfil (lib/panel/disenoPanel.ts). Si cambia
// la lógica (datos, permisos, guardados), se cambia en las dos.
// Esta es la del diseño Nuevo; la de Softcars es LeadsUnificadosClient.tsx.

import { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import AvatarVendedor from "@/components/panel/conversaciones/AvatarVendedor";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase2 } from "@/lib/supabase/client";
import { List, Columns3, TrendingUp, Trophy, Filter, Search, Radar, Bot, User, Plus, Radio, Building2, ChevronRight, ChevronLeft, Flame, Trash2, Clock3, Zap, Sun, Snowflake,ArrowDownWideNarrow, ClipboardList, LayoutGrid, CalendarDays, History, PieChart } from "lucide-react";
import { IconoWhatsapp, IconoInstagram, IconoMessenger } from "@/components/ui/IconosCanales";
import LeadDetailModal, { CANALES_ORIGEN } from "@/components/panel/conversaciones/LeadDetailModal";
import NuevoLeadManualModal from "./NuevoLeadManualModal";
import { PipelineLeads, IngresosLeads, RankingLeads } from "./LeadsVistas";
import type { VistaTareas } from "./TareasLeadBoard";
import type { DatosTareasLead } from "./tareasLead";
import { Crossfade, Compartido } from "@/components/ui/movimiento";
import { diasDesde, calcularScore, prioridadDeScore, motivosPrioridad, ordenarPorPrioridad } from "@/lib/panel/prioridadLeads";
import { escucharTablas } from "@/lib/panel/escucharTablas";
import { etiquetaOrigen } from "@/lib/panel/origenesCliente";
import SelectorWeb from "@/components/ui/SelectorWeb";
import FichaLeadsNueva from "@/components/panel/conversaciones/FichaLeadsNueva";
import { ESTILO_STOCK_MINIMAL } from "../propiedades/estiloStockMinimal";
import { esModoDemo } from "@/lib/demo/modo";

interface Perfil { id: string; nombre: string; roles: string[] }
interface Sucursal { id: string; nombre: string }
type Origen = "whatsapp" | "instagram" | "messenger" | "rodi" | "manual";
interface LeadNormalizado {
  id: string; origen: Origen; nombre: string; telefono: string | null; vendedor_id: string | null;
  calificacion: string | null; estado_lead: string; canal_origen: string | null; sucursal_id: string | null;
  created_at: string; last_message_at: string | null; esBasura: boolean; ultimaDireccion: "in" | "out" | null;
  /** Lista del diseño nuevo (19/11/2026): último mensaje de la charla y resumen de la IA, si hay (page.tsx). */
  ultimoMensaje?: { texto: string | null; tipo: string | null; direccion: "in" | "out" } | null; resumen?: string | null;
}

// Un lead caliente que el CLIENTE dejó esperando respuesta 2+ días necesita
// seguimiento urgente -- mismo umbral usado para "lead basura" abajo, para
// no manejar dos números distintos en el mismo módulo.
const DIAS_SIN_RESPUESTA = 2;

// Las pestañas de Tareas usan recharts (Métricas): se cargan recién cuando se abren.
const TareasLeadBoard = dynamic(() => import("./TareasLeadBoard"), { ssr: false });

// Pestañas de arriba: las de los leads y, separadas, las de Tareas (antes un módulo aparte, unificado el 19/10/2026).
type ModoLeads = "lista" | "pipeline" | "ingresos" | "ranking";
type ModoTareas = `tareas_${VistaTareas}`;
const MODOS_TAREAS: { v: ModoTareas; label: string; icon: typeof List }[] = [
  { v: "tareas_tablero", label: "Tablero", icon: LayoutGrid },
  { v: "tareas_calendario", label: "Calendario", icon: CalendarDays },
  { v: "tareas_historial", label: "Historial", icon: History },
  { v: "tareas_metricas", label: "Métricas", icon: PieChart },
];
const esModoTareas = (m: string | null): m is ModoTareas => MODOS_TAREAS.some((t) => t.v === m);

// Filtros rápidos de la bandeja: solo 3 (pedido de Walter 3/10/2026). Contactados, Clientes y Perdidos se ven en la pestaña Pipeline.
const ESTADOS: { value: string; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "nuevo", label: "Nuevos" },
  { value: "calificando", label: "Interesados" },
];
const ESTADO_LABEL: Record<string, string> = { nuevo: "Nuevo", asignado: "Contactado", calificando: "Interesado", convertido: "Cliente", perdido: "Perdido" };
// Estilo "SaaS de alto contraste" (Walter, 20/11/2026, aprobado sobre una muestra): el estado va en una tarjetita blanca
// con un puntito de color; la temperatura, en cambio, con la tarjetita entera de color fuerte y su ícono (opción A).
const ESTADO_DOT: Record<string, string> = { nuevo: "bg-[#0145F2]", asignado: "bg-[#0145F2]", calificando: "bg-violet-500", convertido: "bg-emerald-500", perdido: "bg-rose-500" };
const CALIFICACION_DOT: Record<string, string> = { caliente: "bg-rose-500", tibio: "bg-amber-500", frio: "bg-sky-400" };
const TEMPERATURA: Record<string, { label: string; clase: string; icono: typeof Flame }> = {
  caliente: { label: "Caliente", clase: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30", icono: Flame },
  tibio: { label: "Tibio", clase: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30", icono: Sun },
  frio: { label: "Frío", clase: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30", icono: Snowflake },
};
/** "Hoy 10:00", "Mañana 11:00" o "14 oct". */

const ORIGEN_ICON: Record<Origen, any> = { whatsapp: IconoWhatsapp, instagram: IconoInstagram, messenger: IconoMessenger, rodi: Bot, manual: User };
const ORIGEN_LABEL: Record<Origen, string> = { whatsapp: "WhatsApp", instagram: "Instagram", messenger: "Messenger", rodi: "Chat web", manual: "Manual" };
// Vuelve el color de marca por canal (se había sacado del todo), pero en un
// tono más suave (400 en vez de 600) que el original -- alcanza para
// reconocer el canal de un vistazo sin que la bandeja parezca un semáforo.
const ORIGEN_COLOR: Record<Origen, string> = {
  whatsapp: "text-emerald-500 dark:text-emerald-400", instagram: "text-pink-500 dark:text-pink-400",
  messenger: "text-blue-500 dark:text-blue-400", rodi: "text-indigo-500 dark:text-indigo-400", manual: "text-slate-500 dark:text-slate-400",
};

const PRIORIDAD_LABEL: Record<string, string> = { alta: "Prioridad alta", media: "Prioridad media", baja: "Prioridad baja" };
// La prioridad va al lado del teléfono, como texto de color con su ícono (en el celular también desde el 24/11/2026).
const PRIORIDAD_TEXTO: Record<string, string> = { alta: "text-rose-600 dark:text-rose-400", media: "text-amber-600 dark:text-amber-400", baja: "text-emerald-600 dark:text-emerald-400" };
// Columnas de la tabla en la computadora: lead, canal, temperatura, estado, resumen, último mensaje, fecha y la flechita.
// Los mínimos entran a 1280 de ancho con el menú abierto (24/11/2026: antes sumaban más y la flechita quedaba cortada).
const COLUMNAS_LEADS = "lg:grid-cols-[minmax(250px,1.6fr)_minmax(100px,0.7fr)_84px_118px_minmax(160px,2fr)_minmax(160px,1.6fr)_48px_16px]";
const LEADS_POR_PAGINA = 100;
// Texto del último mensaje para la lista: una foto o un audio sin texto se nombran.
function textoUltimoMensaje(m: { texto: string | null; tipo: string | null }) {
  if (m.texto) return m.texto;
  const nombres: Record<string, string> = { image: "📷 Foto", audio: "🎙️ Audio", video: "🎥 Video", document: "📄 Documento", sticker: "Sticker" };
  return nombres[m.tipo || ""] || "Mensaje";
}

function formatDia(iso: string) {
  const d = new Date(iso);
  const hoy = new Date();
  if (d.toDateString() === hoy.toDateString()) return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}
const esHoy = (iso: string | null | undefined) => !!iso && new Date(iso).toDateString() === new Date().toDateString();

// Último mensaje como globo de chat, para que no se confunda con el resumen: el del cliente blanco con borde, el nuestro
// azul suave (Walter, 20/11/2026). Desde el 24/11/2026 (imagen de Walter) arriba va el nombre de quien lo escribió en vez
// de "Nosotros"/"Cliente": el que manda un vendedor llega como "[Nombre] texto" y se separa; el resto es un renglón.
function GloboUltimoMensaje({ nuestro, texto }: { nuestro: boolean; texto: string }) {
  const conNombre = texto.match(/^\[([^\]]{1,60})\]\s*([\s\S]*)$/);
  const autor = conNombre?.[1].trim();
  const cuerpo = conNombre ? conNombre[2] || "Mensaje" : texto;
  return (
    <div className={`w-fit max-w-full min-w-0 px-3 py-2 text-[12.5px] leading-snug text-slate-800 dark:text-slate-100 rounded-xl ${nuestro
      ? "bg-[#EAF0FF] dark:bg-[#0145F2]/25"
      : "bg-white dark:bg-white/[0.06] border border-[#E3E5EA] dark:border-white/10"}`}>
      {autor && <p className={`truncate text-[12px] font-semibold ${nuestro ? "text-[#0145F2] dark:text-[#9db8ff]" : "text-slate-700 dark:text-slate-300"}`}>{autor}</p>}
      <p className="line-clamp-1 break-all">{cuerpo}</p>
    </div>
  );
}

function ChipTemperatura({ calificacion }: { calificacion: string }) {
  const t = TEMPERATURA[calificacion];
  const Icono = t.icono;
  return <span className={`inline-flex items-center gap-1 h-6 px-2 rounded-md text-[12px] font-semibold whitespace-nowrap ${t.clase}`}><Icono className="w-3.5 h-3.5" />{t.label}</span>;
}

function ChipEstado({ estado }: { estado: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-md border border-[#E3E5EA] dark:border-white/10 bg-white dark:bg-white/5 text-[12px] font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">
      <span className={`w-1.5 h-1.5 rounded-full ${ESTADO_DOT[estado] || ESTADO_DOT.nuevo}`} />{ESTADO_LABEL[estado] || "Nuevo"}
    </span>
  );
}

// Flechas y números de página del pie de la lista (imagen de Walter, 24/11/2026). Con muchas páginas muestra la primera,
// la última y las de al lado de la actual.
function Paginas({ pagina, total, onIr }: { pagina: number; total: number; onIr: (n: number) => void }) {
  const numeros = Array.from({ length: total }, (_, i) => i).filter((i) => total <= 7 || i === 0 || i === total - 1 || Math.abs(i - pagina) <= 1);
  const flecha = "grid place-items-center w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-transparent";
  return (
    <div className="flex items-center gap-1">
      <button type="button" aria-label="Página anterior" disabled={pagina === 0} onClick={() => onIr(pagina - 1)} className={flecha}><ChevronLeft className="w-4 h-4" /></button>
      {numeros.map((n, k) => (
        <span key={n} className="flex items-center gap-1">
          {k > 0 && n - numeros[k - 1] > 1 && <span className="px-1 text-slate-400">…</span>}
          <button type="button" aria-current={n === pagina ? "page" : undefined} onClick={() => onIr(n)}
            className={`grid place-items-center min-w-7 h-7 px-1.5 rounded-full text-[12.5px] font-semibold tabular-nums ${n === pagina ? "bg-[#0145F2] text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"}`}>{n + 1}</button>
        </span>
      ))}
      <button type="button" aria-label="Página siguiente" disabled={pagina >= total - 1} onClick={() => onIr(pagina + 1)} className={flecha}><ChevronRight className="w-4 h-4" /></button>
    </div>
  );
}

export default function LeadsNuevoClient({ leadsIniciales, vendedores, sucursales, miId, tareas, topeAlcanzado = false, avisosCarga = [] }: { leadsIniciales: LeadNormalizado[]; vendedores: Perfil[]; sucursales: Sucursal[]; miId: string; tareas: DatosTareasLead; topeAlcanzado?: boolean; ventasCerradas?: { vendedor_id: string | null; fecha_cierre: string | null }[]; avisosCarga?: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const misRoles = vendedores.find((v) => v.id === miId)?.roles || [];
  const [leads, setLeads] = useState(leadsIniciales);
  // Pestañas de arriba: la bandeja de siempre (lista + detalle) o las vistas de tablero/estadísticas (LeadsVistas.tsx).
  const [modo, setModo] = useState<ModoLeads | ModoTareas>(() => { const m = searchParams.get("modo"); return esModoTareas(m) ? m : "lista"; });
  const [vista, setVista] = useState<"normal" | "sin_respuesta" | "basura">("normal");
  // Admin y encargado ven todos los leads: arrancan en "Míos" (Walter, 21/10/2026). El vendedor ya ve solo los suyos.
  const veTodos = misRoles.some((r: string) => r === "admin" || r === "director" || r === "encargado");
  // En la demo se ven todos los leads de entrada (con "Mis leads" quedaban 4 de 11 y parecía vacía).
  const [filtroEstado, setFiltroEstado] = useState(veTodos && !esModoDemo() ? "mios" : "todos");
  const [filtroOrigen, setFiltroOrigen] = useState<Origen | "todos">("todos");
  const [filtroCanal, setFiltroCanal] = useState("");
  const [filtroSucursal, setFiltroSucursal] = useState("");
  const [orden, setOrden] = useState<"prioridad" | "recientes">("recientes");
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState<{ id: string; origen: Origen } | null>(null);
  const [showNuevo, setShowNuevo] = useState(false);
  const [showFiltros, setShowFiltros] = useState(false);
  // La lista larga va en páginas de 100 (con miles de leads, dibujar todo de una frena la pantalla). Al cambiar un
  // filtro, el buscador o el orden vuelve a la página 1: la página guardada vale solo para los mismos filtros.
  const [paginaGuardada, setPaginaGuardada] = useState<{ clave: string; n: number }>({ clave: "", n: 0 });
  useEffect(() => {
    const leadId = searchParams.get("lead");
    const origen = searchParams.get("origen") as Origen | null;
    if (leadId && origen) setSeleccionado({ id: leadId, origen });
  }, [searchParams]);

  useEffect(() => { setLeads(leadsIniciales); }, [leadsIniciales]);

  // Realtime sobre las 4 fuentes reales de un lead (ver ARCHITECTURE.md,
  // "no hay una tabla leads") -- antes un lead nuevo de cualquier canal solo
  // aparecía acá al recargar la página a mano.
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const refrescarConDebounce = () => { clearTimeout(timeoutId); timeoutId = setTimeout(() => router.refresh(), 400); };
    const dejarDeEscuchar = escucharTablas(supabase2, ["whatsapp_conversaciones", "instagram_conversaciones", "messenger_conversaciones", "rodi_conversaciones", "leads_manuales"], refrescarConDebounce, "leads");
    return () => { clearTimeout(timeoutId); dejarDeEscuchar(); };
  }, [router]);

  const cerrarDetalle = () => {
    setSeleccionado(null);
    if (searchParams.get("lead")) router.replace("/panel/leads");
  };

  // Clasificación derivada -- ninguna de las dos pestañas especiales muta el
  // estado_lead normal (nuevo/asignado/etc), son vistas calculadas sobre los
  // mismos datos. "Lead basura" sí puede venir de un flag persistido
  // (es_basura, un vendedor lo mandó a mano) además de la regla automática.
  const clasificados = useMemo(() => leads.map((l) => {
    const sinContestarDelCliente = l.origen !== "manual" && l.ultimaDireccion === "in" && diasDesde(l.last_message_at) >= DIAS_SIN_RESPUESTA
      && l.estado_lead !== "perdido" && l.estado_lead !== "convertido";
    const sinRespuesta = sinContestarDelCliente && l.calificacion === "caliente" && !l.esBasura;
    const basuraAutomatica = sinContestarDelCliente && (l.calificacion === "frio" || !l.calificacion);
    const esBasuraFinal = l.esBasura || basuraAutomatica;
    const score = calcularScore({ ...l, sinRespuesta, esBasuraFinal });
    return { ...l, sinRespuesta, esBasuraFinal, score, prioridad: prioridadDeScore(score) };
  }), [leads]);

  // Admin y encargado filtran por vendedor/encargado en vez de por estado (Walter, 23/10/2026): Nuevos e Interesados
  // se siguen viendo en la pestaña Pipeline. El vendedor ve solo los suyos, así que mantiene los filtros por estado.
  const filtrosPorVendedor = useMemo(() => [
    { value: "mios", label: "Mis leads" },
    { value: "todos", label: "Todos" },
    ...vendedores
      .filter((v) => v.id !== miId && (v.roles?.includes("ventas") || v.roles?.includes("encargado")))
      .map((v) => ({ value: `v:${v.id}`, label: v.nombre })),
    { value: "sin_asignar", label: "Sin asignar" },
  ], [vendedores, miId]);

  const totalSinRespuesta = useMemo(() => clasificados.filter((l) => l.sinRespuesta).length, [clasificados]);
  const totalBasura = useMemo(() => clasificados.filter((l) => l.esBasuraFinal).length, [clasificados]);

  const filtrados = useMemo(() => {
    let l = clasificados;
    if (vista === "sin_respuesta") l = l.filter((c) => c.sinRespuesta);
    else if (vista === "basura") l = l.filter((c) => c.esBasuraFinal);
    else {
      l = l.filter((c) => !c.esBasuraFinal);
      if (filtroEstado === "mios") l = l.filter((c) => c.vendedor_id === miId);
      else if (filtroEstado === "sin_asignar") l = l.filter((c) => !c.vendedor_id);
      else if (filtroEstado.startsWith("v:")) l = l.filter((c) => c.vendedor_id === filtroEstado.slice(2));
      else if (filtroEstado !== "todos") l = l.filter((c) => c.estado_lead === filtroEstado);
    }
    if (filtroOrigen !== "todos") l = l.filter((c) => c.origen === filtroOrigen);
    if (filtroCanal) l = l.filter((c) => c.canal_origen === filtroCanal);
    if (filtroSucursal) l = l.filter((c) => c.sucursal_id === filtroSucursal);
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      l = l.filter((c) => [c.nombre, c.telefono].filter(Boolean).join(" ").toLowerCase().includes(q));
    }
    // "Prioridad" no aplica dentro de Sin respuesta/Basura -- esas dos
    // pestañas ya son su propio criterio de orden (más viejo primero tiene
    // más sentido ahí que el score general).
    if (orden === "prioridad" && vista === "normal") {
      l = ordenarPorPrioridad(l);
    }
    return l;
  }, [clasificados, vista, filtroEstado, filtroOrigen, filtroCanal, filtroSucursal, busqueda, orden, miId]);

  const claveFiltros = [vista, filtroEstado, filtroOrigen, filtroCanal, filtroSucursal, busqueda, orden].join("|");
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / LEADS_POR_PAGINA));
  const pagina = paginaGuardada.clave === claveFiltros ? Math.min(paginaGuardada.n, totalPaginas - 1) : 0;
  const irAPagina = (n: number) => setPaginaGuardada({ clave: claveFiltros, n: Math.max(0, Math.min(totalPaginas - 1, n)) });
  const deLaPagina = filtrados.slice(pagina * LEADS_POR_PAGINA, (pagina + 1) * LEADS_POR_PAGINA);

  const actualizarUno = (id: string, patch: any) => setLeads((prev) => prev.map((c) => (c.id === id ? {
    ...c,
    estado_lead: patch.estado_lead ?? c.estado_lead, calificacion: patch.calificacion ?? c.calificacion,
    vendedor_id: patch.vendedor_id !== undefined ? patch.vendedor_id : c.vendedor_id,
    canal_origen: patch.canal_origen !== undefined ? patch.canal_origen : c.canal_origen,
    sucursal_id: patch.sucursal_id !== undefined ? patch.sucursal_id : c.sucursal_id,
    esBasura: patch.es_basura !== undefined ? patch.es_basura : c.esBasura,
  } : c)));

  const onCreadoManual = (lead: any) => {
    setLeads((prev) => [{ id: lead.id, origen: "manual", nombre: lead.nombre, telefono: lead.telefono, vendedor_id: lead.vendedor_id, calificacion: lead.calificacion, estado_lead: lead.estado_lead || "nuevo", canal_origen: lead.canal_origen, sucursal_id: lead.sucursal_id, created_at: lead.created_at, last_message_at: lead.created_at, esBasura: false, ultimaDireccion: null }, ...prev]);
    setShowNuevo(false);
  };


  const nuevosHoy = leads.filter((l) => new Date(l.created_at).toDateString() === new Date().toDateString()).length;
  const sinAsignar = leads.filter((l) => !l.vendedor_id).length;

  const abrirDesdeVista = (id: string, origen: Origen) => { setSeleccionado({ id, origen }); setModo("lista"); };
  // El Ranking es solo para admin y encargado (los vendedores no ven el rendimiento de los demás).
  const puedeVerRanking = misRoles.some((r: string) => r === "admin" || r === "director") || misRoles.includes("encargado");
  // Barra de arriba en 3 grupos (Walter, 20/10/2026, mezcla de la propuesta con lo de antes): Leads (Lista y Pipeline),
  // Tareas y Números (Ingresos y Ranking). Las opciones del grupo abierto aparecen al lado, chicas. Abajo, en la lista,
  // siguen a la vista Sin respuesta, Basura, los filtros rápidos y el orden.
  const MODOS_LEADS = [
    { v: "lista" as const, label: "Lista", icon: List },
    { v: "pipeline" as const, label: "Pipeline", icon: Columns3 },
  ];
  const MODOS_NUMEROS = [
    { v: "ingresos" as const, label: "Ingresos", icon: TrendingUp },
    { v: "ranking" as const, label: "Ranking", icon: Trophy },
  ].filter((m) => m.v !== "ranking" || puedeVerRanking);
  const GRUPOS = [
    { id: "leads", label: "Leads", icon: List, modos: MODOS_LEADS as { v: ModoLeads | ModoTareas; label: string; icon: typeof List }[] },
    { id: "tareas", label: "Tareas", icon: ClipboardList, modos: MODOS_TAREAS as { v: ModoLeads | ModoTareas; label: string; icon: typeof List }[] },
    { id: "numeros", label: "Números", icon: TrendingUp, modos: MODOS_NUMEROS as { v: ModoLeads | ModoTareas; label: string; icon: typeof List }[] },
  ];
  const grupoActual = GRUPOS.find((g) => g.modos.some((m) => m.v === modo)) || GRUPOS[0];

  return (
    <div className="diseno-material flex flex-col w-full h-full text-slate-800 dark:text-slate-200 overflow-hidden">
      <style>{`
        .tema-softcars .diseno-material {
          --color-slate-50: oklch(98.4% 0.003 247.858); --color-slate-100: oklch(96.8% 0.007 247.896); --color-slate-200: oklch(92.9% 0.013 255.508);
          --color-slate-300: oklch(86.9% 0.022 252.894); --color-slate-400: oklch(70.4% 0.04 256.788); --color-slate-500: oklch(55.4% 0.046 257.417);
          --color-slate-600: oklch(44.6% 0.043 257.281); --color-slate-700: oklch(37.2% 0.044 257.287); --color-slate-800: oklch(27.9% 0.041 260.031);
          --color-slate-900: oklch(20.8% 0.042 265.755);
        }
        .tema-softcars .diseno-material h1, .tema-softcars .diseno-material h2 { color: var(--color-slate-900); }
        .tema-softcars .diseno-material label { color: inherit; }
      `}</style>
      {/* Celular: dos renglones, los grupos arriba y sus opciones (ej. Lista / Pipeline) abajo, todo a lo ancho; antes iban
          en uno solo y se cortaban a la derecha (Walter, 12/11/2026). Computadora: un renglón como siempre. */}
      <div className={`shrink-0 flex-wrap md:flex-nowrap items-center gap-1.5 md:gap-6 px-2.5 md:px-8 py-1.5 md:py-0 border-b border-[#E7E9EE] dark:border-white/[0.07] bg-white dark:bg-[#111113] md:overflow-x-auto ${seleccionado && modo === "lista" ? "hidden" : "flex"}`}>
        {/* Pestañas con subrayado, como los CRM corporativos (26/11/2026). En el celular siguen como botones a lo ancho. */}
        <div className="w-full md:w-auto md:shrink-0 flex items-center gap-0.5 md:gap-5 rounded-lg md:rounded-none bg-slate-100 md:bg-transparent dark:bg-white/5 md:dark:bg-transparent p-0.5 md:p-0">
          {GRUPOS.map((g) => {
            const Icon = g.icon;
            const activo = g.id === grupoActual.id;
            return (
              <button key={g.id} onClick={() => !activo && setModo(g.modos[0].v)} aria-pressed={activo}
                className={`flex-1 md:flex-none justify-center flex items-center gap-1.5 px-3 md:px-0.5 h-8 md:h-12 rounded-md md:rounded-none text-[13px] font-medium md:border-b-2 transition-colors ${activo ? "bg-white md:bg-transparent dark:bg-[#1c1c1f] md:dark:bg-transparent text-slate-900 dark:text-white shadow-sm md:shadow-none md:border-indigo-600 dark:md:border-indigo-400" : "md:border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}>
                <Icon className="w-3.5 h-3.5" /> {g.label}
              </button>
            );
          })}
        </div>
        {grupoActual.modos.length > 1 && (
          <div className="w-full md:w-auto md:shrink-0 md:ml-auto flex items-center gap-1 md:p-0.5 md:rounded-lg md:border md:border-[#E7E9EE] dark:md:border-white/10">
            {grupoActual.modos.map((t) => {
              const Icon = t.icon;
              return (
                <button key={t.v} onClick={() => setModo(t.v)} className={`flex-1 md:flex-none justify-center flex items-center gap-1.5 px-2.5 h-8 md:h-7 rounded-md text-[13px] md:text-[12.5px] font-medium transition-colors ${modo === t.v ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"}`}>
                  <Icon className="w-3.5 h-3.5" /> {t.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Crossfade id={esModoTareas(modo) ? "tareas" : modo} className="flex-1 min-h-0 flex flex-col" classNameInterno="flex-1 min-h-0 flex flex-col w-full">
      {modo === "pipeline" && <PipelineLeads leads={clasificados} vendedores={vendedores} miId={miId} onAbrir={abrirDesdeVista} onMovido={actualizarUno} />}
      {modo === "ingresos" && <IngresosLeads leads={clasificados} vendedores={vendedores} />}
      {modo === "ranking" && puedeVerRanking && <RankingLeads leads={clasificados} vendedores={vendedores} />}
      {esModoTareas(modo) && <TareasLeadBoard vista={modo.replace("tareas_", "") as VistaTareas} {...tareas} />}

      {/* Lista a lo ancho y detalle en pantalla completa (Walter, 19/11/2026): en vez de la bandeja
          angosta con el detalle al costado, una tabla con los mismos datos; al tocar un lead se abre su ficha entera y
          "Volver a leads" regresa a la lista con los mismos filtros. */}
      {modo === "lista" && seleccionado && (
        <div className="stock-minimal flex-1 min-h-0 flex flex-col bg-[#F7F7F8] dark:bg-[#0c0c0f]">
          {/* La ficha trae su propio "Volver a la lista" arriba. Mismo estilo de esquinas y líneas que Stock. */}
          <style>{ESTILO_STOCK_MINIMAL}</style>
          <div className="flex-1 min-h-0 flex flex-col">
            {/* key: al pasar a otro lead la ficha arranca de cero (antes quedaba el anterior a la vista hasta que cargaba el nuevo). */}
            <LeadDetailModal
              key={`${seleccionado.origen}-${seleccionado.id}`}
              leadId={seleccionado.id} origen={seleccionado.origen} miId={miId} vendedores={vendedores} sucursales={sucursales}
              onClose={cerrarDetalle} onActualizado={actualizarUno} inline variante="leads" Ficha={FichaLeadsNueva}
            />
          </div>
        </div>
      )}

      {modo === "lista" && !seleccionado && (
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-[#F4F5F7] dark:bg-[#0A0A0B]">
          <div className="p-3 md:px-8 md:py-6 space-y-4">
            {/* Título, cuántos hay y el botón de crear. Estilo "SaaS de alto contraste" (Walter, 20/11/2026). */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-baseline gap-3 min-w-0">
                {/* El nombre de la pantalla ya está en la barra de arriba: acá solo cuántos hay. */}
                <span className="text-[18px] md:text-[20px] font-semibold tracking-tight text-slate-950 dark:text-white tabular-nums">{leads.length} <span className="text-[14px] md:text-[15px] font-medium text-slate-500 dark:text-slate-400">leads</span></span>
                <span className="hidden sm:inline text-[13px] text-slate-600 dark:text-slate-400 truncate">{nuevosHoy} hoy · <span className="font-medium text-slate-800 dark:text-slate-200">{sinAsignar} sin asignar</span></span>
              </div>
              <button onClick={() => setShowNuevo(true)} className="flex items-center gap-1.5 px-4 h-10 text-[13px] font-semibold bg-[#0145F2] hover:bg-[#0138c9] text-white rounded-lg shrink-0 shadow-[0_1px_2px_rgba(1,69,242,0.3)] boton-principal"><Plus className="w-4 h-4" /> Nuevo lead</button>
            </div>

            {avisosCarga.length > 0 && (
              <div className="text-[12px] text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-lg px-3 py-2">
                <p className="font-semibold">Algunos canales no cargaron bien</p>
                {avisosCarga.map((a) => <p key={a}>{a}</p>)}
              </div>
            )}
            {topeAlcanzado && <p className="text-[12px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg px-3 py-2">Se muestran los 1000 leads más recientes de cada canal; hay más antiguos que no se listan acá.</p>}

            {/* Barra de herramientas: buscador, de quién, orden, Sin respuesta, Basura y más filtros. */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre o teléfono" className="w-full bg-white dark:bg-white/[0.03] border border-[#D9DCE2] dark:border-white/10 rounded-lg h-10 pl-9 pr-3 text-[16px] md:text-[13px] outline-none focus:border-[#0145F2] focus:ring-4 focus:ring-[#0145F2]/10 text-slate-900 dark:text-white placeholder:text-slate-500" />
              </div>
              {/* Celular: un renglón que se desliza de costado (Walter, 24/11/2026: antes eran 4 renglones). */}
              <div className="flex w-full md:w-auto md:flex-1 items-center gap-2 overflow-x-auto md:overflow-visible [scrollbar-width:none] [&>*]:shrink-0">
              {vista === "normal" && (
                <div className="relative">
                  <SelectorWeb valor={filtroEstado} onCambio={setFiltroEstado} claseBoton="appearance-none bg-white dark:bg-white/[0.03] border border-[#D9DCE2] dark:border-white/10 rounded-lg pl-3 pr-8 h-10 text-[13px] font-medium text-slate-800 dark:text-slate-200 outline-none" claseFlecha="w-4 h-4" opciones={(veTodos ? filtrosPorVendedor : ESTADOS).map((e) => ({ valor: e.value, etiqueta: e.label }))} />
                </div>
              )}
              {vista === "normal" && (
                <div className="relative">
                  <ArrowDownWideNarrow className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                  <SelectorWeb
                    valor={orden} onCambio={(v) => setOrden(v as "prioridad" | "recientes")} ariaLabel="Ordenar"
                    claseBoton="appearance-none whitespace-nowrap bg-white dark:bg-white/[0.03] border border-[#D9DCE2] dark:border-white/10 rounded-lg pl-9 pr-3 h-10 text-[13px] font-medium text-slate-800 dark:text-slate-200 outline-none"
                    opciones={[
                      { valor: "recientes", etiqueta: "Más recientes", icono: <Clock3 className="w-3.5 h-3.5 shrink-0" /> },
                      { valor: "prioridad", etiqueta: "A quién llamar primero", icono: <Zap className="w-3.5 h-3.5 shrink-0" /> },
                    ]}
                  />
                </div>
              )}
              <button onClick={() => setShowFiltros((v) => !v)} className={`flex items-center gap-1.5 whitespace-nowrap px-3 h-10 rounded-lg text-[13px] font-medium border transition-colors ${showFiltros ? "bg-[#EEF3FF] border-[#0145F2]/30 text-[#0145F2] dark:bg-[#0145F2]/25 dark:text-[#9db8ff]" : "bg-white dark:bg-white/[0.03] border-[#D9DCE2] dark:border-white/10 text-slate-800 dark:text-slate-200"}`}>
                <Filter className={`w-4 h-4 ${showFiltros ? "" : "text-slate-500"}`} /> Filtros
              </button>
              <div className="flex items-center gap-2 md:ml-auto">
                <button onClick={() => setVista(vista === "sin_respuesta" ? "normal" : "sin_respuesta")} className={`flex items-center gap-1.5 whitespace-nowrap px-3 h-10 rounded-lg text-[13px] font-medium border transition-colors ${vista === "sin_respuesta" ? "bg-rose-600 border-rose-600 text-white" : "bg-white dark:bg-white/[0.03] border-[#D9DCE2] dark:border-white/10 text-slate-800 dark:text-slate-200"}`}>
                  <Flame className={`w-4 h-4 ${vista === "sin_respuesta" ? "" : "text-rose-500"}`} /> Sin respuesta {totalSinRespuesta > 0 && <span className={`text-[11px] font-bold px-1.5 py-px rounded ${vista === "sin_respuesta" ? "bg-white/20" : "bg-rose-500 text-white"}`}>{totalSinRespuesta}</span>}
                </button>
                <button onClick={() => setVista(vista === "basura" ? "normal" : "basura")} className={`flex items-center gap-1.5 px-3 h-10 rounded-lg text-[13px] font-medium border transition-colors ${vista === "basura" ? "bg-slate-800 border-slate-800 text-white dark:bg-white/20" : "bg-white dark:bg-white/[0.03] border-[#D9DCE2] dark:border-white/10 text-slate-800 dark:text-slate-200"}`}>
                  <Trash2 className={`w-4 h-4 ${vista === "basura" ? "" : "text-slate-500"}`} /> Basura {totalBasura > 0 && <span className={`text-[11px] font-semibold px-1.5 py-px rounded ${vista === "basura" ? "bg-white/20" : "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300"}`}>{totalBasura}</span>}
                </button>
              </div>
              </div>
            </div>

            {showFiltros && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E3E5EA] dark:border-white/10 bg-white dark:bg-[#111] p-2.5 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
                <div className="flex items-center gap-1 flex-wrap">
                  <button onClick={() => setFiltroOrigen("todos")} className={`px-2.5 h-8 rounded-md text-[12px] font-medium border ${filtroOrigen === "todos" ? "bg-[#0145F2] border-[#0145F2] text-white" : "bg-white dark:bg-white/5 border-[#E4E6EB] dark:border-white/10 text-slate-600 dark:text-slate-300"}`}>Todos los canales</button>
                  {(["whatsapp", "instagram", "messenger", "rodi", "manual"] as Origen[]).map((o) => (
                    <button key={o} onClick={() => setFiltroOrigen(o)} className={`px-2.5 h-8 rounded-md text-[12px] font-medium border ${filtroOrigen === o ? "bg-[#0145F2] border-[#0145F2] text-white" : "bg-white dark:bg-white/5 border-[#E4E6EB] dark:border-white/10 text-slate-600 dark:text-slate-300"}`}>{ORIGEN_LABEL[o]}</button>
                  ))}
                </div>
                <div className="relative">
                  <Radio className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <SelectorWeb valor={filtroCanal} onCambio={setFiltroCanal} claseBoton="appearance-none bg-white dark:bg-white/5 border border-[#E4E6EB] dark:border-white/10 rounded-md pl-8 pr-7 h-8 text-[12px] font-medium text-slate-600 dark:text-slate-300 outline-none" claseFlecha="w-3 h-3" opciones={[{ valor: "", etiqueta: "De dónde vino: todos" }, ...CANALES_ORIGEN.map((c) => ({ valor: c, etiqueta: etiquetaOrigen(c) }))]} />
                </div>
                <div className="relative">
                  <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <SelectorWeb valor={filtroSucursal} onCambio={setFiltroSucursal} claseBoton="appearance-none bg-white dark:bg-white/5 border border-[#E4E6EB] dark:border-white/10 rounded-md pl-8 pr-7 h-8 text-[12px] font-medium text-slate-600 dark:text-slate-300 outline-none" claseFlecha="w-3 h-3" opciones={[{ valor: "", etiqueta: "Todas las oficinas" }, ...sucursales.map((s) => ({ valor: s.id, etiqueta: s.nombre }))]} />
                </div>
              </div>
            )}

            <div className="rounded-xl border border-[#E3E5EA] dark:border-white/10 bg-white dark:bg-[#111] overflow-hidden shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
              {filtrados.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-16 px-4">
                  {vista === "basura" ? <Trash2 className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" /> : <Radar className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />}
                  <p className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">Sin leads acá</p>
                  <p className="text-[12px] text-slate-400 mt-0.5">
                    {vista === "sin_respuesta" ? "Ningún caliente esperando respuesta." : vista === "basura" ? "Nada mandado a basura." : "Sin resultados con estos filtros."}
                  </p>
                </div>
              ) : (
                <>
                  {/* Encabezado de la tabla (solo en la computadora). */}
                  <div className={`hidden lg:grid ${COLUMNAS_LEADS} gap-x-3 px-5 h-11 items-center border-b border-[#E3E5EA] dark:border-white/10 bg-[#F4F5F8] dark:bg-white/[0.04] text-[11.5px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400`}>
                    <span>Lead</span><span>Canal</span><span>Temperatura</span><span>Estado</span><span>Resumen de la charla</span><span>Último mensaje</span><span className="text-right">Fecha</span><span />
                  </div>
                  {deLaPagina.map((c) => {
                    const Icon = ORIGEN_ICON[c.origen];
                    const abrir = () => setSeleccionado({ id: c.id, origen: c.origen });
                    const motivos = c.prioridad === "alta" ? motivosPrioridad(c) : [];
                    const avisoSinResponder = c.sinRespuesta && vista !== "sin_respuesta";
                    const avisoPrioridad = !c.sinRespuesta && vista === "normal" && c.prioridad;
                    const avisoBasura = c.esBasuraFinal && vista !== "basura";
                    return (
                      <div
                        key={`${c.origen}-${c.id}`} role="button" tabIndex={0} onClick={abrir} onKeyDown={(e) => { if (e.key === "Enter") abrir(); }}
                        className={`group relative grid grid-cols-[1fr_auto] ${COLUMNAS_LEADS} gap-x-3 gap-y-1.5 items-center px-4 lg:px-5 py-3 lg:py-3.5 border-b border-[#EDEEF1] dark:border-white/[0.06] last:border-b-0 cursor-pointer hover:bg-[#F8FAFF] dark:hover:bg-white/[0.03] transition-colors`}
                      >
                        {/* Rayita azul a la izquierda al pasar el mouse. */}
                        <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-[#0145F2] opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
                        {/* Lead: quién lo atiende (círculo), temperatura (puntito), nombre y teléfono; en la computadora, al lado
                            del teléfono van los avisos (sin responder, prioridad con su ícono, basura). */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative shrink-0">
                            <AvatarVendedor vendedorId={c.vendedor_id} nombreRespaldo={vendedores.find((v) => v.id === c.vendedor_id)?.nombre} clase="w-9 h-9" claseTexto="text-xs" />
                            <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#111] ${CALIFICACION_DOT[c.calificacion || ""] || "bg-slate-300"}`} title={c.calificacion || "Sin calificar"} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[14px] font-semibold text-slate-950 dark:text-white truncate"><Compartido id={`nombre-lead-${c.id}`}>{c.nombre}</Compartido></p>
                            <p className="mt-0.5 flex flex-wrap lg:flex-nowrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-slate-600 dark:text-slate-400 tabular-nums min-w-0">
                              <span className="shrink-0 whitespace-nowrap">{c.telefono || "Sin teléfono"}</span>
                              {avisoSinResponder && <span className="inline-flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400 whitespace-nowrap"><Flame className="w-3.5 h-3.5" />Sin responder</span>}
                              {avisoPrioridad && <span title={motivos.length > 0 ? motivos.join(", ") : undefined} className={`inline-flex items-center gap-1 font-medium whitespace-nowrap ${PRIORIDAD_TEXTO[c.prioridad!]}`}>{c.prioridad === "alta" ? <Flame className="w-3.5 h-3.5" /> : c.prioridad === "media" ? <Clock3 className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}{PRIORIDAD_LABEL[c.prioridad!]}</span>}
                              {avisoBasura && <span className="inline-flex items-center gap-1 font-medium text-slate-500 whitespace-nowrap"><Trash2 className="w-3.5 h-3.5" />Basura</span>}
                            </p>
                          </div>
                        </div>
                        {/* Celular: la fecha arriba a la derecha */}
                        <span className={`lg:hidden text-[11px] whitespace-nowrap self-start ${esHoy(c.last_message_at) ? "font-semibold text-slate-900 dark:text-white" : "text-slate-500"}`}>{c.last_message_at ? formatDia(c.last_message_at) : ""}</span>
                        <div className="hidden lg:flex items-center gap-2 min-w-0 text-[13px] text-slate-800 dark:text-slate-200">
                          <Icon className={`w-4 h-4 shrink-0 ${ORIGEN_COLOR[c.origen]}`} />
                          <span className="truncate">{c.canal_origen ? etiquetaOrigen(c.canal_origen) : ORIGEN_LABEL[c.origen]}</span>
                        </div>
                        <div className="hidden lg:block">
                          {c.calificacion && TEMPERATURA[c.calificacion] ? <ChipTemperatura calificacion={c.calificacion} /> : <span className="text-[13px] text-slate-400 dark:text-slate-600">—</span>}
                        </div>
                        <div className="hidden lg:block"><ChipEstado estado={c.estado_lead} /></div>
                        {/* Resumen de la IA (lo que pidió el cliente). La mayoría de los que usan Leads son vendedores: les sirve más
                            que ver de quién es (eso ya lo dice el círculo). Walter, 19/11/2026. */}
                        <p className="hidden lg:line-clamp-2 min-w-0 text-[13px] leading-[1.45] text-slate-700 dark:text-slate-300">{c.resumen || <span className="text-slate-500 italic">Sin resumen todavía</span>}</p>
                        <div className="hidden lg:block min-w-0">
                          {c.ultimoMensaje ? <GloboUltimoMensaje nuestro={c.ultimoMensaje.direccion === "out"} texto={textoUltimoMensaje(c.ultimoMensaje)} /> : <span className="text-[13px] text-slate-400">—</span>}
                        </div>
                        <span className={`hidden lg:block text-[12.5px] text-right tabular-nums ${esHoy(c.last_message_at) ? "font-semibold text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400"}`}>{c.last_message_at ? formatDia(c.last_message_at) : "—"}</span>
                        <ChevronRight className="hidden lg:block w-4 h-4 text-slate-400 group-hover:text-[#0145F2] transition-colors" />
                        {/* Celular: estado, temperatura y avisos en un renglón; vendedor abajo */}
                        <div className="lg:hidden col-span-2 flex flex-wrap items-center gap-1.5 pl-12">
                          <ChipEstado estado={c.estado_lead} />
                          {c.calificacion && TEMPERATURA[c.calificacion] && <ChipTemperatura calificacion={c.calificacion} />}
                          <span className="inline-flex items-center gap-1 text-[12px] text-slate-700 dark:text-slate-300"><Icon className={`w-3.5 h-3.5 ${ORIGEN_COLOR[c.origen]}`} /> {ORIGEN_LABEL[c.origen]}</span>
                        </div>
                        {/* Celular: solo el resumen de la charla en 2 renglones, sin el último mensaje (Walter, 24/11/2026: es lo que más le sirve al vendedor). Los
                            avisos van al lado del teléfono; acá queda solo el porqué de la prioridad alta. */}
                        <p className="lg:hidden col-span-2 pl-12 text-[13px] leading-[1.45] text-slate-700 dark:text-slate-300 line-clamp-2">{c.resumen || <span className="text-slate-500 italic">Sin resumen todavía</span>}</p>
                        {avisoPrioridad && c.prioridad === "alta" && motivos.length > 0 && (
                          <p className="lg:hidden col-span-2 pl-12 text-[11.5px] text-rose-700 dark:text-rose-300">{motivos.join(", ")}</p>
                        )}
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between gap-3 px-5 h-11 border-t border-[#E3E5EA] dark:border-white/10 text-[12.5px] text-slate-600 dark:text-slate-400">
                    <span>Mostrando <b className="font-semibold text-slate-900 dark:text-white">{deLaPagina.length}</b> de <b className="font-semibold text-slate-900 dark:text-white">{filtrados.length}</b> {filtrados.length === 1 ? "lead" : "leads"}</span>
                    <Paginas pagina={pagina} total={totalPaginas} onIr={irAPagina} />
                  </div>
                </>
              )}
            </div>
          </div>
          {showNuevo && (
            <NuevoLeadManualModal vendedores={vendedores} sucursales={sucursales} miId={miId} onClose={() => setShowNuevo(false)} onCreado={onCreadoManual} />
          )}
        </div>
      )}
      </Crossfade>
    </div>
  );
}
