"use client";

import { useMemo, useState } from "react";
import { BadgeCheck, Building2, CalendarClock, Hourglass, Key, LayoutGrid, List, MapPin, Plus, Search, Tag, UserRound } from "lucide-react";
import FotoPropiedad from "@/components/inmo/FotoPropiedad";
import SelectorWeb from "@/components/ui/SelectorWeb";
import PropiedadModal from "./PropiedadModal";
import { ESTILO_STOCK_MINIMAL } from "./estiloStockMinimal";
import {
  DIAS_SIN_MOVIMIENTO, ESTADO_LABEL, ESTADOS, OPERACIONES, OPERACION_LABEL, TIPOS, TIPO_LABEL, TIPO_PLURAL, antiguedad, contarPorTipo, diasPublicada,
  especificaciones, filtrarPropiedades, formatearPrecio, resumenCartera, ubicacion,
  type EstadoPropiedad, type Operacion, type Propiedad, type TipoPropiedad,
} from "@/lib/propiedades/propiedades";

interface Opcion { id: string; nombre: string }

// Diseño nuevo (26/11/2026): el Stock del panel completo de Pfaffen llevado a propiedades. Números en una franja, filtros en
// un renglón, tabla con foto y días publicada como borde de color en la compu, y tarjetas de a dos en el celular.
const ESTADO_PILL: Record<EstadoPropiedad, string> = {
  disponible: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
  reservada: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",
  vendida: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/10 dark:text-slate-300 dark:border-white/10",
  alquilada: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/10 dark:text-slate-300 dark:border-white/10",
  pausada: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20",
};
const ESTADO_PUNTO: Record<EstadoPropiedad, string> = { disponible: "bg-emerald-500", reservada: "bg-amber-500", vendida: "bg-slate-400", alquilada: "bg-slate-400", pausada: "bg-rose-500" };
const OPERACION_PILL: Record<Operacion, string> = {
  venta: "bg-[#0145F2]/10 text-[#0145F2] dark:text-[#9db8ff]",
  alquiler: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
};
const PUNTO = { ok: "bg-emerald-500", atencion: "bg-amber-400", estancada: "bg-rose-500" } as const;
const BORDE = { ok: "border-l-emerald-500", atencion: "border-l-amber-400", estancada: "border-l-rose-500" } as const;
const CAMPO = "h-9 px-3 rounded-lg border border-[#E4E6EB] dark:border-white/10 bg-white dark:bg-[#111] text-[13px] font-medium text-slate-700 dark:text-slate-200 outline-none";
const SEGMENTO = "flex items-center gap-1 p-1 rounded-lg bg-white dark:bg-[#111] border border-[#E4E6EB] dark:border-white/10";
const activoSeg = (si: boolean) => (si ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5");
type Vista = "tabla" | "tarjetas";

export default function PropiedadesClient({ iniciales, sucursales, asesores, miId, aviso }: {
  iniciales: Propiedad[]; sucursales: Opcion[]; asesores: Opcion[]; miId: string; aviso: string | null;
}) {
  const [lista, setLista] = useState<Propiedad[]>(iniciales);
  const [tipo, setTipo] = useState<TipoPropiedad | "todas">("todas");
  const [operacion, setOperacion] = useState<Operacion | "todas">("todas");
  const [estado, setEstado] = useState<EstadoPropiedad | "todas">("todas");
  const [textoBusqueda, setTextoBusqueda] = useState("");
  const [modal, setModal] = useState<{ propiedad: Propiedad | null } | null>(null);
  const [vista, setVista] = useState<Vista>("tabla");
  const [soloSinMovimiento, setSoloSinMovimiento] = useState(false);
  // Hora fija mientras la pantalla está abierta, para contar los días publicada.
  const [ahora] = useState(() => Date.now());

  const conteo = useMemo(() => contarPorTipo(lista), [lista]);
  const resumen = useMemo(() => resumenCartera(lista), [lista]);
  const filtradas = useMemo(() => filtrarPropiedades(lista, { tipo, operacion, estado, texto: textoBusqueda }), [lista, tipo, operacion, estado, textoBusqueda]);
  const activas = lista.filter((p) => p.estado === "disponible" || p.estado === "reservada");
  const esVieja = (p: Propiedad) => (p.estado === "disponible" || p.estado === "reservada") && diasPublicada(p.created_at, ahora) >= DIAS_SIN_MOVIMIENTO;
  const sinMovimiento = activas.filter(esVieja).length;
  const diasProm = activas.length ? Math.round(activas.reduce((n, p) => n + diasPublicada(p.created_at, ahora), 0) / activas.length) : 0;
  const visibles = soloSinMovimiento ? filtradas.filter(esVieja) : filtradas;
  // Solo se ofrecen los tipos que hay, para que no aparezca "Terrenos 0" en una inmobiliaria que no los tiene.
  const tiposConDatos = TIPOS.filter((t) => conteo[t] > 0);
  const nombreOficina = (id: string | null) => sucursales.find((x) => x.id === id)?.nombre ?? "Sin oficina";
  const nombreAsesor = (id: string | null) => asesores.find((x) => x.id === id)?.nombre ?? "Sin asesor";
  const abrir = (p: Propiedad) => setModal({ propiedad: p });

  const guardada = (p: Propiedad) => {
    setLista((prev) => (prev.some((x) => x.id === p.id) ? prev.map((x) => (x.id === p.id ? p : x)) : [p, ...prev]));
    setModal(null);
  };

  const franja = [
    { icono: <Building2 className="w-3 h-3" />, tono: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300", titulo: "Propiedades", valor: resumen.total, extra: null as string | null },
    { icono: <BadgeCheck className="w-3 h-3" />, tono: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300", titulo: "Disponibles", valor: resumen.disponibles, extra: resumen.reservadas ? `${resumen.reservadas} reservadas` : null },
    { icono: <Key className="w-3 h-3" />, tono: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300", titulo: "En venta", valor: resumen.enVenta, extra: null },
    { icono: <CalendarClock className="w-3 h-3" />, tono: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300", titulo: "En alquiler", valor: resumen.enAlquiler, extra: null },
    { icono: <Tag className="w-3 h-3" />, tono: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300", titulo: "Días promedio publicada", valor: diasProm, extra: null },
  ];

  return (
    <div className="im-page stock-minimal">
      <style>{ESTILO_STOCK_MINIMAL}</style>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p className="text-[13.5px] text-slate-600 dark:text-slate-400 max-w-xl">Tu cartera de venta y alquiler: lo que el bot ofrece en los chats, con foto y precio a mano.</p>
        <button type="button" onClick={() => setModal({ propiedad: null })} className="flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[#0145F2] hover:bg-[#0138c9] text-white text-[13px] font-semibold boton-principal"><Plus className="w-4 h-4" /> Nueva propiedad</button>
      </div>

      {aviso && <div className="im-error" role="alert">{aviso}</div>}

      {/* Números en una sola franja con separadores. "Sin movimiento" filtra la lista al tocarlo. */}
      <div className="flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-white dark:bg-[#111] border border-[#E8E9ED] dark:border-white/10 rounded-xl divide-x divide-[#EEEFF2] dark:divide-white/[0.07] mb-4">
        {franja.map((k) => (
          <div key={k.titulo} className="shrink-0 md:flex-1 px-4 py-3">
            <span className="flex items-center gap-2 whitespace-nowrap text-[12px] font-medium text-slate-600 dark:text-slate-300"><span className={`w-5 h-5 rounded-md grid place-items-center ${k.tono}`}>{k.icono}</span>{k.titulo}</span>
            <span className="mt-1.5 flex items-baseline gap-2 text-[22px] font-semibold leading-tight tracking-tight tabular-nums text-slate-900 dark:text-white whitespace-nowrap">{k.valor}{k.extra && <span className="text-[11.5px] font-medium text-amber-600 dark:text-amber-300">{k.extra}</span>}</span>
          </div>
        ))}
        <button type="button" onClick={() => setSoloSinMovimiento((v) => !v)} aria-pressed={soloSinMovimiento} className={`text-left shrink-0 md:flex-1 px-4 py-3 transition-colors ${soloSinMovimiento ? "bg-rose-50 dark:bg-rose-500/15" : "hover:bg-slate-50 dark:hover:bg-white/[0.03]"}`}>
          <span className="flex items-center gap-2 whitespace-nowrap text-[12px] font-medium text-slate-600 dark:text-slate-300"><span className="w-5 h-5 rounded-md grid place-items-center bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300"><Hourglass className="w-3 h-3" /></span>Sin movimiento (+{DIAS_SIN_MOVIMIENTO} días)</span>
          <span className="block mt-1.5 text-[22px] font-semibold leading-tight tracking-tight tabular-nums text-rose-600 dark:text-rose-300">{sinMovimiento}</span>
        </button>
      </div>

      {/* Filtros en un renglón: buscador, tipo, estado, venta/alquiler y la vista. En el celular se acomodan en dos. */}
      <div className="grid grid-cols-2 gap-2 mb-2 md:flex md:flex-wrap md:items-center">
        <label className="col-span-2 relative md:flex-1 md:min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input type="search" aria-label="Buscar propiedad" placeholder="Buscar por título, barrio, dirección o código" value={textoBusqueda} onChange={(e) => setTextoBusqueda(e.target.value)}
            className="w-full h-10 md:h-9 bg-white dark:bg-[#111] border border-[#E4E6EB] dark:border-white/10 rounded-lg pl-9 pr-3 text-[13px] outline-none focus:border-slate-400 text-slate-900 dark:text-white placeholder:text-slate-400" />
        </label>
        <div className="min-w-0 md:w-[185px]"><SelectorWeb ariaLabel="Tipo" valor={tipo} onCambio={(v) => setTipo(v as TipoPropiedad | "todas")} claseBoton={CAMPO} claseFlecha="w-3.5 h-3.5"
          opciones={[{ valor: "todas", etiqueta: `Todos los tipos · ${lista.length}` }, ...tiposConDatos.map((t) => ({ valor: t, etiqueta: `${TIPO_PLURAL[t]} · ${conteo[t]}` }))]} /></div>
        <div className="min-w-0 md:w-[165px]"><SelectorWeb ariaLabel="Estado" valor={estado} onCambio={(v) => { setEstado(v as EstadoPropiedad | "todas"); setSoloSinMovimiento(false); }} claseBoton={CAMPO} claseFlecha="w-3.5 h-3.5"
          opciones={[{ valor: "todas", etiqueta: "Todos los estados" }, ...ESTADOS.map((e) => ({ valor: e, etiqueta: ESTADO_LABEL[e], icono: <span className={`w-2 h-2 rounded-full ${ESTADO_PUNTO[e]}`} /> }))]} /></div>
        <div className={`col-span-2 md:col-span-1 ${SEGMENTO}`} role="group" aria-label="Operación">
          {(["todas", ...OPERACIONES] as const).map((o) => (
            <button key={o} type="button" aria-pressed={operacion === o} onClick={() => setOperacion(o)} className={`flex-1 md:flex-none h-7 px-2.5 rounded-md text-[12.5px] font-medium whitespace-nowrap ${activoSeg(operacion === o)}`}>
              {o === "todas" ? "Venta y alquiler" : OPERACION_LABEL[o]}
            </button>
          ))}
        </div>
        <div className={`hidden md:flex ${SEGMENTO}`} role="group" aria-label="Vista">
          <button type="button" title="Tabla" aria-label="Ver como tabla" aria-pressed={vista === "tabla"} onClick={() => setVista("tabla")} className={`grid place-items-center w-7 h-7 rounded-md ${activoSeg(vista === "tabla")}`}><List className="w-4 h-4" /></button>
          <button type="button" title="Tarjetas" aria-label="Ver como tarjetas" aria-pressed={vista === "tarjetas"} onClick={() => setVista("tarjetas")} className={`grid place-items-center w-7 h-7 rounded-md ${activoSeg(vista === "tarjetas")}`}><LayoutGrid className="w-4 h-4" /></button>
        </div>
      </div>

      {visibles.length > 0 ? (
        <>
          <div className="px-1 pb-1.5 flex items-center justify-between flex-wrap gap-2 text-[11.5px] font-medium text-slate-500 dark:text-slate-400">
            <span>{visibles.length} propiedad{visibles.length === 1 ? "" : "es"} en lista{soloSinMovimiento ? " · solo sin movimiento" : ""}</span>
            <span className="hidden md:flex items-center gap-3">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Publicada</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /> +45 días</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500" /> +{DIAS_SIN_MOVIMIENTO} días</span>
            </span>
          </div>

          {/* Celular: tarjetas de a dos con foto, precio, tres números y los datos de abajo. */}
          <div className="md:hidden grid grid-cols-2 gap-2">
            {visibles.map((p) => {
              const dias = diasPublicada(p.created_at, ahora);
              const precio = formatearPrecio(p);
              return (
                <button type="button" key={p.id} onClick={() => abrir(p)} className="flex flex-col min-w-0 text-left bg-white dark:bg-[#111] border border-[#E8E9ED] dark:border-white/10 rounded-xl p-2.5">
                  <span className="text-[13px] font-semibold leading-tight text-slate-900 dark:text-white line-clamp-2">{p.titulo}</span>
                  <span className="mt-0.5 text-[14px] font-semibold tabular-nums text-slate-900 dark:text-white">{precio.monto}{precio.sufijo && <span className="text-[11px] font-medium text-slate-500"> {precio.sufijo}</span>}</span>
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${ESTADO_PILL[p.estado]}`}>{ESTADO_LABEL[p.estado]}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${OPERACION_PILL[p.operacion]}`}>{OPERACION_LABEL[p.operacion]}</span>
                  </span>
                  <span className="mt-2 block rounded-lg overflow-hidden"><FotoPropiedad propiedad={p} sinCartel /></span>
                  <span className="mt-2 grid grid-cols-3 gap-1 text-center">
                    <span><span className="block text-[13px] font-semibold tabular-nums text-slate-900 dark:text-white">{p.ambientes ?? "—"}</span><span className="block text-[10px] text-slate-400">Amb.</span></span>
                    <span><span className="block text-[13px] font-semibold tabular-nums text-slate-900 dark:text-white truncate">{p.superficie_cubierta || p.superficie_total || "—"}</span><span className="block text-[10px] text-slate-400">m²</span></span>
                    <span title="Días publicada"><span className="flex items-center justify-center gap-1 text-[13px] font-semibold tabular-nums text-slate-900 dark:text-white"><span className={`w-1.5 h-1.5 rounded-full ${PUNTO[antiguedad(dias)]}`} />{dias}</span><span className="block text-[10px] text-slate-400">Días</span></span>
                  </span>
                  <span className="mt-2 pt-2 border-t border-[#EEEFF2] dark:border-white/[0.07] space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                    <span className="flex items-center gap-1.5 min-w-0"><MapPin className="w-3 h-3 shrink-0 text-slate-400" /><span className="truncate">{p.barrio || p.ciudad || "Sin barrio"}</span></span>
                    <span className="flex items-center gap-1.5 min-w-0"><Building2 className="w-3 h-3 shrink-0 text-slate-400" /><span className="truncate">{nombreOficina(p.sucursal_id)}</span></span>
                    <span className="flex items-center gap-1.5 min-w-0"><UserRound className="w-3 h-3 shrink-0 text-slate-400" /><span className="truncate">{nombreAsesor(p.asesor_id)}</span></span>
                  </span>
                </button>
              );
            })}
          </div>

          {vista === "tabla" ? (
            <div className="hidden md:block stock-tabla-nuevo">
              <div className="bg-white dark:bg-[#111] overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <th className="pl-4 pr-3 py-2.5">Propiedad</th><th className="px-3 py-2.5">Operación</th><th className="px-3 py-2.5">Datos</th><th className="px-3 py-2.5">Precio</th>
                      <th className="px-3 py-2.5">Estado</th><th className="px-3 py-2.5 whitespace-nowrap">Oficina y asesor</th><th className="px-3 py-2.5 text-right pr-4">Días</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.map((p) => {
                      const dias = diasPublicada(p.created_at, ahora);
                      const precio = formatearPrecio(p);
                      return (
                        <tr key={p.id} onClick={() => abrir(p)} className={`border-l-4 ${BORDE[antiguedad(dias)]} border-t border-[#EEEFF2] dark:border-t-white/[0.06] cursor-pointer hover:bg-slate-50/70 dark:hover:bg-white/[0.02]`}>
                          <td className="pl-3 pr-3 py-2.5">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-[64px] shrink-0 rounded-lg overflow-hidden"><FotoPropiedad propiedad={p} sinCartel /></div>
                              <div className="min-w-0">
                                <p className="text-[14px] font-semibold text-slate-900 dark:text-white truncate max-w-[250px]">{p.titulo}</p>
                                <p className="text-[12px] text-slate-500 dark:text-slate-400 truncate max-w-[250px]">{ubicacion(p) || TIPO_LABEL[p.tipo]}</p>
                                <p className="mt-0.5 text-[11px] text-slate-400">{TIPO_LABEL[p.tipo]}{p.codigo && <span className="font-mono"> · {p.codigo}</span>}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5"><span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${OPERACION_PILL[p.operacion]}`}>{OPERACION_LABEL[p.operacion]}</span></td>
                          <td className="px-3 py-2.5 text-[12.5px] text-slate-600 dark:text-slate-300 min-w-[120px]">{especificaciones(p).slice(0, 3).join(" · ") || "—"}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <p className="text-[14px] font-semibold tabular-nums text-slate-900 dark:text-white">{precio.monto}{precio.sufijo && <span className="text-[11px] font-medium text-slate-500"> {precio.sufijo}</span>}</p>
                            {p.expensas ? <p className="text-[11px] text-slate-500 dark:text-slate-400">+ $ {new Intl.NumberFormat("es-AR").format(p.expensas)} expensas</p> : null}
                          </td>
                          <td className="px-3 py-2.5"><span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap ${ESTADO_PILL[p.estado]}`}>{ESTADO_LABEL[p.estado]}</span></td>
                          <td className="px-3 py-2.5 text-[12.5px] whitespace-nowrap"><p className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200"><Building2 className="w-3 h-3 shrink-0 text-slate-400" /><span className="truncate max-w-[130px]">{nombreOficina(p.sucursal_id)}</span></p><p className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400"><UserRound className="w-3 h-3 shrink-0 text-slate-400" /><span className="truncate max-w-[130px]">{nombreAsesor(p.asesor_id)}</span></p></td>
                          <td className="pr-4 pl-3 py-2.5 text-right"><span className="inline-flex items-center gap-1.5 text-[13px] font-semibold tabular-nums text-slate-700 dark:text-slate-200"><span className={`w-2 h-2 rounded-full ${PUNTO[antiguedad(dias)]}`} />{dias}d</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
              {visibles.map((p) => {
                const dias = diasPublicada(p.created_at, ahora);
                const precio = formatearPrecio(p);
                return (
                  <button type="button" key={p.id} onClick={() => abrir(p)} className="group flex flex-col text-left p-2 bg-white dark:bg-[#111] border border-[#E8E9ED] dark:border-white/10 rounded-xl overflow-hidden hover:shadow-md transition">
                    <span className="relative block rounded-lg overflow-hidden">
                      <FotoPropiedad propiedad={p} sinCartel />
                      <span className={`absolute top-2 left-2 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${ESTADO_PILL[p.estado]}`}>{ESTADO_LABEL[p.estado]}</span>
                      <span className="absolute top-2 right-2 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-900/75 text-white">{OPERACION_LABEL[p.operacion]}</span>
                    </span>
                    <span className="flex-1 flex flex-col px-1.5 pt-3 pb-1">
                      <span className="text-[15px] font-semibold text-slate-900 dark:text-white leading-snug line-clamp-1">{p.titulo}</span>
                      <span className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{ubicacion(p) || TIPO_LABEL[p.tipo]}</span>
                      <span className="text-[19px] font-semibold tracking-tight text-slate-900 dark:text-white mt-1.5 tabular-nums">{precio.monto}{precio.sufijo && <span className="text-[12px] font-medium text-slate-500"> {precio.sufijo}</span>}</span>
                      <span className="text-[11.5px] text-slate-500 dark:text-slate-400">{especificaciones(p).join(" · ")}</span>
                      <span className="mt-auto pt-2.5"><span className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-white/5 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1 min-w-0"><UserRound className="w-3 h-3 shrink-0" /><span className="truncate">{nombreOficina(p.sucursal_id)} · {nombreAsesor(p.asesor_id)}</span></span>
                        <span className="flex items-center gap-1 shrink-0 font-semibold" title="Días publicada"><span className={`w-2 h-2 rounded-full ${PUNTO[antiguedad(dias)]}`} />{dias}d</span>
                      </span></span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : lista.length === 0 ? (
        <div className="im-vacio">
          <h3>Todavía no cargaste propiedades</h3>
          <p>Cargá la primera con su precio, ubicación y una foto. El bot la empieza a ofrecer en los chats en el momento.</p>
          <button type="button" className="im-btn primary" onClick={() => setModal({ propiedad: null })}><Plus size={16} />Cargar la primera propiedad</button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-center py-16 bg-white dark:bg-[#111] border border-[#E8E9ED] dark:border-white/10 rounded-xl">
          <Search className="w-9 h-9 text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-1">Ninguna propiedad coincide</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Probá con otro tipo, estado o búsqueda.</p>
        </div>
      )}

      {modal && <PropiedadModal propiedad={modal.propiedad} sucursales={sucursales} asesores={asesores} miId={miId} onClose={() => setModal(null)} onGuardada={guardada} />}
    </div>
  );
}
