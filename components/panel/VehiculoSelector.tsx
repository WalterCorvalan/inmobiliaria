"use client";

import { useState } from "react";
import { Car, Check, X, Pencil, Search, Loader2 } from "lucide-react";
import { supabase2 } from "@/lib/supabase/client";
import { avisar } from "@/components/panel/Dialogos";
import { useStockParaElegir } from "@/components/panel/useStockParaElegir";

export interface VehiculoDatos {
  vehiculo_id: string | null;
  dominio: string; segmento: string; marca: string; modelo: string; tipo: string;
  marca_motor: string; numero_motor: string; marca_chasis: string; numero_chasis: string;
  modelo_anio: string; color: string; kilometros: string; combustible: string; transmision: string; traccion: string;
  precio_publicado_ars?: number | null; precio_publicado_usd?: number | null;
  precio_venta?: number | null; moneda_venta?: string | null;
}

const SOLO_DISPONIBLES = ["disponible"] as const;

const VACIO: VehiculoDatos = {
  vehiculo_id: null, dominio: "", segmento: "", marca: "", modelo: "", tipo: "",
  marca_motor: "", numero_motor: "", marca_chasis: "", numero_chasis: "",
  modelo_anio: "", color: "", kilometros: "", combustible: "", transmision: "", traccion: "",
  precio_publicado_ars: null, precio_publicado_usd: null, precio_venta: null, moneda_venta: null,
};

const inputClass = "w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-rose-500 focus:bg-white dark:focus:bg-white/10 transition-colors text-slate-900 dark:text-white placeholder:text-slate-400";

