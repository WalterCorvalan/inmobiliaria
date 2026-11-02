"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle, Clock, UserPlus, Phone,
  Calendar, Printer, ChevronLeft, ChevronRight, Search,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import TablaResponsiva, { type ColumnaTabla } from "@/components/panel/TablaResponsiva";
import { Crossfade } from "@/components/ui/movimiento";
import { CLASE_CONTENEDOR_GRAFICO, EJE, TooltipGrafico, colorEstado, colorSerie, textoLeyenda } from "@/components/panel/graficos/paleta";
import SelectorWeb from "@/components/ui/SelectorWeb";

const CALIFICACIONES = [
  { value: "caliente", label: "Caliente" },
  { value: "tibio", label: "Tibio" },
  { value: "frio", label: "Frío" },
];

// Colores de components/panel/graficos/paleta.tsx: estados (vencida, al día, completada) con color de estado; tipos y
// series con los colores de serie en orden fijo.

export type VistaTareas = "tablero" | "calendario" | "historial" | "metricas";

function hrefLead(lead: { id: string; origen: "whatsapp" | "instagram" | "messenger" | "rodi" | "manual" }) {
  // whatsapp/instagram abren en la pestaña de Leads de su propio módulo
  // (ConversacionesShell, separados en dos módulos de sidebar el 25/9);
  // rodi/manual no viven ahí -- se resuelven en la vista unificada de
  // /panel/leads, que sí soporta los 4 orígenes (ver LeadsUnificadosClient.tsx).
  if (lead.origen === "whatsapp") return `/panel/whatsapp?tab=leads&lead=${lead.id}&origen=whatsapp`;
  if (lead.origen === "instagram") return `/panel/instagram?tab=leads&lead=${lead.id}&origen=instagram`;
  return `/panel/leads?lead=${lead.id}&origen=${lead.origen}`;
}

