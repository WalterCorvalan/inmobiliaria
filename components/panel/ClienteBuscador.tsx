"use client";

import { useEffect, useRef, useState } from "react";
import { supabase2 } from "@/lib/supabase/client";
import { buscarClienteDuplicado } from "@/lib/panel/clienteDedupe";
import { LEAD_ORIGEN_LABEL, type LeadEncontrado } from "@/lib/panel/buscarLeads";
import { Search, UserPlus, X, Check, ScanLine, Loader2, Megaphone } from "lucide-react";
import ConfirmDialog from "@/components/panel/ConfirmDialog";
import { normalizarOrigenCliente } from "@/lib/panel/origenesCliente";
import { avisar } from "@/components/panel/Dialogos";

export interface ClienteSeleccionado {
  id: string;
  nombre: string;
  apellido: string | null;
  dni_cuit: string | null;
  cuit_cuil: string | null;
  telefono: string | null;
  telefono_linea: string | null;
  email: string | null;
  calle: string | null;
  numero_calle: string | null;
  depto: string | null;
  localidad: string | null;
  codigo_postal: string | null;
  provincia: string | null;
  estado_civil: string | null;
  profesion: string | null;
  fecha_nacimiento: string | null;
  sexo?: string | null;
}

const inputClass = "w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-rose-500 focus:bg-white dark:focus:bg-white/10 transition-colors text-slate-900 dark:text-white placeholder:text-slate-400";

// Origen de cliente (los 8 valores que acepta clientes_origen_check) según el canal del lead.
const ORIGEN_CLIENTE_POR_LEAD: Record<LeadEncontrado["origen"], string> = {
  whatsapp: "WhatsApp", instagram: "Instagram", messenger: "Messenger", rodi: "Paffy", manual: "Salón",
};

