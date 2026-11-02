"use client";

import { useState } from "react";
import { X, ClipboardCheck, Search, Loader2, Car, Check } from "lucide-react";
import { supabase2 } from "@/lib/supabase/client";
import { BTN } from "@/components/panel/detalle/DetalleUI";
import { normalizarProspeccion } from "@/lib/panel/prospeccionLead";
import { nombreAuto, useStockParaElegir } from "@/components/panel/useStockParaElegir";

// Peritaje desde la ficha del lead (17/10/2026, Walter). Es el paso 2 de Peritajes → Nuevo peritaje con la persona ya
// elegida (el lead): un auto del stock o uno de afuera. Desde "Auto que le interesa" abre con ese auto ya elegido; desde
// "Avanzar la venta" abre con la lista del stock. El auto de afuera se precarga con el usado de "Cómo compra" y lleva
// marca, modelo, versión, año, km y patente, cada uno en su campo. Si la patente después entra al stock, la base vincula
// el peritaje sola (migraciones/sql_peritaje_cliente_y_vehiculo.sql).

export type OrigenPeritajeLead = "whatsapp" | "instagram" | "messenger" | "rodi" | "manual";

export type AutoInicialPeritaje = { id: string; marca: string; modelo: string; version?: string | null; anio: number | null; patente: string | null; km?: number | null };

const inputClass = "w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0145F2] text-slate-900 dark:text-white placeholder:text-slate-400";
const labelClass = "text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1";

