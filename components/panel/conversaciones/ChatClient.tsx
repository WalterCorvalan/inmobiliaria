"use client";

import AvatarVendedor from "./AvatarVendedor";
import { Fragment, useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { CLASE_ABRIR_EN_LEADS } from "@/lib/panel/botonesCanal";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase2 } from "@/lib/supabase/client";
import ConfirmDialog from "@/components/panel/ConfirmDialog";
import { traducirErrorMeta } from "@/lib/meta/erroresWhatsapp";
import { Search, Send, Bot, Check, CheckCheck, Info, ChevronRight, PanelRight, Loader2, Megaphone, X, MessageSquareText, Archive, ArchiveRestore, FileCheck2, ShoppingBag, Link2, Flame, Clock, FileText, Play } from "lucide-react";
import dynamic from "next/dynamic";
import VisorVideoModal from "./VisorVideoModal";

// Mismo visor con zoom que la galería del catálogo; se carga recién al abrir una foto.
const VisorFotosModal = dynamic(() => import("@/components/modals/VisorFotosModal"), { ssr: false });
import { etiquetaAdjunto } from "@/lib/panel/adjuntosMeta";
import { avisoVentana, claveDia, estadoVentana, horasVentana } from "@/lib/panel/ventana24h";
import SeparadorDia from "./SeparadorDia";
import { countVariables, renderBody } from "@/lib/panel/variablesPlantilla";
import { sugeridaPorNombre } from "@/lib/panel/plantillasSugeridas";
import { IconoWhatsapp, IconoInstagram, IconoMessenger } from "@/components/ui/IconosCanales";
import { normalizarOrigenCliente } from "@/lib/panel/origenesCliente";
import { ordenarPorLlegada } from "@/lib/panel/ordenBandeja";
import { avisar } from "@/components/panel/Dialogos";
import { escucharTablas } from "@/lib/panel/escucharTablas";
import { marcarChatVisto } from "@/lib/panel/chatsVistos";