export default function ClienteBuscador({
  clientes, seleccionado, onSeleccionar, prefillNuevo,
}: {
  clientes: any[]; seleccionado: ClienteSeleccionado | null; onSeleccionar: (cliente: ClienteSeleccionado | null) => void;
  /** Precarga el alta de "nuevo cliente" con nombre/teléfono ya conocidos
     (ej. viene de un lead) y abre ese modo directo, sin que el vendedor
     tenga que buscar y después apretar "Nuevo cliente" a mano. */
  prefillNuevo?: { nombre: string; apellido?: string; telefono: string } | null;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [creandoNuevo, setCreandoNuevo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ mensaje: string; accion: () => void } | null>(null);
  const [escaneando, setEscaneando] = useState(false);
  const [errorEscaneo, setErrorEscaneo] = useState("");
  // El escaneo del DNI arranca apagado (14/10/2026): lo prende un administrador en Configuración → Empresa → IA.
  const [dniActivo, setDniActivo] = useState(false);
  useEffect(() => {
    let vivo = true;
    supabase2.from("configuracion_empresa").select("ocr_dni_activo").eq("id", true).maybeSingle()
      .then(({ data }) => { if (vivo) setDniActivo(!!data?.ocr_dni_activo); });
    return () => { vivo = false; };
  }, []);
  const inputDniRef = useRef<HTMLInputElement>(null);
  // Origen con el que se guarda el cliente nuevo: el del lead elegido, o "Salón" si se carga a mano.
  // Sin esto la base le ponía su valor por defecto, que clientes_origen_check ya no acepta.
  const [origenNuevo, setOrigenNuevo] = useState("Salón");
  const [nuevo, setNuevo] = useState({
    nombre: "", apellido: "", dni_cuit: "", cuit_cuil: "", telefono: "", telefono_linea: "",
    email: "", calle: "", numero_calle: "", depto: "", localidad: "", codigo_postal: "",
    provincia: "", estado_civil: "", profesion: "", fecha_nacimiento: "",
  });

  useEffect(() => {
    if (!prefillNuevo || seleccionado) return;
    const [nombrePref, ...restoPref] = prefillNuevo.nombre.split(" ");
    setNuevo((prev) => ({
      ...prev,
      nombre: prefillNuevo.apellido ? prefillNuevo.nombre : (nombrePref || prefillNuevo.nombre),
      apellido: prefillNuevo.apellido || restoPref.join(" "),
      telefono: prefillNuevo.telefono || prev.telefono,
    }));
    setCreandoNuevo(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillNuevo]);

  const escanearDNI = async (file: File) => {
    setErrorEscaneo("");
    setEscaneando(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/panel/ocr-dni", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo leer el DNI.");
      setNuevo((prev) => ({
        ...prev,
        nombre: data.nombre || prev.nombre,
        apellido: data.apellido || prev.apellido,
        dni_cuit: data.dni || prev.dni_cuit,
        fecha_nacimiento: data.fecha_nacimiento || prev.fecha_nacimiento,
        calle: data.domicilio_calle || prev.calle,
        numero_calle: data.domicilio_numero || prev.numero_calle,
        localidad: data.localidad || prev.localidad,
        provincia: data.provincia || prev.provincia,
        codigo_postal: data.codigo_postal || prev.codigo_postal,
      }));
    } catch (err) {
      setErrorEscaneo(err instanceof Error ? err.message : "Error al escanear el DNI.");
    } finally {
      setEscaneando(false);
      if (inputDniRef.current) inputDniRef.current.value = "";
    }
  };

  // Búsqueda en vivo contra la base en vez de filtrar "clientes" (el array
  // que recibe este componente por prop) -- ese array se trae UNA sola vez
  // al cargar la página que lo usa (Señas/Presupuestos), así que un cliente
  // creado en la misma sesión (acá mismo con "Cargar cliente nuevo", o desde
  // /panel/clientes en otra pestaña) nunca aparecía en la búsqueda hasta
  // recargar la página entera (bug encontrado en la auditoría de flujo real,
  // hallazgo #4). Se filtra igual sobre el array local mientras el usuario
  // recién empieza a tipear (1 carácter, resultado instantáneo, cubre el
  // caso común de "ya estaba en la lista"), y a partir de 2 caracteres se
  // dispara una consulta real que sí ve todo lo que existe ahora mismo.
  const [resultadosVivo, setResultadosVivo] = useState<any[] | null>(null);
  const [leadsEncontrados, setLeadsEncontrados] = useState<LeadEncontrado[]>([]);
  const [buscando, setBuscando] = useState(false);
  useEffect(() => {
    const q = busqueda.trim();
    if (q.length < 2) { setResultadosVivo(null); setLeadsEncontrados([]); return; }
    setBuscando(true);
    const timer = setTimeout(async () => {
      const [{ data }, leadsRes] = await Promise.all([
        supabase2
          .from("clientes")
          .select("id, nombre, apellido, dni_cuit, cuit_cuil, telefono, telefono_linea, email, calle, numero_calle, depto, localidad, codigo_postal, provincia, estado_civil, profesion, fecha_nacimiento")
          .or(`nombre.ilike.%${q}%,apellido.ilike.%${q}%,dni_cuit.ilike.%${q}%`)
          .order("nombre")
          .limit(20),
        // Vía API (service-role) y no supabase2 directo -- la RLS de
        // "cada vendedor ve solo sus leads asignados" le vaciaba este
        // resultado a cualquiera que no sea admin, aunque el lead buscado
        // fuera de otro vendedor o estuviera sin asignar.
        fetch(`/api/panel/leads/buscar?q=${encodeURIComponent(q)}`).then((r) => r.json()).catch(() => ({ leads: [] })),
      ]);
      setResultadosVivo(data || []);
      setLeadsEncontrados(leadsRes.leads || []);
      setBuscando(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [busqueda]);

  const filtrados = resultadosVivo ?? clientes.filter((c) => {
    const q = busqueda.toLowerCase();
    return !q || `${c.nombre} ${c.apellido || ""} ${c.dni_cuit || ""}`.toLowerCase().includes(q);
  });

  // Un lead no tiene los campos que este formulario necesita (DNI, domicilio,
  // etc.) -- elegirlo no lo "engancha" directo como si fuera un cliente real,
  // precarga el alta de cliente nuevo con nombre/teléfono y deja el resto
  // para completar a mano.
  const elegirLead = (l: LeadEncontrado) => {
    setOrigenNuevo(ORIGEN_CLIENTE_POR_LEAD[l.origen]);
    const [nombreLead, ...resto] = l.nombre.split(" ");
    setNuevo((prev) => ({ ...prev, nombre: nombreLead || l.nombre, apellido: resto.join(" "), telefono: l.telefono || prev.telefono }));
    setCreandoNuevo(true);
  };

  const guardarNuevoCliente = async () => {
    if (!nuevo.nombre.trim() || !nuevo.apellido.trim()) {
      avisar("Nombre y apellido son obligatorios.");
      return;
    }
    setGuardando(true);
    try {
      const existente = await buscarClienteDuplicado(supabase2, nuevo);
      if (existente) {
        setConfirmDialog({
          mensaje: `Ya existe un cliente con ese DNI/teléfono: ${existente.nombre} ${existente.apellido || ""}. ¿Usar ese en vez de crear uno nuevo?`,
          accion: () => {
            onSeleccionar(existente as any);
            setCreandoNuevo(false);
          },
        });
        return;
      }
      const { data, error } = await supabase2
        .from("clientes")
        .insert({ ...nuevo, origen: normalizarOrigenCliente(origenNuevo), fecha_nacimiento: nuevo.fecha_nacimiento || null })
        .select("*")
        .single();
      if (error) throw error;
      onSeleccionar(data as any);
      setCreandoNuevo(false);
    } catch (err) {
      // Los errores de Supabase (PostgrestError) no son instancias de Error,
      // así que "err instanceof Error" siempre daba false acá y el usuario
      // veía el mensaje genérico en vez del motivo real (ej. fecha de
      // nacimiento inválida rechazada por Postgres).
      const mensaje = err instanceof Error ? err.message : (err as { message?: string })?.message;
      avisar(mensaje || "Error al crear el cliente.");
    } finally {
      setGuardando(false);
    }
  };

  if (seleccionado) {
    return (
      <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
            <Check className="w-4 h-4 shrink-0" /> {seleccionado.nombre} {seleccionado.apellido}
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-300 mt-0.5">
            {seleccionado.dni_cuit ? `DNI ${seleccionado.dni_cuit}` : "Sin DNI"} · {seleccionado.telefono || "Sin teléfono"}
          </p>
        </div>
        <button type="button" onClick={() => onSeleccionar(null)} className="shrink-0 text-emerald-600 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-200 bg-white dark:bg-white/5 border border-emerald-200 dark:border-emerald-500/20 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-colors">
          Cambiar
        </button>
      </div>
    );
  }

  if (creandoNuevo) {
    return (
      <>
      <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Nuevo cliente</span>
          <button type="button" onClick={() => setCreandoNuevo(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><X className="w-4 h-4" /></button>
        </div>

        <button type="button" onClick={() => inputDniRef.current?.click()} disabled={escaneando || !dniActivo}
          className="w-full flex items-center justify-center gap-2 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/20 font-bold py-2.5 rounded-lg text-[11px] uppercase tracking-widest disabled:opacity-50 transition-colors">
          {escaneando ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Leyendo DNI...</> : <><ScanLine className="w-3.5 h-3.5" /> Escanear DNI (foto)</>}
        </button>
        <input ref={inputDniRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && escanearDNI(e.target.files[0])} />
        {!dniActivo && <p className="text-[11px] text-slate-400">Escanear DNI está apagado. Lo prende un administrador en Configuración → Empresa → IA.</p>}
        {errorEscaneo && <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">{errorEscaneo}</p>}
        <p className="text-[10px] text-slate-400 -mt-1">Sacale foto al frente (nombre, DNI) y después al dorso (domicilio) — completa lo que falte, no pisa lo que ya escaneaste.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input className={inputClass} placeholder="Nombre *" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
          <input className={inputClass} placeholder="Apellido *" value={nuevo.apellido} onChange={(e) => setNuevo({ ...nuevo, apellido: e.target.value })} />
          <input className={inputClass} placeholder="DNI" value={nuevo.dni_cuit} onChange={(e) => setNuevo({ ...nuevo, dni_cuit: e.target.value })} />
          <input className={inputClass} placeholder="CUIT/CUIL" value={nuevo.cuit_cuil} onChange={(e) => setNuevo({ ...nuevo, cuit_cuil: e.target.value })} />
          <input className={inputClass} placeholder="Teléfono celular" value={nuevo.telefono} onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value })} />
          <input className={inputClass} placeholder="Teléfono de línea" value={nuevo.telefono_linea} onChange={(e) => setNuevo({ ...nuevo, telefono_linea: e.target.value })} />
          <input className={inputClass} placeholder="Correo electrónico" value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} />
          <input className={inputClass} type="date" value={nuevo.fecha_nacimiento} onChange={(e) => setNuevo({ ...nuevo, fecha_nacimiento: e.target.value })} />
          <input className={inputClass} placeholder="Calle" value={nuevo.calle} onChange={(e) => setNuevo({ ...nuevo, calle: e.target.value })} />
          <input className={inputClass} placeholder="Número" value={nuevo.numero_calle} onChange={(e) => setNuevo({ ...nuevo, numero_calle: e.target.value })} />
          <input className={inputClass} placeholder="Depto" value={nuevo.depto} onChange={(e) => setNuevo({ ...nuevo, depto: e.target.value })} />
          <input className={inputClass} placeholder="Localidad" value={nuevo.localidad} onChange={(e) => setNuevo({ ...nuevo, localidad: e.target.value })} />
          <input className={inputClass} placeholder="Código postal" value={nuevo.codigo_postal} onChange={(e) => setNuevo({ ...nuevo, codigo_postal: e.target.value })} />
          <input className={inputClass} placeholder="Provincia" value={nuevo.provincia} onChange={(e) => setNuevo({ ...nuevo, provincia: e.target.value })} />
          <input className={inputClass} placeholder="Estado civil" value={nuevo.estado_civil} onChange={(e) => setNuevo({ ...nuevo, estado_civil: e.target.value })} />
          <input className={inputClass} placeholder="Profesión" value={nuevo.profesion} onChange={(e) => setNuevo({ ...nuevo, profesion: e.target.value })} />
        </div>
        <button type="button" onClick={guardarNuevoCliente} disabled={guardando} className="w-full bg-[#0145F2] hover:bg-[#0138c9] text-white font-bold py-2.5 rounded-lg text-[11px] uppercase tracking-widest disabled:opacity-50 transition-colors">
          {guardando ? "Guardando..." : "Usar este cliente"}
        </button>
      </div>
      <ConfirmDialog
        abierto={!!confirmDialog}
        mensaje={confirmDialog?.mensaje || ""}
        onConfirmar={() => { confirmDialog?.accion(); setConfirmDialog(null); }}
        onCancelar={() => setConfirmDialog(null)}
      />
      </>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input className={`${inputClass} pl-9`} placeholder="Buscar cliente por nombre, apellido o DNI..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      </div>
      {busqueda && (
        <div className="max-h-64 overflow-y-auto border border-slate-200 dark:border-white/10 rounded-xl divide-y divide-slate-100 dark:divide-white/10">
          {filtrados.slice(0, 20).map((c) => (
            <button key={c.id} type="button" onClick={() => onSeleccionar(c)} className="w-full text-left px-3 py-2.5 hover:bg-rose-50 dark:hover:bg-white/5 transition-colors flex items-center justify-between">
              <span className="text-sm font-medium text-slate-800 dark:text-white">{c.nombre} {c.apellido || ""}</span>
              <span className="text-[11px] text-slate-400">{c.dni_cuit || "Sin DNI"}</span>
            </button>
          ))}
          {leadsEncontrados.map((l) => (
            <button key={`${l.origen}-${l.id}`} type="button" onClick={() => elegirLead(l)} className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-800 dark:text-white flex items-center gap-1.5 min-w-0"><Megaphone className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> <span className="truncate">{l.nombre}</span></span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-300 shrink-0">{LEAD_ORIGEN_LABEL[l.origen]}</span>
            </button>
          ))}
          {buscando ? (
            <p className="px-3 py-3 text-[13px] text-slate-400 italic flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando...</p>
          ) : filtrados.length === 0 && leadsEncontrados.length === 0 && <p className="px-3 py-3 text-[13px] text-slate-400 italic">Sin resultados.</p>}
        </div>
      )}
      <button type="button" onClick={() => setCreandoNuevo(true)} className="flex items-center gap-1.5 text-[#0145F2] dark:text-[#5b8dff] hover:text-[#0138c9] dark:hover:text-rose-300 text-[12px] font-bold">
        <UserPlus className="w-3.5 h-3.5" /> Cargar cliente nuevo
      </button>
    </div>
  );
}
