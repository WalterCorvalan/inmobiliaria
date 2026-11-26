"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CalendarCheck, CalendarClock, CalendarX, Home, ChevronLeft, ChevronRight, MapPin, MessageCircle, Plus, UserCheck, UserRound } from "lucide-react";
import SelectorWeb from "@/components/ui/SelectorWeb";
import KpiFila from "@/components/inmo/KpiFila";
import { supabase2 } from "@/lib/supabase/client";
import {
  ESTADOS_VISITA, agruparPorDia, aFechaISO, desdeFechaISO, diasDeSemana, etiquetaDia, etiquetaSemana, filtrarVisitas, linkConfirmarPorWhatsapp,
  resumenVisitas, sumarDias, visitasEnConflicto, type EstadoVisita, type Visita,
} from "@/lib/visitas/visitas";
import VisitaModal, { type PropiedadOpcion } from "./VisitaModal";

interface Opcion { id: string; nombre: string }

// Diseño nuevo (26/11/2026, el de Leads del panel completo de Pfaffen): cada día es una tarjeta blanca con línea fina, cada
// visita un renglón con la hora grande, el cliente, el auto y el estado como píldora de color que se toca para cambiar.
const ESTADO_PUNTO: Record<EstadoVisita, string> = { Pendiente: "bg-amber-500", Confirmada: "bg-[#0145F2]", "Asistió": "bg-emerald-500", Cancelada: "bg-rose-500" };
const filtroBoton = "h-9 px-3 rounded-lg border border-[#E4E6EB] dark:border-white/10 bg-white dark:bg-[#111] text-[13px] font-medium text-slate-700 dark:text-slate-200 outline-none";
const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const inicialesDe = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";