export default function PeritajeLeadModal({ origen, leadId, prospeccion, autoInicial, onCreado, onClose }: {
  origen: OrigenPeritajeLead; leadId: string; prospeccion: unknown; autoInicial?: AutoInicialPeritaje | null;
  onCreado: (peritajeId: string) => void; onClose: () => void;
}) {
  const usado = normalizarProspeccion(prospeccion).usado;
  const [deAfuera, setDeAfuera] = useState(false);
  const [busquedaAuto, setBusquedaAuto] = useState("");
  const [autoStock, setAutoStock] = useState<AutoInicialPeritaje | null>(autoInicial ?? null);
  const [afuera, setAfuera] = useState({
    marca: usado?.marca ?? "", modelo: usado?.modelo ?? "", version: "",
    anio: usado?.anio != null ? String(usado.anio) : "", km: usado?.km != null ? String(usado.km) : "", patente: "",
  });
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState("");
  const stock = useStockParaElegir(busquedaAuto, { activo: !deAfuera && !autoStock });

  const campo = (k: keyof typeof afuera, etiqueta: string, extra: Partial<React.InputHTMLAttributes<HTMLInputElement>> = {}, limpiar = (v: string) => v) => (
    <div><label className={labelClass}>{etiqueta}</label><input value={afuera[k]} onChange={(e) => setAfuera({ ...afuera, [k]: limpiar(e.target.value) })} className={inputClass} {...extra} /></div>
  );

  const iniciar = async () => {
    if (deAfuera && (!afuera.marca.trim() || !afuera.modelo.trim())) return setError("Escribí al menos la marca y el modelo del auto.");
    if (!deAfuera && !autoStock) return setError("Elegí un auto del stock, o tocá \"No está en el stock\".");
    const km = afuera.km ? `${Number(afuera.km).toLocaleString("es-AR")} km` : "";
    const descripcion = deAfuera
      ? [[afuera.marca, afuera.modelo, afuera.version, afuera.anio].map((t) => t.trim()).filter(Boolean).join(" "), km].filter(Boolean).join(" · ")
      : nombreAuto(autoStock!);
    setCreando(true);
    setError("");
    const { data: id, error: errRpc } = await supabase2.rpc("crear_peritaje", {
      p_origen: origen,
      p_origen_id: leadId,
      p_vehiculo_id: deAfuera ? null : autoStock!.id,
      p_vehiculo_descripcion: descripcion,
      p_patente: deAfuera ? afuera.patente.trim() || null : autoStock!.patente,
    });
    setCreando(false);
    if (errRpc || !id) {
      console.error(errRpc);
      // Los avisos propios de la función (lead con peritaje, sesión vencida) se muestran tal cual.
      return setError(errRpc?.code === "P0001" ? errRpc.message : "No se pudo iniciar el peritaje.");
    }
    onCreado(id as string);
  };

  const pestana = (activa: boolean) => `py-2 rounded-lg text-[13px] font-bold transition-colors ${activa ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm" : "text-slate-500"}`;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50" onClick={() => !creando && onClose()}>
      <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-2xl w-full max-w-md border border-slate-100 dark:border-white/10 p-5 max-h-[88vh] flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between shrink-0">
          <p className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2"><ClipboardCheck className="w-4 h-4 text-[#0145F2]" /> ¿Qué auto se perita?</p>
          <button onClick={onClose} aria-label="Cerrar" className="p-1.5 -mt-1 -mr-1 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-white/5 shrink-0" role="tablist">
          <button role="tab" aria-selected={!deAfuera} onClick={() => { setDeAfuera(false); setError(""); }} className={pestana(!deAfuera)}>De nuestro stock</button>
          <button role="tab" aria-selected={deAfuera} onClick={() => { setDeAfuera(true); setError(""); }} className={pestana(deAfuera)}>No está en el stock</button>
        </div>

        {!deAfuera ? (
          autoStock ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 shrink-0">
              <span className="flex items-center gap-2 min-w-0 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                <Check className="w-4 h-4 shrink-0" /> <span className="truncate">{nombreAuto(autoStock)}{autoStock.patente ? ` · ${autoStock.patente}` : ""}</span>
              </span>
              <button onClick={() => setAutoStock(null)} className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:underline shrink-0">Cambiar</button>
            </div>
          ) : (
            <>
              <div className="relative shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input autoFocus value={busquedaAuto} onChange={(e) => setBusquedaAuto(e.target.value)} placeholder="Marca, modelo o patente" className={`${inputClass} pl-9`} />
              </div>
              <div className="flex-1 min-h-[160px] overflow-y-auto rounded-xl border border-slate-200 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/10">
                {stock.buscando && stock.filas.length === 0 ? (
                  <p className="flex items-center gap-1.5 text-sm text-slate-400 px-4 py-4"><Loader2 className="w-4 h-4 animate-spin" /> Cargando el stock…</p>
                ) : stock.filas.length === 0 ? (
                  <p className="text-sm text-slate-400 px-4 py-4">
                    No hay autos en el stock con eso.{" "}
                    <button onClick={() => setDeAfuera(true)} className="font-bold text-[#0145F2] dark:text-sky-400 hover:underline">Cargarlo como auto de afuera</button>
                  </p>
                ) : stock.filas.map((v) => (
                  <button key={v.id} onClick={() => { setAutoStock(v); setError(""); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 min-w-0">
                      <Car className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-sm font-medium text-slate-800 dark:text-white truncate">{nombreAuto(v)}</span>
                    </span>
                    <span className="text-[11px] text-slate-400 shrink-0">{v.patente || "S/P"}</span>
                  </button>
                ))}
              </div>
            </>
          )
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              {campo("marca", "Marca *")}
              {campo("modelo", "Modelo *")}
              {campo("version", "Versión")}
              {campo("anio", "Año", { inputMode: "numeric" }, (v) => v.replace(/\D/g, "").slice(0, 4))}
              {campo("km", "Kilómetros", { inputMode: "numeric" }, (v) => v.replace(/\D/g, "").slice(0, 7))}
              {campo("patente", "Patente", {}, (v) => v.toUpperCase())}
            </div>
            <p className="text-[11px] text-slate-400">Con la patente, si después el auto entra al stock (por ejemplo, una permuta), el peritaje queda guardado en su ficha.</p>
          </div>
        )}

        {error && <p className="text-xs font-semibold text-rose-600 shrink-0">{error}</p>}
        <div className="flex gap-2 shrink-0">
          <button onClick={iniciar} disabled={creando} className={BTN.primario}>{creando ? "Iniciando…" : "Iniciar peritaje"}</button>
          <button onClick={onClose} className={BTN.secundario}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
