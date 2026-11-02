"use client";

// Ficha del lead SOLO para /panel/leads (pedido de Walter del 12/10/2026). Las bandejas de WhatsApp, Instagram,
// Messenger y Rodi siguen con el detalle de siempre.
// No tiene lógica propia: el estado, la carga y los cambios viven en LeadDetailModal.tsx, que la dibuja con
// variante="leads" y le pasa todo en `f`. Si cambia una regla (estado, vendedor, tareas), se cambia allá.
// Diseño: el mismo de las vistas de detalle del panel (components/panel/detalle/DetalleUI.tsx), sobrio. La primera
// versión con degradés no se adaptaba al resto (Walter, 12/10 a la tarde). Cada dato aparece una sola vez: grado de
// interés, origen, vendedor y sucursal arriba; un solo botón de WhatsApp.
// 14/10/2026 (Walter: "mejor UX/UI, más fácil de ver y de usar"): contacto al costado del nombre, la etapa como pasos
// que se tocan, "Próximo paso" primero, las acciones de venta arriba a la derecha, el auto compacto y, en el celular,
// una barra fija con Llamar, WhatsApp y Cotizar.
import { useRef, useState } from "react";
import Link from "next/link";
import { etiquetaOrigen } from "@/lib/panel/origenesCliente";
import {
  ArrowLeft, MoreHorizontal, Phone, Mail, Flame, Clock, Snowflake, Minus, Sparkles, CalendarDays,
  Square, History, LifeBuoy, FileText, Receipt, Wallet, ArrowRight, MapPin, StickyNote, Trash2,
  RotateCcw, Edit2, Check, Plus, AlertTriangle, ClipboardCheck, Car, UserRound, MessageCircle, Search, Link2,
} from "lucide-react";
import { IconoWhatsapp } from "@/components/ui/IconosCanales";
import { Compartido } from "@/components/ui/movimiento";
import { BTN, Etiqueta, Seccion, BloqueDestacado, LineaTiempo } from "@/components/panel/detalle/DetalleUI";
import { fotoPrincipal, textoKm } from "@/lib/vehiculos";
import { sugerirVehiculosDelTexto } from "@/lib/panel/sugerenciaVehiculoLead";
import SelectorWeb from "@/components/ui/SelectorWeb";
import AvisoSucursalLead from "./AvisoSucursalLead";
import ProspeccionLead, { type ProspeccionLeadRef } from "./ProspeccionLead";
import ResumenResaltado from "./ResumenResaltado";
import { telefonoEnTexto } from "@/lib/panel/resaltarResumen";
import { nombreParaFicha } from "@/lib/panel/nombreLead";
import { COLOR_BOTON_CANAL, linkConversacionDelLead, type CanalConversacion } from "@/lib/panel/botonesCanal";
import { normalizarProspeccion } from "@/lib/panel/prospeccionLead";

// Mismos datos sin tipar que LeadDetailModal.tsx (filas de 5 tablas distintas según el canal).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fila = any;

const card = "rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111] p-4 sm:p-5";
const inputClass = "w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0145F2]";
const etiquetaDato = "text-[10px] font-semibold uppercase tracking-wider text-slate-400";
const pastilla = "inline-flex items-center gap-1.5 max-w-full rounded-full border border-slate-200 dark:border-white/10 px-2.5 py-1 text-slate-800 dark:text-slate-100 hover:border-[#0145F2]/50 cursor-pointer";
const pastillaAlerta = "inline-flex items-center gap-1.5 max-w-full rounded-full border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-2.5 py-1 text-rose-700 dark:text-rose-300 cursor-pointer";
const accionChica = "flex flex-col items-center justify-center gap-1 rounded-lg border border-slate-200 dark:border-white/10 px-1 py-2 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:border-[#0145F2] hover:text-[#0145F2] dark:hover:text-sky-300";
// Seña y Venta conservan su color de siempre (Walter, 20/10/2026: "no se trata de colores, sino de que había muchas cosas").
const accionChicaSena = "flex flex-col items-center justify-center gap-1 rounded-lg border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 px-1 py-2 text-[11px] font-bold text-amber-800 dark:text-amber-300";
const accionChicaVenta = "flex flex-col items-center justify-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-1 py-2 text-[11px] font-bold text-white";
// Las listas usan SelectorWeb y no el <select> del navegador, que abría con el azul de Windows (Walter, 2/11/2026).
const selectPastilla = "gap-1 text-xs font-semibold outline-none cursor-pointer";

const GRADOS: Record<string, { label: string; icono: typeof Flame; color: string }> = {
  "": { label: "Sin calificar", icono: Minus, color: "text-slate-400" },
  caliente: { label: "Caliente", icono: Flame, color: "text-rose-500" },
  tibio: { label: "Tibio", icono: Clock, color: "text-amber-500" },
  frio: { label: "Frío", icono: Snowflake, color: "text-sky-500" },
};
const ICONO_TAREA: Record<string, typeof Phone> = { Llamar: Phone, "Enviar Email": Mail, "Enviar SMS": MessageCircle, "Enviar WhatsApp": MessageCircle };
const ESTADO_AUTO: Record<string, string> = { disponible: "Disponible", reservado: "Reservado", "señado": "Señado", vendido: "Vendido", en_preparacion: "En preparación" };
const HORA = { hour: "2-digit", minute: "2-digit", hour12: false } as const;

