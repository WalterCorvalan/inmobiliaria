"use client";

import { useState, useEffect } from "react";
import { supabase2 } from "@/lib/supabase/client";
import { X, Loader2, DoorOpen, Globe, ScanLine, Search, Car, XCircle, UserRound, Megaphone, StickyNote } from "lucide-react";
import { usePasosFormulario, BarraPasos, TituloPaso as TituloPasoBase, type PasoFormulario } from "@/components/panel/formulario/PasosFormulario";
import EscanearDniModal, { type DatosDni } from "./EscanearDniModal";
import { parseFechaLocal } from "@/lib/panel/fechas";
import { crearAlerta } from "@/lib/panel/alertas";
import { Compartido } from "@/components/ui/movimiento";
import { ORIGENES_CLIENTE, normalizarOrigenCliente } from "@/lib/panel/origenesCliente";

import { useStockParaElegir } from "@/components/panel/useStockParaElegir";
import { etiquetaOrigen } from "@/lib/panel/origenesCliente";
import SelectorWeb from "@/components/ui/SelectorWeb";
// Se agregan los canales reales que faltaban (MercadoLibre, Rodi,
// Messenger) -- mismo vocabulario que ya usa CANALES_ORIGEN en
// components/panel/conversaciones/LeadDetailModal.tsx para el mismo
// concepto ("canal de origen" de un lead), así este formulario no queda
// con una lista propia desincronizada del resto del panel. "Google Ads"
// y "Cliente anterior" se sacaron a pedido -- no se cargan clientes a
// mano con esos orígenes. "Showroom" también se sacó del selector (a
// pedido) y se reemplaza por "Salón" -- los clientes ya cargados con
// "Showroom" quedan como están: "Cómo nos conocieron" en Marketing →
// Embudo sigue agrupando por el string tal cual está guardado en
// `clientes.origen`. IMPORTANTE: "Salón" necesita estar en el CHECK
// constraint `clientes_origen_check` de la base -- si se agrega otro
// valor acá, también hay que ampliar ese constraint (ver auditoría de
// sep-2026, mismo bug que rompía el alta de cliente).
// PRIORIDAD 1 -- lista CERRADA de orígenes de cliente (Walter, 7/10/2026, repetido muchas veces): estos 9 y ningún otro.
// La fuente es lib/panel/origenesCliente.ts (con test que la congela). No agregar, sacar ni renombrar ninguno sin que él lo pida.
export const ORIGENES: string[] = [...ORIGENES_CLIENTE];
const ETAPAS = [
  { value: "sin_contactar", label: "Nuevo" },
  { value: "contactado", label: "Contactado" },
  { value: "negociacion", label: "En Negociación" },
  { value: "cerrado", label: "Cerrado" },
  { value: "perdido", label: "Sin interés" },
];

interface Perfil { id: string; nombre: string; roles: string[] }
interface Disponibilidad { vendedor_id: string; recibir_leads: boolean }

interface Props {
  perfiles: Perfil[];
  disponibilidad: Disponibilidad[];
  miId: string;
  editando?: any;
  onClose: () => void;
  onCreado: (cliente: any) => void;
}

// Elige vendedor por rotación: entre los que reciben leads, el que hace más
// tiempo no recibe uno de este mismo canal (walk-in y digital rotan aparte,
// así nadie se "saltea" cuando los dos canales están activos a la vez).
async function elegirPorRotacion(canal: string, disponibles: Perfil[]) {
  if (disponibles.length === 0) return null;
  const { data } = await supabase2
    .from("clientes")
    .select("vendedor_id, created_at")
    .eq("canal_ingreso", canal)
    .order("created_at", { ascending: false });

  const ultimaAsignacion: Record<string, string> = {};
  (data || []).forEach((row: any) => {
    if (row.vendedor_id && !ultimaAsignacion[row.vendedor_id]) ultimaAsignacion[row.vendedor_id] = row.created_at;
  });

  let elegido = disponibles[0];
  let elegidoFecha: string | undefined = ultimaAsignacion[elegido.id];
  for (const p of disponibles) {
    const f = ultimaAsignacion[p.id];
    if (!f) { elegido = p; elegidoFecha = undefined; break; }
    if (elegidoFecha && f < elegidoFecha) { elegido = p; elegidoFecha = f; }
  }
  return elegido.id;
}

