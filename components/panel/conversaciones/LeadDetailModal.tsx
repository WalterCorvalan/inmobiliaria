"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { supabase2 } from "@/lib/supabase/client";
import { etiquetaOrigen, ORIGENES_CLIENTE } from "@/lib/panel/origenesCliente";
import {
  X, User, Phone, CarFront, Calendar, Plus, CheckCircle2, Circle, FileText,
  Ban, Clock, AlertTriangle, MapPin, StickyNote, Radio, Car, LifeBuoy, History,
  Edit2, Flame, Snowflake, Minus, Receipt, Wallet, ClipboardCheck, Loader2, MessageCircle, Building2,
  Trash2, RotateCcw, Sparkles, UserRound,
} from "lucide-react";
import { IconoWhatsapp, IconoInstagram, IconoMessenger } from "@/components/ui/IconosCanales";
import { Compartido } from "@/components/ui/movimiento";
import { avisar } from "@/components/panel/Dialogos";
import FichaLeads from "./FichaLeads";
import SelectorWeb from "@/components/ui/SelectorWeb";
import ResumenResaltado from "./ResumenResaltado";
import { telefonoEnTexto } from "@/lib/panel/resaltarResumen";
import AvisoSucursalLead from "./AvisoSucursalLead";
import { estaVacia, resumenProspeccion, type ProspeccionLead } from "@/lib/panel/prospeccionLead";
import PeritajeLeadModal, { type OrigenPeritajeLead } from "./PeritajeLeadModal";

const ESTADOS_LEAD = [
  { value: "nuevo", label: "Nuevo" },
  { value: "asignado", label: "Contactado" },
  { value: "calificando", label: "Interesado" },
  { value: "convertido", label: "Cliente" },
  { value: "perdido", label: "Perdido" },
];
const ESTADO_COLOR: Record<string, string> = {
  nuevo: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/20",
  asignado: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/20",
  calificando: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/20",
  convertido: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20",
  perdido: "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/20",
};

// Historial: los últimos 50 al abrir; "Ver más" trae el resto.
const LIMITE_EVENTOS = 50;
const TIPOS_TAREA = ["Llamar", "Enviar Email", "Enviar SMS", "Enviar WhatsApp", "Visitar al Cliente", "Cliente visita salón"];
const ESTADOS_TEST_DRIVE = ["Programado", "Realizado", "Cancelado"];
// El origen del lead se elige de la misma lista cerrada que el de cliente (Walter, 29/10/2026): antes tenía "Cliente
// anterior", que no existe, y le faltaban Facebook, Web y Otro. No armar otra lista acá.
export const CANALES_ORIGEN: readonly string[] = ORIGENES_CLIENTE;
const CALIFICACIONES = [
  { value: "", label: "Sin calificar", icono: Minus, color: "text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5" },
  { value: "caliente", label: "Caliente", icono: Flame, color: "text-rose-600 dark:text-rose-300 border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10" },
  { value: "tibio", label: "Tibio", icono: Clock, color: "text-amber-600 dark:text-amber-300 border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10" },
  { value: "frio", label: "Frío", icono: Snowflake, color: "text-sky-600 dark:text-sky-300 border-sky-200 dark:border-sky-500/20 bg-sky-50 dark:bg-sky-500/10" },
];

const inputClass = "w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-rose-500";
const labelClass = "text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5";

// Secciones con el diseño compartido de las vistas de detalle del panel
// (pedido 6/10, ver components/panel/detalle/DetalleUI.tsx): tarjeta blanca
// con borde fino y título chico en gris, todas iguales. Antes cada sección
// tenía su propio color de acento (borde izquierdo + fondo tintado); Walter
// pidió el estilo sobrio de la cotización en todas las vistas.
const TARJETA_SECCION = { card: "bg-white dark:bg-white/[0.02] border-slate-200 dark:border-white/10", chip: "bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-300", icono: "text-slate-500 dark:text-slate-400" };
const SECCION_COLOR: Record<string, { card: string; chip: string; icono: string }> = {
  vehiculo: TARJETA_SECCION, vendedor: TARJETA_SECCION, prospecto: TARJETA_SECCION, canal: TARJETA_SECCION, eventos: TARJETA_SECCION,
  tareas: TARJETA_SECCION, historial: TARJETA_SECCION, peritaje: TARJETA_SECCION, testdrive: TARJETA_SECCION,
};
function IconoSeccion({ icono: Icono }: { icono: any; color: string }) {
  return <Icono className="w-3.5 h-3.5 shrink-0" />;
}

interface Perfil { id: string; nombre: string; roles: string[] }

function Dato({ label, valor }: { label: string; valor?: string | null }) {
  return (
    <div>
      <span className="text-slate-400 dark:text-slate-500 block text-[10px] uppercase tracking-widest font-bold mb-0.5">{label}</span>
      <span className="text-[13px] font-bold text-slate-800 dark:text-white">{valor || "—"}</span>
    </div>
  );
}

interface Sucursal { id: string; nombre: string }

const CAMPOS_AUTO_LEAD = "id, marca, modelo, anio, patente, km, fotos, estado, propio_agencia, precio_publicado_ars, precio_publicado_usd, sucursal_id, sucursal:sucursal_id ( nombre ), vendedor_asignado_id, vendedor_asignado:vendedor_asignado_id ( nombre )";

const TABLA_POR_ORIGEN: Record<string, string> = {
  whatsapp: "whatsapp_conversaciones", instagram: "instagram_conversaciones", messenger: "messenger_conversaciones", rodi: "rodi_conversaciones", manual: "leads_manuales",
};
const CAMPO_FK_POR_ORIGEN: Record<string, string> = {
  whatsapp: "whatsapp_conversacion_id", instagram: "instagram_conversacion_id", messenger: "messenger_conversacion_id", rodi: "rodi_conversacion_id", manual: "leads_manuales_id",
};
const CONTACTO_TABLA_POR_ORIGEN: Record<string, string | null> = {
  whatsapp: "whatsapp_contactos", instagram: "instagram_contactos", messenger: "messenger_contactos", rodi: null, manual: null,
};
const ETIQUETA_ORIGEN: Record<string, string> = { whatsapp: "WhatsApp", instagram: "Instagram", messenger: "Messenger", rodi: "Paffy", manual: "carga manual" };
const ICONO_ORIGEN: Record<string, React.ComponentType<{ className?: string }>> = {
  whatsapp: IconoWhatsapp, instagram: IconoInstagram, messenger: IconoMessenger, rodi: Sparkles, manual: UserRound,
};
const COLOR_ICONO_ORIGEN: Record<string, string> = {
  whatsapp: "text-[#25D366]", instagram: "text-[#E4405F]", messenger: "text-[#0084FF]", rodi: "text-indigo-500", manual: "text-slate-500",
};

