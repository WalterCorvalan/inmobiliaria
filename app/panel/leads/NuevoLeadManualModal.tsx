"use client";

import { useState } from "react";
import { supabase2 } from "@/lib/supabase/client";
import { X, Save, Radar } from "lucide-react";
import { CANALES_ORIGEN } from "@/components/panel/conversaciones/LeadDetailModal";
import { etiquetaOrigen } from "@/lib/panel/origenesCliente";
import SelectorWeb from "@/components/ui/SelectorWeb";

interface Perfil { id: string; nombre: string }
interface Sucursal { id: string; nombre: string }

const inputClass = "w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-rose-500 text-slate-900 dark:text-white placeholder:text-slate-400";
const labelClass = "text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1";

export default function NuevoLeadManualModal({ vendedores, sucursales, miId, onClose, onCreado }: { vendedores: Perfil[]; sucursales: Sucursal[]; miId: string; onClose: () => void; onCreado: (lead: any) => void }) {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [canalOrigen, setCanalOrigen] = useState<string>("Oficina");
  const [sucursalId, setSucursalId] = useState("");
  const [vendedorId, setVendedorId] = useState("");
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) { setError("Completá el nombre."); return; }
    setGuardando(true);
    setError("");
    try {
      const { data, error: dbError } = await supabase2.from("leads_manuales").insert({
        nombre: nombre.trim(), telefono: telefono || null, email: email || null,
        canal_origen: canalOrigen || null, sucursal_id: sucursalId || null,
        vendedor_id: vendedorId || null, notas: notas || null, creado_por: miId,
      }).select("*").single();
      if (dbError) throw dbError;
      onCreado(data);
    } catch (err: any) {
      console.error(err);
      setError(err?.message ? `No se pudo crear el lead: ${err.message}` : "No se pudo crear el lead.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !guardando && onClose()} />
      <div className="relative bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/10 w-full max-w-md rounded-2xl shadow-2xl p-6">
        <div className="flex justify-between items-start mb-1">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><Radar className="w-5 h-5 text-[#0145F2]" /> Nuevo lead</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Para leads que no llegan por WhatsApp/Instagram/chat web — walk-in, MercadoLibre, cliente anterior, etc.</p>

        <form onSubmit={guardar} className="space-y-3">
          <div>
            <label className={labelClass}>Nombre *</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputClass} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Teléfono</label>
              <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Canal de origen</label>
              <div className="w-full"><SelectorWeb valor={canalOrigen} onCambio={setCanalOrigen} claseBoton={inputClass} opciones={CANALES_ORIGEN.map((c) => ({ valor: c, etiqueta: etiquetaOrigen(c) }))} /></div>
            </div>
            <div>
              <label className={labelClass}>Sucursal</label>
              <div className="w-full"><SelectorWeb valor={sucursalId} onCambio={setSucursalId} claseBoton={inputClass} opciones={[{ valor: "", etiqueta: "Sin especificar" }, ...sucursales.map((s) => ({ valor: s.id, etiqueta: s.nombre }))]} /></div>
            </div>
          </div>
          <div>
            <label className={labelClass}>Vendedor asignado</label>
            <div className="w-full"><SelectorWeb valor={vendedorId} onCambio={setVendedorId} claseBoton={inputClass} opciones={[{ valor: "", etiqueta: "Sin asignar" }, ...vendedores.map((v) => ({ valor: v.id, etiqueta: v.nombre }))]} /></div>
          </div>
          <div>
            <label className={labelClass}>Notas</label>
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} className={inputClass} />
          </div>

          {error && <p className="text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-500/10 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 rounded-xl transition-colors">Cancelar</button>
            <button type="submit" disabled={guardando} className="flex-1 py-2.5 flex items-center justify-center gap-2 text-sm font-bold bg-[#0145F2] hover:bg-[#0138c9] text-white rounded-xl transition-colors disabled:opacity-50">
              {guardando ? "Guardando..." : <><Save className="w-4 h-4" /> Crear lead</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