export default function VisitasClient({ iniciales, lunesISO, asesores, sucursales, propiedades, negocio, miId, aviso }: {
  iniciales: Visita[]; lunesISO: string; asesores: Opcion[]; sucursales: string[]; propiedades: PropiedadOpcion[]; negocio: string; miId: string; aviso: string | null;
}) {
  const [lista, setLista] = useState<Visita[]>(iniciales);
  const [sucursal, setSucursal] = useState<string>("todas");
  const [vendedorId, setVendedorId] = useState<string>("todos");
  const [estado, setEstado] = useState<EstadoVisita | "todos">("todos");
  // Desde la ficha del lead ("Agendar visita") se llega con ?nuevo=1: el formulario arranca abierto.
  const params = useSearchParams();
  const [modal, setModal] = useState<{ visita: Visita | null; fecha?: string } | null>(() => (params.get("nuevo") === "1" ? { visita: null, fecha: aFechaISO(new Date()) } : null));
  const [error, setError] = useState("");

  const lunes = useMemo(() => desdeFechaISO(lunesISO), [lunesISO]);
  const dias = useMemo(() => diasDeSemana(desdeFechaISO(lunesISO)), [lunesISO]);
  const hoy = aFechaISO(new Date());
  const visibles = useMemo(() => filtrarVisitas(lista, { sucursal, vendedorId, estado }), [lista, sucursal, vendedorId, estado]);
  const porDia = useMemo(() => agruparPorDia(visibles, dias), [visibles, dias]);
  const conflictos = useMemo(() => visitasEnConflicto(lista), [lista]);
  const resumen = useMemo(() => resumenVisitas(lista), [lista]);
  const nombreAsesor = (id: string | null) => asesores.find((a) => a.id === id)?.nombre ?? "Sin asesor";
  const propiedad = (v: Visita) => propiedades.find((p) => p.id === v.propiedad_id) ?? (v.propiedad_codigo ? propiedades.find((p) => p.codigo?.toUpperCase() === v.propiedad_codigo?.toUpperCase()) : undefined);

  const cambiarEstado = async (v: Visita, nuevo: EstadoVisita) => {
    setError("");
    const anterior = v.estado;
    setLista((prev) => prev.map((x) => (x.id === v.id ? { ...x, estado: nuevo } : x)));
    const { error: err } = await supabase2.from("visitas").update({ estado: nuevo, updated_at: new Date().toISOString() }).eq("id", v.id);
    if (err) {
      setLista((prev) => prev.map((x) => (x.id === v.id ? { ...x, estado: anterior } : x)));
      setError(`No se pudo cambiar el estado: ${err.message}`);
    }
  };

  const guardada = (v: Visita) => {
    // Si se movió a otra semana, sale de esta vista.
    setLista((prev) => {
      const sin = prev.filter((x) => x.id !== v.id);
      return dias.includes(v.fecha_visita) ? [...sin, v] : sin;
    });
    setModal(null);
  };

  const semanaLink = (n: number) => `/panel/visitas?semana=${aFechaISO(sumarDias(lunes, n * 7))}`;

  return (
    <div className="im-page">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p className="text-[13.5px] text-slate-600 dark:text-slate-400 max-w-xl">La agenda de la semana: las visitas que agenda el bot en los chats y las que cargás vos.</p>
        <button type="button" onClick={() => setModal({ visita: null, fecha: dias.includes(hoy) ? hoy : dias[0] })} className="flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[#0145F2] hover:bg-[#0138c9] text-white text-[13px] font-semibold"><Plus className="w-4 h-4" /> Nueva visita</button>
      </div>

      {aviso && <div className="im-error" role="alert">{aviso}</div>}
      {error && <div className="im-error" role="alert">{error}</div>}

      <KpiFila datos={[
        { icono: <CalendarClock size={15} />, titulo: "Esta semana", valor: resumen.total, nota: "visitas" },
        { icono: <CalendarClock size={15} />, titulo: "Por confirmar", valor: resumen.pendientes, etiqueta: conflictos.size ? `${conflictos.size} con choque` : undefined, nota: "pendientes" },
        { icono: <CalendarCheck size={15} />, titulo: "Confirmadas", valor: resumen.confirmadas, nota: "listas" },
        { icono: <UserCheck size={15} />, titulo: "Asistieron", valor: resumen.asistieron, etiqueta: resumen.canceladas ? `${resumen.canceladas} canceladas` : undefined, nota: "realizadas" },
      ]} />

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex items-center gap-1.5 mr-auto">
          <Link className="grid place-items-center w-9 h-9 rounded-lg border border-[#E4E6EB] dark:border-white/10 bg-white dark:bg-[#111] text-slate-600 dark:text-slate-300 hover:bg-slate-50" href={semanaLink(-1)} aria-label="Semana anterior"><ChevronLeft size={16} /></Link>
          <h2 className="px-1.5 text-[15px] font-semibold text-slate-900 dark:text-white whitespace-nowrap">{etiquetaSemana(lunes)}</h2>
          <Link className="grid place-items-center w-9 h-9 rounded-lg border border-[#E4E6EB] dark:border-white/10 bg-white dark:bg-[#111] text-slate-600 dark:text-slate-300 hover:bg-slate-50" href={semanaLink(1)} aria-label="Semana siguiente"><ChevronRight size={16} /></Link>
          {!dias.includes(hoy) && <Link className={`${filtroBoton} grid place-items-center`} href="/panel/visitas">Hoy</Link>}
        </div>
        <div className="grid grid-cols-2 gap-2 w-full md:w-auto md:flex">
          {sucursales.length > 1 && (
            <div className="min-w-0 md:w-[190px]"><SelectorWeb ariaLabel="Oficina" valor={sucursal} onCambio={setSucursal} claseBoton={filtroBoton} claseFlecha="w-3.5 h-3.5"
              opciones={[{ valor: "todas", etiqueta: "Todas las oficinas" }, ...sucursales.map((x) => ({ valor: x, etiqueta: x }))]} /></div>
          )}
          <div className="min-w-0 md:w-[190px]"><SelectorWeb ariaLabel="Asesor" valor={vendedorId} onCambio={setVendedorId} claseBoton={filtroBoton} claseFlecha="w-3.5 h-3.5"
            opciones={[{ valor: "todos", etiqueta: "Todos los asesores" }, { valor: "sin", etiqueta: "Sin asesor" }, ...asesores.map((a) => ({ valor: a.id, etiqueta: a.nombre }))]} /></div>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg bg-white dark:bg-[#111] border border-[#E4E6EB] dark:border-white/10 overflow-x-auto max-w-full [scrollbar-width:none]" role="group" aria-label="Estado">
          {(["todos", ...ESTADOS_VISITA] as const).map((s) => (
            <button key={s} type="button" aria-pressed={estado === s} onClick={() => setEstado(s)}
              className={`shrink-0 flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12.5px] font-medium transition-colors ${estado === s ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"}`}>
              {s !== "todos" && <span className={`w-1.5 h-1.5 rounded-full ${ESTADO_PUNTO[s]}`} />}{s === "todos" ? "Todas" : s}
            </button>
          ))}
        </div>
      </div>

      <p className="px-1 pb-1.5 text-[11.5px] font-medium text-slate-500 dark:text-slate-400">{visibles.length} de {lista.length} visitas esta semana</p>
      <div className="grid gap-2.5">
        {porDia.map(({ fecha, visitas }) => {
          const esHoy = fecha === hoy;
          return (
            <section key={fecha} aria-label={etiquetaDia(fecha)} className={`rounded-xl bg-white dark:bg-[#111] border ${esHoy ? "border-[#0145F2]/40" : "border-[#E8E9ED] dark:border-white/10"} overflow-hidden`}>
              <div className={`flex items-center justify-between gap-2 px-4 ${visitas.length ? "py-2.5 border-b border-[#EEEFF2] dark:border-white/[0.07] bg-[#FAFAFB] dark:bg-white/[0.02]" : "py-2"}`}>
                <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-slate-900 dark:text-white">
                  {mayuscula(etiquetaDia(fecha))}
                  {esHoy && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#0145F2] text-white">Hoy</span>}
                  {visitas.length === 0 && <span className="text-[12px] font-normal text-slate-400">· Sin visitas</span>}
                  {visitas.length > 0 && <span className="text-[12px] font-normal text-slate-500 dark:text-slate-400 tabular-nums">· {visitas.length}</span>}
                </h3>
                <button type="button" onClick={() => setModal({ visita: null, fecha })} aria-label={`Agregar visita el ${etiquetaDia(fecha)}`}
                  className="flex items-center gap-1 h-7 px-2 rounded-md text-[12px] font-medium text-slate-500 hover:text-[#0145F2] hover:bg-slate-100 dark:hover:bg-white/5"><Plus size={14} /><span className="hidden sm:inline">Agregar</span></button>
              </div>
              {visitas.length > 0 && (
                <ul className="divide-y divide-[#EEEFF2] dark:divide-white/[0.07]">
                  {visitas.map((v) => {
                    const p = propiedad(v);
                    const propTexto = p ? `${p.codigo ? `[${p.codigo}] ` : ""}${p.titulo}${p.barrio ? `, ${p.barrio}` : ""}` : v.propiedad_codigo ? `Código ${v.propiedad_codigo}` : "";
                    const wa = linkConfirmarPorWhatsapp(v, negocio);
                    const cancelada = v.estado === "Cancelada";
                    return (
                      <li key={v.id} className={`grid grid-cols-[52px_minmax(0,1fr)] md:grid-cols-[64px_minmax(0,1.3fr)_minmax(0,1fr)_auto] gap-x-3 gap-y-2 items-center px-4 py-3 ${cancelada ? "opacity-60" : ""}`}>
                        <span className="text-[17px] font-semibold tabular-nums text-slate-900 dark:text-white self-start md:self-center">{v.horario_visita}</span>
                        <button type="button" onClick={() => setModal({ visita: v })} className="flex items-center gap-3 min-w-0 text-left group">
                          <span className="hidden sm:grid shrink-0 w-9 h-9 rounded-full place-items-center bg-slate-100 dark:bg-white/10 text-[12px] font-semibold text-slate-600 dark:text-slate-300">{inicialesDe(v.nombre_cliente)}</span>
                          <span className="min-w-0">
                            <span className={`block text-[14px] font-semibold text-slate-900 dark:text-white truncate group-hover:text-[#0145F2] ${cancelada ? "line-through" : ""}`}>{v.nombre_cliente}</span>
                            <span className="flex items-center gap-x-2.5 gap-y-0.5 flex-wrap text-[12px] text-slate-500 dark:text-slate-400">
                              {v.telefono_cliente !== "sin dato" && <span className="tabular-nums">{v.telefono_cliente}</span>}
                              {v.sucursal !== "Sin especificar" && <span className="flex items-center gap-1"><MapPin size={11} />{v.sucursal}</span>}
                              <span className="flex items-center gap-1"><UserRound size={11} />{nombreAsesor(v.vendedor_id)}</span>
                            </span>
                          </span>
                        </button>
                        <div className="col-start-2 md:col-start-auto min-w-0">
                          <span className="flex items-center gap-1.5 min-w-0 text-[12.5px] text-slate-700 dark:text-slate-200">
                            {propTexto ? <span className="flex items-center gap-1 min-w-0"><Home size={13} className="shrink-0 text-slate-400" /><span className="truncate">{propTexto}</span></span> : <span className="text-slate-400">Sin propiedad elegida</span>}
                          </span>
                          {v.notas && <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400 line-clamp-2">{v.notas}</p>}
                          {conflictos.has(v.id) && <p className="mt-1 flex items-center gap-1 text-[12px] font-medium text-rose-600"><AlertTriangle size={12} /> Otra cita en la misma sucursal y horario: reagendá una.</p>}
                        </div>
                        <div className="col-start-2 md:col-start-auto flex items-center gap-1.5 flex-wrap md:flex-nowrap">
                          {wa && v.estado === "Pendiente" && <a className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-[#E4E6EB] dark:border-white/10 text-[12px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50" href={wa} target="_blank" rel="noreferrer" title="Confirmar por WhatsApp"><MessageCircle size={14} className="text-[#25D366]" />Confirmar</a>}
                          <div className="w-[128px]"><SelectorWeb ariaLabel={`Estado de la visita de ${v.nombre_cliente}`} valor={v.estado} onCambio={(e) => cambiarEstado(v, e as EstadoVisita)} claseFlecha="w-3 h-3"
                            claseBoton="h-8 px-2.5 rounded-lg border border-[#E4E6EB] dark:border-white/10 bg-white dark:bg-white/[0.03] text-[12px] font-medium text-slate-700 dark:text-slate-200 outline-none"
                            opciones={ESTADOS_VISITA.map((e) => ({ valor: e, etiqueta: e, icono: <span className={`w-1.5 h-1.5 rounded-full ${ESTADO_PUNTO[e]}`} /> }))} /></div>
                          {!cancelada && <button type="button" onClick={() => cambiarEstado(v, "Cancelada")} title="Cancelar visita" aria-label={`Cancelar la visita de ${v.nombre_cliente}`} className="grid place-items-center w-8 h-8 rounded-lg border border-[#E4E6EB] dark:border-white/10 text-slate-400 hover:text-rose-600"><CalendarX size={14} /></button>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {modal && (
        <VisitaModal visita={modal.visita} fechaInicial={modal.fecha} asesores={asesores} sucursales={sucursales} propiedades={propiedades} miId={miId}
          onClose={() => setModal(null)} onGuardada={guardada} />
      )}
    </div>
  );
}