export default function LeadDetailModal({
  leadId, origen, miId, vendedores, sucursales = [], onClose, onActualizado, inline = false, variante = "clasica",
}: { leadId: string; origen: "whatsapp" | "instagram" | "messenger" | "rodi" | "manual"; miId: string; vendedores: Perfil[]; sucursales?: Sucursal[]; onClose: () => void; onActualizado: (id: string, patch: any) => void; inline?: boolean;
  /** "leads": el diseño nuevo de /panel/leads (FichaLeads.tsx, 12/10/2026). Las bandejas de los canales usan "clasica". */
  variante?: "clasica" | "leads" }) {
  const tabla = TABLA_POR_ORIGEN[origen];
  const campoFk = CAMPO_FK_POR_ORIGEN[origen];
  const contactoTabla = CONTACTO_TABLA_POR_ORIGEN[origen];
  // rodi/manual no tienen tabla de contacto separada -- nombre/telefono/email
  // viven directo en la fila del lead (nombre_contacto en rodi, nombre en manual).
  // Desde el 17/10/2026 el peritaje se inicia con crear_peritaje (PeritajeLeadModal), que acepta los cinco orígenes.
  const soportaPeritaje = true;

  const [cargando, setCargando] = useState(true);
  const [lead, setLead] = useState<any>(null);
  const [contacto, setContacto] = useState<any>(null);
  const [vehiculo, setVehiculo] = useState<any>(null);
  const [vehiculosStock, setVehiculosStock] = useState<any[]>([]);
  const [tareas, setTareas] = useState<any[]>([]);
  const [eventos, setEventos] = useState<any[]>([]);
  const [testDrives, setTestDrives] = useState<any[]>([]);
  const [peritajes, setPeritajes] = useState<any[]>([]);
  const [senas, setSenas] = useState<any[]>([]);
  const [presupuestos, setPresupuestos] = useState<any[]>([]);
  const [ventas, setVentas] = useState<any[]>([]);
  const [motivos, setMotivos] = useState<any[]>([]);
  // Carga en dos partes (Walter, 20/10/2026: "tarda muchísimo"): la ficha se muestra apenas llegan el lead, el contacto y
  // el auto; tareas, historial, test drives, peritajes y lo hecho con el cliente llegan después (cargandoDetalle).
  const [cargandoDetalle, setCargandoDetalle] = useState(true);
  // El stock en venta ya no se baja al abrir: recién al tocar el buscador, "Cambiar" o el test drive, o si el lead no
  // tiene auto (para sugerir los que nombra el resumen).
  const [stockCargado, setStockCargado] = useState(false);
  const pidioStock = useRef(false);
  const [autosTestDrive, setAutosTestDrive] = useState<any[]>([]);
  const [hayMasEventos, setHayMasEventos] = useState(false);

  const [guardandoEstado, setGuardandoEstado] = useState(false);
  const [guardandoCalificacion, setGuardandoCalificacion] = useState(false);
  const [guardandoVendedor, setGuardandoVendedor] = useState(false);
  const [guardandoVehiculo, setGuardandoVehiculo] = useState(false);
  const [creandoPeritaje] = useState(false);
  const [showPeritaje, setShowPeritaje] = useState<{ conAuto: boolean } | null>(null);
  const [guardandoBasura, setGuardandoBasura] = useState(false);

  const [showCierreModal, setShowCierreModal] = useState(false);
  const [motivoCierreId, setMotivoCierreId] = useState("");
  const [nuevoMotivoNombre, setNuevoMotivoNombre] = useState("");
  const [creandoMotivo, setCreandoMotivo] = useState(false);

  const [editandoDomicilio, setEditandoDomicilio] = useState(false);
  const [domicilio, setDomicilio] = useState("");
  const [editandoTelefono, setEditandoTelefono] = useState(false);
  const [telefonoForm, setTelefonoForm] = useState("");
  const [guardandoTelefono, setGuardandoTelefono] = useState(false);
  const [busquedaVehiculo, setBusquedaVehiculo] = useState("");
  const [mostrarListaVehiculos, setMostrarListaVehiculos] = useState(false);
  const [guardandoCanalOrigen, setGuardandoCanalOrigen] = useState(false);
  const [guardandoSucursal, setGuardandoSucursal] = useState(false);
  const [editandoNotas, setEditandoNotas] = useState(false);
  const [notas, setNotas] = useState("");

  const [showTareaModal, setShowTareaModal] = useState(false);
  const [tipoTarea, setTipoTarea] = useState(TIPOS_TAREA[0]);
  const [tituloTarea, setTituloTarea] = useState("");
  const [fechaTarea, setFechaTarea] = useState("");
  const [guardandoTarea, setGuardandoTarea] = useState(false);
  const [tareaACompletar, setTareaACompletar] = useState<any | null>(null);
  const [resultadoTarea, setResultadoTarea] = useState("");
  const [guardandoResultado, setGuardandoResultado] = useState(false);

  const [showTestDriveModal, setShowTestDriveModal] = useState(false);
  const [fechaTestDrive, setFechaTestDrive] = useState("");
  const [vehiculoTestDriveId, setVehiculoTestDriveId] = useState("");
  const [guardandoTestDrive, setGuardandoTestDrive] = useState(false);

  const [showAsistenciaModal, setShowAsistenciaModal] = useState(false);
  const [notaAsistencia, setNotaAsistencia] = useState("");
  const [asistenciaParaId, setAsistenciaParaId] = useState("");
  const [guardandoAsistencia, setGuardandoAsistencia] = useState(false);

  const cargarStock = async () => {
    if (pidioStock.current) return;
    pidioStock.current = true;
    const { data } = await supabase2.from("vehiculos").select("id, marca, modelo, patente, sucursal_id, sucursal:sucursal_id ( nombre ), vendedor_asignado_id, vendedor_asignado:vendedor_asignado_id ( nombre )").in("estado", ["disponible", "reservado"]).order("marca");
    setVehiculosStock(data || []);
    setStockCargado(true);
  };

  const leerEventos = (todos = false) => {
    const q = supabase2.from("eventos_lead").select("*, autor:perfiles(nombre)").eq(campoFk, leadId).order("created_at", { ascending: false });
    return todos ? q : q.limit(LIMITE_EVENTOS + 1);
  };
  const guardarEventos = (e: any[] | null, todos = false) => {
    const lista = e || [];
    setHayMasEventos(!todos && lista.length > LIMITE_EVENTOS);
    setEventos(todos ? lista : lista.slice(0, LIMITE_EVENTOS));
  };
  const cargarMasEventos = async () => { const { data } = await leerEventos(true); guardarEventos(data, true); };

  // "vigente" corta las respuestas viejas: si se abrió otro lead mientras tanto, no pisan al nuevo.
  const cargar = async (vigente: () => boolean = () => true) => {
    const { data: l } = await supabase2.from(tabla).select("*").eq("id", leadId).maybeSingle();
    if (!vigente()) return;
    if (!l) { setCargando(false); setCargandoDetalle(false); return; }
    setLead(l);
    setDomicilio(l.domicilio || "");
    setNotas(l.notas || "");
    setVehiculoTestDriveId(l.vehiculo_id || "");

    const [{ data: c }, { data: v }] = await Promise.all([
      contactoTabla ? supabase2.from(contactoTabla).select("*").eq("id", l.contacto_id).maybeSingle() : Promise.resolve({ data: { nombre_perfil: l.nombre_contacto || l.nombre, telefono: l.telefono_contacto || l.telefono, email: l.email_contacto || l.email } }),
      l.vehiculo_id ? supabase2.from("vehiculos").select(CAMPOS_AUTO_LEAD).eq("id", l.vehiculo_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    if (!vigente()) return;
    setContacto(c);
    setVehiculo(v);
    setCargando(false);
    if (!l.vehiculo_id) cargarStock();

    const sinCliente = Promise.resolve({ data: [] as any[] });
    const [{ data: t }, { data: e }, { data: td }, { data: p }, { data: mot }, { data: s }, { data: pr }, { data: vt }] = await Promise.all([
      supabase2.from("tareas_lead").select("*").eq(campoFk, leadId).order("fecha_vencimiento"),
      leerEventos(),
      supabase2.from("test_drives").select("*").eq(campoFk, leadId).order("fecha_hora", { ascending: false }),
      supabase2.from("peritajes_lead").select("id, estado, puntaje, created_at").eq(campoFk, leadId),
      supabase2.from("motivos_cierre").select("*").order("nombre"),
      l.cliente_id ? supabase2.from("senas").select("id, numero, estado, fecha, venta_ars, venta_usd").eq("cliente_id", l.cliente_id).order("fecha", { ascending: false }) : sinCliente,
      l.cliente_id ? supabase2.from("presupuestos").select("id, numero, fecha, precio_ars, precio_usd").eq("cliente_id", l.cliente_id).order("fecha", { ascending: false }) : sinCliente,
      l.cliente_id ? supabase2.from("ventas").select("id, created_at, precio_venta, moneda_venta").eq("cliente_id", l.cliente_id).order("created_at", { ascending: false }) : sinCliente,
    ]);
    if (!vigente()) return;
    setTareas(t || []);
    guardarEventos(e);
    setTestDrives(td || []);
    setPeritajes(p || []);
    setMotivos(mot || []);
    setSenas(s || []);
    setPresupuestos(pr || []);
    setVentas(vt || []);
    setCargandoDetalle(false);

    // Nombre de los autos de los test drives sin bajar todo el stock.
    const idsTd = [...new Set((td || []).map((x: any) => x.vehiculo_id).filter(Boolean))];
    if (idsTd.length) {
      const { data: autos } = await supabase2.from("vehiculos").select("id, marca, modelo").in("id", idsTd);
      if (vigente()) setAutosTestDrive(autos || []);
    }
  };

  useEffect(() => {
    let vivo = true;
    cargar(() => vivo);
    return () => { vivo = false; };
  }, [leadId]);

  useEffect(() => { if (showTestDriveModal) cargarStock(); }, [showTestDriveModal]);

  const autoDeTestDrive = (id: string | null) => vehiculosStock.find((x) => x.id === id) || autosTestDrive.find((x) => x.id === id);

  const registrarEvento = async (tipo: string, descripcion: string) => {
    await supabase2.from("eventos_lead").insert({ [campoFk]: leadId, tipo, descripcion, creado_por: miId });
    const { data: e } = await leerEventos();
    guardarEventos(e);
  };

  const patch = async (payload: any) => {
    const { data, error } = await supabase2.from(tabla).update(payload).eq("id", leadId).select("*").single();
    if (error) throw error;
    setLead(data);
    onActualizado(leadId, data);
    return data;
  };

  const cambiarEstado = async (nuevo: string) => {
    if (nuevo === "perdido") { setShowCierreModal(true); return; }
    setGuardandoEstado(true);
    try {
      await patch({ estado_lead: nuevo });
      await registrarEvento("estado", `Estado cambiado a "${ESTADOS_LEAD.find((e) => e.value === nuevo)?.label}"`);
    } catch { avisar("No se pudo cambiar el estado."); } finally { setGuardandoEstado(false); }
  };

  const confirmarCierre = async () => {
    if (!motivoCierreId) return void avisar("Elegí un motivo.");
    setGuardandoEstado(true);
    try {
      await patch({ estado_lead: "perdido", motivo_cierre_id: motivoCierreId });
      const nombreMotivo = motivos.find((m) => m.id === motivoCierreId)?.nombre || "";
      await registrarEvento("cierre", `Cerrado como perdido — ${nombreMotivo}`);
      setShowCierreModal(false);
      setMotivoCierreId("");
    } catch { avisar("No se pudo cerrar el lead."); } finally { setGuardandoEstado(false); }
  };

  const crearMotivo = async () => {
    if (!nuevoMotivoNombre.trim()) return;
    setCreandoMotivo(true);
    try {
      const { data, error } = await supabase2.from("motivos_cierre").insert({ nombre: nuevoMotivoNombre.trim() }).select("*").single();
      if (error) throw error;
      setMotivos((prev) => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setMotivoCierreId(data.id);
      setNuevoMotivoNombre("");
    } catch { avisar("No se pudo crear el motivo."); } finally { setCreandoMotivo(false); }
  };

  const cambiarCalificacion = async (nueva: string) => {
    setGuardandoCalificacion(true);
    try {
      await patch({ calificacion: nueva || null });
      await registrarEvento("calificacion", `Grado de interés cambiado a "${CALIFICACIONES.find((c) => c.value === nueva)?.label}"`);
    } catch { avisar("No se pudo cambiar el grado de interés."); } finally { setGuardandoCalificacion(false); }
  };

  const toggleBasura = async () => {
    setGuardandoBasura(true);
    try {
      const nuevo = !lead.es_basura;
      await patch({ es_basura: nuevo });
      await registrarEvento("basura", nuevo ? "Mandado a Lead basura" : "Sacado de Lead basura");
    } catch { avisar("No se pudo actualizar."); } finally { setGuardandoBasura(false); }
  };

  // Pasa por el endpoint del servidor (no un update directo del cliente a
  // la tabla del canal) para que la regla de quién puede reasignar a quién
  // (vendedor->solo vendedor, encargado->vendedor/encargado, admin->
  // cualquiera) se valide de verdad server-side, no solo confiando en que
  // "vendedores" ya venga filtrado para el <select> -- antes esto
  // dependía de que RLS permitiera el update directo, y para "ventas"
  // normalmente no lo permite (quedaba "sin servir", sin error claro).
  const cambiarVendedor = async (vendedorId: string) => {
    setGuardandoVendedor(true);
    try {
      const res = await fetch("/api/panel/leads/reasignar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origen, leadId, vendedorId: vendedorId || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo reasignar.");
      setLead(data.lead);
      onActualizado(leadId, data.lead);
      const { data: e } = await supabase2.from("eventos_lead").select("*, autor:perfiles(nombre)").eq(campoFk, leadId).order("created_at", { ascending: false });
      setEventos(e || []);
    } catch (err: any) {
      avisar(err?.message || "No se pudo reasignar.");
    } finally {
      setGuardandoVendedor(false);
    }
  };

  const cambiarVehiculo = async (vehiculoId: string) => {
    setGuardandoVehiculo(true);
    try {
      await patch({ vehiculo_id: vehiculoId || null });
      const v = vehiculosStock.find((x) => x.id === vehiculoId);
      // La lista del buscador trae pocos campos; la tarjeta del auto necesita foto, km y precio.
      const { data: completo } = vehiculoId ? await supabase2.from("vehiculos").select(CAMPOS_AUTO_LEAD).eq("id", vehiculoId).maybeSingle() : { data: null };
      setVehiculo(completo || (v ? { ...v } : null));
      const auto = completo || v;
      await registrarEvento("vehiculo", vehiculoId ? `Vinculado a ${auto?.marca} ${auto?.modelo}` : "Vehículo desvinculado");
    } catch { avisar("No se pudo vincular el vehículo."); } finally { setGuardandoVehiculo(false); }
  };

  const guardarDomicilio = async () => { await patch({ domicilio }); setEditandoDomicilio(false); };
  const guardarProspeccion = async (p: ProspeccionLead) => {
    try {
      await patch({ prospeccion: estaVacia(p) ? null : p });
      await registrarEvento("prospeccion", `Cómo compra: ${resumenProspeccion(p)}`);
    } catch { avisar("No se pudo guardar cómo compra."); throw new Error("prospeccion"); }
  };

  // whatsapp/instagram guardan el teléfono en su tabla de contacto aparte
  // (whatsapp_contactos/instagram_contactos, vía contacto_id); rodi/manual
  // no tienen tabla de contacto separada -- el teléfono vive directo en la
  // fila del lead (telefono_contacto en rodi, telefono en manual).
  // directo: el teléfono que el cliente dejó escrito en la charla (botón "Guardar … (lo dejó en la charla)").
  const guardarTelefono = async (directo?: unknown) => {
    setGuardandoTelefono(true);
    const valor = (typeof directo === "string" ? directo : telefonoForm).trim() || null;
    try {
      if (contactoTabla && lead.contacto_id) {
        const { data, error } = await supabase2.from(contactoTabla).update({ telefono: valor }).eq("id", lead.contacto_id).select("*").single();
        if (error) throw error;
        setContacto(data);
      } else {
        const campo = origen === "rodi" ? "telefono_contacto" : "telefono";
        await patch({ [campo]: valor });
        setContacto((prev: any) => ({ ...prev, telefono: valor }));
      }
      await registrarEvento("telefono", valor ? `Teléfono actualizado: ${valor}` : "Teléfono borrado");
      setEditandoTelefono(false);
    } catch { avisar("No se pudo guardar el teléfono."); } finally { setGuardandoTelefono(false); }
  };
  const cambiarCanalOrigen = async (nuevo: string) => {
    setGuardandoCanalOrigen(true);
    try {
      await patch({ canal_origen: nuevo || null });
      await registrarEvento("canal_origen", nuevo ? `Canal de origen marcado: ${nuevo}` : "Canal de origen borrado");
    } finally { setGuardandoCanalOrigen(false); }
  };
  const guardarNotas = async () => { await patch({ notas }); setEditandoNotas(false); };
  const cambiarSucursal = async (nuevaId: string) => {
    setGuardandoSucursal(true);
    try {
      await patch({ sucursal_id: nuevaId || null });
      const nombre = sucursales.find((s) => s.id === nuevaId)?.nombre;
      await registrarEvento("sucursal", nuevaId ? `Sucursal marcada: ${nombre}` : "Sucursal borrada");
    } finally { setGuardandoSucursal(false); }
  };

  const crearTarea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fechaTarea) return void avisar("Elegí fecha y hora.");
    setGuardandoTarea(true);
    try {
      const { data, error } = await supabase2.from("tareas_lead").insert({
        [campoFk]: leadId, tipo: tipoTarea, titulo: tituloTarea || null, fecha_vencimiento: new Date(fechaTarea).toISOString(), creado_por: miId,
      }).select("*").single();
      if (error) throw error;
      setTareas((prev) => [...prev, data].sort((a, b) => new Date(a.fecha_vencimiento).getTime() - new Date(b.fecha_vencimiento).getTime()));
      await registrarEvento("tarea", `Tarea creada: ${tipoTarea}`);
      setShowTareaModal(false); setTituloTarea(""); setFechaTarea("");
    } catch { avisar("Error al crear la tarea."); } finally { setGuardandoTarea(false); }
  };

  // Botones rápidos de "Próximo paso" en la ficha de Leads: abren la tarea ya armada (tipo y fecha a las 10) para confirmar.
  const abrirTareaRapida = (tipo: string, enDias: number) => {
    const d = new Date(); d.setDate(d.getDate() + enDias); d.setHours(10, 0, 0, 0);
    const dos = (n: number) => String(n).padStart(2, "0");
    setTipoTarea(tipo); setTituloTarea("");
    setFechaTarea(`${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T10:00`);
    setShowTareaModal(true);
  };

  const toggleCompletada = (tarea: any) => {
    if (!tarea.completada) { setTareaACompletar(tarea); setResultadoTarea(""); return; }
    supabase2.from("tareas_lead").update({ completada: false }).eq("id", tarea.id);
    setTareas((prev) => prev.map((t) => (t.id === tarea.id ? { ...t, completada: false } : t)));
  };

  const confirmarCompletarTarea = async () => {
    if (!tareaACompletar) return;
    setGuardandoResultado(true);
    try {
      await supabase2.from("tareas_lead").update({ completada: true, resultado: resultadoTarea || null }).eq("id", tareaACompletar.id);
      setTareas((prev) => prev.map((t) => (t.id === tareaACompletar.id ? { ...t, completada: true, resultado: resultadoTarea || null } : t)));
      await registrarEvento("tarea", `Tarea completada: ${tareaACompletar.tipo}` + (resultadoTarea ? ` — ${resultadoTarea}` : ""));
      setTareaACompletar(null);
    } catch { avisar("No se pudo completar la tarea."); } finally { setGuardandoResultado(false); }
  };

  const agendarTestDrive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fechaTestDrive) return void avisar("Elegí fecha y hora.");
    setGuardandoTestDrive(true);
    try {
      const { data, error } = await supabase2.from("test_drives").insert({
        [campoFk]: leadId, vehiculo_id: vehiculoTestDriveId || null, fecha_hora: new Date(fechaTestDrive).toISOString(),
      }).select("*").single();
      if (error) throw error;
      setTestDrives((prev) => [data, ...prev]);
      await registrarEvento("test_drive", "Test drive agendado");
      // Aviso a los encargados (los coordina Gaby); si falla, el test drive ya quedó agendado igual.
      fetch("/api/panel/test-drives/avisar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ testDriveId: data.id }) }).catch(() => {});
      setShowTestDriveModal(false); setFechaTestDrive("");
    } catch { avisar("Error al agendar el test drive."); } finally { setGuardandoTestDrive(false); }
  };

  const cambiarEstadoTestDrive = async (td: any, nuevo: string) => {
    setTestDrives((prev) => prev.map((t) => (t.id === td.id ? { ...t, estado: nuevo } : t)));
    await supabase2.from("test_drives").update({ estado: nuevo }).eq("id", td.id);
    await registrarEvento("test_drive", `Test drive marcado como "${nuevo}"`);
  };

  const LINK_ORIGEN: Record<string, string> = { whatsapp: "/panel/whatsapp", instagram: "/panel/instagram", messenger: "/panel/messenger", rodi: "/panel/rodi", manual: "/panel/clientes" };

  const pedirAsistencia = async () => {
    if (!asistenciaParaId) return void avisar("Elegí a quién pedirle ayuda.");
    setGuardandoAsistencia(true);
    try {
      await patch({ asistencia_solicitada: true, asistencia_nota: notaAsistencia || null, asistencia_para: asistenciaParaId, asistencia_atendida: false });
      const nombre = vendedores.find((v) => v.id === asistenciaParaId)?.nombre;
      await registrarEvento("asistencia", `Asistencia pedida a ${nombre}` + (notaAsistencia ? `: ${notaAsistencia}` : ""));
      // Prioridad alta = dispara el cartelito de 5s (no solo la campanita) --
      // pedir ayuda es urgente, no debería depender de que el otro vendedor
      // entre a mirar la campana por las suyas.
      await supabase2.from("alertas").insert({
        destinatario_id: asistenciaParaId, tipo: "asistencia_pedida",
        titulo: `Un compañero te pidió ayuda con ${contacto?.nombre_perfil || "un lead"}` + (notaAsistencia ? `: ${notaAsistencia}` : ""),
        link: `${LINK_ORIGEN[origen] || "/panel/whatsapp"}?conversacion=${leadId}`,
        prioridad: "alta",
      });
      setShowAsistenciaModal(false); setNotaAsistencia("");
    } catch { avisar("No se pudo pedir asistencia."); } finally { setGuardandoAsistencia(false); }
  };

  const marcarAsistenciaAtendida = async () => {
    await patch({ asistencia_atendida: true });
    await registrarEvento("asistencia", "Asistencia atendida");
  };

  // PeritajeLeadModal: desde "Avanzar la venta" abre con la lista del stock; desde "Auto que le interesa", con ese auto.
  const iniciarPeritaje = () => setShowPeritaje({ conAuto: false });
  const iniciarPeritajeDelAuto = () => setShowPeritaje({ conAuto: true });
  const peritajeCreado = async (id: string) => {
    setShowPeritaje(null);
    window.open(`/panel/peritajes/${id}`, "_blank");
    await cargar();
  };

  const { vencidas, hoy, proximas } = useMemo(() => {
    const ahora = new Date();
    const finHoy = new Date(ahora); finHoy.setHours(23, 59, 59, 999);
    const inicioHoy = new Date(ahora); inicioHoy.setHours(0, 0, 0, 0);
    const abiertas = tareas.filter((t) => !t.completada);
    return {
      vencidas: abiertas.filter((t) => new Date(t.fecha_vencimiento) < inicioHoy),
      hoy: abiertas.filter((t) => { const f = new Date(t.fecha_vencimiento); return f >= inicioHoy && f <= finHoy; }),
      proximas: abiertas.filter((t) => new Date(t.fecha_vencimiento) > finHoy),
    };
  }, [tareas]);

  if (cargando || !lead) {
    // Adentro del panel de Leads la espera se ve en la ficha, sin oscurecer toda la pantalla.
    if (inline) return <div className="w-full h-full flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
    return <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-white" /></div>;
  }

  const nombre = contacto?.nombre_perfil || contacto?.username || contacto?.telefono || "Sin nombre";
  const telefono = contacto?.telefono || "";
  const telefonoDelResumen = lead?.handoff_resumen ? telefonoEnTexto(lead.handoff_resumen) : null;
  const numeroLimpio = String(telefono).replace(/\D/g, "");
  const linkWhatsApp = numeroLimpio ? `https://wa.me/${numeroLimpio}?text=${encodeURIComponent(`¡Hola ${nombre}! Te escribimos de Pfaffen Cars.`)}` : null;
  const puedeEditar = true;

  const TareasGrupo = ({ titulo, icono, tareas }: { titulo: string; icono: React.ReactNode; tareas: any[] }) =>
    tareas.length === 0 ? null : (
      <div className="mb-2 last:mb-0">
        <p className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1.5 mb-1">{icono} {titulo}</p>
        <div className="space-y-1">
          {tareas.map((t) => (
            <button key={t.id} onClick={() => toggleCompletada(t)} className="flex items-center gap-2 w-full text-left">
              {t.completada ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
              <span className={`text-xs ${t.completada ? "text-slate-400 line-through" : "text-slate-700 dark:text-slate-200"}`}>{t.tipo}{t.titulo ? ` — ${t.titulo}` : ""}</span>
              <span className="text-[10px] text-slate-400 ml-auto shrink-0">{new Date(t.fecha_vencimiento).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}</span>
            </button>
          ))}
        </div>
      </div>
    );

  const modales = (
    <>
        {showPeritaje && lead && (
          <PeritajeLeadModal origen={origen as OrigenPeritajeLead} leadId={leadId} prospeccion={lead.prospeccion}
            autoInicial={showPeritaje.conAuto ? vehiculo : null} onCreado={peritajeCreado} onClose={() => setShowPeritaje(null)} />
        )}
        {showTareaModal && (
          <div className="fixed inset-0 bg-black/40 z-[110] flex items-center justify-center p-4" onClick={() => setShowTareaModal(false)}>
            <form onSubmit={crearTarea} onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-5 w-full max-w-sm space-y-3">
              <h3 className="font-bold text-sm">Nueva tarea</h3>
              <SelectorWeb ariaLabel="Tipo de tarea" valor={tipoTarea} onCambio={setTipoTarea} claseBoton={inputClass} opciones={TIPOS_TAREA.map((t) => ({ valor: t, etiqueta: t }))} />
              <input value={tituloTarea} onChange={(e) => setTituloTarea(e.target.value)} placeholder="Título (opcional)" className={inputClass} />
              <input type="datetime-local" value={fechaTarea} onChange={(e) => setFechaTarea(e.target.value)} className={inputClass} required />
              <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowTareaModal(false)} className="px-3 py-1.5 text-xs font-semibold text-slate-500">Cancelar</button><button type="submit" disabled={guardandoTarea} className="px-3 py-1.5 rounded-lg bg-[#0145F2] hover:bg-[#0138c9] text-white text-xs font-bold disabled:opacity-50">Crear</button></div>
            </form>
          </div>
        )}

        {tareaACompletar && (
          <div className="fixed inset-0 bg-black/40 z-[110] flex items-center justify-center p-4" onClick={() => setTareaACompletar(null)}>
            <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-5 w-full max-w-sm space-y-3">
              <h3 className="font-bold text-sm">Completar: {tareaACompletar.tipo}</h3>
              <textarea value={resultadoTarea} onChange={(e) => setResultadoTarea(e.target.value)} rows={3} placeholder="Resultado (opcional)" className={inputClass} />
              <div className="flex justify-end gap-2"><button onClick={() => setTareaACompletar(null)} className="px-3 py-1.5 text-xs font-semibold text-slate-500">Cancelar</button><button onClick={confirmarCompletarTarea} disabled={guardandoResultado} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50">Completar</button></div>
            </div>
          </div>
        )}

        {showTestDriveModal && (
          <div className="fixed inset-0 bg-black/40 z-[110] flex items-center justify-center p-4" onClick={() => setShowTestDriveModal(false)}>
            <form onSubmit={agendarTestDrive} onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-5 w-full max-w-sm space-y-3">
              <h3 className="font-bold text-sm">Agendar test drive</h3>
              <SelectorWeb ariaLabel="Auto del test drive" valor={vehiculoTestDriveId} onCambio={setVehiculoTestDriveId} claseBoton={inputClass}
                opciones={[{ valor: "", etiqueta: "Sin auto" }, ...vehiculosStock.map((v: any) => ({ valor: v.id, etiqueta: `${v.marca} ${v.modelo}` }))]} />
              <input type="datetime-local" value={fechaTestDrive} onChange={(e) => setFechaTestDrive(e.target.value)} className={inputClass} required />
              <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowTestDriveModal(false)} className="px-3 py-1.5 text-xs font-semibold text-slate-500">Cancelar</button><button type="submit" disabled={guardandoTestDrive} className="px-3 py-1.5 rounded-lg bg-[#0145F2] hover:bg-[#0138c9] text-white text-xs font-bold disabled:opacity-50">Agendar</button></div>
            </form>
          </div>
        )}

        {showAsistenciaModal && (
          <div className="fixed inset-0 bg-black/40 z-[110] flex items-center justify-center p-4" onClick={() => setShowAsistenciaModal(false)}>
            <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-5 w-full max-w-sm space-y-3">
              <h3 className="font-bold text-sm flex items-center gap-1.5"><LifeBuoy className="w-4 h-4" /> Pedir asistencia</h3>
              <SelectorWeb ariaLabel="A quién pedirle asistencia" valor={asistenciaParaId} onCambio={setAsistenciaParaId} claseBoton={inputClass} placeholder="Elegí a quién"
                opciones={vendedores.map((v) => ({ valor: v.id, etiqueta: v.nombre }))} />
              <textarea value={notaAsistencia} onChange={(e) => setNotaAsistencia(e.target.value)} rows={2} placeholder="Nota (opcional)" className={inputClass} />
              <div className="flex justify-end gap-2"><button onClick={() => setShowAsistenciaModal(false)} className="px-3 py-1.5 text-xs font-semibold text-slate-500">Cancelar</button><button onClick={pedirAsistencia} disabled={guardandoAsistencia} className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold disabled:opacity-50">Pedir ayuda</button></div>
            </div>
          </div>
        )}

        {showCierreModal && (
          <div className="fixed inset-0 bg-black/40 z-[110] flex items-center justify-center p-4" onClick={() => setShowCierreModal(false)}>
            <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-5 w-full max-w-sm space-y-3">
              <h3 className="font-bold text-sm">¿Por qué se pierde este lead?</h3>
              <SelectorWeb ariaLabel="Motivo" valor={motivoCierreId} onCambio={setMotivoCierreId} claseBoton={inputClass} placeholder="Seleccionar motivo..."
                opciones={motivos.map((m) => ({ valor: m.id, etiqueta: m.nombre }))} />
              <div className="flex gap-2"><input value={nuevoMotivoNombre} onChange={(e) => setNuevoMotivoNombre(e.target.value)} placeholder="Nuevo motivo..." className={inputClass} /><button onClick={crearMotivo} disabled={creandoMotivo} className="shrink-0 px-3 rounded-lg bg-slate-100 dark:bg-white/10 text-xs font-bold">+</button></div>
              <div className="flex justify-end gap-2"><button onClick={() => setShowCierreModal(false)} className="px-3 py-1.5 text-xs font-semibold text-slate-500">Cancelar</button><button onClick={confirmarCierre} disabled={guardandoEstado} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0145F2] hover:bg-[#0138c9] text-white text-xs font-bold disabled:opacity-50"><Ban className="w-3.5 h-3.5" /> Confirmar cierre</button></div>
            </div>
          </div>
        )}
    </>
  );

  if (variante === "leads") {
    return (
      <FichaLeads
        modales={modales}
        f={{
          lead, leadId, origen, nombre, telefono, linkWhatsApp, vehiculo, vendedores, sucursales, motivos, eventos, testDrives, peritajes,
          presupuestos, senas, ventas, vehiculosStock, soportaPeritaje, onClose,
          cargandoDetalle, stockCargado, cargarStock, autoDeTestDrive, hayMasEventos, cargarMasEventos,
          email: contacto?.email || lead.email_contacto || lead.email || "",
          miNombre: vendedores.find((v) => v.id === miId)?.nombre || "",
          tareasAbiertas: [...vencidas, ...hoy, ...proximas],
          ESTADOS_LEAD, ETIQUETA_ORIGEN, ICONO_ORIGEN, COLOR_ICONO_ORIGEN, CANALES_ORIGEN, ESTADOS_TEST_DRIVE,
          guardandoEstado, guardandoCalificacion, guardandoVendedor, guardandoVehiculo, guardandoBasura, guardandoCanalOrigen, guardandoSucursal, guardandoTelefono, creandoPeritaje,
          cambiarEstado, cambiarCalificacion, cambiarVendedor, cambiarVehiculo, cambiarCanalOrigen, cambiarSucursal, toggleBasura, guardarTelefono, guardarDomicilio, guardarNotas, guardarProspeccion,
          marcarAsistenciaAtendida, iniciarPeritaje, iniciarPeritajeDelAuto, toggleCompletada, cambiarEstadoTestDrive,
          editandoTelefono, setEditandoTelefono, telefonoForm, setTelefonoForm, editandoDomicilio, setEditandoDomicilio, domicilio, setDomicilio,
          editandoNotas, setEditandoNotas, notas, setNotas, busquedaVehiculo, setBusquedaVehiculo, mostrarListaVehiculos, setMostrarListaVehiculos,
          setShowTareaModal, setShowTestDriveModal, setShowAsistenciaModal, abrirTareaRapida,
        }}
      />
    );
  }

  const contenido = (
    <div className={inline ? "bg-white dark:bg-[#111] w-full h-full overflow-y-auto" : "bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl"} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center px-5 pt-4 sticky top-0 bg-white dark:bg-[#111] z-10 pb-3 border-b border-slate-100 dark:border-white/10">
          <button onClick={toggleBasura} disabled={guardandoBasura} title={lead.es_basura ? "Sacar de Lead basura" : "Mandar a Lead basura"}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-50 ${lead.es_basura ? "bg-slate-700 dark:bg-white/20 text-white" : "bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/10"}`}>
            {lead.es_basura ? <><RotateCcw className="w-3.5 h-3.5" /> Sacar de basura</> : <><Trash2 className="w-3.5 h-3.5" /> Lead basura</>}
          </button>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-5 pt-4 pb-6 space-y-4">
          <div>
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-3">
                <div className="relative w-12 h-12 rounded-full bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-sm shrink-0">
                  {nombre.substring(0, 2).toUpperCase()}
                  {(() => { const IconoCanal = ICONO_ORIGEN[origen]; return (
                    <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 flex items-center justify-center">
                      <IconoCanal className={`w-3 h-3 ${COLOR_ICONO_ORIGEN[origen]}`} />
                    </span>
                  ); })()}
                </div>
                <div>
                  <Compartido destino como="h1" id={`nombre-lead-${leadId}`} className="text-xl font-bold text-slate-900 dark:text-white">{nombre}</Compartido>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{origen === "manual" ? "Lead cargado a mano" : `Consulta por ${ETIQUETA_ORIGEN[origen]}`}</p>
                </div>
              </div>
              <select value={lead.estado_lead || "nuevo"} disabled={guardandoEstado} onChange={(e) => cambiarEstado(e.target.value)}
                className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-lg border outline-none cursor-pointer disabled:opacity-50 shrink-0 ${ESTADO_COLOR[lead.estado_lead] || ESTADO_COLOR.nuevo}`}>
                {ESTADOS_LEAD.map((e) => (<option key={e.value} value={e.value}>{e.label}</option>))}
              </select>
            </div>
            <div className="flex items-center gap-4 text-[13px] text-slate-600 dark:text-slate-300 flex-wrap">
              {editandoTelefono ? (
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <input autoFocus value={telefonoForm} onChange={(e) => setTelefonoForm(e.target.value)} placeholder="11 2345 6789"
                    className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 text-[13px] outline-none focus:border-rose-500 w-36" />
                  {/* Botones con texto en vez del check y la cruz chiquitos (Walter, 21/10/2026). */}
                  <button onClick={() => guardarTelefono()} disabled={guardandoTelefono} className="px-3 py-1 rounded-lg bg-[#0145F2] hover:bg-[#0138c9] text-white text-xs font-bold disabled:opacity-50">{guardandoTelefono ? "Guardando…" : "Guardar"}</button>
                  <button onClick={() => setEditandoTelefono(false)} className="px-3 py-1 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-600 dark:text-slate-300">Cancelar</button>
                </div>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" /> {telefono || "Sin teléfono"}
                  <button onClick={() => { setTelefonoForm(telefono); setEditandoTelefono(true); }} className="text-slate-400 hover:text-[#0145F2]"><Edit2 className="w-3 h-3" /></button>
                  {!telefono && telefonoDelResumen && (
                    <button onClick={() => guardarTelefono(telefonoDelResumen)} disabled={guardandoTelefono} className="text-xs font-semibold text-[#0145F2] hover:underline disabled:opacity-50">Guardar {telefonoDelResumen} (lo dejó en la charla)</button>
                  )}
                </span>
              )}
              {linkWhatsApp && <a href={linkWhatsApp} target="_blank" rel="noreferrer" className="text-emerald-600 dark:text-emerald-300 font-bold text-xs hover:underline flex items-center gap-1"><IconoWhatsapp className="w-3.5 h-3.5" /> WhatsApp</a>}
            </div>
            <div className="flex items-center gap-1.5 mt-3 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mr-1">Grado de interés:</span>
              {CALIFICACIONES.map((c) => {
                const Icono = c.icono;
                const activo = (lead.calificacion || "") === c.value;
                return (
                  <button key={c.value || "sin"} onClick={() => cambiarCalificacion(c.value)} disabled={guardandoCalificacion}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50 ${activo ? c.color + " ring-1 ring-current" : "text-slate-400 border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10"}`}>
                    <Icono className="w-3 h-3" /> {c.label}
                  </button>
                );
              })}
            </div>
            {lead.motivo_cierre_id && lead.estado_lead === "perdido" && (
              <p className="text-[11px] text-rose-600 dark:text-rose-300 font-bold mt-2 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-lg px-2.5 py-1.5 w-fit">
                Motivo: {motivos.find((m) => m.id === lead.motivo_cierre_id)?.nombre || "—"}
              </p>
            )}
          </div>

          {lead.asistencia_solicitada && !lead.asistencia_atendida ? (
            <div className="bg-orange-500 border-2 border-orange-600 rounded-2xl p-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <LifeBuoy className="w-6 h-6 text-white mt-0.5 shrink-0 animate-pulse" />
                <div>
                  <p className="text-xs font-black text-white uppercase tracking-wide">🆘 Asistencia solicitada{lead.asistencia_para ? ` a ${vendedores.find((v) => v.id === lead.asistencia_para)?.nombre || ""}` : ""}</p>
                  {lead.asistencia_nota && <p className="text-xs text-white/95 mt-1 font-medium">{lead.asistencia_nota}</p>}
                </div>
              </div>
              <button onClick={marcarAsistenciaAtendida} className="shrink-0 text-[11px] font-bold text-orange-700 bg-white px-3 py-1.5 rounded-lg hover:bg-orange-50">Marcar atendida</button>
            </div>
          ) : (
            <button onClick={() => setShowAsistenciaModal(true)} className="flex items-center justify-center gap-2 w-full bg-white dark:bg-white/5 border border-orange-200 dark:border-orange-500/20 hover:bg-orange-50 dark:hover:bg-orange-500/10 text-orange-600 dark:text-orange-300 font-bold py-2 rounded-xl text-[11px] uppercase tracking-widest transition-colors">
              <LifeBuoy className="w-3.5 h-3.5" /> Pedir asistencia
            </button>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div className={`border rounded-2xl p-4 ${SECCION_COLOR.vehiculo.card}`}>
                <h2 className={labelClass}><IconoSeccion icono={CarFront} color="vehiculo" /> Vehículo de interés</h2>
                <div className="relative">
                  {vehiculo && !mostrarListaVehiculos ? (
                    <button type="button" disabled={guardandoVehiculo} onClick={() => { setBusquedaVehiculo(""); setMostrarListaVehiculos(true); }}
                      className={`${inputClass} text-left flex items-center justify-between gap-2 disabled:opacity-50`}>
                      <span className="truncate">{vehiculo.marca} {vehiculo.modelo} {vehiculo.patente ? `— ${vehiculo.patente}` : ""}</span>
                      <Edit2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </button>
                  ) : (
                    <input
                      autoFocus={mostrarListaVehiculos} value={busquedaVehiculo} disabled={guardandoVehiculo}
                      onChange={(e) => setBusquedaVehiculo(e.target.value)}
                      onFocus={() => { setMostrarListaVehiculos(true); cargarStock(); }}
                      onBlur={() => setTimeout(() => setMostrarListaVehiculos(false), 150)}
                      placeholder="Buscar por marca, modelo o patente..." className={`${inputClass} disabled:opacity-50`}
                    />
                  )}
                  {mostrarListaVehiculos && (
                    <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-lg shadow-lg divide-y divide-slate-100 dark:divide-white/10">
                      <button type="button" onMouseDown={(e) => { e.preventDefault(); cambiarVehiculo(""); setMostrarListaVehiculos(false); setBusquedaVehiculo(""); }}
                        className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5">Sin vincular</button>
                      {vehiculosStock
                        .filter((v: any) => {
                          const q = busquedaVehiculo.trim().toLowerCase();
                          if (!q) return true;
                          return `${v.marca} ${v.modelo} ${v.patente || ""}`.toLowerCase().includes(q);
                        })
                        .slice(0, 30)
                        .map((v: any) => (
                          <button key={v.id} type="button" onMouseDown={(e) => { e.preventDefault(); cambiarVehiculo(v.id); setMostrarListaVehiculos(false); setBusquedaVehiculo(""); }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/5 flex items-center justify-between gap-2">
                            <span className="truncate text-slate-800 dark:text-white">{v.marca} {v.modelo}</span>
                            <span className="text-[11px] text-slate-400 shrink-0">{v.patente || "S/P"}</span>
                          </button>
                        ))}
                      {vehiculosStock.filter((v: any) => {
                        const q = busquedaVehiculo.trim().toLowerCase();
                        if (!q) return true;
                        return `${v.marca} ${v.modelo} ${v.patente || ""}`.toLowerCase().includes(q);
                      }).length === 0 && <p className="px-3 py-2 text-[13px] text-slate-400 italic">Sin resultados.</p>}
                    </div>
                  )}
                </div>
                {vehiculo?.vendedor_asignado_id && vehiculo.vendedor_asignado_id !== (lead.vendedor_id || null) && (
                  <p className="mt-2.5 flex items-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg px-2.5 py-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Este auto lo tiene asignado {vehiculo.vendedor_asignado?.nombre || "otro vendedor"} en Stock.
                  </p>
                )}
                {vehiculo && (
                  <AvisoSucursalLead sucursalAutoId={vehiculo.sucursal_id} sucursalAutoNombre={vehiculo.sucursal?.nombre} vendedorActualId={lead.vendedor_id}
                    guardando={guardandoVendedor} onAsignar={cambiarVendedor} />
                )}
              </div>

              <div className={`border rounded-2xl p-4 ${SECCION_COLOR.vendedor.card}`}>
                <h2 className={labelClass}><IconoSeccion icono={User} color="vendedor" /> Vendedor asignado</h2>
                <select value={lead.vendedor_id || ""} disabled={guardandoVendedor} onChange={(e) => cambiarVendedor(e.target.value)} className={inputClass}>
                  <option value="">Sin asignar</option>
                  {vendedores.map((v) => (<option key={v.id} value={v.id}>{v.nombre}</option>))}
                </select>
              </div>

              <div className={`border rounded-2xl p-4 space-y-3 ${SECCION_COLOR.prospecto.card}`}>
                <h2 className={labelClass}><IconoSeccion icono={MapPin} color="prospecto" /> Prospecto</h2>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Domicilio</span>
                    {!editandoDomicilio && <button onClick={() => setEditandoDomicilio(true)} className="text-slate-400 hover:text-[#0145F2]"><Edit2 className="w-3 h-3" /></button>}
                  </div>
                  {editandoDomicilio ? (
                    <div className="flex gap-2"><input autoFocus value={domicilio} onChange={(e) => setDomicilio(e.target.value)} className={inputClass} /><button onClick={guardarDomicilio} className="shrink-0 bg-[#0145F2] hover:bg-[#0138c9] text-white px-3 py-2 rounded-lg text-xs font-bold">Guardar</button></div>
                  ) : (<p className="text-[13px] text-slate-700 dark:text-slate-200">{lead.domicilio || "Sin domicilio"}</p>)}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1"><StickyNote className="w-3 h-3" /> Notas</span>
                    {!editandoNotas && <button onClick={() => setEditandoNotas(true)} className="text-slate-400 hover:text-[#0145F2]"><Edit2 className="w-3 h-3" /></button>}
                  </div>
                  {editandoNotas ? (
                    <div className="space-y-2"><textarea autoFocus rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} className={inputClass} /><button onClick={guardarNotas} className="w-full bg-[#0145F2] hover:bg-[#0138c9] text-white text-[11px] font-bold uppercase tracking-widest py-2 rounded-lg">Guardar</button></div>
                  ) : (<p className="text-[13px] text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{lead.notas || "Sin notas"}</p>)}
                </div>
              </div>

              <div className={`border rounded-2xl p-4 space-y-3 ${SECCION_COLOR.canal.card}`}>
                <div>
                  <h2 className={labelClass}><IconoSeccion icono={Radio} color="canal" /> Canal de origen</h2>
                  <div className="relative">
                    <select
                      value={lead.canal_origen || ""}
                      disabled={guardandoCanalOrigen}
                      onChange={(e) => cambiarCanalOrigen(e.target.value)}
                      className={`${inputClass} appearance-none pr-8 disabled:opacity-50`}
                    >
                      <option value="">Sin especificar</option>
                      {CANALES_ORIGEN.map((c) => <option key={c} value={c}>{etiquetaOrigen(c)}</option>)}
                    </select>
                    {guardandoCanalOrigen && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />}
                  </div>
                </div>
                {/* messenger_conversaciones no tiene la columna sucursal_id: guardarla daría error. */}
                {origen !== "messenger" && (
                  <div>
                    <h2 className={labelClass}><IconoSeccion icono={Building2} color="canal" /> Sucursal</h2>
                    <div className="relative">
                      <select
                        value={lead.sucursal_id || ""}
                        disabled={guardandoSucursal}
                        onChange={(e) => cambiarSucursal(e.target.value)}
                        className={`${inputClass} appearance-none pr-8 disabled:opacity-50`}
                      >
                        <option value="">{vehiculo?.sucursal?.nombre ? `Sin especificar (auto: ${vehiculo.sucursal.nombre})` : "Sin especificar"}</option>
                        {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                      </select>
                      {guardandoSucursal && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />}
                    </div>
                  </div>
                )}
              </div>

              {lead.handoff_resumen && (
                <div className="rounded-2xl overflow-hidden border border-indigo-200 dark:border-indigo-500/20 shadow-sm">
                  <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center shrink-0"><Sparkles className="w-3.5 h-3.5 text-white" /></span>
                    <span className="text-[12px] font-black uppercase tracking-widest text-white">Resumen de la IA</span>
                    {lead.handoff_reason && (
                      <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-white/90 bg-white/15 px-2 py-0.5 rounded-full shrink-0">
                        <UserRound className="w-3 h-3" /> {lead.handoff_reason === "cliente_pidio_humano" ? "Pidió humano" : "IA en pausa"}
                      </span>
                    )}
                  </div>
                  <div className="bg-indigo-50 dark:bg-indigo-500/10 px-4 py-3.5 border-l-4 border-l-indigo-500 dark:border-l-indigo-400">
                    <div className="text-[13.5px] text-indigo-950 dark:text-indigo-100 leading-relaxed"><ResumenResaltado texto={lead.handoff_resumen} /></div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className={`border rounded-2xl p-4 ${SECCION_COLOR.eventos.card}`}>
                <div className="flex items-center justify-between mb-2">
                  <h2 className={labelClass + " mb-0"}><IconoSeccion icono={History} color="eventos" /> Eventos</h2>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {eventos.length === 0 ? <p className="text-xs text-slate-400 italic">Lead creado</p> : eventos.map((ev) => (
                    <div key={ev.id} className="text-xs">
                      <p className="text-slate-700 dark:text-slate-200">{ev.descripcion}</p>
                      <p className="text-[10px] text-slate-400">{ev.autor?.nombre || "Sistema"} · {new Date(ev.created_at).toLocaleString("es-AR")}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`border rounded-2xl p-4 ${SECCION_COLOR.tareas.card}`}>
                <div className="flex items-center justify-between mb-2">
                  <h2 className={labelClass + " mb-0"}><IconoSeccion icono={Calendar} color="tareas" /> Tareas de seguimiento</h2>
                  <button onClick={() => setShowTareaModal(true)} className="flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700"><Plus className="w-3.5 h-3.5" /> Nueva</button>
                </div>
                <TareasGrupo titulo="Vencidas" icono={<AlertTriangle className="w-3.5 h-3.5 text-rose-500" />} tareas={vencidas} />
                <TareasGrupo titulo="Hoy" icono={<Clock className="w-3.5 h-3.5 text-amber-500" />} tareas={hoy} />
                <TareasGrupo titulo="Próximas" icono={<Calendar className="w-3.5 h-3.5 text-slate-400" />} tareas={proximas} />
                {vencidas.length === 0 && hoy.length === 0 && proximas.length === 0 && <p className="text-xs text-slate-400 italic">Sin tareas pendientes.</p>}
              </div>
            </div>
          </div>

          <div className={`border rounded-2xl p-4 space-y-3 ${SECCION_COLOR.historial.card}`}>
            <h2 className={labelClass}><IconoSeccion icono={FileText} color="historial" /> Historial comercial</h2>
            {presupuestos.length === 0 && senas.length === 0 && ventas.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Todavía no se generó ninguna cotización, seña ni venta para este lead.</p>
            ) : (
              <div className="space-y-1.5">
                {presupuestos.map((p: any) => (
                  <Link key={`p-${p.id}`} href={`/panel/cotizaciones/imprimir/${p.id}`} className="flex items-center justify-between bg-white dark:bg-white/5 rounded-lg px-3 py-2 text-xs hover:border-rose-300 border border-transparent">
                    <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Cotización N° {p.numero}</span>
                    <span className="font-bold">{p.precio_ars ? `$ ${Number(p.precio_ars).toLocaleString("es-AR")}` : p.precio_usd ? `US$ ${Number(p.precio_usd).toLocaleString("es-AR")}` : ""}</span>
                  </Link>
                ))}
                {senas.map((s: any) => (
                  <Link key={`s-${s.id}`} href={`/panel/senas/imprimir/${s.id}`} className="flex items-center justify-between bg-white dark:bg-white/5 rounded-lg px-3 py-2 text-xs hover:border-rose-300 border border-transparent">
                    <span className="flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> Seña N° {s.numero}</span>
                    <span className="font-bold">{s.venta_ars ? `$ ${Number(s.venta_ars).toLocaleString("es-AR")}` : s.venta_usd ? `US$ ${Number(s.venta_usd).toLocaleString("es-AR")}` : ""}</span>
                  </Link>
                ))}
                {ventas.map((b: any) => (
                  <div key={`b-${b.id}`} className="flex items-center justify-between bg-white dark:bg-white/5 rounded-lg px-3 py-2 text-xs">
                    <span className="flex items-center gap-1.5"><Receipt className="w-3.5 h-3.5" /> Venta — {new Date(b.created_at).toLocaleDateString("es-AR")}</span>
                    <span className="font-bold">{b.moneda_venta} {Number(b.precio_venta).toLocaleString("es-AR")}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-white/10">
              <Link href={`/panel/cotizaciones?nuevo=1&lead_origen=${origen}&lead_id=${leadId}`} className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl text-[11px] uppercase tracking-widest">
                <Plus className="w-3.5 h-3.5" /> Cotización
              </Link>
              <Link href={`/panel/senas?nuevo=1&lead_origen=${origen}&lead_id=${leadId}`} className="flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 rounded-xl text-[11px] uppercase tracking-widest">
                <Plus className="w-3.5 h-3.5" /> Seña
              </Link>
              {/* Esta iba a "ventas?nuevo=1" pero VentasClient.tsx solo
                 escucha "nueva" -- nunca abría el modal, el botón no hacía
                 nada. */}
              <Link href={`/panel/ventas?nueva=1&lead_origen=${origen}&lead_id=${leadId}`} className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl text-[11px] uppercase tracking-widest">
                <Plus className="w-3.5 h-3.5" /> Venta
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={`border rounded-2xl p-4 space-y-3 ${SECCION_COLOR.peritaje.card}`}>
              <div className="flex items-center justify-between">
                <h2 className={labelClass + " mb-0"}><IconoSeccion icono={ClipboardCheck} color="peritaje" /> Peritaje</h2>
                {soportaPeritaje && (
                  <button onClick={iniciarPeritaje} disabled={creandoPeritaje} className="flex items-center gap-1 text-[11px] font-bold text-[#0145F2] hover:text-[#0138c9] disabled:opacity-50">
                    <Plus className="w-3.5 h-3.5" /> {creandoPeritaje ? "Iniciando..." : "Iniciar peritaje"}
                  </button>
                )}
              </div>
              {peritajes.length === 0 ? <p className="text-xs text-slate-400 italic">Todavía no se hizo un peritaje de este vehículo.</p> : (
                <div className="space-y-2">
                  {peritajes.map((p: any) => (
                    <Link key={p.id} href={`/panel/peritajes/${p.id}`} className="flex items-center justify-between gap-3 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl p-3 hover:border-rose-300">
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{new Date(p.created_at).toLocaleDateString("es-AR")}</span>
                      <span className="flex items-center gap-2 text-[11px] font-bold">
                        {p.puntaje != null && <span className={p.puntaje >= 70 ? "text-emerald-600" : p.puntaje >= 40 ? "text-amber-600" : "text-rose-600"}>{p.puntaje}%</span>}
                        <span className="text-slate-400 uppercase">{p.estado}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className={`border rounded-2xl p-4 ${SECCION_COLOR.testdrive.card}`}>
              <div className="flex items-center justify-between mb-2">
                <h2 className={labelClass + " mb-0"}><IconoSeccion icono={Car} color="testdrive" /> Test Drive</h2>
                <button onClick={() => setShowTestDriveModal(true)} className="flex items-center gap-1 text-[11px] font-bold text-[#0145F2] hover:text-[#0138c9]"><Plus className="w-3.5 h-3.5" /> Agendar</button>
              </div>
              {testDrives.length === 0 ? <p className="text-xs text-slate-400 italic">Sin test drives agendados.</p> : (
                <div className="space-y-1.5">
                  {testDrives.map((td: any) => {
                    const v = autoDeTestDrive(td.vehiculo_id);
                    return (
                      <div key={td.id} className="flex items-center justify-between gap-2 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-lg px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-white">{v ? `${v.marca} ${v.modelo}` : "Sin auto"}</p>
                          <span className="text-[10px] text-slate-400">{new Date(td.fecha_hora).toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <select value={td.estado} onChange={(e) => cambiarEstadoTestDrive(td, e.target.value)} className="text-[10px] font-bold uppercase px-2 py-1 rounded border outline-none bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 shrink-0">
                          {ESTADOS_TEST_DRIVE.map((e) => (<option key={e} value={e}>{e}</option>))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {modales}
        </div>
  );


  if (inline) return contenido;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => onClose()}>
      {contenido}
    </div>
  );
}