export default function VehiculoSelector({
  vehiculos, datos, onCambiar, persistirManual = false, sucursalId, origen = "Compra", soloManual = false,
}: {
  vehiculos: any[]; datos: VehiculoDatos | null; onCambiar: (datos: VehiculoDatos | null) => void;
  persistirManual?: boolean; sucursalId?: string; origen?: string; soloManual?: boolean;
}) {
  const [modoManual, setModoManual] = useState(soloManual);
  const [guardandoManual, setGuardandoManual] = useState(false);
  const [busquedaStock, setBusquedaStock] = useState("");

  // vehiculos llega por prop desde un query server-side que se trae una sola vez al cargar la página (sin .limit(),
  // y un auto recién cargado no aparecía hasta recargar). Desde 2 letras se busca en la base palabra por palabra
  // ("toyota corolla" encuentra marca y modelo en columnas distintas). Si el formulario no pasa la lista (Simulador),
  // igual se muestra el stock disponible sin escribir nada (Walter, 14/10/2026: "que aparezcan precargados").
  // Tiene que vivir antes de los `return` condicionales de más abajo (reglas de hooks).
  const largoBusqueda = busquedaStock.trim().length;
  const stockVivo = useStockParaElegir<any>(busquedaStock, {
    select: "id, marca, modelo, patente, segmento, tipo, marca_motor, numero_motor, marca_chasis, numero_chasis, anio, color, km, combustible, transmision, traccion, precio_publicado_ars, precio_publicado_usd, precio_venta, moneda_venta",
    estados: SOLO_DISPONIBLES,
    activo: !soloManual && (vehiculos.length === 0 || largoBusqueda >= 2),
  });
  const buscando = stockVivo.buscando && (vehiculos.length === 0 || largoBusqueda >= 2);

  const seleccionarDeStock = (v: any) => {
    if (!v) return;
    onCambiar({
      vehiculo_id: v.id, dominio: v.patente || "", segmento: v.segmento || "", marca: v.marca || "", modelo: v.modelo || "",
      tipo: v.tipo || "", marca_motor: v.marca_motor || "", numero_motor: v.numero_motor || "",
      marca_chasis: v.marca_chasis || "", numero_chasis: v.numero_chasis || "", modelo_anio: String(v.anio || ""),
      color: v.color || "", kilometros: String(v.km || ""), combustible: v.combustible || "", transmision: v.transmision || "",
      traccion: v.traccion || "", precio_publicado_ars: v.precio_publicado_ars ?? null, precio_publicado_usd: v.precio_publicado_usd ?? null,
      precio_venta: v.precio_venta ?? null, moneda_venta: v.moneda_venta ?? null,
    });
  };

  if (datos && !modoManual) {
    return (
      <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
            <Check className="w-4 h-4 shrink-0" /> {datos.marca} {datos.modelo} {datos.dominio ? `(${datos.dominio})` : ""}
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-300 mt-0.5">{datos.modelo_anio || "—"} · {datos.color || "—"}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={() => setModoManual(true)} className="text-emerald-600 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-200 bg-white dark:bg-white/5 border border-emerald-200 dark:border-emerald-500/20 p-2 rounded-lg transition-colors" title="Editar campos"><Pencil className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => { onCambiar(null); if (soloManual) setModoManual(true); }} className="text-emerald-600 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-200 bg-white dark:bg-white/5 border border-emerald-200 dark:border-emerald-500/20 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-colors">Cambiar</button>
        </div>
      </div>
    );
  }

  const confirmarManual = async () => {
    const d = datos || VACIO;
    if (!persistirManual) { setModoManual(false); return; }
    if (!d.marca.trim() || !d.modelo.trim()) return void avisar("Marca y modelo son obligatorios.");
    if (!sucursalId) return void avisar("Elegí la sucursal antes de cargar el vehículo.");
    setGuardandoManual(true);
    try {
      const res = await fetch("/api/panel/vehiculos/crear-incompleto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patente: d.dominio, marca: d.marca, modelo: d.modelo, anio: d.modelo_anio, color: d.color, km: d.kilometros,
          tipo: d.tipo, tipo_combustible: d.combustible, transmision: d.transmision, traccion: d.traccion,
          numero_motor: d.numero_motor, numero_chasis: d.numero_chasis,
          marca_motor: d.marca_motor, marca_chasis: d.marca_chasis, segmento: d.segmento, sucursal_id: sucursalId, origen,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al crear el vehículo.");
      onCambiar({ ...d, vehiculo_id: json.id });
      setModoManual(false);
    } catch (err: any) {
      avisar(err.message || "Error al crear el vehículo.");
    } finally {
      setGuardandoManual(false);
    }
  };

  if (modoManual) {
    const d = datos || VACIO;
    return (
      <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Datos del vehículo</span>
          {!soloManual && <button type="button" onClick={() => setModoManual(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><X className="w-4 h-4" /></button>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input className={inputClass} placeholder="Dominio" value={d.dominio} onChange={(e) => onCambiar({ ...d, dominio: e.target.value })} />
          <input className={inputClass} placeholder="Segmento" value={d.segmento} onChange={(e) => onCambiar({ ...d, segmento: e.target.value })} />
          <input className={inputClass} placeholder="Marca *" value={d.marca} onChange={(e) => onCambiar({ ...d, marca: e.target.value })} />
          <input className={inputClass} placeholder="Modelo *" value={d.modelo} onChange={(e) => onCambiar({ ...d, modelo: e.target.value })} />
          <select className={`${inputClass} cursor-pointer`} value={d.tipo} onChange={(e) => onCambiar({ ...d, tipo: e.target.value })}>
            <option value="">Tipo de vehículo...</option>
            <option value="Auto">Auto</option>
            <option value="Pickup">Pickup</option>
            <option value="Todo Terreno | SUV">SUV</option>
            <option value="Utilitarios">Utilitario</option>
          </select>
          <input className={inputClass} placeholder="Año" value={d.modelo_anio} onChange={(e) => onCambiar({ ...d, modelo_anio: e.target.value })} />
          <input className={inputClass} placeholder="Color" value={d.color} onChange={(e) => onCambiar({ ...d, color: e.target.value })} />
          <input className={inputClass} placeholder="Kilómetros" value={d.kilometros} onChange={(e) => onCambiar({ ...d, kilometros: e.target.value })} />
          <select className={`${inputClass} cursor-pointer`} value={d.combustible} onChange={(e) => onCambiar({ ...d, combustible: e.target.value })}>
            <option value="">Combustible...</option>
            <option value="Nafta">Nafta</option>
            <option value="Diesel">Diesel</option>
            <option value="GNC">GNC</option>
            <option value="Híbrido">Híbrido</option>
          </select>
          <select className={`${inputClass} cursor-pointer`} value={d.transmision} onChange={(e) => onCambiar({ ...d, transmision: e.target.value })}>
            <option value="">Transmisión...</option>
            <option value="Manual">Manual</option>
            <option value="Automática">Automática</option>
          </select>
          <select className={`${inputClass} cursor-pointer`} value={d.traccion} onChange={(e) => onCambiar({ ...d, traccion: e.target.value })}>
            <option value="">Tracción...</option>
            <option value="4x2">4x2</option>
            <option value="4x4">4x4</option>
            <option value="Delantera">Delantera</option>
            <option value="Trasera">Trasera</option>
            <option value="Integral (AWD)">Integral (AWD)</option>
          </select>
          <input className={inputClass} placeholder="Marca de motor" value={d.marca_motor} onChange={(e) => onCambiar({ ...d, marca_motor: e.target.value })} />
          <input className={inputClass} placeholder="Número de motor" value={d.numero_motor} onChange={(e) => onCambiar({ ...d, numero_motor: e.target.value })} />
          <input className={inputClass} placeholder="Marca de chasis" value={d.marca_chasis} onChange={(e) => onCambiar({ ...d, marca_chasis: e.target.value })} />
          <input className={inputClass} placeholder="Número de chasis" value={d.numero_chasis} onChange={(e) => onCambiar({ ...d, numero_chasis: e.target.value })} />
        </div>
        <button type="button" onClick={confirmarManual} disabled={guardandoManual} className="w-full bg-[#0145F2] hover:bg-[#0138c9] text-white font-bold py-2.5 rounded-lg text-[11px] uppercase tracking-widest transition-colors disabled:opacity-50">
          {guardandoManual ? "Guardando..." : "Listo"}
        </button>
      </div>
    );
  }

  const vehiculosFiltrados = largoBusqueda >= 2 || vehiculos.length === 0 ? stockVivo.filas : vehiculos.filter((v) => {
    const q = busquedaStock.trim().toLowerCase();
    if (!q) return true;
    return `${v.marca} ${v.modelo} ${v.patente || ""}`.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={busquedaStock} onChange={(e) => setBusquedaStock(e.target.value)} placeholder="Buscar en stock por marca, modelo o patente..." className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:border-rose-500 text-slate-900 dark:text-white placeholder:text-slate-400" />
      </div>
      <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-white/10 rounded-xl divide-y divide-slate-100 dark:divide-white/10">
        {vehiculosFiltrados.slice(0, 30).map((v) => (
          <button key={v.id} type="button" onClick={() => seleccionarDeStock(v)} className="w-full text-left px-3 py-2.5 hover:bg-rose-50 dark:hover:bg-white/5 transition-colors flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-800 dark:text-white truncate">{v.marca} {v.modelo}</span>
            <span className="text-[11px] text-slate-400 shrink-0">{v.patente || "S/P"}</span>
          </button>
        ))}
        {buscando ? (
          <p className="px-3 py-3 text-[13px] text-slate-400 italic flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando...</p>
        ) : vehiculosFiltrados.length === 0 && <p className="px-3 py-3 text-[13px] text-slate-400 italic">Sin resultados.</p>}
      </div>
      <button type="button" onClick={() => setModoManual(true)} className="flex items-center gap-1.5 text-[#0145F2] dark:text-[#5b8dff] hover:text-[#0138c9] dark:hover:text-rose-300 text-[12px] font-bold">
        <Car className="w-3.5 h-3.5" /> Cargar vehículo manualmente
      </button>
    </div>
  );
}