function TarjetaKpi({ titulo, valor, subtitulo, alerta, color }: { titulo: string; valor: number | string; subtitulo?: string; alerta?: boolean; color?: string }) {
  const colorClass = alerta ? "text-rose-600 dark:text-rose-400" : color ? color : "text-rose-600 dark:text-rose-300";
  const bgClass = alerta ? "bg-rose-50 border-rose-100 dark:bg-rose-900/20 dark:border-rose-900/50" : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10";
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 shadow-sm border ${bgClass}`}>
      <p className={`text-3xl font-black ${colorClass}`}>{valor}</p>
      <p className={`text-[11px] font-bold uppercase tracking-widest mt-1 ${alerta ? "text-rose-500" : "text-slate-500 dark:text-slate-400"}`}>{titulo}</p>
      {subtitulo && <p className="text-[10px] text-slate-400 mt-1 font-medium">{subtitulo}</p>}
      {alerta && <div className="absolute top-0 right-0 w-12 h-12 bg-rose-500/10 rounded-bl-full -mr-4 -mt-4" />}
    </div>
  );
}


// Pestañas de Tareas dentro de Leads (antes el módulo /panel/tareas; unificado el 19/10/2026). Qué pestaña se ve
// lo decide la barra de Leads (LeadsUnificadosClient.tsx).
export default function TareasLeadBoard({
  vista, tareasIniciales, tareasCompletadas, leadsSinContacto, vendedores,
}: { vista: VistaTareas; tareasIniciales: any[]; tareasCompletadas: any[]; leadsSinContacto: any[]; vendedores: any[] }) {
  const vendedorInicial = useSearchParams().get("vendedor") || "";
  const [vendedorFiltro, setVendedorFiltro] = useState(vendedorInicial);
  const [calificacionFiltro, setCalificacionFiltro] = useState("");
  const [query, setQuery] = useState("");

  const filtrar = (lista: any[], getVendedorId: (x: any) => string | null, getCalificacion: (x: any) => string | null, getNombre: (x: any) => string | null, getTelefono: (x: any) => string | null) =>
    lista.filter((x) => {
      if (vendedorFiltro && getVendedorId(x) !== vendedorFiltro) return false;
      if (calificacionFiltro && getCalificacion(x) !== calificacionFiltro) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        if (!`${getNombre(x) || ""} ${getTelefono(x) || ""}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });

  const tareas = useMemo(() => filtrar(tareasIniciales, (t) => t.lead?.vendedor_id, (t) => t.lead?.calificacion, (t) => t.lead?.nombre, (t) => t.lead?.telefono), [tareasIniciales, vendedorFiltro, calificacionFiltro, query]);
  const completadas = useMemo(() => filtrar(tareasCompletadas, (t) => t.lead?.vendedor_id, (t) => t.lead?.calificacion, (t) => t.lead?.nombre, (t) => t.lead?.telefono), [tareasCompletadas, vendedorFiltro, calificacionFiltro, query]);
  const sinContacto = useMemo(() => filtrar(leadsSinContacto, (l) => l.vendedor_id, (l) => l.calificacion, (l) => l.nombre, (l) => l.telefono), [leadsSinContacto, vendedorFiltro, calificacionFiltro, query]);

  const { vencidas, hoy, proximas } = useMemo(() => {
    const ahora = new Date();
    const finHoy = new Date(ahora); finHoy.setHours(23, 59, 59, 999);
    const inicioHoy = new Date(ahora); inicioHoy.setHours(0, 0, 0, 0);
    return {
      vencidas: tareas.filter((t) => new Date(t.fecha_vencimiento) < inicioHoy),
      hoy: tareas.filter((t) => { const f = new Date(t.fecha_vencimiento); return f >= inicioHoy && f <= finHoy; }),
      proximas: tareas.filter((t) => new Date(t.fecha_vencimiento) > finHoy),
    };
  }, [tareas]);

  const getNombreVendedor = (id: string) => vendedores.find((v: any) => v.id === id)?.nombre || "Sin asignar";

  const { dataTipos, dataCargaVendedores, dataStatus } = useMemo(() => {
    const conteoTipos = new Map<string, number>();
    [...tareas, ...completadas].forEach((t) => conteoTipos.set(t.tipo || "Otro", (conteoTipos.get(t.tipo || "Otro") || 0) + 1));
    // Se ordena antes de pintar: el color sigue a la posición fija, y más de 7 tipos van juntos en "Otros".
    const ordenados = Array.from(conteoTipos.entries()).sort((a, b) => b[1] - a[1]);
    const principales = ordenados.slice(0, 6);
    const resto = ordenados.slice(6).reduce((t, [, n]) => t + n, 0);
    const dataTipos = [...principales, ...(resto > 0 ? [["Otros", resto] as [string, number]] : [])].map(([name, value], i) => ({ name, value, color: name === "Otros" ? "var(--g-neutro)" : colorSerie(i) }));

    const dataStatus = [
      { name: "Completadas", value: completadas.length, color: colorEstado("ok") },
      { name: "Para hoy / próximas", value: hoy.length + proximas.length, color: colorSerie(0) },
      { name: "Vencidas", value: vencidas.length, color: colorEstado("mal") },
    ].filter((d) => d.value > 0);

    const vendedoresMap = new Map<string, { Pendientes: number; Completadas: number }>();
    tareas.forEach((t) => { const v = getNombreVendedor(t.lead?.vendedor_id); const d = vendedoresMap.get(v) || { Pendientes: 0, Completadas: 0 }; d.Pendientes += 1; vendedoresMap.set(v, d); });
    completadas.forEach((t) => { const v = getNombreVendedor(t.lead?.vendedor_id); const d = vendedoresMap.get(v) || { Pendientes: 0, Completadas: 0 }; d.Completadas += 1; vendedoresMap.set(v, d); });
    const dataCargaVendedores = Array.from(vendedoresMap.entries()).map(([name, d]) => ({ name, ...d, Total: d.Pendientes + d.Completadas })).sort((a, b) => b.Total - a.Total).slice(0, 8);

    return { dataTipos, dataCargaVendedores, dataStatus };
  }, [tareas, completadas, vencidas, hoy, proximas, vendedores]);

  return (
    <div className="flex flex-col h-full w-full bg-white dark:bg-[#0A0A0A] overflow-hidden print:overflow-visible print:h-auto">
      <header className="flex flex-col gap-4 border-b border-slate-200 dark:border-white/10 px-6 py-3 bg-white dark:bg-[#0A0A0A] shrink-0 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Seguimiento de cada lead: llamar, mandar información, volver a escribir.</p>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar lead por nombre o teléfono..." className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg py-2 pl-9 pr-3 text-[13px] outline-none placeholder:text-slate-400" />
            </div>
            <div className="inline-block"><SelectorWeb valor={calificacionFiltro} onCambio={setCalificacionFiltro} claseBoton="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-[13px] outline-none" opciones={[{ valor: "", etiqueta: "Todo grado de interés" }, ...CALIFICACIONES.map((c) => ({ valor: c.value, etiqueta: c.label }))]} /></div>
            <div className="inline-block"><SelectorWeb valor={vendedorFiltro} onCambio={setVendedorFiltro} claseBoton="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-[13px] outline-none" claseFlecha="w-3 h-3" opciones={[{ valor: "", etiqueta: "Todos los vendedores" }, ...vendedores.map((v: any) => ({ valor: v.id, etiqueta: v.nombre }))]} /></div>
            <button onClick={() => window.print()} className="flex items-center gap-1.5 bg-slate-800 dark:bg-white/10 hover:bg-slate-700 dark:hover:bg-white/20 text-white px-3 py-2 rounded-lg text-[12px] font-bold">
              <Printer className="w-3.5 h-3.5" /> Imprimir
            </button>
          </div>
        </div>

      </header>

      <div className="flex-1 overflow-y-auto bg-[#F9FAFB] dark:bg-[#0A0A0A] p-6 print:overflow-visible print:bg-white print:p-0">
        <Crossfade id={vista}>
        {vista === "tablero" && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 max-w-[1800px] mx-auto">
            <Columna titulo="Tareas vencidas" color="rose" icono={<AlertTriangle className="w-4 h-4 text-white" />} items={vencidas} render={(t) => <TareaCard tarea={t} color="rose" />} />
            <Columna titulo="Tareas del día" color="amber" icono={<Clock className="w-4 h-4 text-white" />} items={hoy} render={(t) => <TareaCard tarea={t} color="amber" />} />
            <Columna titulo="Próximas" color="sky" icono={<Calendar className="w-4 h-4 text-white" />} items={proximas} render={(t) => <TareaCard tarea={t} color="sky" />} />
            <Columna titulo="Sin primer contacto" color="slate" icono={<UserPlus className="w-4 h-4 text-white" />} items={sinContacto} render={(l) => <LeadSinContactoCard lead={l} />} />
          </div>
        )}

        {vista === "calendario" && <TareasCalendario tareas={tareas} completadas={completadas} />}
        {vista === "historial" && <TareasHistorial completadas={completadas} />}

        {vista === "metricas" && (
          <div className="max-w-[1400px] mx-auto space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <TarjetaKpi titulo="Pendientes (Total)" valor={tareas.length} subtitulo="Para hoy o futuras" />
              <TarjetaKpi titulo="Vencidas" valor={vencidas.length} alerta={vencidas.length > 0} subtitulo="Requieren atención urgente" />
              <TarjetaKpi titulo="Completadas" valor={completadas.length} color="text-emerald-600 dark:text-emerald-400" subtitulo="Histórico de tareas cerradas" />
              <TarjetaKpi titulo="Leads Huérfanos" valor={sinContacto.length} alerta={sinContacto.length > 0} subtitulo="Nuevos leads sin tarea asignada" />
            </div>

            <div className={`grid grid-cols-1 md:grid-cols-3 gap-5 ${CLASE_CONTENEDOR_GRAFICO}`}>
              <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm p-5 h-[340px] flex flex-col">
                <h3 className="text-[11px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400 mb-2">Estado de Tareas</h3>
                <div className="flex-1 w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={dataStatus} innerRadius="65%" outerRadius="85%" paddingAngle={3} dataKey="value" stroke="none">
                        {dataStatus.map((entry, index) => (<Cell key={index} fill={entry.color} />))}
                      </Pie>
                      <Tooltip content={<TooltipGrafico />} isAnimationActive={false} />
                      <Legend formatter={textoLeyenda} iconType="plainline" wrapperStyle={{ fontSize: "11px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black text-slate-800 dark:text-white">{tareas.length + completadas.length}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total</span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm p-5 h-[340px] flex flex-col">
                <h3 className="text-[11px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400 mb-2">Distribución por Tipo</h3>
                <div className="flex-1 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={dataTipos} innerRadius="55%" outerRadius="85%" paddingAngle={2} dataKey="value" stroke="none">
                        {dataTipos.map((entry, index) => (<Cell key={index} fill={entry.color} />))}
                      </Pie>
                      <Tooltip content={<TooltipGrafico />} isAnimationActive={false} />
                      <Legend formatter={textoLeyenda} iconType="plainline" wrapperStyle={{ fontSize: "11px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm p-5 h-[340px] flex flex-col col-span-1 md:col-span-3 lg:col-span-1">
                <h3 className="text-[11px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400 mb-4">Carga por Vendedor</h3>
                <div className="flex-1 w-full min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dataCargaVendedores} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" {...EJE} width={80} />
                      <Tooltip content={<TooltipGrafico />} cursor={{ fill: "currentColor", fillOpacity: 0.08 }} isAnimationActive={false} />
                      <Bar dataKey="Pendientes" stackId="a" fill={colorSerie(0)} stroke="var(--g-fondo)" strokeWidth={1} barSize={16} />
                      <Bar dataKey="Completadas" stackId="a" fill={colorSerie(1)} stroke="var(--g-fondo)" strokeWidth={1} radius={[0, 4, 4, 0]} barSize={16} />
                      <Legend formatter={textoLeyenda} iconType="plainline" wrapperStyle={{ fontSize: "11px" }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}
        </Crossfade>
      </div>
    </div>
  );
}

const COLOR_HEADER: Record<string, string> = { rose: "bg-rose-500", amber: "bg-amber-500", sky: "bg-sky-500", slate: "bg-slate-500" };

function Columna({ titulo, icono, items, render, color }: { titulo: string; icono: React.ReactNode; items: any[]; render: (item: any) => React.ReactNode; color: string }) {
  return (
    <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm flex flex-col h-[calc(100vh-220px)]">
      <div className={`px-4 py-3 flex items-center justify-between shrink-0 ${COLOR_HEADER[color]}`}>
        <h2 className="text-[12px] font-bold text-white flex items-center gap-2">{icono} {titulo}</h2>
        <span className="text-[11px] font-bold text-white bg-white/20 px-2 py-0.5 rounded-full">{items.length}</span>
      </div>
      <div className="p-3 space-y-2 flex-1 overflow-y-auto">
        {items.length === 0 ? <p className="text-[12px] text-slate-400 italic text-center py-6">Sin pendientes.</p> : items.map((item) => <div key={item.id}>{render(item)}</div>)}
      </div>
    </div>
  );
}

const COLOR_BORDE: Record<string, string> = { rose: "border-l-rose-400", amber: "border-l-amber-400", sky: "border-l-sky-400" };

function TareaCard({ tarea, color }: { tarea: any; color: string }) {
  const lead = tarea.lead;
  return (
    <Link href={hrefLead(lead)} className={`block bg-slate-50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 hover:shadow-sm border border-slate-200 dark:border-white/10 border-l-4 rounded-xl p-3 transition-all ${COLOR_BORDE[color]}`}>
      <p className="text-[12px] font-bold text-slate-800 dark:text-white">{tarea.tipo}</p>
      <p className="text-[12px] text-slate-600 dark:text-slate-300 truncate">{lead?.nombre}</p>
      <span className="text-[10px] text-slate-400">{new Date(tarea.fecha_vencimiento).toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
    </Link>
  );
}

function LeadSinContactoCard({ lead }: { lead: any }) {
  return (
    <Link href={hrefLead(lead)} className="block bg-slate-50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 hover:shadow-sm border border-slate-200 dark:border-white/10 border-l-4 border-l-sky-400 rounded-xl p-3 transition-all">
      <p className="text-[12px] font-bold text-slate-800 dark:text-white truncate">{lead.nombre}</p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" /> {lead.telefono || "Sin teléfono"}</p>
      <span className="text-[10px] text-slate-400 mt-1 block">Ingresó: {new Date(lead.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}</span>
    </Link>
  );
}

function inicioDeSemana(fecha: Date) {
  const d = new Date(fecha);
  const dia = d.getDay();
  const diff = dia === 0 ? -6 : 1 - dia;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function TareasCalendario({ tareas, completadas }: { tareas: any[]; completadas: any[] }) {
  const [semanaBase, setSemanaBase] = useState(() => inicioDeSemana(new Date()));
  const todasLasTareas = useMemo(() => [...tareas, ...completadas], [tareas, completadas]);

  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(semanaBase); d.setDate(d.getDate() + i); return d; }), [semanaBase]);

  const tareasPorDia = (dia: Date) => {
    const inicio = new Date(dia); inicio.setHours(0, 0, 0, 0);
    const fin = new Date(dia); fin.setHours(23, 59, 59, 999);
    return todasLasTareas.filter((t) => { const f = new Date(t.fecha_vencimiento); return f >= inicio && f <= fin; }).sort((a, b) => new Date(a.fecha_vencimiento).getTime() - new Date(b.fecha_vencimiento).getTime());
  };

  const colorTarea = (t: any) => t.completada ? "bg-slate-400 dark:bg-slate-600" : new Date(t.fecha_vencimiento) < new Date() ? "bg-rose-500" : "bg-amber-500";
  const nombreDia = (d: Date) => d.toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "2-digit" }).toUpperCase();

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex flex-col gap-3 mb-4 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 justify-center sm:justify-start">
          <button onClick={() => setSemanaBase((s) => { const n = new Date(s); n.setDate(n.getDate() - 7); return n; })} className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => setSemanaBase(inicioDeSemana(new Date()))} className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-[12px] font-bold text-slate-600 dark:text-slate-300">Hoy</button>
          <button onClick={() => setSemanaBase((s) => { const n = new Date(s); n.setDate(n.getDate() + 7); return n; })} className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300"><ChevronRight className="w-4 h-4" /></button>
          <span className="text-[13px] font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap ml-1">{dias[0].toLocaleDateString("es-AR", { day: "2-digit", month: "short" })} – {dias[6].toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-bold uppercase text-slate-400 justify-center sm:justify-end flex-wrap">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> Vencida</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Pendiente</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400" /> Completada</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
        {dias.map((dia) => {
          const items = tareasPorDia(dia);
          const esHoy = dia.toDateString() === new Date().toDateString();
          return (
            <div key={dia.toISOString()} className={`bg-white dark:bg-white/5 border rounded-xl overflow-hidden ${esHoy ? "border-rose-400 ring-1 ring-rose-400" : "border-slate-200 dark:border-white/10"}`}>
              <div className={`px-2 py-1.5 text-center text-[10px] font-bold ${esHoy ? "bg-[#0145F2] text-white" : "bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400"}`}>{nombreDia(dia)}</div>
              {items.length === 0 ? <p className="px-2 py-2.5 text-center text-[10px] text-slate-300 dark:text-slate-600 italic">Sin tareas</p> : (
                <div className="p-1.5 space-y-1">
                  {items.map((t) => (
                    <Link key={t.id} href={hrefLead(t.lead)} className={`block ${colorTarea(t)} text-white rounded px-1.5 py-1 text-[10px] leading-tight hover:opacity-90`}>
                      <div className="font-bold">{new Date(t.fecha_vencimiento).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</div>
                      <div className="truncate">{t.lead?.nombre || "Lead"}</div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TareasHistorial({ completadas }: { completadas: any[] }) {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const filtradas = useMemo(() => completadas.filter((t) => {
    const f = new Date(t.fecha_vencimiento);
    if (desde && f < new Date(`${desde}T00:00:00`)) return false;
    if (hasta && f > new Date(`${hasta}T23:59:59`)) return false;
    return true;
  }).sort((a, b) => new Date(b.fecha_vencimiento).getTime() - new Date(a.fecha_vencimiento).getTime()), [completadas, desde, hasta]);

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4 print:hidden">
        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Desde</label>
        <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-[12px] outline-none" />
        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Hasta</label>
        <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-[12px] outline-none" />
        <span className="text-[11px] font-bold text-slate-400 sm:ml-auto bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 px-3 py-1.5 rounded-lg">{filtradas.length} tarea(s) completada(s)</span>
      </div>

      {filtradas.length === 0 ? (
        <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-8 text-center text-slate-400 text-[13px] shadow-sm">Sin tareas completadas en este rango.</div>
      ) : (
        <TablaResponsiva<typeof filtradas[number]>
          filas={filtradas}
          keyExtractor={(t) => t.id}
          encabezadoMobile={(t) => <Link href={hrefLead(t.lead)} className="text-[#0145F2] hover:underline text-[13px] font-bold">{t.lead?.nombre || "Lead"}</Link>}
          columnas={
            [
              { key: "fecha", header: "Fecha", cell: (t) => new Date(t.fecha_vencimiento).toLocaleString("es-AR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }), claseTd: "text-[12px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap" },
              { key: "lead", header: "Lead", cell: (t) => <Link href={hrefLead(t.lead)} className="text-[#0145F2] hover:underline">{t.lead?.nombre || "Lead"}</Link>, claseTd: "text-[13px] font-bold", ocultarEnMobile: true },
              { key: "tipo", header: "Tipo", cell: (t) => <span className="bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-md">{t.tipo}</span>, claseTd: "text-[12px] font-semibold text-slate-700 dark:text-slate-200" },
              { key: "comentario", header: "Comentario", cell: (t) => t.resultado || t.titulo || "—", claseTd: "text-[12px] text-slate-500 dark:text-slate-400 truncate max-w-xs" },
            ] as ColumnaTabla<typeof filtradas[number]>[]
          }
        />
      )}
    </div>
  );
}