// Badge con el origen real del lead, sobre el avatar -- pedido del 24/9:
// "canal_origen" ya se clasifica solo en el webhook (WhatsApp directo, Meta
// Ads si llegó de un anuncio con Click-to-WhatsApp, MercadoLibre si vino del
// botón "Contactá al vendedor" de una publicación), pero antes esa info
// vivía solo en el dato -- no se veía en ningún lado del chat. Solo aplica a
// WhatsApp: Instagram no tiene un equivalente de "número directo vs. link de
// otra plataforma" (siempre es un DM nativo de Instagram).
function OrigenBadge({ canalOrigen }: { canalOrigen?: string | null }) {
  if (canalOrigen === "MercadoLibre") {
    return (
      <span title="Llegó desde MercadoLibre" className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-yellow-400 border-2 border-white dark:border-[#111] flex items-center justify-center">
        <ShoppingBag className="w-2.5 h-2.5 text-yellow-900" />
      </span>
    );
  }
  if (canalOrigen === "Meta Ads") {
    return (
      <span title="Llegó desde un anuncio de Meta (Facebook/Instagram)" className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-blue-600 border-2 border-white dark:border-[#111] flex items-center justify-center">
        <Megaphone className="w-2.5 h-2.5 text-white" />
      </span>
    );
  }
  return (
    <span title="Número de WhatsApp directo" className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#25D366] border-2 border-white dark:border-[#111] flex items-center justify-center">
      <IconoWhatsapp className="w-2.5 h-2.5 text-white" />
    </span>
  );
}

// Logo del canal en el avatar de cada charla de Instagram y Messenger, como el de WhatsApp (Walter, 27/10/2026).
function CanalBadge({ canal }: { canal: string }) {
  if (canal === "instagram") return (
    <span title="Instagram" className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#E4405F] border-2 border-white dark:border-[#111] flex items-center justify-center">
      <IconoInstagram className="w-2.5 h-2.5 text-white" />
    </span>
  );
  if (canal === "messenger") return (
    <span title="Messenger" className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#0084FF] border-2 border-white dark:border-[#111] flex items-center justify-center">
      <IconoMessenger className="w-2.5 h-2.5 text-white" />
    </span>
  );
  return null;
}

const ETAPAS_PIPELINE: { value: string; label: string }[] = [
  { value: "sin_contactar", label: "Sin contactar" },
  { value: "contactado", label: "Contactado" },
  { value: "visita", label: "Visita" },
  { value: "negociacion", label: "Negociación" },
  { value: "cerrado", label: "Cerrado" },
  { value: "perdido", label: "Perdido" },
];

type Canal = "whatsapp" | "instagram" | "messenger";
// Messenger agregado en paralelo (28/9) mientras la verificación de negocio
// de Meta está pendiente -- webhook y tablas ya construidos (ver
// app/api/panel/webhooks/messenger), pero sin canalFijo="messenger" en
// ningún page.tsx todavía (no hay app/panel/messenger/page.tsx real armado
// para eso, MessengerClient.tsx sigue con su placeholder "no conectado").
// Se agrupa con Instagram en noEsWhatsapp (mismo modelo de leido_at, sin
// status intermedio como WhatsApp) -- ver CheckDeLeido más abajo.
const TABLA_CONVERSACIONES: Record<Canal, string> = { whatsapp: "whatsapp_conversaciones", instagram: "instagram_conversaciones", messenger: "messenger_conversaciones" };
const TABLA_MENSAJES: Record<Canal, string> = { whatsapp: "whatsapp_mensajes", instagram: "instagram_mensajes", messenger: "messenger_mensajes" };
const ENDPOINT_ENVIAR: Record<Canal, string> = { whatsapp: "/api/panel/whatsapp/enviar", instagram: "/api/panel/instagram/enviar", messenger: "/api/panel/messenger/enviar" };
const CAMPO_CONTACTO: Record<Canal, string> = { whatsapp: "whatsapp_contactos", instagram: "instagram_contactos", messenger: "messenger_contactos" };

// Cada canal guarda el contacto distinto -- WhatsApp tiene nombre_perfil +
// telefono real, Instagram tiene @username (fallback si nunca se resolvió
// el nombre real), Messenger no tiene ni teléfono ni @usuario público, solo
// nombre real si Meta lo llegó a resolver.
function resolverContacto(canal: Canal, raw: any): { nombre_perfil: string | null; telefono: string | null } | null {
  if (!raw) return null;
  if (canal === "whatsapp") return { nombre_perfil: raw.nombre_perfil, telefono: raw.telefono };
  if (canal === "instagram") return { nombre_perfil: raw.nombre_perfil || `@${raw.username || raw.ig_user_id}`, telefono: null };
  return { nombre_perfil: raw.nombre_perfil || "Contacto de Messenger", telefono: null };
}

export default function ChatClient({
  conversacionesIniciales,
  conversacionesInstagramIniciales = [],
  conversacionesMessengerIniciales = [],
  vendedores = [],
  miId = "",
  canalFijo,
}: {
  conversacionesIniciales: any[];
  conversacionesInstagramIniciales?: any[];
  conversacionesMessengerIniciales?: any[];
  vendedores?: { id: string; nombre: string; roles?: string[] | null }[];
  miId?: string;
  canalFijo?: Canal;
}) {
  const [canal, setCanal] = useState<Canal>(canalFijo || "whatsapp");
  const noEsWhatsapp = canal !== "whatsapp";
  const [conversacionesWA, setConversacionesWA] = useState(conversacionesIniciales);
  const [conversacionesIG, setConversacionesIG] = useState(conversacionesInstagramIniciales);
  const [conversacionesMSG, setConversacionesMSG] = useState(conversacionesMessengerIniciales);
  const conversaciones = canal === "whatsapp" ? conversacionesWA : canal === "instagram" ? conversacionesIG : conversacionesMSG;
  const setConversaciones = canal === "whatsapp" ? setConversacionesWA : canal === "instagram" ? setConversacionesIG : setConversacionesMSG;
  const tablaConversaciones = TABLA_CONVERSACIONES[canal];
  const tablaMensajes = TABLA_MENSAJES[canal];
  const endpointEnviar = ENDPOINT_ENVIAR[canal];
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<any[]>([]);
  // Foto o video del chat abierto en grande (Walter, 30/10/2026): las fotos se ven con zoom y se pasa a las otras
  // fotos de la misma charla deslizando.
  const [fotoAbierta, setFotoAbierta] = useState<number | null>(null);
  const [videoAbierto, setVideoAbierto] = useState<string | null>(null);
  const fotosDelChat: string[] = mensajes.filter((m) => m.tipo === "image" && m.media_url).map((m) => m.media_url);
  const [nuevoMensaje, setNuevoMensaje] = useState("");
  const [filtro, setFiltro] = useState<"todas" | "no-leidas" | "archivadas">("todas");
  // Admin y encargados ven todas las charlas: arrancan en "Míos" (las asignadas a ellos) y con "Todos" ven el resto
  // (Walter, 21/10/2026, igual que Leads). El vendedor ya ve solo las suyas.
  const veTodos = (vendedores.find((v) => v.id === miId)?.roles || []).some((r) => r === "admin" || r === "director" || r === "encargado");
  const [soloMias, setSoloMias] = useState(veTodos);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(false);
  const [mostrarPlantillas, setMostrarPlantillas] = useState(false);
  const [plantillas, setPlantillas] = useState<any[]>([]);

  // Distinto de "plantillas" de arriba (respuestas rápidas propias, texto
  // libre) -- estas son plantillas APROBADAS por Meta, obligatorias para
  // responder cuando pasaron 24hs desde el último mensaje del cliente.
  const [plantillasAprobadas, setPlantillasAprobadas] = useState<any[]>([]);
  const [mostrarSelectorAprobadas, setMostrarSelectorAprobadas] = useState(false);
  const [templateElegido, setTemplateElegido] = useState("");
  // Datos {{1}}, {{2}}… de la plantilla elegida (19/10/2026: antes uno solo).
  const [datosPlantilla, setDatosPlantilla] = useState<string[]>([]);
  const [enviandoPlantilla, setEnviandoPlantilla] = useState(false);

  const [creandoClienteManual, setCreandoClienteManual] = useState(false);
  const [guardandoCliente, setGuardandoCliente] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ mensaje: string; accion: () => void } | null>(null);
  const [nuevoCliente, setNuevoCliente] = useState({ nombre: "", telefono: "", email: "", dni_cuit: "" });

  const [panelAbierto, setPanelAbierto] = useState(true);
  const [mostrarDetallesMobile, setMostrarDetallesMobile] = useState(false);
  const [etapaActual, setEtapaActual] = useState("sin_contactar");
  const [notasLocales, setNotasLocales] = useState("");
  const [guardandoNotas, setGuardandoNotas] = useState(false);

  const mensajesEndRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => { setConversacionesWA(conversacionesIniciales); }, [conversacionesIniciales]);
  useEffect(() => { setConversacionesIG(conversacionesInstagramIniciales); }, [conversacionesInstagramIniciales]);
  useEffect(() => { setConversacionesMSG(conversacionesMessengerIniciales); }, [conversacionesMessengerIniciales]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const refrescarConDebounce = () => { clearTimeout(timeoutId); timeoutId = setTimeout(() => router.refresh(), 400); };
    const dejarDeEscuchar = escucharTablas(supabase2, ["whatsapp_conversaciones", "instagram_conversaciones", "messenger_conversaciones"], refrescarConDebounce, "bandeja-chat");
    return () => { clearTimeout(timeoutId); dejarDeEscuchar(); };
  }, [router]);

  useEffect(() => {
    const conversacionParam = searchParams.get("conversacion");
    const canalParam = searchParams.get("canal");
    if (!canalFijo && (canalParam === "instagram" || canalParam === "whatsapp" || canalParam === "messenger")) setCanal(canalParam);
    if (conversacionParam) setSeleccionada(conversacionParam);
  }, [searchParams, canalFijo]);

  useEffect(() => { mensajesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensajes]);

  useEffect(() => {
    if (!seleccionada) return;
    setLoading(true);

    // Últimos 500 mensajes (desc + limit, después se da vuelta) en vez de
    // todo el historial sin límite -- un lead muy viejo con charla larga
    // podía traer miles de filas de una.
    supabase2.from(tablaMensajes).select("*").eq("conversacion_id", seleccionada).order("created_at", { ascending: false }).limit(500).then(({ data }) => {
      setMensajes((data || []).slice().reverse());
      setLoading(false);
    });

    supabase2.from(tablaConversaciones).select("estado_pipeline, notas, unread_count").eq("id", seleccionada).single().then(({ data }) => {
      if (data) {
        setEtapaActual(data.estado_pipeline || "sin_contactar");
        setNotasLocales(data.notas || "");
        // Al entrar a la charla se marca leída sola (promesa del manual).
        if (data.unread_count > 0) {
          supabase2.from(tablaConversaciones).update({ unread_count: 0 }).eq("id", seleccionada).then(() => {
            setConversaciones((prev) => prev.map((c) => (c.id === seleccionada ? { ...c, unread_count: 0 } : c)));
          });
        }
      }
    });

    const canalRealtime = supabase2
      .channel(`${tablaMensajes}:${seleccionada}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: tablaMensajes, filter: `conversacion_id=eq.${seleccionada}` }, (payload) => {
        const nuevo = payload.new as any;
        setMensajes((prev) => {
          if (prev.some((m) => m.id === nuevo.id)) return prev;
          const sinEcoLocal = prev.filter((m) => !(m.direccion === "out" && m.texto === nuevo.texto && m.status === "pending" && m.id !== nuevo.id));
          return [...sinEcoLocal, nuevo];
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: tablaMensajes, filter: `conversacion_id=eq.${seleccionada}` }, (payload) => {
        const actualizado = payload.new as any;
        setMensajes((prev) => prev.map((m) => (m.id === actualizado.id ? actualizado : m)));
      })
      .subscribe();

    return () => { supabase2.removeChannel(canalRealtime); };
  }, [seleccionada, tablaMensajes, tablaConversaciones]);

  // Abrir el chat frena la repetición del aviso de "cliente sin contestar" en el celular (lib/panel/clienteSinContestar.ts).
  useEffect(() => {
    if (seleccionada) marcarChatVisto(canal, seleccionada, miId);
  }, [seleccionada, canal, miId]);

  useEffect(() => {
    supabase2.from("whatsapp_plantillas").select("*").eq("activa", true).order("sector").then(({ data }) => setPlantillas(data || []));
  }, []);

  useEffect(() => {
    if (canal !== "whatsapp") return;
    supabase2.from("whatsapp_templates").select("*").eq("estado", "approved").then(({ data }) => setPlantillasAprobadas(data || []));
  }, [canal]);

  const enviarConPlantilla = async () => {
    if (!seleccionada || !templateElegido) return;
    setEnviandoPlantilla(true);
    try {
      const res = await fetch("/api/panel/whatsapp/enviar-plantilla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversacionId: seleccionada, templateId: templateElegido, variables: datosPlantilla.slice(0, countVariables(plantillasAprobadas.find((t) => t.id === templateElegido)?.cuerpo || "")) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMostrarSelectorAprobadas(false);
      setTemplateElegido("");
      setDatosPlantilla([]);
    } catch (err: any) {
      avisar(err.message || "Error enviando la plantilla.");
    } finally {
      setEnviandoPlantilla(false);
    }
  };

  const enviarMensaje = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoMensaje.trim() || !seleccionada) return;

    const texto = nuevoMensaje.trim();
    setNuevoMensaje("");

    const tempId = crypto.randomUUID();
    const tempMsg = { id: tempId, conversacion_id: seleccionada, direccion: "out", tipo: "text", texto, status: "pending", ai_generado: false, created_at: new Date().toISOString() };
    setMensajes((prev) => [...prev, tempMsg]);

    try {
      const res = await fetch(endpointEnviar, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversacionId: seleccionada, texto }) });
      const data = await res.json();
      if (!res.ok) {
        console.error("Error al enviar", data.error);
        setMensajes((prev) => prev.filter((m) => m.id !== tempId));
        if (res.status === 422) {
          avisar(data.error || "Mensaje bloqueado.");
          setNuevoMensaje(texto);
        } else {
          setMensajes((prev) => [...prev, { ...tempMsg, status: "failed" }]);
        }
      } else {
        // Responder a mano toma la charla: refleja acá lo que el endpoint ya
        // hizo en la base (pausar la IA + pasar a "Contactado" si estaba
        // "Sin contactar"), sin esperar al round-trip de realtime.
        setConversaciones((prev) => prev.map((c) => (c.id === seleccionada
          ? { ...c, ai_habilitada: false, estado_pipeline: !c.estado_pipeline || c.estado_pipeline === "sin_contactar" ? "contactado" : c.estado_pipeline }
          : c)));
        setEtapaActual((prev) => (!prev || prev === "sin_contactar" ? "contactado" : prev));
      }
    } catch (err) {
      console.error("Error al enviar", err);
      setMensajes((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m)));
    }
  };

  const insertarPlantilla = (texto: string) => {
    setNuevoMensaje((prev) => (prev ? `${prev} ${texto}` : texto));
    setMostrarPlantillas(false);
  };

  const cambiarEtapa = async (nuevaEtapa: string) => {
    if (!seleccionada || nuevaEtapa === etapaActual) return;
    setEtapaActual(nuevaEtapa);
    await supabase2.from(tablaConversaciones).update({ estado_pipeline: nuevaEtapa }).eq("id", seleccionada);
  };

  const guardarNotas = async () => {
    if (!seleccionada) return;
    setGuardandoNotas(true);
    try {
      await supabase2.from(tablaConversaciones).update({ notas: notasLocales }).eq("id", seleccionada);
    } finally {
      setGuardandoNotas(false);
    }
  };

  const conversacionActiva = conversaciones.find((c) => c.id === seleccionada);

  const toggleIA = async () => {
    if (!conversacionActiva) return;
    const nuevoValor = !conversacionActiva.ai_habilitada;
    setConversaciones((prev) => prev.map((c) => (c.id === conversacionActiva.id ? { ...c, ai_habilitada: nuevoValor } : c)));
    const { error } = await supabase2.from(tablaConversaciones).update({ ai_habilitada: nuevoValor }).eq("id", conversacionActiva.id);
    if (error) setConversaciones((prev) => prev.map((c) => (c.id === conversacionActiva.id ? { ...c, ai_habilitada: !nuevoValor } : c)));
  };

  const contactoActivo = resolverContacto(canal, conversacionActiva?.[CAMPO_CONTACTO[canal]]);

  // Ventana de 24 hs de Meta (lib/panel/ventana24h.ts): se recalcula cada minuto para que el aviso cuente para atrás.
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setAhora(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  const ultimoDelCliente = [...mensajes].reverse().find((m) => m.direccion === "in")?.created_at ?? null;
  const aviso24h = seleccionada ? avisoVentana(canal, estadoVentana(ultimoDelCliente, ahora, horasVentana(canal))) : null;

  const formatDate = (dateString: string) => new Date(dateString).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" });
  // Como en WhatsApp: hoy muestra la hora, ayer "Ayer", esta semana el día, más viejo la fecha. Días de calendario en hora de Argentina.
  const formatDay = (dateString: string) => {
    const diaAR = (ms: number) => new Date(ms).toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });
    const ms = new Date(dateString).getTime();
    const difDays = Math.round((Date.parse(diaAR(Date.now())) - Date.parse(diaAR(ms))) / 86400000);
    if (difDays <= 0) return new Date(ms).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" });
    if (difDays === 1) return "Ayer";
    if (difDays < 7) { const d = new Date(ms).toLocaleDateString("es-AR", { weekday: "long", timeZone: "America/Argentina/Buenos_Aires" }); return d.charAt(0).toUpperCase() + d.slice(1); }
    return new Date(ms).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "America/Argentina/Buenos_Aires" });
  };

  const indexEtapaActual = ETAPAS_PIPELINE.findIndex((e) => e.value === etapaActual);

  const [showVincular, setShowVincular] = useState(false);
  const [buscarCliente, setBuscarCliente] = useState("");
  const [clientesResult, setClientesResult] = useState<any[]>([]);
  const buscarClientesFn = async (q: string) => {
    setBuscarCliente(q);
    if (q.length < 2) return setClientesResult([]);
    const { data } = await supabase2.from("clientes").select("id, nombre, telefono, dni_cuit").or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%,dni_cuit.ilike.%${q}%`).limit(5);
    setClientesResult(data || []);
  };

  const abrirFormularioCliente = () => {
    setNuevoCliente({ nombre: contactoActivo?.nombre_perfil || "", telefono: contactoActivo?.telefono || "", email: "", dni_cuit: "" });
    setCreandoClienteManual(true);
  };

  const finalizarGuardadoCliente = async (clienteIdExistente: string | null) => {
    setGuardandoCliente(true);
    try {
      let clienteId = clienteIdExistente;
      if (!clienteId) {
        const { data, error } = await supabase2.from("clientes").insert({
          nombre: nuevoCliente.nombre.trim(), telefono: nuevoCliente.telefono || null, email: nuevoCliente.email || null, dni_cuit: nuevoCliente.dni_cuit || null,
          origen: normalizarOrigenCliente(canal === "whatsapp" ? "WhatsApp" : canal === "instagram" ? "Instagram" : "Messenger"), canal_ingreso: "lead_digital",
        }).select("id").single();
        if (error) throw error;
        clienteId = data.id;
      }
      await vincularCliente(clienteId!);
      setCreandoClienteManual(false);
    } catch {
      avisar("Error al crear el cliente.");
    } finally {
      setGuardandoCliente(false);
    }
  };

  const guardarClienteManual = async () => {
    if (!nuevoCliente.nombre.trim()) { avisar("El nombre es obligatorio."); return; }
    setGuardandoCliente(true);
    try {
      if (nuevoCliente.telefono.trim() || nuevoCliente.dni_cuit.trim()) {
        const filtros: string[] = [];
        if (nuevoCliente.telefono.trim()) filtros.push(`telefono.eq.${nuevoCliente.telefono.trim()}`);
        if (nuevoCliente.dni_cuit.trim()) filtros.push(`dni_cuit.eq.${nuevoCliente.dni_cuit.trim()}`);
        const { data: existentes } = await supabase2.from("clientes").select("id, nombre").or(filtros.join(","));
        if (existentes && existentes.length > 0) {
          setConfirmDialog({
            mensaje: `Ya existe un cliente con ese teléfono/DNI: ${existentes[0].nombre}. ¿Usar ese en vez de crear uno nuevo?`,
            accion: () => { finalizarGuardadoCliente(existentes[0].id); },
          });
          setGuardandoCliente(false);
          return;
        }
      }
      await finalizarGuardadoCliente(null);
    } catch {
      avisar("Error al crear el cliente.");
      setGuardandoCliente(false);
    }
  };

  const vincularCliente = async (clienteId: string) => {
    if (!seleccionada) return;
    await supabase2.from(tablaConversaciones).update({ cliente_id: clienteId }).eq("id", seleccionada);
    setConversaciones((prev) => prev.map((c) => (c.id === seleccionada ? { ...c, cliente_id: clienteId } : c)));
    setShowVincular(false);
  };

  const reasignarVendedor = async (vendedorId: string) => {
    if (!seleccionada) return;
    const nuevoId = vendedorId || null;
    await supabase2.from(tablaConversaciones).update({ vendedor_id: nuevoId }).eq("id", seleccionada);
    const vendedor = vendedores.find((v) => v.id === nuevoId) || null;
    setConversaciones((prev) => prev.map((c) => (c.id === seleccionada ? { ...c, vendedor_id: nuevoId, vendedor } : c)));
  };

  const archivarConversacion = async () => {
    if (!seleccionada || !conversacionActiva) return;
    const nuevoValor = !conversacionActiva.archivada;
    setConversaciones((prev) => prev.map((c) => (c.id === seleccionada ? { ...c, archivada: nuevoValor } : c)));
    await supabase2.from(tablaConversaciones).update({ archivada: nuevoValor }).eq("id", seleccionada);
    if (nuevoValor) setSeleccionada(null);
  };

  const conversacionesFiltradas = conversaciones.filter((c) => {
    if (filtro === "archivadas") return !!c.archivada;
    if (c.archivada) return false;
    if (filtro === "no-leidas" && !(c.unread_count > 0)) return false;
    if (veTodos && soloMias && c.vendedor_id !== miId) return false;
    if (busqueda.trim()) {
      const contactoRaw = c[CAMPO_CONTACTO[canal]];
      const texto = [contactoRaw?.nombre_perfil, contactoRaw?.telefono, contactoRaw?.username, contactoRaw?.ig_user_id].join(" ");
      if (!texto.toLowerCase().includes(busqueda.trim().toLowerCase())) return false;
    }
    return true;
  });

  const noLeidasTotal = conversaciones.filter((c) => c.unread_count > 0).length;
  // Una sola lista, la charla más reciente arriba (Walter, 29/10/2026). Antes iban "Tibios y calientes" arriba y
  // "Fríos" abajo, y un mensaje frío recién llegado quedaba debajo de uno tibio de hace días. La temperatura se
  // sigue viendo en el punto de color de cada charla.
  const porLlegada = ordenarPorLlegada(conversacionesFiltradas);

  const colorCalificacion = (calificacion: string | null) => {
    if (calificacion === "caliente") return "bg-rose-500";
    if (calificacion === "tibio") return "bg-amber-500";
    return "bg-slate-300";
  };

  // Preview del último mensaje + ícono de check (pedido 27/9, ver
  // whatsapp/page.tsx e instagram/page.tsx -- traen c.ultimo_mensaje ahí
  // porque no hay columna cacheada del último mensaje en la conversación).
  // WhatsApp trackea pending/sent/delivered/read en un campo "status".
  // Instagram solo trackea "leido_at" (sin distinguir entregado vs enviado),
  // así que ahí el check es de 1 o 2 rayitas nomás, sin el estado intermedio.
  const previewUltimoMensaje = (um: any) => {
    if (!um) return null;
    if (um.tipo === "text") return um.texto || "";
    const ICONS_TIPO: Record<string, string> = { image: "📷 Foto", audio: "🎙️ Audio", video: "🎥 Video", document: "📄 Documento", sticker: "😀 Sticker" };
    return ICONS_TIPO[um.tipo] || um.texto || "Mensaje";
  };

  const CheckDeLeido = ({ um }: { um: any }) => {
    if (!um || um.direccion !== "out") return null;
    if (canal === "whatsapp") {
      if (um.status === "read") return <CheckCheck className="w-3.5 h-3.5 text-sky-500 shrink-0" />;
      if (um.status === "delivered") return <CheckCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
      if (um.status === "failed") return <Check className="w-3.5 h-3.5 text-rose-500 shrink-0" />;
      return <Check className="w-3.5 h-3.5 text-slate-400 shrink-0" />; // pending / sent
    }
    // Instagram/Messenger -- ambos solo trackean leido_at, sin status intermedio.
    return um.leido_at
      ? <CheckCheck className="w-3.5 h-3.5 text-sky-500 shrink-0" />
      : <Check className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
  };

  const renderConversacion = (c: any) => {
    const contacto = resolverContacto(canal, c[CAMPO_CONTACTO[canal]]);
    const isActive = seleccionada === c.id;
    const esCaliente = c.calificacion === "caliente";

    return (
      <button
        key={c.id}
        onClick={() => setSeleccionada(c.id)}
        className={`w-full text-left p-3.5 border-b border-slate-100 dark:border-white/5 transition-all flex gap-3 ${isActive ? "bg-emerald-50 dark:bg-emerald-500/10 border-l-2 border-l-emerald-700 dark:border-l-emerald-400" : "bg-white dark:bg-transparent border-l-2 border-l-transparent hover:bg-slate-50 dark:hover:bg-white/5"}`}
      >
        <div className="relative shrink-0 self-start">
          <AvatarVendedor vendedorId={c.vendedor_id} nombreRespaldo={c.vendedor?.nombre} clase="w-10 h-10" />
          <span className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-[#111] ${colorCalificacion(c.calificacion)}`} title={c.calificacion || "Sin calificar"} />
          {canal === "whatsapp" ? <OrigenBadge canalOrigen={c.canal_origen} /> : <CanalBadge canal={canal} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-0.5">
            <span className={`font-bold text-sm truncate flex items-center gap-1 ${isActive ? "text-emerald-900 dark:text-emerald-200" : "text-slate-900 dark:text-white"}`}>
              {esCaliente && <span title="Lead caliente" className="shrink-0 inline-flex"><Flame className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /></span>}
              {c.origen_ads && <span title={c.origen_ads} className="shrink-0 inline-flex"><Megaphone className="w-3 h-3 text-indigo-500 dark:text-sky-300" /></span>}
              {contacto?.nombre_perfil || contacto?.telefono}
            </span>
            {/* Fallback a la fecha del último mensaje real (c.ultimo_mensaje,
               traído en whatsapp/instagram page.tsx) -- hay conversaciones
               viejas con last_message_at nulo que antes quedaban sin hora. */}
            {(() => {
              const fecha = c.last_message_at || c.ultimo_mensaje?.created_at;
              return <span className="text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap">{fecha ? formatDay(fecha) : ""}</span>;
            })()}
          </div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="flex items-center gap-1 min-w-0 flex-1">
              <CheckDeLeido um={c.ultimo_mensaje} />
              <p className="text-[13px] text-slate-500 dark:text-slate-400 truncate">
                {previewUltimoMensaje(c.ultimo_mensaje) ?? (c.vendedor?.nombre ? `Asignado a ${c.vendedor.nombre}` : "Sin asignar")}
              </p>
            </span>
            {c.unread_count > 0 && <span className="text-[10px] font-bold bg-emerald-600 text-white px-1.5 py-0.5 rounded-full shrink-0">{c.unread_count}</span>}
          </div>
          {c.handoff_at && !c.ai_habilitada && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded-full mt-0.5">
              ⚠️ IA en pausa
            </span>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="flex w-full h-full text-slate-800 dark:text-slate-200">
      {/* COLUMNA 1: BANDEJA */}
      <div className={`w-full md:w-[280px] flex-col bg-white dark:bg-[#111] border-r border-slate-200 dark:border-white/10 shrink-0 ${seleccionada ? "hidden md:flex" : "flex"}`}>
        <div className="p-2.5 border-b border-slate-100 dark:border-white/10 shrink-0 space-y-2">
          {!canalFijo && (
            <div className="flex gap-1.5">
              <button onClick={() => { setCanal("whatsapp"); setSeleccionada(null); }} className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-bold rounded-lg transition-colors ${canal === "whatsapp" ? "bg-emerald-700 text-white" : "bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10"}`}>
                <IconoWhatsapp className="w-3.5 h-3.5" /> WhatsApp {conversacionesWA.length}
              </button>
              <button onClick={() => { setCanal("instagram"); setSeleccionada(null); }} className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-bold rounded-lg transition-colors ${canal === "instagram" ? "bg-gradient-to-tr from-amber-500 via-pink-600 to-purple-600 text-white" : "bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10"}`}>
                <IconoInstagram className="w-3.5 h-3.5" /> Instagram {conversacionesIG.length}
              </button>
              <button onClick={() => { setCanal("messenger"); setSeleccionada(null); }} className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-bold rounded-lg transition-colors ${canal === "messenger" ? "bg-blue-600 text-white" : "bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10"}`}>
                <IconoMessenger className="w-3.5 h-3.5" /> Messenger {conversacionesMSG.length}
              </button>
            </div>
          )}

          {veTodos && (
            <div className="flex gap-1">
              {([[true, "Míos"], [false, "Todos"]] as const).map(([v, label]) => (
                <button key={label} onClick={() => setSoloMias(v)} className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-colors ${soloMias === v ? "bg-slate-800 dark:bg-white text-white dark:text-slate-900 border-slate-800 dark:border-white" : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-300"}`}>{label}</button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar..." className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg py-1.5 pl-8 pr-3 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500" />
            </div>
            <button onClick={() => setFiltro(filtro === "todas" ? "no-leidas" : "todas")} title="No leídas" className={`shrink-0 px-2 py-1.5 text-[11px] font-semibold rounded-lg transition-colors flex items-center gap-1 ${filtro === "no-leidas" ? "bg-slate-800 dark:bg-white/10 text-white" : "bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"}`}>
              {noLeidasTotal > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />} {noLeidasTotal}
            </button>
            <button onClick={() => { setFiltro(filtro === "archivadas" ? "todas" : "archivadas"); setSeleccionada(null); }} title="Archivadas" className={`shrink-0 p-1.5 rounded-lg transition-colors ${filtro === "archivadas" ? "bg-slate-800 dark:bg-white/10 text-white" : "bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"}`}>
              <Archive className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {porLlegada.map((c) => renderConversacion(c))}
          {conversacionesFiltradas.length === 0 && <p className="text-center text-xs text-slate-400 py-8">Sin conversaciones.</p>}
        </div>
      </div>

      {/* COLUMNA 2: CHAT */}
      <div className={`flex-1 flex flex-col relative ${!seleccionada ? "hidden md:flex" : "flex"} ${noEsWhatsapp ? "bg-[#fafafa] dark:bg-[#0A0A0A]" : "bg-[#e5ddd4] dark:bg-[#0b141a]"}`}
        style={!noEsWhatsapp ? { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cg fill='%23000000' fill-opacity='0.03'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z'/%3E%3C/g%3E%3C/svg%3E\")" } : undefined}>
        {!seleccionada ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
            <p className="text-sm font-medium">Elige una conversación para ver el hilo</p>
          </div>
        ) : (
          <>
            <div className={`h-[56px] flex justify-between items-center px-4 shrink-0 shadow-sm z-10 ${noEsWhatsapp ? "bg-white dark:bg-[#111] border-b border-slate-200 dark:border-white/10" : "bg-emerald-700 dark:bg-[#202c33]"}`}>
              <div className="flex items-center gap-3">
                <AvatarVendedor vendedorId={conversacionActiva?.vendedor_id} nombreRespaldo={conversacionActiva?.vendedor?.nombre} clase="w-9 h-9" claseTexto="text-xs" />
                <div>
                  <h3 className={`font-bold text-[15px] leading-tight ${noEsWhatsapp ? "text-slate-900 dark:text-white" : "text-white"}`}>{contactoActivo?.nombre_perfil || "Cliente"}</h3>
                  <p className={`text-[11px] font-medium ${noEsWhatsapp ? "text-slate-500 dark:text-slate-400" : "text-emerald-100/80"}`}>{contactoActivo?.telefono}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Abre este lead en Leads (Walter, 27/10/2026). */}
                <Link href={`/panel/leads?lead=${seleccionada}&origen=${canal}`} title="Abrir en Leads"
                  className={CLASE_ABRIR_EN_LEADS}>
                  <Image src="/icons/panel/leads.png" alt="" width={16} height={16} className="w-4 h-4 object-contain" /> <span className="hidden sm:inline">Abrir en Leads</span>
                </Link>
                <button className={`md:hidden text-sm font-bold ${noEsWhatsapp ? "text-emerald-700 dark:text-emerald-300" : "text-white"}`} onClick={() => setSeleccionada(null)}>Atrás</button>
                <button onClick={() => setMostrarDetallesMobile(true)} className={`lg:hidden p-1.5 rounded-md transition-colors ${noEsWhatsapp ? "text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-700 dark:hover:text-slate-200" : "text-emerald-100 hover:bg-white/10"}`} title="Ver detalles">
                  <PanelRight className="w-5 h-5" />
                </button>
                {!panelAbierto && (
                  <button onClick={() => setPanelAbierto(true)} className={`hidden lg:flex p-1.5 rounded-md transition-colors ${noEsWhatsapp ? "text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-700 dark:hover:text-slate-200" : "text-emerald-100 hover:bg-white/10"}`} title="Mostrar detalles">
                    <PanelRight className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {conversacionActiva?.handoff_at && !conversacionActiva?.ai_habilitada && (
              <div className="bg-amber-500 text-white px-4 py-2 flex items-center gap-2 shrink-0 shadow-sm z-10">
                <Info className="w-4 h-4 shrink-0" />
                <p className="text-xs font-bold flex-1">
                  ⚠️ IA en pausa — {conversacionActiva.handoff_reason === "cliente_pidio_humano" ? "el cliente pidió hablar con una persona" : "esperando que atiendas vos"}.
                  {conversacionActiva.handoff_resumen ? ` ${conversacionActiva.handoff_resumen}` : ""}
                </p>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-1.5 custom-scrollbar">
              {loading ? (
                <div className="flex justify-center py-4"><span className="text-xs text-slate-500 dark:text-slate-400">Cargando...</span></div>
              ) : (
                mensajes.map((m, idx) => {
                  const out = m.direccion === "out";
                  // "Visto" solo va debajo del ÚLTIMO mensaje que mandamos --
                  // igual que la app real de Instagram, no un tilde por
                  // mensaje. Si el último saliente todavía no tiene
                  // leido_at, no se muestra nada (el cliente no lo vio aún).
                  const esUltimoOut = out && !mensajes.slice(idx + 1).some((sig) => sig.direccion === "out");
                  const mostrarVisto = noEsWhatsapp && esUltimoOut && !!m.leido_at;
                  const burbujaOut = noEsWhatsapp ? "bg-gradient-to-br from-pink-500 to-purple-600 text-white border-transparent" : "bg-[#d9fdd3] dark:bg-[#005c4b] border-transparent text-slate-800 dark:text-white";
                  const burbujaIn = "bg-white dark:bg-[#1f2c34] border-slate-100 dark:border-white/5 text-slate-800 dark:text-slate-100";
                  // Separador de día (SeparadorDia.tsx): estilo WhatsApp o Instagram/Messenger según el canal.
                  const diaNuevo = idx === 0 || claveDia(mensajes[idx - 1].created_at) !== claveDia(m.created_at);
                  return (
                    <Fragment key={m.id}>
                    {diaNuevo && <SeparadorDia fecha={m.created_at} ahora={ahora} estilo={noEsWhatsapp ? "instagram" : "whatsapp"} />}
                    <div className={`flex ${out ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] xl:max-w-[65%] flex flex-col ${out ? "items-end" : "items-start"}`}>
                        <div className={`relative rounded-[10px] px-3 py-2 text-[14.5px] shadow-sm border ${out ? burbujaOut : burbujaIn} ${out ? "rounded-tr-none" : "rounded-tl-none"}`}>
                          {m.tipo === "image" && m.media_url && (
                            <button type="button" onClick={() => setFotoAbierta(fotosDelChat.indexOf(m.media_url))} title="Ver en grande" className="block mb-1 cursor-zoom-in">
                              <img src={m.media_url} alt="Foto del vehículo" className="rounded-lg max-w-[260px] max-h-[260px] object-cover" />
                            </button>
                          )}
                          {m.tipo === "audio" && m.media_url && (
                            <audio controls preload="none" src={m.media_url} className="max-w-[260px] mb-1 h-10" />
                          )}
                          {/* Audio sin media_url: se cayó la descarga de Meta (URL
                              temporal vencida, R2 no configurado, etc.) -- solo
                              queda el placeholder de texto "🎤 Audio" de abajo. */}
                          {m.tipo === "video" && m.media_url && (
                            <button type="button" onClick={() => setVideoAbierto(m.media_url)} title="Ver en grande" className="relative block mb-1 rounded-lg overflow-hidden bg-black">
                              <video preload="metadata" muted playsInline src={m.media_url} className="max-w-[260px] max-h-[260px] pointer-events-none" />
                              <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <span className="w-12 h-12 rounded-full bg-white/90 text-slate-900 flex items-center justify-center shadow-lg"><Play className="w-5 h-5 ml-0.5 fill-current" /></span>
                              </span>
                            </button>
                          )}
                          {m.tipo !== "image" && m.tipo !== "audio" && m.tipo !== "video" && m.media_url && (
                            <a href={m.media_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-black/5 dark:bg-white/10 rounded-lg px-2.5 py-2 mb-1 hover:bg-black/10 dark:hover:bg-white/20 transition-colors">
                              {etiquetaAdjunto(m.media_url, m.tipo) === "Ver publicación compartida" ? <Link2 className="w-3.5 h-3.5 shrink-0" /> : <FileText className="w-3.5 h-3.5 shrink-0" />}
                              <span className="text-[13px] font-semibold underline underline-offset-2 truncate">{etiquetaAdjunto(m.media_url, m.tipo)}</span>
                            </a>
                          )}
                          {m.texto && <p className="leading-relaxed whitespace-pre-wrap">{m.texto}</p>}
                          <div className={`flex items-center justify-end gap-1 mt-1 ${out && !noEsWhatsapp ? "opacity-60" : "opacity-70"}`}>
                            {out && m.ai_generado && <Bot className="w-3 h-3" />}
                            {m.editado && <span className="text-[10px] italic">editado</span>}
                            <span className="text-[10px] font-medium">{formatDate(m.created_at)}</span>
                            {out && (m.status === "failed" ? (
                              <button
                                type="button"
                                onClick={() => setMostrarSelectorAprobadas(true)}
                                title={(() => {
                                  const traducido = traducirErrorMeta(m.error_detalle);
                                  if (traducido) return `${traducido.titulo}: ${traducido.explicacion} Click para reintentar con plantilla.`;
                                  return m.error_detalle ? `Falló: ${m.error_detalle}. Click para reintentar con plantilla.` : "Falló el envío — probablemente ventana de 24hs vencida. Click para reintentar con plantilla.";
                                })()}
                                className="hover:opacity-70"
                              >
                                <X className="w-3.5 h-3.5 text-rose-500" />
                              </button>
                            ) : <CheckDeLeido um={m} />)}
                          </div>
                          {canal === "instagram" && m.reaccion && (
                            <span className={`absolute -bottom-2 ${out ? "left-1" : "right-1"} w-5 h-5 rounded-full bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 shadow flex items-center justify-center text-[11px]`}>
                              {m.reaccion}
                            </span>
                          )}
                        </div>
                        {mostrarVisto && (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 mr-1">Visto</span>
                        )}
                      </div>
                    </div>
                    </Fragment>
                  );
                })
              )}
              <div ref={mensajesEndRef} />
            </div>

            <div className={`p-3 relative ${noEsWhatsapp ? "bg-[#fafafa] dark:bg-[#0A0A0A]" : "bg-transparent"}`}>
              {mostrarPlantillas && (
                <div className="absolute bottom-full left-4 right-4 mb-2 bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl max-h-56 overflow-y-auto z-20">
                  {plantillas.length === 0 ? (
                    <p className="text-xs text-slate-400 p-3">Sin plantillas cargadas — se configuran en Configuración.</p>
                  ) : (
                    plantillas.map((p) => (
                      <button key={p.id} onClick={() => insertarPlantilla(p.texto)} className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/5 border-b border-slate-100 dark:border-white/10 last:border-0">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{p.nombre} <span className="text-[10px] font-normal text-slate-400">· {p.sector}</span></p>
                        <p className="text-[11px] text-slate-400 truncate">{p.texto}</p>
                      </button>
                    ))
                  )}
                </div>
              )}
              {aviso24h && (
                <div className={`mb-2 flex items-start gap-2.5 rounded-xl border px-3 py-2.5 ${aviso24h.tono === "rojo" ? "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-200" : "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-200"}`}>
                  <Clock className="w-4 h-4 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold leading-snug">{aviso24h.titulo}</p>
                    <p className="text-xs leading-snug mt-0.5 opacity-90">{aviso24h.detalle}</p>
                  </div>
                  {aviso24h.plantilla && (
                    <button type="button" onClick={() => setMostrarSelectorAprobadas(true)} className="shrink-0 self-center text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg px-3 py-1.5">Mandar plantilla</button>
                  )}
                </div>
              )}
              <form onSubmit={enviarMensaje} className="flex items-center gap-2 bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 rounded-xl px-2 py-1.5 shadow-sm">
                <button type="button" onClick={() => setMostrarPlantillas((v) => !v)} title="Plantillas" className="p-2 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-300 shrink-0">
                  <MessageSquareText className="w-4 h-4" />
                </button>
                {!noEsWhatsapp && (
                  <button type="button" onClick={() => setMostrarSelectorAprobadas(true)} title="Plantilla aprobada (ventana de 24hs vencida)" className="p-2 text-slate-400 hover:text-amber-600 dark:hover:text-amber-300 shrink-0">
                    <FileCheck2 className="w-4 h-4" />
                  </button>
                )}
                <input type="text" value={nuevoMensaje} onChange={(e) => setNuevoMensaje(e.target.value)} placeholder="Escribe un mensaje..." className="flex-1 bg-transparent px-1 py-2 text-[15px] text-slate-800 dark:text-white outline-none" autoComplete="off" />
                <button type="submit" disabled={!nuevoMensaje.trim()} className="bg-emerald-700 hover:bg-emerald-800 text-white p-2.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </>
        )}
      </div>

      {/* COLUMNA 3: DETALLES -- dock fijo en desktop (lg+), drawer superpuesto
          en mobile/tablet. Antes esta columna entera era "hidden lg:flex":
          en celular no había forma de cambiar vendedor, etapa, pausar la IA
          ni archivar. Mismo contenido, dos formas de mostrarlo. */}
      {seleccionada && (panelAbierto || mostrarDetallesMobile) && (
        <>
          {mostrarDetallesMobile && (
            <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMostrarDetallesMobile(false)} />
          )}
          <div className={`bg-white dark:bg-[#111] border-l border-slate-200 dark:border-white/10 flex-col shrink-0
            ${mostrarDetallesMobile ? "fixed inset-y-0 right-0 z-50 w-[88vw] max-w-[320px] flex shadow-2xl" : "hidden"}
            ${panelAbierto ? "lg:flex lg:static lg:z-auto lg:w-[300px] lg:max-w-none lg:shadow-none" : "lg:hidden"}`}>
            <div className="h-[52px] px-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between shrink-0">
              <h3 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Detalles</h3>
              <button onClick={() => { setPanelAbierto(false); setMostrarDetallesMobile(false); }} className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center gap-3">
                <div className="relative shrink-0">
                  <AvatarVendedor vendedorId={conversacionActiva?.vendedor_id} nombreRespaldo={conversacionActiva?.vendedor?.nombre} clase="w-11 h-11" />
                  {canal === "whatsapp" && <OrigenBadge canalOrigen={conversacionActiva?.canal_origen} />}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm truncate">{contactoActivo?.nombre_perfil || "Cliente"}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{contactoActivo?.telefono}</p>
                </div>
              </div>

              {/* Resumen: antes esto vivía repartido (chip de origen suelto
                  arriba, resumen de handoff solo si había handoff activo) --
                  ahora es una sola tarjeta con lo que importa para entender
                  la conversación de un vistazo: calificación, de dónde vino,
                  y el resumen de la IA si lo generó. */}
              <div className="p-4 border-b border-slate-200 dark:border-white/10 space-y-2.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {conversacionActiva?.calificacion && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${conversacionActiva.calificacion === "caliente" ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300" : conversacionActiva.calificacion === "tibio" ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" : "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400"}`}>
                      {conversacionActiva.calificacion === "caliente" ? "🔥 Caliente" : conversacionActiva.calificacion === "tibio" ? "Tibio" : "Frío"}
                    </span>
                  )}
                  {conversacionActiva?.origen_ads && (
                    <span title={conversacionActiva.origen_ads} className="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-sky-300 text-[10px] font-bold px-2 py-0.5 rounded-full max-w-full">
                      <Megaphone className="w-2.5 h-2.5 shrink-0" /> <span className="truncate">{conversacionActiva.origen_ads}</span>
                    </span>
                  )}
                  {conversacionActiva?.handoff_at && (
                    <span className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      <Info className="w-2.5 h-2.5 shrink-0" /> {conversacionActiva.handoff_reason === "cliente_pidio_humano" ? "Pidió hablar con alguien" : "IA en pausa"}
                    </span>
                  )}
                </div>
                {conversacionActiva?.handoff_resumen ? (
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{conversacionActiva.handoff_resumen}</p>
                ) : (
                  <p className="text-xs text-slate-400 italic">Sin resumen todavía — lo genera la IA al derivar a un vendedor.</p>
                )}
              </div>

              <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">IA en esta conversación</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{conversacionActiva?.ai_habilitada ? "Activada" : "Pausada"}</p>
                </div>
                <button type="button" onClick={toggleIA} className={`w-11 h-6 rounded-full flex items-center px-1 cursor-pointer transition-colors shrink-0 ${conversacionActiva?.ai_habilitada ? "bg-emerald-700 justify-end" : "bg-slate-300 dark:bg-white/10 justify-start"}`}>
                  <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
                </button>
              </div>

            <div className="p-4 border-b border-slate-200 dark:border-white/10">
              <div className="flex items-center justify-between mb-2.5">
                <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Etapa del Pipeline</h4>
                <span className="text-[10px] font-bold text-slate-400">{indexEtapaActual + 1}/{ETAPAS_PIPELINE.length}</span>
              </div>
              <div className="flex items-center gap-1 mb-2.5">
                {ETAPAS_PIPELINE.map((etapa, i) => (
                  <button
                    key={etapa.value}
                    type="button"
                    onClick={() => cambiarEtapa(etapa.value)}
                    title={etapa.label}
                    className={`flex-1 h-1.5 rounded-full transition-colors ${i <= indexEtapaActual ? "bg-emerald-600" : "bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20"}`}
                  />
                ))}
              </div>
              <select value={etapaActual} onChange={(e) => cambiarEtapa(e.target.value)} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-600 cursor-pointer">
                {ETAPAS_PIPELINE.map((etapa) => <option key={etapa.value} value={etapa.value}>{etapa.label}</option>)}
              </select>
            </div>

            <div className="p-4 border-b border-slate-200 dark:border-white/10">
              <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Vendedor asignado</h4>
              <select value={conversacionActiva?.vendedor_id || ""} onChange={(e) => reasignarVendedor(e.target.value)} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 dark:text-white outline-none focus:border-emerald-600 cursor-pointer">
                <option value="">Sin asignar</option>
                {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
              </select>
            </div>

            <div className="p-4 pb-0 space-y-2">
              <button onClick={() => setShowVincular(true)} className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-bold px-4 py-2 rounded-lg">
                {conversacionActiva?.cliente_id ? "Cliente vinculado ✓" : "Vincular a cliente"}
              </button>
              <button onClick={archivarConversacion} className="w-full flex items-center justify-center gap-1.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-bold px-4 py-2 rounded-lg">
                {conversacionActiva?.archivada ? <><ArchiveRestore className="w-3.5 h-3.5" /> Desarchivar</> : <><Archive className="w-3.5 h-3.5" /> Archivar conversación</>}
              </button>
            </div>

            {showVincular && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setShowVincular(false); setCreandoClienteManual(false); }}>
                <div className="bg-white dark:bg-[#111] rounded-xl p-5 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">{creandoClienteManual ? "Nuevo cliente" : "Vincular conversación"}</h3>
                    <button onClick={() => { setShowVincular(false); setCreandoClienteManual(false); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><X className="w-4 h-4" /></button>
                  </div>

                  {creandoClienteManual ? (
                    <div className="space-y-3">
                      <input className="w-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm placeholder:text-slate-400" placeholder="Nombre *" value={nuevoCliente.nombre} onChange={(e) => setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })} />
                      <input className="w-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm placeholder:text-slate-400" placeholder="Teléfono" value={nuevoCliente.telefono} onChange={(e) => setNuevoCliente({ ...nuevoCliente, telefono: e.target.value })} />
                      <input className="w-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm placeholder:text-slate-400" placeholder="Email" value={nuevoCliente.email} onChange={(e) => setNuevoCliente({ ...nuevoCliente, email: e.target.value })} />
                      <input className="w-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm placeholder:text-slate-400" placeholder="DNI/CUIT" value={nuevoCliente.dni_cuit} onChange={(e) => setNuevoCliente({ ...nuevoCliente, dni_cuit: e.target.value })} />
                      <div className="pt-1">
                        <button onClick={guardarClienteManual} disabled={guardandoCliente} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg text-[11px] uppercase tracking-widest disabled:opacity-50 transition-colors">
                          {guardandoCliente ? "Guardando..." : "Usar este cliente"}
                        </button>
                        <button onClick={() => setCreandoClienteManual(false)} className="w-full mt-2 text-[11px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 py-2">Volver a buscar</button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Cliente</label>
                        <input value={buscarCliente} onChange={(e) => buscarClientesFn(e.target.value)} placeholder="Buscar por nombre, teléfono o DNI..." className="w-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm mt-1" />
                        {clientesResult.map((c) => (
                          <button key={c.id} onClick={() => vincularCliente(c.id)} className="block w-full text-left text-sm text-slate-700 dark:text-slate-200 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-white/5 rounded mt-1">
                            {c.nombre} {c.telefono ? `— ${c.telefono}` : ""}
                          </button>
                        ))}
                        <button onClick={abrirFormularioCliente} className="text-xs text-emerald-700 dark:text-emerald-300 font-bold mt-3">+ Crear cliente nuevo con estos datos</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="p-6">
              <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Notas</h4>
              <textarea value={notasLocales} onChange={(e) => setNotasLocales(e.target.value)} placeholder="Notas internas sobre este contacto..." className="w-full h-32 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-[13px] text-slate-700 dark:text-slate-200 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all resize-none custom-scrollbar" />
              <button onClick={guardarNotas} disabled={guardandoNotas} className="mt-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-bold px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 w-max">
                {guardandoNotas && <Loader2 className="w-3 h-3 animate-spin" />} {guardandoNotas ? "Guardando..." : "Guardar notas"}
              </button>
            </div>
          </div>
          </div>
        </>
      )}

      {mostrarSelectorAprobadas && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setMostrarSelectorAprobadas(false)}>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-5 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-slate-900 dark:text-white">Enviar plantilla aprobada</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Se usa cuando pasaron 24hs desde el último mensaje del cliente — Meta rechaza texto libre fuera de esa ventana.</p>
            {plantillasAprobadas.length === 0 ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">Sin plantillas aprobadas todavía. Configuración → WhatsApp → Plantillas.</p>
            ) : (
              <>
                <select value={templateElegido} onChange={(e) => { setTemplateElegido(e.target.value); setDatosPlantilla([(contactoActivo?.nombre_perfil || "").split(" ")[0] || ""]); }} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none">
                  <option value="">Elegí una plantilla...</option>
                  {plantillasAprobadas.map((t) => (
                    <option key={t.id} value={t.id}>{sugeridaPorNombre(t.nombre)?.titulo ?? t.nombre}</option>
                  ))}
                </select>
                {templateElegido && (
                  <>
                    {(() => {
                      const t = plantillasAprobadas.find((x) => x.id === templateElegido);
                      const cantidad = countVariables(t?.cuerpo || "");
                      const sugerida = t ? sugeridaPorNombre(t.nombre) : undefined;
                      return (
                        <>
                          {Array.from({ length: cantidad }, (_, i) => (
                            <div key={i}>
                              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">{sugerida?.datos[i] ?? `Dato {{${i + 1}}}`}</label>
                              <input value={datosPlantilla[i] ?? ""} onChange={(e) => setDatosPlantilla((d) => { const n = [...d]; n[i] = e.target.value; return n; })} placeholder={sugerida?.ejemplos[i] ? `Ej: ${sugerida.ejemplos[i]}` : ""} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none" />
                            </div>
                          ))}
                          <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-white/5 rounded-xl px-3 py-2.5 leading-relaxed">{renderBody(t?.cuerpo || "", datosPlantilla.map((d, i) => d || `{{${i + 1}}}`).concat(Array.from({ length: Math.max(0, cantidad - datosPlantilla.length) }, (_, k) => `{{${datosPlantilla.length + k + 1}}}`)))}</p>
                        </>
                      );
                    })()}
                  </>
                )}
              </>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setMostrarSelectorAprobadas(false)} className="px-3 py-2 rounded-xl text-xs font-bold text-slate-500">Cancelar</button>
              <button onClick={enviarConPlantilla} disabled={!templateElegido || enviandoPlantilla} className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1.5">
                {enviandoPlantilla && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Enviar
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        abierto={!!confirmDialog}
        mensaje={confirmDialog?.mensaje || ""}
        onConfirmar={() => { confirmDialog?.accion(); setConfirmDialog(null); }}
        onCancelar={() => setConfirmDialog(null)}
      />
      {fotoAbierta !== null && fotoAbierta >= 0 && (
        <VisorFotosModal imagenes={fotosDelChat} inicio={fotoAbierta} altText="Foto del chat" onClose={() => setFotoAbierta(null)} />
      )}
      {videoAbierto && <VisorVideoModal src={videoAbierto} onClose={() => setVideoAbierto(null)} />}
    </div>
  );
}
