"use client";

import { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import AvatarVendedor from "@/components/panel/conversaciones/AvatarVendedor";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase2 } from "@/lib/supabase/client";
import { List, Columns3, TrendingUp, Trophy, Filter, Search, Radar, MessageCircle, AtSign, Bot, User, Plus, Radio, Building2, ChevronDown, Flame, Trash2, Megaphone, PanelLeftClose, PanelLeftOpen, ArrowDownWideNarrow, Clock3, Zap, ClipboardList, LayoutGrid, CalendarDays, History, PieChart } from "lucide-react";
import { IconoWhatsapp, IconoInstagram, IconoMessenger } from "@/components/ui/IconosCanales";
import LeadDetailModal, { CANALES_ORIGEN } from "@/components/panel/conversaciones/LeadDetailModal";
import NuevoLeadManualModal from "./NuevoLeadManualModal";
import { PipelineLeads, IngresosLeads, RankingLeads } from "./LeadsVistas";
import type { VistaTareas } from "./TareasLeadBoard";
import type { DatosTareasLead } from "./tareasLead";
import { Crossfade, Compartido } from "@/components/ui/movimiento";
import { diasDesde, calcularScore, prioridadDeScore, motivosPrioridad, ordenarPorPrioridad } from "@/lib/panel/prioridadLeads";
import { avisar } from "@/components/panel/Dialogos";
import { escucharTablas } from "@/lib/panel/escucharTablas";
import { etiquetaOrigen } from "@/lib/panel/origenesCliente";
import SelectorWeb from "@/components/ui/SelectorWeb";

interface Perfil { id: string; nombre: string; roles: string[] }
interface Sucursal { id: string; nombre: string }
type Origen = "whatsapp" | "instagram" | "messenger" | "rodi" | "manual";
interface LeadNormalizado {
  id: string; origen: Origen; nombre: string; telefono: string | null; vendedor_id: string | null;
  calificacion: string | null; estado_lead: string; canal_origen: string | null; sucursal_id: string | null;
  created_at: string; last_message_at: string | null; esBasura: boolean; ultimaDireccion: "in" | "out" | null;
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
// Punto medio entre la versión original (5 colores distintos, muy
// "semáforo") y la que le siguió (todo gris, muy apagada): los 3 estados
// intermedios (nuevo/asignado/calificando) comparten un mismo tono suave en
// vez de tener cada uno el suyo -- ya no compiten entre sí -- pero "convertido"
// (bien) y "perdido" (mal) conservan su color semántico de siempre.
const ESTADO_COLOR: Record<string, string> = {
  nuevo: "bg-[#0145F2]/10 text-[#0145F2] dark:bg-[#0145F2]/20 dark:text-sky-300",
  asignado: "bg-[#0145F2]/10 text-[#0145F2] dark:bg-[#0145F2]/20 dark:text-sky-300",
  calificando: "bg-[#0145F2]/10 text-[#0145F2] dark:bg-[#0145F2]/20 dark:text-sky-300",
  convertido: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  perdido: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
};
const ESTADO_LABEL: Record<string, string> = { nuevo: "Nuevo", asignado: "Contactado", calificando: "Interesado", convertido: "Cliente", perdido: "Perdido" };
const CALIFICACION_DOT: Record<string, string> = { caliente: "bg-rose-500", tibio: "bg-amber-500", frio: "bg-slate-300" };

const ORIGEN_ICON: Record<Origen, any> = { whatsapp: IconoWhatsapp, instagram: IconoInstagram, messenger: IconoMessenger, rodi: Bot, manual: User };
const ORIGEN_LABEL: Record<Origen, string> = { whatsapp: "WhatsApp", instagram: "Instagram", messenger: "Messenger", rodi: "Paffy", manual: "Manual" };
// Vuelve el color de marca por canal (se había sacado del todo), pero en un
// tono más suave (400 en vez de 600) que el original -- alcanza para
// reconocer el canal de un vistazo sin que la bandeja parezca un semáforo.
const ORIGEN_COLOR: Record<Origen, string> = {
  whatsapp: "text-emerald-500/80 dark:text-emerald-400/80", instagram: "text-pink-500/80 dark:text-pink-400/80",
  messenger: "text-blue-500/80 dark:text-blue-400/80", rodi: "text-indigo-500/80 dark:text-indigo-400/80", manual: "text-slate-400 dark:text-slate-500",
};

const PRIORIDAD_LABEL: Record<string, string> = { alta: "Prioridad alta", media: "Prioridad media", baja: "Prioridad baja" };
const PRIORIDAD_COLOR: Record<string, string> = {
  alta: "text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10",
  media: "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10",
  baja: "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10",
};
function formatDia(iso: string) {
  const d = new Date(iso);
  const hoy = new Date();
  if (d.toDateString() === hoy.toDateString()) return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

// Reasignar vendedor sin tener que abrir el detalle completo -- pedido de
// Walter (1/10). Reusa la misma ruta /api/panel/leads/reasignar que ya
// usa LeadDetailModal.tsx (valida ahí quién puede reasignar a quién, ver
// el comentario en esa ruta). El selector vive afuera del <button> de la
// fila (ahora un <div role="button">) porque un <select>/<button> anidado
// dentro de otro <button> es HTML inválido y el click se filtra al padre.
function VendedorLeadSelector({
  lead, vendedores, misRoles, onReasignado,
}: { lead: LeadNormalizado; vendedores: Perfil[]; misRoles: string[]; onReasignado: (id: string, vendedorId: string | null) => void }) {
  const [guardando, setGuardando] = useState(false);
  const soyAdmin = misRoles.some((r: string) => r === "admin" || r === "director");
  const opciones = vendedores.filter((v) => v.roles?.includes("ventas") || v.roles?.includes("encargado"));
  // El vendedor actual tiene que estar en la lista aunque no sea de ventas (un admin con leads propios): si no, se vería "Elegir…".
  const actual = vendedores.find((v) => v.id === lead.vendedor_id);
  if (actual && !opciones.some((v) => v.id === actual.id)) opciones.unshift(actual);

  const reasignar = async (vendedorId: string) => {
    setGuardando(true);
    try {
      const res = await fetch("/api/panel/leads/reasignar", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origen: lead.origen, leadId: lead.id, vendedorId: vendedorId || null }),
      });
      const data = await res.json();
      if (!res.ok) { avisar(data.error || "No se pudo reasignar."); return; }
      onReasignado(lead.id, vendedorId || null);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="inline-block max-w-[150px]" onClick={(e) => e.stopPropagation()}>
      <SelectorWeb
        ariaLabel="Vendedor del lead" placeholder="Sin asignar" valor={lead.vendedor_id || ""} onCambio={reasignar} deshabilitado={guardando}
        claseBoton="text-[11px] text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-sky-300 text-left"
        claseFlecha="w-3 h-3"
        opciones={[...(soyAdmin ? [{ valor: "", etiqueta: "Sin asignar" }] : []), ...opciones.map((v) => ({ valor: v.id, etiqueta: v.nombre }))]}
      />
    </div>
  );
}