function hace(fecha: string | null | undefined): string {
  if (!fecha) return "";
  const min = Math.round((Date.now() - new Date(fecha).getTime()) / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d < 30 ? `hace ${d} d` : new Date(fecha).toLocaleDateString("es-AR");
}

/** "Hoy 10:00", "Mañana 11:00", "Ayer 09:30" o "14 oct 16:00". */
function cuando(fecha: string): string {
  const f = new Date(fecha);
  const dia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dif = Math.round((dia(f) - dia(new Date())) / 86400000);
  const etiqueta = dif === 0 ? "Hoy" : dif === 1 ? "Mañana" : dif === -1 ? "Ayer" : f.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
  return `${etiqueta} ${f.toLocaleTimeString("es-AR", HORA)}`;
}

function iniciales(nombre: string) {
  const partes = nombre.replace(/^@/, "").trim().split(/\s+/);
  return ((partes[0]?.[0] || "?") + (partes[1]?.[0] || partes[0]?.[1] || "")).toUpperCase();
}

function precioVehiculo(v: Fila): string | null {
  if (Number(v?.precio_publicado_usd) > 0) return `US$ ${Number(v.precio_publicado_usd).toLocaleString("es-AR")}`;
  if (Number(v?.precio_publicado_ars) > 0) return `$ ${Number(v.precio_publicado_ars).toLocaleString("es-AR")}`;
  return null;
}

export default function FichaLeads({ f, modales }: { f: Fila; modales: React.ReactNode }) {
  const [verTodo, setVerTodo] = useState(false);
  const [cambiandoAuto, setCambiandoAuto] = useState(false);
  const [listaAutos, setListaAutos] = useState(false);
  const [editandoDatos, setEditandoDatos] = useState(false);
  const [guardandoDatos, setGuardandoDatos] = useState(false);
  // Cambia al guardar o deshacer para que "Cómo compra" vuelva a leer lo guardado.
  const [versionDatos, setVersionDatos] = useState(0);
  const prospeccionRef = useRef<ProspeccionLeadRef | null>(null);
  const [menuAcciones, setMenuAcciones] = useState(false);
  // Hora de referencia para "vencida" y "próximos" (fija mientras la ficha está abierta).
  const [ahora] = useState(() => Date.now());
  const {
    lead, leadId, origen, nombre, telefono, linkWhatsApp, email, vehiculo, vendedores, sucursales, motivos, eventos,
    tareasAbiertas, testDrives, peritajes, presupuestos, senas, ventas, vehiculosStock,
    ESTADOS_LEAD, ETIQUETA_ORIGEN, ICONO_ORIGEN, COLOR_ICONO_ORIGEN, CANALES_ORIGEN, ESTADOS_TEST_DRIVE, soportaPeritaje,
  } = f;

  const grado = GRADOS[lead.calificacion || ""] || GRADOS[""];
  const IconoGrado = grado.icono;
  const IconoCanal = ICONO_ORIGEN[origen];
  const qs = `lead_origen=${origen}&lead_id=${leadId}`;
  const linkChat = linkConversacionDelLead(origen, leadId);
  const telefonoDelResumen = lead.handoff_resumen ? telefonoEnTexto(lead.handoff_resumen) : null;
  const sugeridos = vehiculo ? [] : sugerirVehiculosDelTexto([lead.handoff_resumen, lead.notas].filter(Boolean).join(" "), vehiculosStock);
  // Al tocar el buscador se ve todo el stock en venta (Walter, 14/10 y 20/10/2026); escribiendo, cada palabra tiene que aparecer.
  const palabrasAuto = f.busquedaVehiculo.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const buscados = vehiculosStock.filter((v: Fila) => {
    const texto = `${v.marca} ${v.modelo} ${v.patente || ""}`.toLowerCase();
    return palabrasAuto.every((p: string) => texto.includes(p));
  });
  const elegirAuto = (id: string) => { f.cambiarVehiculo(id); f.setBusquedaVehiculo(""); setCambiandoAuto(false); };
  const mostrarBuscador = !vehiculo || cambiandoAuto;
  // Historial: los últimos 3 y "Ver todo" (Walter, 20/10/2026).
  const historial = verTodo ? eventos : eventos.slice(0, 3);
  const mostrado = nombreParaFicha(nombre, lead.handoff_resumen);
  // Datos del cliente (Walter, 21/10/2026: "como antes, todo a la vista; el botón Editar confunde"): los campos se ven
  // siempre y se editan ahí mismo; al tocar algo aparece "Guardar cambios". Se guarda solo lo que cambió.
  const cancelarDatos = () => { f.setNotas(lead.notas || ""); f.setDomicilio(lead.domicilio || ""); setEditandoDatos(false); setVersionDatos((v) => v + 1); };
  const guardarDatos = async () => {
    setGuardandoDatos(true);
    try {
      const prospeccion = prospeccionRef.current?.valor();
      if (prospeccion && JSON.stringify(prospeccion) !== JSON.stringify(normalizarProspeccion(lead.prospeccion))) await f.guardarProspeccion(prospeccion);
      if ((f.notas || "") !== (lead.notas || "")) await f.guardarNotas();
      if ((f.domicilio || "") !== (lead.domicilio || "")) await f.guardarDomicilio();
      setEditandoDatos(false);
      setVersionDatos((v) => v + 1);
    } catch {
      // El aviso ya lo mostró quien guarda (LeadDetailModal); queda abierto para reintentar.
    } finally {
      setGuardandoDatos(false);
    }
  };

  // Próximo paso: la tarea vencida o la que sigue (las tareas ya vienen ordenadas: vencidas, hoy, próximas).
  const proxima = tareasAbiertas[0] as Fila | undefined;
  const restoTareas = tareasAbiertas.slice(1);
  const etapas = (ESTADOS_LEAD as Fila[]).filter((e) => e.value !== "perdido");
  const indiceEtapa = etapas.findIndex((e) => e.value === (lead.estado_lead || "nuevo"));
  const perdido = lead.estado_lead === "perdido";
  const telLimpio = telefono ? String(telefono).replace(/[^\d+]/g, "") : "";
  const filaTarea = (t: Fila, grande = false) => {
    const Icono = ICONO_TAREA[t.tipo] || CalendarDays;
    const vencida = new Date(t.fecha_vencimiento).getTime() < ahora;
    return (
      <div key={t.id} className={`flex items-center gap-3 ${grande ? "py-1" : "py-2.5"}`}>
        <span className={`shrink-0 rounded-full flex items-center justify-center ${grande ? "w-10 h-10" : "w-8 h-8"} ${vencida ? "bg-rose-50 dark:bg-rose-500/10 text-rose-600" : "bg-[#0145F2]/10 text-[#0145F2] dark:text-sky-300"}`}>
          <Icono className={grande ? "w-5 h-5" : "w-4 h-4"} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`${grande ? "text-base font-bold" : "text-sm"} text-slate-800 dark:text-slate-100 truncate`}>{t.titulo || t.tipo}</p>
          <p className={`text-xs ${vencida ? "text-rose-500 font-semibold" : "text-slate-400"}`}>{vencida ? "Vencida · " : ""}{t.titulo ? `${t.tipo} · ` : ""}{cuando(t.fecha_vencimiento)}</p>
        </div>
        <button onClick={() => f.toggleCompletada(t)} className={grande ? "shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10" : "shrink-0 text-slate-300 hover:text-emerald-500"} aria-label="Marcar la tarea como hecha">
          {grande ? <><Check className="w-4 h-4" /> Hecha</> : <Square className="w-5 h-5" />}
        </button>
      </div>
    );
  };

  return (
    <div className="w-full h-full overflow-y-auto custom-scrollbar bg-[#F8FAFC] dark:bg-[#0a0a0f]">
      <div className="p-3 sm:p-5 pb-24 sm:pb-5 max-w-6xl mx-auto space-y-4">
        {/* ================= ENCABEZADO =================
            14/10/2026 (Walter: "mejor UX/UI"): contacto al costado del nombre (no una fila entera), la etapa como pasos
            que se tocan, y abajo los datos del lead en una línea. */}
        <div className={card}>
          <div className="flex items-center justify-between gap-3 mb-2 sm:mb-4">
            <button onClick={f.onClose} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#0145F2]">
              <ArrowLeft className="w-4 h-4" /> Volver a la lista
            </button>
            {/* 17/10/2026 (Walter): sin menú de tres puntos; Lead basura a la vista y "Pedir asistencia" al lado.
                31/10/2026 (Walter): "Ir a la conversación" primero, del color del chat al que lleva (lib/panel/botonesCanal.ts).
                20/10/2026 (Walter): en el celular no entran, ahí van a un botón ⋯. */}
            <div className="hidden sm:flex items-center gap-2">
              {linkChat && (
                <Link href={linkChat} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold shadow-sm ${COLOR_BOTON_CANAL[origen as CanalConversacion]}`}><IconoCanal className="w-3.5 h-3.5" /> Ir a la conversación</Link>
              )}
              {!(lead.asistencia_solicitada && !lead.asistencia_atendida) && (
                <button onClick={() => f.setShowAsistenciaModal(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-orange-200 dark:border-orange-500/30 text-xs font-bold text-orange-600 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-500/10"><LifeBuoy className="w-3.5 h-3.5" /> Pedir asistencia</button>
              )}
              <button onClick={f.toggleBasura} disabled={f.guardandoBasura} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-rose-600 hover:border-rose-200 dark:hover:border-rose-500/30 disabled:opacity-50">
                {lead.es_basura ? <><RotateCcw className="w-3.5 h-3.5" /> Sacar de Lead basura</> : <><Trash2 className="w-3.5 h-3.5" /> Mandar a Lead basura</>}
              </button>
            </div>
            <div className="relative sm:hidden">
              <button onClick={() => setMenuAcciones((v) => !v)} aria-label="Más acciones" aria-expanded={menuAcciones} className="p-2 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300"><MoreHorizontal className="w-4 h-4" /></button>
              {menuAcciones && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuAcciones(false)} />
                  <div className="absolute right-0 top-full mt-1 z-40 w-56 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] shadow-lg py-1">
                    {linkChat && (
                      <Link href={linkChat} onClick={() => setMenuAcciones(false)} className={`mx-2 my-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold ${COLOR_BOTON_CANAL[origen as CanalConversacion]}`}><IconoCanal className="w-4 h-4" /> Ir a la conversación</Link>
                    )}
                    {!(lead.asistencia_solicitada && !lead.asistencia_atendida) && (
                      <button onClick={() => { setMenuAcciones(false); f.setShowAsistenciaModal(true); }} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-orange-600 dark:text-orange-300 hover:bg-slate-50 dark:hover:bg-white/5"><LifeBuoy className="w-4 h-4" /> Pedir asistencia</button>
                    )}
                    <button onClick={() => { setMenuAcciones(false); f.toggleBasura(); }} disabled={f.guardandoBasura} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50">
                      {lead.es_basura ? <><RotateCcw className="w-4 h-4" /> Sacar de Lead basura</> : <><Trash2 className="w-4 h-4" /> Mandar a Lead basura</>}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <div className="relative shrink-0 w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white flex items-center justify-center text-lg font-bold">
                {iniciales(mostrado.nombre)}
                <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 flex items-center justify-center">
                  <IconoCanal className={`w-3 h-3 ${COLOR_ICONO_ORIGEN[origen]}`} />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <Compartido destino como="h1" id={`nombre-lead-${leadId}`} className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate">{mostrado.nombre}</Compartido>
                {mostrado.usuario && <p className="text-[11px] text-slate-400 truncate">{mostrado.usuario.startsWith("@") ? mostrado.usuario : `@${mostrado.usuario}`}</p>}
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  {origen === "manual" ? "Cargado a mano" : `Consulta por ${ETIQUETA_ORIGEN[origen]}`} · {hace(lead.last_message_at || lead.created_at)}
                </p>
                {f.editandoTelefono ? (
                  <span className="mt-1 flex items-center gap-1.5">
                    <input autoFocus value={f.telefonoForm} onChange={(e) => f.setTelefonoForm(e.target.value)} placeholder="11 2345 6789" className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 text-sm outline-none w-40" />
                    {/* Botones con texto: el check chiquito no se veía (Walter, 21/10/2026). */}
                    <button onClick={() => f.guardarTelefono()} disabled={f.guardandoTelefono} className="px-3 py-1 rounded-lg bg-[#0145F2] text-white text-xs font-bold disabled:opacity-50">{f.guardandoTelefono ? "Guardando…" : "Guardar"}</button>
                    <button onClick={() => f.setEditandoTelefono(false)} className="px-3 py-1 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-600 dark:text-slate-300">Cancelar</button>
                  </span>
                ) : (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-200">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> {telefono || "Sin teléfono"}
                    <button onClick={() => { f.setTelefonoForm(telefono); f.setEditandoTelefono(true); }} className="flex items-center gap-1 text-xs font-semibold text-[#0145F2] dark:text-sky-400 hover:underline" aria-label="Editar teléfono"><Edit2 className="w-3 h-3" /> {telefono ? "Cambiar" : "Agregar"}</button>
                    {!telefono && telefonoDelResumen && (
                      <button onClick={() => f.guardarTelefono(telefonoDelResumen)} disabled={f.guardandoTelefono} className="text-xs font-semibold text-[#0145F2] dark:text-[#6B92FF] hover:underline disabled:opacity-50">Guardar {telefonoDelResumen} (lo dejó en la charla)</button>
                    )}
                  </p>
                )}
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              {telefono && <a href={`tel:${telLimpio}`} className={`${BTN.secundario} flex-none px-4`}><Phone className="w-4 h-4" /> Llamar</a>}
              {linkWhatsApp && <a href={linkWhatsApp} target="_blank" rel="noreferrer" className={`${BTN.whatsapp} flex-none px-4`}><IconoWhatsapp className="w-4 h-4" /> WhatsApp</a>}
              {email && <a href={`mailto:${email}`} className={`${BTN.secundario} flex-none px-3`} aria-label="Enviar email"><Mail className="w-4 h-4" /></a>}
            </div>
          </div>

          {/* Etapa: pasos que se tocan. "Perdido" va aparte. */}
          <div className="mt-3 sm:mt-5 flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex-1 grid gap-1" style={{ gridTemplateColumns: `repeat(${etapas.length}, minmax(0, 1fr))` }}>
              {etapas.map((e: Fila, i: number) => {
                const hecha = !perdido && i <= indiceEtapa;
                const actual = !perdido && i === indiceEtapa;
                return (
                  <button key={e.value} type="button" disabled={f.guardandoEstado || actual} onClick={() => f.cambiarEstado(e.value)}
                    className={`text-left rounded-lg px-2 sm:px-2.5 py-1.5 border transition-colors disabled:cursor-default ${actual ? "bg-[#0145F2] border-[#0145F2] text-white" : hecha ? "bg-[#0145F2]/10 border-[#0145F2]/20 text-[#0145F2] dark:text-sky-300" : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 hover:border-[#0145F2]/40"}`}>
                    <span className="block h-1 rounded-full mb-1 bg-current opacity-60" />
                    <span className="block text-[10px] sm:text-[11px] font-bold leading-tight">{e.label}</span>
                  </button>
                );
              })}
            </div>
            <button type="button" disabled={f.guardandoEstado || perdido} onClick={() => f.cambiarEstado("perdido")}
              className={`shrink-0 rounded-lg px-3 py-2 text-[11px] font-bold border ${perdido ? "bg-rose-600 border-rose-600 text-white" : "border-rose-200 dark:border-rose-500/30 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"}`}>
              {perdido ? "Perdido" : "Marcar perdido"}
            </button>
          </div>
          {perdido && lead.motivo_cierre_id && (
            <p className="mt-2"><Etiqueta tono="peligro">Motivo: {motivos.find((m: Fila) => m.id === lead.motivo_cierre_id)?.nombre || "sin motivo"}</Etiqueta></p>
          )}

          {/* Interés, vendedor, sucursal y origen en una línea corta que se toca para cambiar (Walter, 20/10/2026).
              Sin vendedor se marca en rojo. Sin dato, cada uno invita a completarlo: "Asignar vendedor", "Asignar sucursal",
              "Especificar origen" (Walter, 21/10/2026). */}
          <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 sm:mt-4 sm:pt-4 border-t border-slate-100 dark:border-white/10">
            <label className={pastilla} title="Grado de interés">
              <IconoGrado className={`w-3.5 h-3.5 shrink-0 ${grado.color}`} />
              <SelectorWeb ariaLabel="Grado de interés" placeholder="Sin calificar" valor={lead.calificacion || ""} deshabilitado={f.guardandoCalificacion} onCambio={f.cambiarCalificacion} claseBoton={selectPastilla} claseFlecha="w-3 h-3"
                opciones={Object.entries(GRADOS).map(([v, g]) => ({ valor: v, etiqueta: g.label }))} />
            </label>
            <label className={lead.vendedor_id ? pastilla : pastillaAlerta} title="Vendedor">
              <UserRound className="w-3.5 h-3.5 shrink-0 opacity-70" />
              <SelectorWeb ariaLabel="Vendedor" valor={lead.vendedor_id || ""} deshabilitado={f.guardandoVendedor} onCambio={f.cambiarVendedor} claseBoton={selectPastilla} claseFlecha="w-3 h-3"
                opciones={[{ valor: "", etiqueta: "Asignar vendedor" }, ...vendedores.map((v: Fila) => ({ valor: v.id, etiqueta: v.nombre }))]} />
            </label>
            {/* messenger_conversaciones no tiene la columna sucursal_id: guardarla daría error. */}
            {origen !== "messenger" && (
              <label className={pastilla} title="Sucursal">
                <MapPin className="w-3.5 h-3.5 shrink-0 opacity-70" />
                <SelectorWeb ariaLabel="Sucursal" valor={lead.sucursal_id || ""} deshabilitado={f.guardandoSucursal} onCambio={f.cambiarSucursal} claseBoton={selectPastilla} claseFlecha="w-3 h-3"
                  opciones={[{ valor: "", etiqueta: vehiculo?.sucursal?.nombre ? `${vehiculo.sucursal.nombre} (del auto)` : "Asignar sucursal" }, ...sucursales.map((s: Fila) => ({ valor: s.id, etiqueta: s.nombre }))]} />
              </label>
            )}
            <label className={pastilla} title="Origen">
              <IconoCanal className={`w-3.5 h-3.5 shrink-0 ${COLOR_ICONO_ORIGEN[origen]}`} />
              {/* El canal por el que escribió ya es la primera opción: no se repite abajo ("Instagram" salía dos veces, Walter 29/10/2026). Si canal_origen trae ese mismo canal (los webhooks lo guardan al crear la charla) o uno que no está en la lista, se muestra esa primera opción: el <select> viejo hacía lo mismo solo. */}
              <SelectorWeb ariaLabel="Origen" valor={CANALES_ORIGEN.some((c: string) => c === lead.canal_origen && (origen === "manual" || etiquetaOrigen(c) !== ETIQUETA_ORIGEN[origen])) ? (lead.canal_origen as string) : ""} deshabilitado={f.guardandoCanalOrigen} onCambio={f.cambiarCanalOrigen} claseBoton={selectPastilla} claseFlecha="w-3 h-3"
                opciones={[{ valor: "", etiqueta: origen === "manual" ? "Especificar origen" : ETIQUETA_ORIGEN[origen] },
                  ...CANALES_ORIGEN.filter((c: string) => origen === "manual" || etiquetaOrigen(c) !== ETIQUETA_ORIGEN[origen]).map((c: string) => ({ valor: c, etiqueta: etiquetaOrigen(c) }))]} />
            </label>
          </div>
        </div>

        {lead.asistencia_solicitada && !lead.asistencia_atendida && (
          <div className="rounded-2xl border border-orange-200 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10 p-4 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <LifeBuoy className="w-5 h-5 mt-0.5 shrink-0 text-orange-600" />
              <div>
                <p className="text-sm font-bold text-orange-700 dark:text-orange-300">Asistencia pedida{lead.asistencia_para ? ` a ${vendedores.find((v: Fila) => v.id === lead.asistencia_para)?.nombre || ""}` : ""}</p>
                {lead.asistencia_nota && <p className="text-xs text-orange-700/80 dark:text-orange-200 mt-0.5">{lead.asistencia_nota}</p>}
              </div>
            </div>
            <button onClick={f.marcarAsistenciaAtendida} className="shrink-0 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 px-3 py-1.5 rounded-lg">Marcar atendida</button>
          </div>
        )}

        {/* ================= CUERPO =================
            En el celular y la tablet es una sola columna en el orden que pidió Walter (2/11/2026): resumen de la IA,
            operaciones (Avanzar la venta), datos del cliente, próximo paso, auto y al final el historial. Las dos columnas
            se "abren" (contents) y cada tarjeta lleva su order; desde lg vuelven las dos columnas de siempre. */}
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <div className="contents lg:block lg:space-y-4 lg:min-w-0">
            {lead.handoff_resumen && (
              <div className={`${card} order-1 lg:order-none`}>
                <Seccion titulo="Qué pidió el cliente (resumen de la IA)" icono={Sparkles} accion={lead.handoff_reason ? <Etiqueta tono="info"><UserRound className="w-3 h-3" /> {lead.handoff_reason === "cliente_pidio_humano" ? "Pidió hablar con una persona" : "IA en pausa"}</Etiqueta> : null}>
                  <BloqueDestacado><ResumenResaltado texto={lead.handoff_resumen} /></BloqueDestacado>
                </Seccion>
              </div>
            )}

            {/* Datos del cliente siempre a la vista: los cuatro de cómo compra (los completa solo el lector de charlas), notas y
                domicilio. Se tocan ahí mismo y "Guardar cambios" aparece recién al cambiar algo (Walter, 21/10/2026). */}
            <div className={`${card} order-3 lg:order-none`}>
              <Seccion titulo="Datos del cliente" icono={UserRound}>
                <div className="space-y-3">
                  <ProspeccionLead key={`${lead.id}-${versionDatos}`} valor={lead.prospeccion} onGuardar={f.guardarProspeccion} soloCampos ref={prospeccionRef} onCambio={() => setEditandoDatos(true)} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-200 dark:border-white/10 p-3">
                      <label className={`${etiquetaDato} flex items-center gap-1 mb-1`}><StickyNote className="w-3 h-3" /> Notas</label>
                      <textarea rows={3} value={f.notas} onChange={(e) => { f.setNotas(e.target.value); setEditandoDatos(true); }} className={inputClass} placeholder="Lo que haya que recordar de este cliente" />
                    </div>
                    <div className="rounded-xl border border-slate-200 dark:border-white/10 p-3">
                      <label className={`${etiquetaDato} flex items-center gap-1 mb-1`}><MapPin className="w-3 h-3" /> Domicilio</label>
                      <input value={f.domicilio} onChange={(e) => { f.setDomicilio(e.target.value); setEditandoDatos(true); }} className={inputClass} placeholder="Calle, número y localidad" />
                    </div>
                  </div>
                  {editandoDatos && (
                    <div className="flex gap-2">
                      <button onClick={guardarDatos} disabled={guardandoDatos} className={BTN.primario}>{guardandoDatos ? "Guardando…" : "Guardar cambios"}</button>
                      <button onClick={cancelarDatos} disabled={guardandoDatos} className={BTN.secundario}>Deshacer</button>
                    </div>
                  )}
                </div>
              </Seccion>
            </div>

            {/* Próximo paso, debajo de los datos (Walter, 17/10/2026: qué pidió, cómo compra, notas, próximo paso).
                Vacío: botones rápidos que abren la tarea ya armada (20/10/2026). */}
            <div className={`${card} order-4 lg:order-none`}>
              <Seccion titulo="Próximo paso" icono={CalendarDays} accion={<button onClick={() => f.setShowTareaModal(true)} className="flex items-center gap-1 text-xs font-bold text-[#0145F2] dark:text-sky-400"><Plus className="w-3.5 h-3.5" /> Nueva tarea</button>}>
                {f.cargandoDetalle ? <p className="text-xs text-slate-400">Cargando…</p> : proxima ? filaTarea(proxima, true) : (
                  <div className="rounded-xl border border-dashed border-slate-300 dark:border-white/15 px-4 py-3">
                    <p className="text-sm font-bold text-slate-800 dark:text-white">Sin próximo paso</p>
                    <p className="text-xs text-slate-400">Agendá un llamado o un mensaje para no perder al cliente.</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button onClick={() => f.abrirTareaRapida("Llamar", 1)} className={`${BTN.secundario} flex-none px-3`}><Phone className="w-4 h-4" /> Llamar mañana</button>
                      <button onClick={() => f.abrirTareaRapida("Enviar WhatsApp", 2)} className={`${BTN.secundario} flex-none px-3`}><MessageCircle className="w-4 h-4" /> WhatsApp en 2 días</button>
                    </div>
                  </div>
                )}
                {restoTareas.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-slate-100 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/10">
                    {restoTareas.map((t: Fila) => filaTarea(t))}
                  </div>
                )}
              </Seccion>
            </div>

            <div className={`${card} order-7 lg:order-none`}>
              <Seccion titulo="Historial" icono={History} accion={eventos.length > 3 || f.hayMasEventos ? <button onClick={() => setVerTodo((v) => !v)} className="text-xs font-bold text-[#0145F2] dark:text-sky-400">{verTodo ? "Ver menos" : `Ver todo (${eventos.length}${f.hayMasEventos ? "+" : ""})`}</button> : null}>
                {f.cargandoDetalle ? <p className="text-xs text-slate-400">Cargando…</p> : eventos.length === 0 ? <p className="text-xs text-slate-400">Lead creado {hace(lead.created_at)}.</p> : (
                  <LineaTiempo items={historial.map((ev: Fila) => ({ titulo: ev.descripcion, detalle: `${ev.autor?.nombre || "Sistema"} · ${hace(ev.created_at)}` }))} />
                )}
                {verTodo && f.hayMasEventos && <button onClick={f.cargarMasEventos} className="mt-2 text-xs font-bold text-[#0145F2] dark:text-sky-400">Ver los anteriores</button>}
              </Seccion>
            </div>
          </div>

          {/* ================= COLUMNA DERECHA ================= */}
          <div className="contents lg:block lg:space-y-4 lg:min-w-0 lg:sticky lg:top-4">
            {/* Acciones de venta arriba: antes estaban al final y había que bajar para encontrarlas. */}
            <div className={`${card} order-2 lg:order-none`}>
              <Seccion titulo="Avanzar la venta" icono={ArrowRight}>
                {/* Grande solo "Crear cotización"; el resto, chicos en una fila (Walter, 20/10/2026). */}
                <Link href={`/panel/cotizaciones?nuevo=1&${qs}`} className={`${BTN.primario} w-full`}><FileText className="w-4 h-4" /> Crear cotización</Link>
                <div className="grid grid-cols-4 gap-1.5 mt-2">
                  <Link href={`/panel/senas?nuevo=1&${qs}`} className={accionChicaSena}><Wallet className="w-4 h-4" /> Seña</Link>
                  <Link href={`/panel/ventas?nueva=1&${qs}`} className={accionChicaVenta}><Receipt className="w-4 h-4" /> Venta</Link>
                  {peritajes.length > 0
                    ? <Link href={`/panel/peritajes/${peritajes[0].id}`} className={accionChica}><ClipboardCheck className="w-4 h-4" /> Peritaje</Link>
                    : <button onClick={f.iniciarPeritaje} className={accionChica}><ClipboardCheck className="w-4 h-4" /> Peritaje</button>}
                  <button onClick={() => f.setShowTestDriveModal(true)} className={accionChica}><Car className="w-4 h-4" /> Test drive</button>
                </div>
                {(presupuestos.length > 0 || senas.length > 0 || ventas.length > 0) && (
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/10 space-y-1.5">
                    <p className={etiquetaDato}>Ya hecho con este cliente</p>
                    {presupuestos.map((p: Fila) => (
                      <Link key={`p-${p.id}`} href={`/panel/cotizaciones/imprimir/${p.id}`} className="flex items-center justify-between rounded-lg border border-slate-100 dark:border-white/10 px-3 py-2 text-xs hover:border-[#0145F2]">
                        <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Cotización N° {p.numero}</span>
                        <span className="font-bold">{p.precio_ars ? `$ ${Number(p.precio_ars).toLocaleString("es-AR")}` : p.precio_usd ? `US$ ${Number(p.precio_usd).toLocaleString("es-AR")}` : ""}</span>
                      </Link>
                    ))}
                    {senas.map((s: Fila) => (
                      <Link key={`s-${s.id}`} href={`/panel/senas/imprimir/${s.id}`} className="flex items-center justify-between rounded-lg border border-slate-100 dark:border-white/10 px-3 py-2 text-xs hover:border-[#0145F2]">
                        <span className="flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> Seña N° {s.numero}</span>
                        <span className="font-bold">{s.venta_ars ? `$ ${Number(s.venta_ars).toLocaleString("es-AR")}` : s.venta_usd ? `US$ ${Number(s.venta_usd).toLocaleString("es-AR")}` : ""}</span>
                      </Link>
                    ))}
                    {ventas.map((b: Fila) => (
                      <div key={`b-${b.id}`} className="flex items-center justify-between rounded-lg border border-slate-100 dark:border-white/10 px-3 py-2 text-xs">
                        <span className="flex items-center gap-1.5"><Receipt className="w-3.5 h-3.5" /> Venta — {new Date(b.created_at).toLocaleDateString("es-AR")}</span>
                        <span className="font-bold">{b.moneda_venta} {Number(b.precio_venta).toLocaleString("es-AR")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Seccion>
            </div>

            <div className={`${card} order-5 lg:order-none`}>
              <Seccion titulo="Auto que le interesa" icono={Car} accion={vehiculo && !cambiandoAuto ? <button onClick={() => { setCambiandoAuto(true); f.cargarStock(); }} className="text-xs font-bold text-[#0145F2] dark:text-sky-400">Cambiar</button> : null}>
                {vehiculo && !cambiandoAuto && (
                  <>
                    <Link href={`/panel/stock?vehiculo=${vehiculo.id}`} className="flex gap-3 group">
                      <div className="w-24 h-16 shrink-0 rounded-lg overflow-hidden bg-slate-100 dark:bg-white/5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={fotoPrincipal(vehiculo.fotos)} alt={`${vehiculo.marca} ${vehiculo.modelo}`} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#0145F2] truncate">{vehiculo.marca} {vehiculo.modelo}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{[vehiculo.anio, textoKm(vehiculo), vehiculo.patente].filter(Boolean).join(" · ")}</p>
                        {precioVehiculo(vehiculo) && <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{precioVehiculo(vehiculo)}</p>}
                      </div>
                    </Link>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {vehiculo.estado && <Etiqueta>{ESTADO_AUTO[vehiculo.estado] || vehiculo.estado}</Etiqueta>}
                      {vehiculo.propio_agencia === false && <Etiqueta tono="info">En consignación</Etiqueta>}
                      {vehiculo.sucursal?.nombre && <Etiqueta><MapPin className="w-3 h-3" /> {vehiculo.sucursal.nombre}</Etiqueta>}
                    </div>
                    {vehiculo.vendedor_asignado_id && vehiculo.vendedor_asignado_id !== (lead.vendedor_id || null) && (
                      <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300"><AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Lo tiene asignado {vehiculo.vendedor_asignado?.nombre || "otro vendedor"} en Stock.</p>
                    )}
                    <AvisoSucursalLead sucursalAutoId={vehiculo.sucursal_id} sucursalAutoNombre={vehiculo.sucursal?.nombre} vendedorActualId={lead.vendedor_id}
                      guardando={f.guardandoVendedor} onAsignar={f.cambiarVendedor} />
                  </>
                )}
                {mostrarBuscador && (
                  <div className="space-y-2">
                    {sugeridos.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Lo nombra el resumen o las notas:</p>
                        {sugeridos.map((v: Fila) => (
                          <button key={v.id} onClick={() => elegirAuto(v.id)} disabled={f.guardandoVehiculo} className="w-full flex items-center justify-between gap-2 rounded-lg border border-[#0145F2]/30 bg-[#0145F2]/5 px-3 py-2 text-left text-sm hover:bg-[#0145F2]/10 disabled:opacity-50">
                            <span className="truncate text-slate-800 dark:text-white">{v.marca} {v.modelo}</span>
                            <span className="flex items-center gap-1 text-xs font-bold text-[#0145F2] dark:text-sky-400 shrink-0"><Link2 className="w-3.5 h-3.5" /> Vincular</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input value={f.busquedaVehiculo} onChange={(e) => f.setBusquedaVehiculo(e.target.value)} onFocus={() => { setListaAutos(true); f.cargarStock(); }} disabled={f.guardandoVehiculo}
                        placeholder="Buscar en el stock: marca, modelo o patente" className={`${inputClass} pl-8`} />
                    </div>
                    {/* La lista del stock aparece al tocar el buscador, no de entrada (Walter, 20/10/2026: abrumaba). */}
                    {(listaAutos || f.busquedaVehiculo) && (
                      <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/10">
                        {!f.stockCargado ? <p className="px-3 py-2 text-xs text-slate-400">Cargando el stock…</p> : buscados.length === 0 ? <p className="px-3 py-2 text-xs text-slate-400">Sin resultados.</p> : buscados.slice(0, 60).map((v: Fila) => (
                          <button key={v.id} onClick={() => elegirAuto(v.id)} disabled={f.guardandoVehiculo} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/5 flex items-center justify-between gap-2 disabled:opacity-50">
                            <span className="truncate text-slate-800 dark:text-white">{v.marca} {v.modelo}</span><span className="text-[11px] text-slate-400 shrink-0">{v.patente || "S/P"}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {vehiculo && <div className="flex gap-2"><button onClick={() => { setCambiandoAuto(false); f.setBusquedaVehiculo(""); }} className={BTN.secundario}>Cancelar</button><button onClick={() => elegirAuto("")} className={BTN.peligro}>Desvincular</button></div>}
                  </div>
                )}
              </Seccion>

              {testDrives.length > 0 && (
                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-white/10">
                  <Seccion titulo="Test drive" icono={CalendarDays}>
                    <div className="space-y-1.5">
                      {testDrives.map((td: Fila) => {
                        const v = f.autoDeTestDrive(td.vehiculo_id);
                        return (
                          <div key={td.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 dark:border-white/10 px-3 py-2">
                            <div className="min-w-0"><p className="text-xs font-bold text-slate-800 dark:text-white truncate">{v ? `${v.marca} ${v.modelo}` : "Sin auto"}</p><span className="text-[11px] text-slate-400">{cuando(td.fecha_hora)}</span></div>
                            <div className="shrink-0">
                              <SelectorWeb ariaLabel="Estado del test drive" valor={td.estado} onCambio={(v) => f.cambiarEstadoTestDrive(td, v)} claseFlecha="w-3 h-3"
                                claseBoton="text-[10px] font-bold uppercase px-2 py-1 rounded-lg border outline-none bg-white dark:bg-white/5 border-slate-200 dark:border-white/10"
                                opciones={ESTADOS_TEST_DRIVE.map((e: string) => ({ valor: e, etiqueta: e }))} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Seccion>
                </div>
              )}

              {(soportaPeritaje || peritajes.length > 0) && (
                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-white/10">
                  <Seccion titulo="Peritaje" icono={ClipboardCheck} accion={soportaPeritaje ? <button onClick={vehiculo ? f.iniciarPeritajeDelAuto : f.iniciarPeritaje} disabled={f.creandoPeritaje} className="flex items-center gap-1 text-xs font-bold text-[#0145F2] dark:text-sky-400 disabled:opacity-50"><Plus className="w-3.5 h-3.5" /> {f.creandoPeritaje ? "Iniciando..." : "Iniciar"}</button> : null}>
                    {peritajes.length === 0 ? <p className="text-xs text-slate-400">Todavía no se hizo un peritaje.</p> : peritajes.map((p: Fila) => (
                      <Link key={p.id} href={`/panel/peritajes/${p.id}`} className="flex items-center justify-between rounded-lg border border-slate-100 dark:border-white/10 px-3 py-2 text-xs hover:border-[#0145F2]">
                        <span>{new Date(p.created_at).toLocaleDateString("es-AR")}</span>
                        <span className="flex items-center gap-2 font-bold">{p.puntaje != null && <span className={p.puntaje >= 70 ? "text-emerald-600" : p.puntaje >= 40 ? "text-amber-600" : "text-rose-600"}>{p.puntaje}%</span>}<span className="text-slate-400 uppercase">{p.estado}</span></span>
                      </Link>
                    ))}
                  </Seccion>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Celular: contacto siempre a mano, abajo. "Ir a la conversación" en vez de Cotizar (Walter, 2/11/2026: Cotizar ya está
          en Avanzar la venta); un lead cargado a mano no tiene chat y sigue con Cotizar. */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-20 bg-white/95 dark:bg-[#111]/95 backdrop-blur border-t border-slate-200 dark:border-white/10 px-3 py-2.5 flex gap-2">
        {telefono && <a href={`tel:${telLimpio}`} className={BTN.secundario}><Phone className="w-4 h-4" /> Llamar</a>}
        {/* Un lead de WhatsApp ya se contesta en su conversación: no se repite el botón verde (eran dos iguales). */}
        {linkWhatsApp && !(linkChat && origen === "whatsapp") && <a href={linkWhatsApp} target="_blank" rel="noreferrer" className={BTN.whatsapp}><IconoWhatsapp className="w-4 h-4" /> WhatsApp</a>}
        {linkChat
          ? <Link href={linkChat} className={`flex-1 flex items-center justify-center gap-1.5 whitespace-nowrap px-3 py-2.5 rounded-xl text-sm font-bold shadow-sm ${COLOR_BOTON_CANAL[origen as CanalConversacion]}`}><IconoCanal className="w-4 h-4 shrink-0" /> {telefono && linkWhatsApp && origen !== "whatsapp" ? "Ir al chat" : "Ir a la conversación"}</Link>
          : <Link href={`/panel/cotizaciones?nuevo=1&${qs}`} className={BTN.primario}><FileText className="w-4 h-4" /> Cotizar</Link>}
      </div>

      {modales}
    </div>
  );
}
