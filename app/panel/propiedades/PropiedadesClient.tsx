"use client";

import { useMemo, useState } from "react";
import { Building2, Plus, Search, Pencil, Trash2, MapPin, ImageOff } from "lucide-react";
import { supabase2 } from "@/lib/supabase/client";
import { mostrarToast } from "@/lib/toast";
import ConfirmDialog from "@/components/panel/ConfirmDialog";
import { ESTADOS, OPERACIONES, TIPOS, formatearPrecio, resumenCaracteristicas, type EstadoPropiedad } from "@/lib/propiedades";
import PropiedadModal, { type Propiedad } from "./PropiedadModal";
import EstadoPropiedadSelector from "./EstadoPropiedadSelector";

const filtro = "rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0145F2]";

export default function PropiedadesClient({ propiedadesIniciales, errorCarga, sucursales, equipo, miId, puedeBorrar }: {
  propiedadesIniciales: Propiedad[]; errorCarga: string | null; sucursales: { id: string; nombre: string }[]; equipo: { id: string; nombre: string }[]; miId: string; puedeBorrar: boolean;
}) {
  const [lista, setLista] = useState<Propiedad[]>(propiedadesIniciales);
  const [busqueda, setBusqueda] = useState("");
  const [operacion, setOperacion] = useState("");
  const [tipo, setTipo] = useState("");
  const [estado, setEstado] = useState("");
  const [editando, setEditando] = useState<Propiedad | "nueva" | null>(null);
  const [aBorrar, setABorrar] = useState<Propiedad | null>(null);

  const nombreOficina = useMemo(() => new Map(sucursales.map((s) => [s.id, s.nombre])), [sucursales]);
  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return lista.filter((p) =>
      (!operacion || p.operacion === operacion) && (!tipo || p.tipo === tipo) && (!estado || p.estado === estado) &&
      (!q || [p.titulo, p.codigo, p.direccion, p.barrio, p.localidad].some((t) => t?.toLowerCase().includes(q))),
    );
  }, [lista, busqueda, operacion, tipo, estado]);

  const guardada = (p: Propiedad) => {
    setLista((l) => (l.some((x) => x.id === p.id) ? l.map((x) => (x.id === p.id ? p : x)) : [p, ...l]));
    setEditando(null);
  };

  const cambiarEstado = async (p: Propiedad, nuevo: EstadoPropiedad) => {
    const anterior = p.estado;
    setLista((l) => l.map((x) => (x.id === p.id ? { ...x, estado: nuevo } : x)));
    const { error } = await supabase2.from("propiedades").update({ estado: nuevo }).eq("id", p.id);
    if (error) {
      setLista((l) => l.map((x) => (x.id === p.id ? { ...x, estado: anterior } : x)));
      mostrarToast("No se pudo cambiar el estado.", "error");
    }
  };

  const borrar = async () => {
    if (!aBorrar) return;
    const p = aBorrar;
    setABorrar(null);
    const { data, error } = await supabase2.from("propiedades").delete().eq("id", p.id).select("id");
    if (error || !data?.length) { mostrarToast("No se pudo borrar la propiedad.", "error"); return; }
    setLista((l) => l.filter((x) => x.id !== p.id));
    mostrarToast("Propiedad borrada");
  };

  const disponibles = lista.filter((p) => p.estado === "disponible").length;

  return (
    <div className="flex-1 min-h-0 overflow-auto p-3 sm:p-6 max-w-7xl w-full mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2"><Building2 className="w-5 h-5 text-[#0145F2]" /> Propiedades</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">{lista.length} cargadas · {disponibles} disponibles</p>
        </div>
        <button onClick={() => setEditando("nueva")} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white bg-[#0145F2] hover:bg-[#0138c9]"><Plus className="w-4 h-4" /> Nueva propiedad</button>
      </div>

      {errorCarga && <p role="alert" className="mb-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 p-3 text-sm text-rose-700 dark:text-rose-300">{errorCarga}</p>}

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[12rem]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input aria-label="Buscar propiedades" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por título, código o dirección" className={`${filtro} w-full pl-9`} />
        </div>
        <select aria-label="Operación" className={filtro} value={operacion} onChange={(e) => setOperacion(e.target.value)}><option value="">Toda operación</option>{Object.entries(OPERACIONES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select aria-label="Tipo" className={filtro} value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="">Todo tipo</option>{Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select aria-label="Estado" className={filtro} value={estado} onChange={(e) => setEstado(e.target.value)}><option value="">Todo estado</option>{Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>

      {filtradas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-white/15 py-16 flex flex-col items-center text-center px-4">
          <Building2 className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
          <p className="font-bold text-slate-700 dark:text-slate-200">{lista.length === 0 ? "Todavía no cargaste propiedades" : "Ninguna propiedad coincide con los filtros"}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{lista.length === 0 ? "Cargá la primera para poder ofrecerla en los chats." : "Probá con otra búsqueda."}</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtradas.map((p) => (
            <li key={p.id} className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 overflow-hidden flex flex-col">
              <button onClick={() => setEditando(p)} className="text-left flex-1 flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0145F2]">
                <div className="aspect-[16/10] bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                  {p.fotos[0]
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={p.fotos[0]} alt={p.titulo} loading="lazy" className="w-full h-full object-cover" />
                    : <ImageOff className="w-8 h-8 text-slate-300 dark:text-slate-600" />}
                </div>
                <div className="p-3 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{OPERACIONES[p.operacion]} · {TIPOS[p.tipo]}{p.codigo ? ` · ${p.codigo}` : ""}</p>
                  <p className="font-bold text-slate-800 dark:text-slate-100 leading-snug mt-0.5">{p.titulo}</p>
                  <p className="text-lg font-black text-[#0145F2] dark:text-[#5b8dff] mt-1">{formatearPrecio(p.precio, p.moneda)}</p>
                  {(p.direccion || p.barrio) && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-start gap-1"><MapPin className="w-3 h-3 mt-0.5 shrink-0" />{[p.direccion, p.barrio].filter(Boolean).join(", ")}</p>}
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{resumenCaracteristicas(p)}</p>
                  {p.sucursal_id && nombreOficina.get(p.sucursal_id) && <p className="text-[11px] text-slate-400 mt-1">{nombreOficina.get(p.sucursal_id)}</p>}
                </div>
              </button>
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-slate-100 dark:border-white/10">
                <EstadoPropiedadSelector estado={p.estado} operacion={p.operacion} onChange={(e) => cambiarEstado(p, e)} />
                <div className="flex items-center gap-1">
                  {!p.publicada && <span className="text-[10px] font-bold text-slate-400 mr-1">No se ofrece</span>}
                  <button onClick={() => setEditando(p)} aria-label={`Editar ${p.titulo}`} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"><Pencil className="w-4 h-4" /></button>
                  {puedeBorrar && <button onClick={() => setABorrar(p)} aria-label={`Borrar ${p.titulo}`} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="w-4 h-4" /></button>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editando && (
        <PropiedadModal propiedad={editando === "nueva" ? null : editando} sucursales={sucursales} equipo={equipo} miId={miId} onCerrar={() => setEditando(null)} onGuardada={guardada} />
      )}
      <ConfirmDialog abierto={!!aBorrar} titulo="Borrar propiedad" mensaje={`¿Borrar "${aBorrar?.titulo ?? ""}"? No se puede deshacer. Si solo se vendió o alquiló, cambiale el estado en vez de borrarla.`} textoConfirmar="Borrar" onConfirmar={borrar} onCancelar={() => setABorrar(null)} />
    </div>
  );
}