export default function LeadsUnificadosClient({ leadsIniciales, vendedores, sucursales, miId, tareas, topeAlcanzado = false, ventasCerradas = [], avisosCarga = [] }: { leadsIniciales: LeadNormalizado[]; vendedores: Perfil[]; sucursales: Sucursal[]; miId: string; tareas: DatosTareasLead; topeAlcanzado?: boolean; ventasCerradas?: { vendedor_id: string | null; fecha_cierre: string | null }[]; avisosCarga?: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const misRoles = vendedores.find((v) => v.id === miId)?.roles || [];
  const [leads, setLeads] = useState(leadsIniciales);
  // Pestañas de arriba: la bandeja de siempre (lista + detalle) o las vistas de tablero/estadísticas (LeadsVistas.tsx).
  const [modo, setModo] = useState<ModoLeads | ModoTareas>(() => { const m = searchParams.get("modo"); return esModoTareas(m) ? m : "lista"; });
  const [vista, setVista] = useState<"normal" | "sin_respuesta" | "basura">("normal");
  // Admin y encargado ven todos los leads: arrancan en "Míos" (Walter, 21/10/2026). El vendedor ya ve solo los suyos.
  const veTodos = misRoles.some((r: string) => r === "admin" || r === "director" || r === "encargado");
  const [filtroEstado, setFiltroEstado] = useState(veTodos ? "mios" : "todos");
  const [filtroOrigen, setFiltroOrigen] = useState<Origen | "todos">("todos");
  const [filtroCanal, setFiltroCanal] = useState("");
  const [filtroSucursal, setFiltroSucursal] = useState("");
  const [orden, setOrden] = useState<"prioridad" | "recientes">("recientes");
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState<{ id: string; origen: Origen } | null>(null);
  const [showNuevo, setShowNuevo] = useState(false);
  const [showFiltros, setShowFiltros] = useState(false);
  // Achicar/ocultar la bandeja para ganar espacio de pantalla en el detalle
  // (pedido del 29/9) -- solo aplica en desktop (md+), en mobile ya alterna
  // sola entre lista y detalle. Se recuerda entre visitas (localStorage) para
  // no tener que volver a ocultarla cada vez que se entra al módulo.
  const [bandejaColapsada, setBandejaColapsada] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem("leads_bandeja_colapsada") === "1"; } catch { return false; }
  });
  const toggleBandeja = () => {
    setBandejaColapsada((prev) => {
      const next = !prev;
      try { localStorage.setItem("leads_bandeja_colapsada", next ? "1" : "0"); } catch { /* noop */ }
      return next;
    });
  };

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
    { value: "mios", label: "Míos" },
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

  const filaClase = (id: string) => seleccionado?.id === id
    ? "border-[#0145F2] bg-[#0145F2]/[0.06] dark:bg-[#0145F2]/15 shadow-[0_0_22px_-8px_rgba(1,69,242,0.85)]"
    : "border-transparent hover:bg-slate-50 dark:hover:bg-white/5";

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
    <div className="flex flex-col w-full h-full text-slate-800 dark:text-slate-200 overflow-hidden">
      <div className={`shrink-0 items-center gap-2 px-2.5 py-2 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-[#111] overflow-x-auto ${seleccionado && modo === "lista" ? "hidden md:flex" : "flex"}`}>
        <div className="shrink-0 flex items-center gap-0.5 rounded-xl bg-slate-100 dark:bg-white/5 p-0.5">
          {GRUPOS.map((g) => {
            const Icon = g.icon;
            const activo = g.id === grupoActual.id;
            return (
              <button key={g.id} onClick={() => !activo && setModo(g.modos[0].v)} aria-pressed={activo}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${activo ? "bg-white dark:bg-[#1c1c1f] text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}>
                <Icon className="w-3.5 h-3.5" /> {g.label}
              </button>
            );
          })}
        </div>
        {grupoActual.modos.length > 1 && (
          <div className="shrink-0 flex items-center gap-1">
            {grupoActual.modos.map((t) => {
              const Icon = t.icon;
              return (
                <button key={t.v} onClick={() => setModo(t.v)} className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${modo === t.v ? "bg-[#0145F2] text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"}`}>
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
      {modo === "ranking" && puedeVerRanking && <RankingLeads leads={clasificados} vendedores={vendedores} ventasCerradas={ventasCerradas} />}
      {esModoTareas(modo) && <TareasLeadBoard vista={modo.replace("tareas_", "") as VistaTareas} {...tareas} />}

      {modo === "lista" && (
    <div className="flex flex-1 min-h-0 w-full overflow-hidden">
      {/* COLUMNA 1: BANDEJA — mismo criterio visual que app/panel/whatsapp/ChatClient.tsx
          (sidebar angosta, filas con avatar circular, sticky group headers) para que
          este módulo se sienta como una extensión natural del panel de WhatsApp. */}
      <div className={`w-full md:w-[360px] flex-col bg-white dark:bg-[#111] border-r border-slate-200 dark:border-white/10 shrink-0 ${seleccionado ? "hidden md:flex" : "flex"} ${bandejaColapsada ? "md:hidden" : ""}`}>
        <div className="p-2.5 border-b border-slate-100 dark:border-white/10 shrink-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><img src="/icons/panel/leads.png" alt="" className="w-6 h-6 object-contain shrink-0" /> Leads</h1>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setShowNuevo(true)} className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-[#0145F2] hover:bg-[#0138c9] text-white rounded-xl boton-principal"><Plus className="w-4 h-4" /> Nuevo</button>
              <button onClick={toggleBandeja} title="Ocultar bandeja" className="hidden md:flex shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10"><PanelLeftClose className="w-4 h-4" /></button>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{leads.length} leads · {nuevosHoy} hoy · {sinAsignar} sin asignar</p>
          {avisosCarga.length > 0 && (
            <div className="text-[10px] font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-lg px-2 py-1.5 space-y-0.5">
              <p className="font-black uppercase tracking-widest">Algunos canales no cargaron bien</p>
              {avisosCarga.map((a) => <p key={a}>{a}</p>)}
            </div>
          )}
          {topeAlcanzado && <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg px-2 py-1">Se muestran los 1000 leads más recientes de cada canal; hay más antiguos que no se listan acá.</p>}

          <div className="flex gap-1.5">
            <button onClick={() => setVista("sin_respuesta")} className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-bold rounded-lg transition-colors ${vista === "sin_respuesta" ? "bg-rose-600 text-white" : "bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10"}`}>
              <Flame className="w-3.5 h-3.5" /> Sin respuesta {totalSinRespuesta > 0 && <span className={`text-[9px] font-black px-1 rounded-full ${vista === "sin_respuesta" ? "bg-white/20" : "bg-rose-500 text-white"}`}>{totalSinRespuesta}</span>}
            </button>
            <button onClick={() => setVista("basura")} className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-bold rounded-lg transition-colors ${vista === "basura" ? "bg-slate-700 dark:bg-white/20 text-white" : "bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10"}`}>
              <Trash2 className="w-3.5 h-3.5" /> Basura {totalBasura > 0 && <span className={`text-[9px] font-black px-1 rounded-full ${vista === "basura" ? "bg-white/20" : "bg-slate-400 text-white"}`}>{totalBasura}</span>}
            </button>
            {vista !== "normal" && <button onClick={() => setVista("normal")} className="shrink-0 px-2 py-1.5 text-[11px] font-bold rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500">✕</button>}
          </div>

          {vista === "normal" && (
            <div className="flex flex-wrap gap-1">
              {(veTodos ? filtrosPorVendedor : ESTADOS).map((e) => (
                <button key={e.value} onClick={() => setFiltroEstado(e.value)} className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-colors ${filtroEstado === e.value ? "bg-slate-800 dark:bg-white text-white dark:text-slate-900 border-slate-800 dark:border-white" : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300"}`}>{e.label}</button>
              ))}
            </div>
          )}

          {vista === "normal" && (
            <div className="flex items-center gap-1 text-[10px]">
              <ArrowDownWideNarrow className="w-3 h-3 text-slate-400 shrink-0" />
              <button onClick={() => setOrden("recientes")} className={`flex items-center gap-1 px-2 py-1 rounded-md font-bold border transition-colors ${orden === "recientes" ? "bg-[#0145F2] border-[#0145F2] text-white" : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500"}`}>
                <Clock3 className="w-3 h-3" /> Más recientes
              </button>
              <button onClick={() => setOrden("prioridad")} className={`flex items-center gap-1 px-2 py-1 rounded-md font-bold border transition-colors ${orden === "prioridad" ? "bg-[#0145F2] border-[#0145F2] text-white" : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500"}`}>
                <Zap className="w-3 h-3" /> A quién llamar primero
              </button>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar lead..." className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[#0145F2] dark:focus:border-sky-400 text-slate-900 dark:text-white placeholder:text-slate-400" />
            </div>
            <button onClick={() => setShowFiltros((v) => !v)} title="Más filtros" className={`shrink-0 p-1.5 rounded-lg transition-colors ${showFiltros ? "bg-slate-800 dark:bg-white/10 text-white" : "bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400"}`}>
              <Filter className="w-3.5 h-3.5" />
            </button>
          </div>

          {showFiltros && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1 flex-wrap">
                <button onClick={() => setFiltroOrigen("todos")} className={`px-2 py-1 rounded-full text-[10px] font-semibold border ${filtroOrigen === "todos" ? "bg-[#0145F2] border-[#0145F2] text-white" : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500"}`}>Todos</button>
                {(["whatsapp", "instagram", "messenger", "rodi", "manual"] as Origen[]).map((o) => (
                  <button key={o} onClick={() => setFiltroOrigen(o)} className={`px-2 py-1 rounded-full text-[10px] font-semibold border ${filtroOrigen === o ? "bg-[#0145F2] border-[#0145F2] text-white" : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500"}`}>{ORIGEN_LABEL[o]}</button>
                ))}
              </div>
              <div className="relative">
                <Radio className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <div className="w-full"><SelectorWeb valor={filtroCanal} onCambio={setFiltroCanal} claseBoton="w-full appearance-none bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg pl-7 pr-6 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 outline-none" claseFlecha="w-3 h-3" opciones={[{ valor: "", etiqueta: "Todos los canales" }, ...CANALES_ORIGEN.map((c) => ({ valor: c, etiqueta: etiquetaOrigen(c) }))]} /></div>
                <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <div className="relative">
                <Building2 className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <div className="w-full"><SelectorWeb valor={filtroSucursal} onCambio={setFiltroSucursal} claseBoton="w-full appearance-none bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg pl-7 pr-6 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 outline-none" claseFlecha="w-3 h-3" opciones={[{ valor: "", etiqueta: "Todas las sucursales" }, ...sucursales.map((s) => ({ valor: s.id, etiqueta: s.nombre }))]} /></div>
                <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filtrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16 px-4">
              {vista === "basura" ? <Trash2 className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" /> : <Radar className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />}
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Sin leads acá</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {vista === "sin_respuesta" ? "Ningún caliente esperando respuesta." : vista === "basura" ? "Nada mandado a basura." : "Sin resultados con estos filtros."}
              </p>
            </div>
          ) : (
            filtrados.map((c) => {
              const Icon = ORIGEN_ICON[c.origen];
              return (
                <div
                  key={`${c.origen}-${c.id}`} role="button" tabIndex={0}
                  onClick={() => setSeleccionado({ id: c.id, origen: c.origen })}
                  onKeyDown={(e) => { if (e.key === "Enter") setSeleccionado({ id: c.id, origen: c.origen }); }}
                  className={`mx-2 my-1.5 rounded-xl border p-3 transition-all flex gap-3 cursor-pointer ${filaClase(c.id)}`}
                >
                  <div className="relative shrink-0">
                    {/* Como en las bandejas de chat: el círculo muestra a quién está asignado el lead (Walter, 17/10/2026). */}
                    <AvatarVendedor vendedorId={c.vendedor_id} nombreRespaldo={vendedores.find((v) => v.id === c.vendedor_id)?.nombre} clase="w-11 h-11" />
                    <span className={`absolute top-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-[#111] ${CALIFICACION_DOT[c.calificacion || ""] || "bg-slate-300"}`} title={c.calificacion || "Sin calificar"} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-semibold text-[14px] truncate flex items-center gap-1.5 text-slate-900 dark:text-white">
                        <Icon className={`w-3.5 h-3.5 shrink-0 ${ORIGEN_COLOR[c.origen]}`} /> <Compartido id={`nombre-lead-${c.id}`}>{c.nombre}</Compartido>
                      </span>
                      <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">{c.last_message_at ? formatDia(c.last_message_at) : ""}</span>
                    </div>
                    <div className="flex items-center justify-between gap-1.5 mt-0.5">
                      <VendedorLeadSelector lead={c} vendedores={vendedores} misRoles={misRoles} onReasignado={(id, vendedorId) => actualizarUno(id, { vendedor_id: vendedorId })} />
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md shrink-0 ${ESTADO_COLOR[c.estado_lead] || ESTADO_COLOR.nuevo}`}>{ESTADO_LABEL[c.estado_lead] || "Nuevo"}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {c.sinRespuesta && vista !== "sin_respuesta" && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 px-2 py-0.5 rounded-md"><Flame className="w-3 h-3" /> Sin responder</span>
                      )}
                      {!c.sinRespuesta && vista === "normal" && c.prioridad && (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${PRIORIDAD_COLOR[c.prioridad]}`}>
                          {c.prioridad === "alta" ? <Flame className="w-3 h-3" /> : c.prioridad === "media" ? <Clock3 className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
                          {PRIORIDAD_LABEL[c.prioridad]}{c.prioridad === "alta" && motivosPrioridad(c).length > 0 ? ` · ${motivosPrioridad(c).join(", ")}` : ""}
                        </span>
                      )}
                      {c.esBasuraFinal && vista !== "basura" && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded-md"><Trash2 className="w-3 h-3" /> Basura</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* COLUMNA 2: DETALLE */}
      <div className={`relative flex-1 flex-col bg-[#F8FAFC] dark:bg-[#0a0a0f] ${!seleccionado ? "hidden md:flex" : "flex"}`}>
        {/* Arriba, a la altura del botón que la oculta (Walter, 17/10/2026); antes quedaba en el medio de la pantalla. */}
        {bandejaColapsada && (
          <button
            onClick={toggleBandeja}
            title="Mostrar bandeja"
            className="hidden md:flex absolute left-0 top-2.5 z-10 items-center p-1.5 rounded-r-lg bg-white dark:bg-[#111] border border-l-0 border-slate-200 dark:border-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white shadow-sm"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        )}
        {!seleccionado ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 gap-2">
            <Megaphone className="w-8 h-8" />
            <p className="text-sm font-medium">Elegí un lead para ver el detalle</p>
          </div>
        ) : (
          // key: al pasar a otro lead la ficha arranca de cero (antes quedaba el anterior a la vista hasta que cargaba el nuevo).
          <LeadDetailModal
            key={`${seleccionado.origen}-${seleccionado.id}`}
            leadId={seleccionado.id} origen={seleccionado.origen} miId={miId} vendedores={vendedores} sucursales={sucursales}
            onClose={cerrarDetalle} onActualizado={actualizarUno} inline variante="leads"
          />
        )}
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