// Para el auto de interés solo se ofrecen los autos en venta.
const SOLO_DISPONIBLES = ["disponible"] as const;

export default function NuevoClienteModal({ perfiles, disponibilidad, miId, editando, onClose, onCreado }: Props) {
  const esEdicion = !!editando;
  // "Vendedor asignado" y la rotación automática de abajo usaban `perfiles`
  // tal cual llega (TODOS los perfiles activos, sin filtrar por rol --
  // page.tsx no aplica filtrarVendedoresAsignables acá porque `perfiles`
  // también se usa en ClientesClient.tsx para cosas que sí necesitan la
  // lista completa, como el mapa de nombres y el filtro "clientes por
  // perfil" que puede incluir asignaciones históricas a encargado/gestoría).
  // Filtrado local, solo para este selector: alguien de gestoría/finanzas
  // (ej. Cecilia) no es vendedor y no debería aparecer para asignar un
  // cliente nuevo, ni entrar en la rotación automática.
  const vendedores = perfiles.filter((p) => p.roles?.includes("ventas") || p.roles?.includes("encargado"));
  const [canalIngreso, setCanalIngreso] = useState<"walk_in" | "lead_digital">(editando?.canal_ingreso || "lead_digital");
  const [nombre, setNombre] = useState(editando?.nombre || "");
  const [tipo, setTipo] = useState(editando?.tipo || "Regular");
  const [sexo, setSexo] = useState(editando?.sexo || "");
  const [dniCuit, setDniCuit] = useState(editando?.dni_cuit || "");
  const [telefono, setTelefono] = useState(editando?.telefono || "");
  const [email, setEmail] = useState(editando?.email || "");
  // Un cliente viejo con un origen que ya no existe (Showroom, Referido...) se abre ya convertido a uno de los 9 (Showroom -> Salón, el resto -> Otro).
  const [origen, setOrigen] = useState<string>(editando ? normalizarOrigenCliente(editando.origen) : "Web");
  const [etapa, setEtapa] = useState(editando?.pipeline_stage || "sin_contactar");
  const [vehiculoTexto, setVehiculoTexto] = useState(editando?.vehiculo_interes_texto || "");
  const [vehiculoInteresId, setVehiculoInteresId] = useState<string>(editando?.vehiculo_interes_id || "");
  const [vehiculoInteresLabel, setVehiculoInteresLabel] = useState("");
  const [busquedaVehiculo, setBusquedaVehiculo] = useState("");
  const [listaVehiculoAbierta, setListaVehiculoAbierta] = useState(false);
  const [buscaMarca, setBuscaMarca] = useState(editando?.busca_marca || "");
  const [buscaModelo, setBuscaModelo] = useState(editando?.busca_modelo || "");
  const [buscaMoneda, setBuscaMoneda] = useState(editando?.busca_moneda || "USD");
  const [buscaAnioDesde, setBuscaAnioDesde] = useState(editando?.busca_anio_desde ? String(editando.busca_anio_desde) : "");
  const [buscaAnioHasta, setBuscaAnioHasta] = useState(editando?.busca_anio_hasta ? String(editando.busca_anio_hasta) : "");
  const [buscaPresupuesto, setBuscaPresupuesto] = useState(editando?.busca_presupuesto_max ? String(editando.busca_presupuesto_max) : "");
  const [fechaNacimiento, setFechaNacimiento] = useState(editando?.fecha_nacimiento || "");
  const [ultimoContacto, setUltimoContacto] = useState(editando?.ultimo_contacto ? String(editando.ultimo_contacto).slice(0, 10) : "");
  const [vendedorId, setVendedorId] = useState(editando?.vendedor_id || "");
  const [direccion, setDireccion] = useState(editando?.direccion || "");
  const [observaciones, setObservaciones] = useState(editando?.observaciones || "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [modalEscaner, setModalEscaner] = useState(false);

  // Al editar un cliente que ya tiene vehiculo_interes_id, la fila de
  // `clientes` (select("*") en page.tsx) no trae marca/modelo -- se resuelve
  // acá una sola vez para mostrar el nombre en vez de un id pelado.
  useEffect(() => {
    if (!editando?.vehiculo_interes_id) return;
    supabase2.from("vehiculos").select("marca, modelo, patente").eq("id", editando.vehiculo_interes_id).maybeSingle().then(({ data }) => {
      if (data) setVehiculoInteresLabel(`${data.marca} ${data.modelo}${data.patente ? ` (${data.patente})` : ""}`);
    });
  }, [editando?.vehiculo_interes_id]);

  // Stock disponible para elegir el auto de interés: al tocar el campo ya se ve la lista, y desde 2 letras se busca
  // en la base palabra por palabra (components/panel/useStockParaElegir.ts, el mismo que usa VehiculoSelector).
  const stockInteres = useStockParaElegir(busquedaVehiculo, { estados: SOLO_DISPONIBLES, activo: listaVehiculoAbierta && !vehiculoInteresId, limite: 30 });
  const resultadosVehiculo = stockInteres.filas;
  const buscandoVehiculo = stockInteres.buscando && resultadosVehiculo.length === 0;

  const elegirVehiculoInteres = (v: any) => {
    setVehiculoInteresId(v.id);
    setVehiculoInteresLabel(`${v.marca} ${v.modelo}${v.patente ? ` (${v.patente})` : ""}`);
    setBusquedaVehiculo("");
    setListaVehiculoAbierta(false);
  };

  const aplicarDatosDni = (datos: DatosDni) => {
    if (datos.nombre) setNombre(datos.nombre);
    if (datos.sexo) setSexo(datos.sexo);
    if (datos.dniCuit) setDniCuit(datos.dniCuit);
    if (datos.fechaNacimiento) setFechaNacimiento(datos.fechaNacimiento);
    setModalEscaner(false);
  };

  const fechaAlta = new Date().toLocaleDateString("es-AR");

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      setError("Falta el nombre.");
      return;
    }
    setGuardando(true);
    setError("");
    try {
      let vendedorFinal = vendedorId || null;
      if (!vendedorFinal && !esEdicion) {
        const disponibles = vendedores.filter((p) => {
          const d = disponibilidad.find((x) => x.vendedor_id === p.id);
          return !d || d.recibir_leads !== false;
        });
        vendedorFinal = await elegirPorRotacion(canalIngreso, disponibles);
      }

      const payload = {
        nombre: nombre.trim(),
        tipo,
        sexo: sexo || null,
        dni_cuit: dniCuit || null,
        telefono: telefono || null,
        email: email || null,
        origen: normalizarOrigenCliente(origen),
        canal_ingreso: canalIngreso,
        pipeline_stage: etapa,
        pipeline_stage_manual: esEdicion ? editando.pipeline_stage_manual : etapa !== "sin_contactar",
        vehiculo_interes_id: vehiculoInteresId || null,
        vehiculo_interes_texto: vehiculoTexto || null,
        busca_marca: buscaMarca || null,
        busca_modelo: buscaModelo || null,
        busca_moneda: buscaMoneda,
        busca_anio_desde: buscaAnioDesde ? Number(buscaAnioDesde) : null,
        busca_anio_hasta: buscaAnioHasta ? Number(buscaAnioHasta) : null,
        busca_presupuesto_max: buscaPresupuesto ? Number(buscaPresupuesto) : null,
        fecha_nacimiento: fechaNacimiento || null,
        ultimo_contacto: ultimoContacto ? parseFechaLocal(ultimoContacto).toISOString() : null,
        vendedor_id: vendedorFinal,
        direccion: direccion || null,
        observaciones: observaciones || null,
        // Reasignación manual (admin cambiando el vendedor a mano) resetea el
        // reloj del cron de reasignación por timeout — sino un lead recién
        // reasignado a mano puede volver a soltarse solo poco después, porque
        // el cron mide desde created_at si nadie tocó este campo.
        ...(esEdicion && vendedorFinal !== editando.vendedor_id ? { ultima_reasignacion_en: new Date().toISOString() } : {}),
      };

      const { data, error: dbError } = esEdicion
        ? await supabase2.from("clientes").update(payload).eq("id", editando.id).select().single()
        : await supabase2.from("clientes").insert({ ...payload, creado_por: miId || null }).select().single();
      if (dbError) throw dbError;
      if (!esEdicion && miId) {
        crearAlerta(supabase2, miId, `Nuevo cliente registrado — ${data.nombre}`, {
          mensaje: `Cargado hoy. Origen: ${etiquetaOrigen(data.origen)}.${data.telefono ? ` Tel: ${data.telefono}.` : ""}`,
          link: "/panel/clientes", tipo: "cliente", prioridad: "novedad", categoriaNotif: "clientes",
        });
      }
      onCreado(data);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err?.message ? `No se pudo guardar el cliente: ${err.message}` : "No se pudo guardar el cliente.");
    } finally {
      setGuardando(false);
    }
  };

  const inputClass = "w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#0145F2] text-slate-900 dark:text-white placeholder:text-slate-400";
  const labelClass = "text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1";

  // Índice de pasos: solo navegación dentro del formulario (ver
  // components/panel/formulario/PasosFormulario.tsx), no cambia qué se guarda.
  const pasos: PasoFormulario[] = [
    { id: "datos", label: "Datos del cliente", icono: UserRound },
    { id: "origen", label: "Origen y seguimiento", icono: Megaphone },
    { id: "busca", label: "Qué busca", icono: Car },
    { id: "notas", label: "Notas", icono: StickyNote },
  ];
  const { cuerpoRef, pasoActivo, nPaso, irAPaso, alScrollear } = usePasosFormulario(pasos, "cliente");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !guardando && onClose()} />
      <div className="relative bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/10 w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex justify-between items-start px-6 pt-6 pb-3 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{esEdicion ? "Editar cliente" : "Nuevo cliente"}</h3>
            {esEdicion && editando?.nombre && <Compartido destino como="p" id={`nombre-cliente-${editando.id}`} className="text-sm font-bold text-slate-900 dark:text-white">{editando.nombre}</Compartido>}
            <p className="text-xs text-slate-500 dark:text-slate-400">Campos mínimos: nombre. El resto se puede completar más tarde.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>

        <BarraPasos pasos={pasos} activo={pasoActivo} onIr={irAPaso} />

        <form onSubmit={guardar} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div ref={cuerpoRef} onScroll={alScrollear} className="space-y-4 px-6 py-4 overflow-y-auto overflow-x-hidden flex-1 min-h-0 border-t border-slate-100 dark:border-white/10">
            <TituloPaso id="datos" n={nPaso("datos")} titulo="Datos del cliente" icono={UserRound} primero />
            <button type="button" onClick={() => setModalEscaner(true)} className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors">
              <ScanLine className="w-4 h-4" /> Escanear DNI (autocompletar)
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Nombre completo *</label>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Juan García" className={inputClass} autoFocus />
              </div>
              <div>
                <label className={labelClass}>Tipo</label>
                <div className="w-full"><SelectorWeb valor={tipo} onCambio={setTipo} claseBoton={inputClass} opciones={[{ valor: "Regular", etiqueta: "Regular" }, { valor: "VIP", etiqueta: "VIP" }, { valor: "Empresa", etiqueta: "Empresa" }]} /></div>
              </div>
              <div>
                <label className={labelClass}>Sexo</label>
                <div className="w-full"><SelectorWeb valor={sexo} onCambio={setSexo} claseBoton={inputClass} opciones={[{ valor: "", etiqueta: "—" }, { valor: "Femenino", etiqueta: "Femenino" }, { valor: "Masculino", etiqueta: "Masculino" }, { valor: "Prefiero no decir", etiqueta: "Prefiero no decir" }]} /></div>
              </div>
              <div>
                <label className={labelClass}>DNI / CUIT</label>
                <input value={dniCuit} onChange={(e) => setDniCuit(e.target.value)} placeholder="Solo números, sin puntos" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Teléfono</label>
                <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Solo números, sin + ni espacios" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="juan@email.com" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Fecha de nacimiento</label>
                <input type="date" value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Dirección</label>
                <input value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Av. Corrientes 1234, CABA" className={inputClass} />
              </div>
            </div>

            <TituloPaso id="origen" n={nPaso("origen")} titulo="Origen y seguimiento" icono={Megaphone} />
            <div className="bg-indigo-50/60 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/20 rounded-xl p-3.5">
              <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300 mb-2">¿Por qué se contacta el cliente?</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setCanalIngreso("walk_in")} className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${canalIngreso === "walk_in" ? "bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-500/15 dark:border-amber-500/30 dark:text-amber-300" : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300"}`}>
                  <DoorOpen className="w-4 h-4" /> Entró por la puerta
                </button>
                <button type="button" onClick={() => setCanalIngreso("lead_digital")} className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${canalIngreso === "lead_digital" ? "bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-500/15 dark:border-blue-500/30 dark:text-blue-300" : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300"}`}>
                  <Globe className="w-4 h-4" /> Lead digital (WhatsApp / IG / ML / web)
                </button>
              </div>
              <p className="text-[10px] text-indigo-700/70 dark:text-indigo-300/60 mt-2 leading-snug">
                Cada botón usa una cola de rotación independiente: si dejás "Vendedor asignado" sin elegir, se asigna solo al que hace más tiempo no recibe un lead de este canal.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Origen / Lead Source</label>
                <div className="w-full"><SelectorWeb valor={origen} onCambio={setOrigen} claseBoton={inputClass} opciones={ORIGENES.map((o) => ({ valor: o, etiqueta: etiquetaOrigen(o) }))} /></div>
              </div>
              <div>
                <label className={labelClass}>Etapa del Pipeline</label>
                <div className="w-full"><SelectorWeb valor={etapa} onCambio={setEtapa} claseBoton={inputClass} opciones={ETAPAS.map((e) => ({ valor: e.value, etiqueta: e.label }))} /></div>
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Vendedor asignado</label>
                <div className="w-full"><SelectorWeb valor={vendedorId} etiquetaActual={perfiles.find((p) => p.id === vendedorId)?.nombre} onCambio={setVendedorId} claseBoton={inputClass} opciones={[{ valor: "", etiqueta: "— Sin asignar —" }, ...vendedores.map((p) => ({ valor: p.id, etiqueta: p.nombre }))]} /></div>
              </div>
              <div>
                <label className={labelClass}>Último contacto</label>
                <input type="date" value={ultimoContacto} onChange={(e) => setUltimoContacto(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Fecha de alta</label>
                <input disabled value={fechaAlta} className={`${inputClass} opacity-60 cursor-not-allowed`} />
              </div>
            </div>

            <TituloPaso id="busca" n={nPaso("busca")} titulo="Qué busca" icono={Car} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Vehículo de interés (del stock)</label>
                {vehiculoInteresId ? (
                  <div className="flex items-center justify-between gap-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl px-3 py-2.5">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300 truncate"><Car className="w-3.5 h-3.5 shrink-0" /> {vehiculoInteresLabel || "Vehículo seleccionado"}</span>
                    <button type="button" onClick={() => { setVehiculoInteresId(""); setVehiculoInteresLabel(""); }} className="text-emerald-600 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-100 shrink-0"><XCircle className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input value={busquedaVehiculo} onChange={(e) => { setBusquedaVehiculo(e.target.value); setListaVehiculoAbierta(true); }} onFocus={() => setListaVehiculoAbierta(true)} onBlur={() => setTimeout(() => setListaVehiculoAbierta(false), 150)} placeholder="Buscar por marca, modelo o patente..." className={`${inputClass} pl-9`} />
                    {listaVehiculoAbierta && (
                      <div className="absolute z-20 mt-1 w-full max-h-44 overflow-y-auto bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-lg shadow-lg divide-y divide-slate-100 dark:divide-white/10">
                        {buscandoVehiculo ? (
                          <p className="px-3 py-2.5 text-[13px] text-slate-400 italic flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando...</p>
                        ) : resultadosVehiculo.length === 0 ? (
                          <p className="px-3 py-2.5 text-[13px] text-slate-400 italic">Sin resultados en stock disponible.</p>
                        ) : resultadosVehiculo.map((v) => (
                          <button key={v.id} type="button" onMouseDown={(e) => { e.preventDefault(); elegirVehiculoInteres(v); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/5 flex items-center justify-between gap-2">
                            <span className="truncate text-slate-800 dark:text-white">{v.marca} {v.modelo}</span>
                            <span className="text-[11px] text-slate-400 shrink-0">{v.patente || "S/P"}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <p className="text-[10px] text-slate-400 mt-1">Si no está en stock, describilo en el campo de texto libre de abajo</p>
              </div>

              <div>
                <label className={labelClass}>...o describí lo que busca (texto libre)</label>
                <input value={vehiculoTexto} onChange={(e) => setVehiculoTexto(e.target.value)} placeholder="Ej: SUV mediana, sedan 2020+, etc." className={inputClass} />
              </div>

              <div className="sm:col-span-2 bg-slate-50 dark:bg-white/5 rounded-xl p-3.5 border border-slate-100 dark:border-white/10">
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2.5 flex items-center gap-1.5"><Search className="w-3.5 h-3.5" /> Qué busca (para matchear con el stock)</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>Marca</label>
                    <input value={buscaMarca} onChange={(e) => setBuscaMarca(e.target.value)} placeholder="Toyota" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Modelo</label>
                    <input value={buscaModelo} onChange={(e) => setBuscaModelo(e.target.value)} placeholder="Hilux" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Moneda</label>
                    <div className="w-full"><SelectorWeb valor={buscaMoneda} onCambio={setBuscaMoneda} claseBoton={inputClass} opciones={[{ valor: "USD", etiqueta: "USD" }, { valor: "ARS", etiqueta: "ARS" }]} /></div>
                  </div>
                  <div>
                    <label className={labelClass}>Año desde</label>
                    <input type="number" value={buscaAnioDesde} onChange={(e) => setBuscaAnioDesde(e.target.value)} placeholder="2018" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Año hasta</label>
                    <input type="number" value={buscaAnioHasta} onChange={(e) => setBuscaAnioHasta(e.target.value)} placeholder="2024" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Presupuesto máx</label>
                    <input type="text" inputMode="numeric" value={buscaPresupuesto} onChange={(e) => setBuscaPresupuesto(e.target.value.replace(/\D/g, ""))} placeholder="25000" className={inputClass} />
                  </div>
                </div>
              </div>
            </div>

            <TituloPaso id="notas" n={nPaso("notas")} titulo="Notas" icono={StickyNote} />
            <div>
              <label className={labelClass}>Observaciones / Notas</label>
              <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={3} placeholder="Preferencias, observaciones, historial de contactos..." className={`${inputClass} resize-none`} />
            </div>

            {error && <p className="text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-500/10 rounded-lg px-3 py-2">{error}</p>}
          </div>

          <div className="px-6 py-4 border-t border-slate-100 dark:border-white/10 flex gap-3 shrink-0">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 rounded-xl transition-colors">Cancelar</button>
            <button type="submit" disabled={guardando} className="flex-1 py-2.5 flex items-center justify-center gap-2 text-sm font-bold bg-[#0145F2] hover:bg-[#0138c9] text-white rounded-xl transition-colors disabled:opacity-50">
              {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : esEdicion ? "Guardar cambios" : "Agregar cliente"}
            </button>
          </div>
        </form>
      </div>

      {modalEscaner && <EscanearDniModal onClose={() => setModalEscaner(false)} onEscaneado={aplicarDatosDni} />}
    </div>
  );
}

// Prefijo "cliente" para los ids de DOM de los títulos de sección.
function TituloPaso(props: Omit<Parameters<typeof TituloPasoBase>[0], "prefijo">) {
  return <TituloPasoBase prefijo="cliente" {...props} />;
}
