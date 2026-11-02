"use client";

import AvatarVendedor from "@/components/panel/conversaciones/AvatarVendedor";
import { Fragment, useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { CLASE_ABRIR_EN_LEADS } from "@/lib/panel/botonesCanal";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase2 } from "@/lib/supabase/client";
import { Search, Send, Bot, Check, Info, ChevronRight, PanelRight, Megaphone, Maximize2 } from "lucide-react";
import LeadDetailModal from "@/components/panel/conversaciones/LeadDetailModal";
import SeparadorDia from "@/components/panel/conversaciones/SeparadorDia";
import { claveDia } from "@/lib/panel/ventana24h";
import { ordenarPorLlegada } from "@/lib/panel/ordenBandeja";
import { marcarChatVisto } from "@/lib/panel/chatsVistos";
import SelectorWeb from "@/components/ui/SelectorWeb";

interface Perfil { id: string; nombre: string; roles: string[] }

export default function RodiBandeja({ conversacionesIniciales, vendedores, miId }: { conversacionesIniciales: any[]; vendedores: Perfil[]; miId: string }) {
  const [conversaciones, setConversaciones] = useState(conversacionesIniciales);
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<any[]>([]);
  const [nuevoMensaje, setNuevoMensaje] = useState("");
  const [filtro, setFiltro] = useState<"todas" | "no-leidas">("todas");
  // Admin y encargados arrancan en "Míos" y con "Todos" ven el resto (Walter, 21/10/2026, igual que Leads).
  const veTodos = ((vendedores.find((v) => v.id === miId) as { roles?: string[] | null } | undefined)?.roles || []).some((r) => r === "admin" || r === "director" || r === "encargado");
  const [soloMias, setSoloMias] = useState(veTodos);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(false);
  const [panelAbierto, setPanelAbierto] = useState(true);
  const [notasLocales, setNotasLocales] = useState("");
  const [guardandoNotas, setGuardandoNotas] = useState(false);
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const mensajesEndRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const id = searchParams.get("conversacion");
    if (id) setSeleccionada(id);
  }, [searchParams]);

  useEffect(() => { setConversaciones(conversacionesIniciales); }, [conversacionesIniciales]);

  // Antes esta bandeja no tenía ningún realtime propio -- solo escuchaba
  // mensajes de la charla ya abierta (más abajo). Una conversación nueva de
  // Rodi (o un last_message_at/unread_count actualizado en otra charla) no
  // aparecía hasta recargar la página a mano, aunque la campana de alertas
  // (canal aparte, en PanelLayoutClient.tsx) sí avisara al toque -- mismo
  // patrón ya usado en ChatClient.tsx (whatsapp/instagram/messenger) y
  // LeadsUnificadosClient.tsx: debounce corto + router.refresh() para traer
  // la lista de vuelta del server component con los joins ya resueltos.
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const refrescarConDebounce = () => { clearTimeout(timeoutId); timeoutId = setTimeout(() => router.refresh(), 400); };
    const canalBandeja = supabase2
      .channel(`rodi-bandeja-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rodi_conversaciones" }, refrescarConDebounce)
      .subscribe();
    return () => { clearTimeout(timeoutId); supabase2.removeChannel(canalBandeja); };
  }, [router]);

  useEffect(() => { mensajesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensajes]);

  useEffect(() => {
    if (!seleccionada) return;
    setLoading(true);
    supabase2.from("rodi_mensajes").select("*").eq("conversacion_id", seleccionada).order("created_at", { ascending: true }).then(({ data }) => {
      setMensajes(data || []);
      setLoading(false);
    });
    supabase2.from("rodi_conversaciones").select("notas, unread_count").eq("id", seleccionada).single().then(({ data }) => {
      if (data) { setNotasLocales(data.notas || ""); }
      if (data?.unread_count > 0) {
        supabase2.from("rodi_conversaciones").update({ unread_count: 0 }).eq("id", seleccionada).then(() => {
          setConversaciones((prev) => prev.map((c) => (c.id === seleccionada ? { ...c, unread_count: 0 } : c)));
        });
      }
    });

    const canal = supabase2
      .channel(`rodi_mensajes:${seleccionada}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "rodi_mensajes", filter: `conversacion_id=eq.${seleccionada}` }, (payload) => {
        setMensajes((prev) => (prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]));
      })
      .subscribe();
    return () => { supabase2.removeChannel(canal); };
  }, [seleccionada]);

  // Abrir el chat frena la repetición del aviso de "cliente sin contestar" en el celular (lib/panel/clienteSinContestar.ts).
  useEffect(() => {
    if (seleccionada) marcarChatVisto("rodi", seleccionada, miId);
  }, [seleccionada, miId]);

  const conversacionActiva = conversaciones.find((c) => c.id === seleccionada);

  const enviarMensajeManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoMensaje.trim() || !seleccionada) return;
    const texto = nuevoMensaje.trim();
    setNuevoMensaje("");
    const optimista = { id: crypto.randomUUID(), conversacion_id: seleccionada, direccion: "out", texto, ai_generado: false, created_at: new Date().toISOString() };
    setMensajes((prev) => [...prev, optimista]);
    await supabase2.from("rodi_mensajes").insert({ conversacion_id: seleccionada, direccion: "out", texto, ai_generado: false });
    await supabase2.from("rodi_conversaciones").update({ ai_habilitada: false, ai_pausada_en: new Date().toISOString(), last_message_at: new Date().toISOString() }).eq("id", seleccionada);
    setConversaciones((prev) => prev.map((c) => (c.id === seleccionada ? { ...c, ai_habilitada: false } : c)));
  };

  const toggleIA = async () => {
    if (!conversacionActiva) return;
    const nuevoValor = !conversacionActiva.ai_habilitada;
    setConversaciones((prev) => prev.map((c) => (c.id === conversacionActiva.id ? { ...c, ai_habilitada: nuevoValor } : c)));
    // Al pausar guarda cuándo, para el auto-reinicio a las 6hs; al reactivar
    // a mano se limpia -- ya no hace falta que el reinicio automático corra.
    await supabase2.from("rodi_conversaciones").update({ ai_habilitada: nuevoValor, ai_pausada_en: nuevoValor ? null : new Date().toISOString() }).eq("id", conversacionActiva.id);
  };

  const guardarNotas = async () => {
    if (!seleccionada) return;
    setGuardandoNotas(true);
    try { await supabase2.from("rodi_conversaciones").update({ notas: notasLocales }).eq("id", seleccionada); } finally { setGuardandoNotas(false); }
  };

  const reasignarVendedor = async (vendedorId: string) => {
    if (!seleccionada) return;
    const nuevoId = vendedorId || null;
    await supabase2.from("rodi_conversaciones").update({ vendedor_id: nuevoId }).eq("id", seleccionada);
    const vendedor = vendedores.find((v) => v.id === nuevoId) || null;
    setConversaciones((prev) => prev.map((c) => (c.id === seleccionada ? { ...c, vendedor_id: nuevoId, vendedor } : c)));
  };

  const formatDate = (d: string) => new Date(d).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  const formatDay = (d: string) => {
    const dif = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
    if (dif === 0) return "Hoy";
    if (dif === 1) return "Ayer";
    return `${dif} días`;
  };

  const filtradas = conversaciones.filter((c) => {
    if (filtro === "no-leidas" && !(c.unread_count > 0)) return false;
    if (veTodos && soloMias && c.vendedor_id !== miId) return false;
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      if (!([c.nombre_contacto, c.telefono_contacto, c.email_contacto].filter(Boolean).join(" ").toLowerCase().includes(q))) return false;
    }
    return true;
  });
  const noLeidasTotal = conversaciones.filter((c) => c.unread_count > 0).length;
  const colorCalificacion = (c: string | null) => (c === "caliente" ? "bg-rose-500" : c === "tibio" ? "bg-amber-500" : "bg-slate-300");

  return (
    <div className="flex w-full h-full text-slate-800 dark:text-slate-200">
      {/* Misma cabecera que la bandeja de WhatsApp, Instagram y Messenger (ChatClient.tsx; Walter, 27/10/2026). */}
      <div className={`w-full md:w-[280px] flex-col bg-white dark:bg-[#111] border-r border-slate-200 dark:border-white/10 shrink-0 ${seleccionada ? "hidden md:flex" : "flex"}`}>
        <div className="p-2.5 border-b border-slate-100 dark:border-white/10 shrink-0 space-y-2">
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
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar..." className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg py-1.5 pl-8 pr-3 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500" />
            </div>
            <button onClick={() => setFiltro(filtro === "todas" ? "no-leidas" : "todas")} title="No leídas" className={`shrink-0 px-2 py-1.5 text-[11px] font-semibold rounded-lg transition-colors flex items-center gap-1 ${filtro === "no-leidas" ? "bg-slate-800 dark:bg-white/10 text-white" : "bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400"}`}>
              {noLeidasTotal > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />} {noLeidasTotal}
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filtradas.length === 0 && <p className="text-center text-xs text-slate-400 py-8">Sin conversaciones.</p>}
          {ordenarPorLlegada(filtradas).map((c) => {
            const isActive = seleccionada === c.id;
            return (
              <button key={c.id} onClick={() => setSeleccionada(c.id)} className={`w-full text-left p-3.5 border-b border-slate-100 dark:border-white/5 flex gap-3 ${isActive ? "bg-emerald-50 dark:bg-emerald-500/10 border-l-2 border-l-emerald-700" : "hover:bg-slate-50 dark:hover:bg-white/5 border-l-2 border-l-transparent"}`}>
                <div className="relative shrink-0 self-start">
                  <AvatarVendedor vendedorId={c.vendedor_id} nombreRespaldo={c.vendedor?.nombre} clase="w-10 h-10" />
                  <span className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-[#111] ${colorCalificacion(c.calificacion)}`} />
                  {/* eslint-disable-next-line @next/next/no-img-element -- ícono de 16 px, igual que el logo de canal de las otras bandejas */}
                  <img src="/icons/panel/rodi.png" alt="" title="Chat de la web" className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white dark:border-[#111] object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-0.5">
                    <span className="font-bold text-sm truncate">{c.nombre_contacto || "Visitante anónimo"}</span>
                    <span className="text-[11px] text-slate-400 whitespace-nowrap">{c.last_message_at ? formatDay(c.last_message_at) : ""}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] text-slate-500 dark:text-slate-400 truncate">{c.vendedor?.nombre ? `Asignado a ${c.vendedor.nombre}` : "Sin asignar"}</p>
                    {c.unread_count > 0 && <span className="text-[10px] font-bold bg-emerald-600 text-white px-1.5 py-0.5 rounded-full shrink-0">{c.unread_count}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className={`flex-1 flex flex-col bg-[#F0F2F5] dark:bg-[#0A0A0A] relative ${!seleccionada ? "hidden md:flex" : "flex"}`}>
        {!seleccionada ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400"><p className="text-sm font-medium">Elige una conversación para ver el hilo</p></div>
        ) : (
          <>
            <div className="h-[60px] bg-white dark:bg-[#111] border-b border-slate-200 dark:border-white/10 flex justify-between items-center px-6 shrink-0 shadow-sm z-10">
              <div className="flex items-center gap-3">
                <AvatarVendedor vendedorId={conversacionActiva?.vendedor_id} nombreRespaldo={conversacionActiva?.vendedor?.nombre} clase="w-9 h-9" claseTexto="text-xs" />
                <div>
                  <h3 className="font-bold text-[15px] leading-tight">{conversacionActiva?.nombre_contacto || "Visitante anónimo"}</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{[conversacionActiva?.telefono_contacto, conversacionActiva?.email_contacto].filter(Boolean).join(" · ") || conversacionActiva?.origen_pagina}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Abre este lead en Leads (Walter, 27/10/2026), igual que en los chats de WhatsApp, Instagram y Messenger. */}
                <Link href={`/panel/leads?lead=${seleccionada}&origen=rodi`} title="Abrir en Leads" className={CLASE_ABRIR_EN_LEADS}>
                  <Image src="/icons/panel/leads.png" alt="" width={16} height={16} className="w-4 h-4 object-contain" /> <span className="hidden sm:inline">Abrir en Leads</span>
                </Link>
                <button className="md:hidden text-emerald-700 text-sm font-bold" onClick={() => setSeleccionada(null)}>Atrás</button>
                {!panelAbierto && <button onClick={() => setPanelAbierto(true)} className="hidden lg:flex p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-md"><PanelRight className="w-5 h-5" /></button>}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-3 custom-scrollbar">
              {loading ? <div className="flex justify-center py-4"><span className="text-xs text-slate-400">Cargando...</span></div> : mensajes.map((m, idx) => {
                const out = m.direccion === "out";
                const diaNuevo = idx === 0 || claveDia(mensajes[idx - 1].created_at) !== claveDia(m.created_at);
                return (
                  <Fragment key={m.id}>
                  {diaNuevo && <SeparadorDia fecha={m.created_at} ahora={new Date()} estilo="whatsapp" />}
                  <div className={`flex ${out ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] lg:max-w-[60%] flex flex-col ${out ? "items-end" : "items-start"}`}>
                      <div className={`rounded-[10px] px-3.5 py-2 text-[14px] shadow-sm border bg-white dark:bg-[#111] border-slate-200 dark:border-white/10 ${out ? "rounded-tr-none" : "rounded-tl-none"}`}>
                        <p className="leading-relaxed whitespace-pre-wrap">{m.texto}</p>
                        <div className="flex items-center justify-end gap-1 mt-1 opacity-70">
                          {out && m.ai_generado && <Bot className="w-3 h-3 text-slate-400" />}
                          <span className="text-[10px] text-slate-400 font-medium">{formatDate(m.created_at)}</span>
                          {out && <Check className="w-3.5 h-3.5 text-blue-500" />}
                        </div>
                      </div>
                    </div>
                  </div>
                  </Fragment>
                );
              })}
              <div ref={mensajesEndRef} />
            </div>

            <div className="p-4 bg-[#F0F2F5] dark:bg-[#0A0A0A]">
              <p className="max-w-4xl mx-auto text-[10px] text-slate-400 mb-1.5 px-1">Este mensaje queda guardado para cuando el visitante vuelva a escribir — no se le manda en vivo (no hay push a un navegador desconectado).</p>
              <form onSubmit={enviarMensajeManual} className="flex items-center gap-3 max-w-4xl mx-auto bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 rounded-xl px-2 py-1.5 shadow-sm">
                <input type="text" value={nuevoMensaje} onChange={(e) => setNuevoMensaje(e.target.value)} placeholder="Escribí una respuesta manual..." className="flex-1 bg-transparent px-3 py-2 text-[15px] outline-none" autoComplete="off" />
                <button type="submit" disabled={!nuevoMensaje.trim()} className="bg-emerald-700 hover:bg-emerald-800 text-white p-2.5 rounded-lg disabled:opacity-40 shrink-0"><Send className="w-4 h-4" /></button>
              </form>
            </div>
          </>
        )}
      </div>

      {seleccionada && panelAbierto && (
        <div className="w-[300px] bg-white dark:bg-[#111] border-l border-slate-200 dark:border-white/10 flex-col hidden lg:flex shrink-0">
          <div className="h-[60px] p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between shrink-0">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Detalles</h3>
            <div className="flex items-center gap-1">
              <button onClick={() => setDetalleAbierto(true)} title="Ver ficha completa (tareas, test drives, historial)" className="text-slate-400 hover:text-[#0145F2] p-1 rounded-md hover:bg-slate-100 dark:hover:bg-white/5"><Maximize2 className="w-4 h-4" /></button>
              <button onClick={() => setPanelAbierto(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-white/5"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="p-6 border-b border-slate-200 dark:border-white/10 flex flex-col items-center text-center">
              <div className="mb-3"><AvatarVendedor vendedorId={conversacionActiva?.vendedor_id} nombreRespaldo={conversacionActiva?.vendedor?.nombre} clase="w-16 h-16" claseTexto="text-xl" /></div>
              <h3 className="font-bold text-lg">{conversacionActiva?.nombre_contacto || "Visitante anónimo"}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{[conversacionActiva?.telefono_contacto, conversacionActiva?.email_contacto].filter(Boolean).join(" · ") || "Sin datos"}</p>
              {conversacionActiva?.origen_pagina && (
                <div
                  title={`Página donde inició el chat — puede no ser el auto del que se terminó hablando: ${conversacionActiva.origen_pagina}`}
                  className="mt-3 flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-sky-300 text-[11px] font-bold px-2.5 py-1 rounded-full max-w-full"
                >
                  <Megaphone className="w-3 h-3 shrink-0" />
                  <span className="truncate">Inició en: {conversacionActiva.origen_pagina}</span>
                </div>
              )}
            </div>

            <div className="p-6 border-b border-slate-200 dark:border-white/10">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-sm font-bold">IA en esta conversación</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{conversacionActiva?.ai_habilitada ? "Activada" : "Pausada"}</p>
                </div>
                <button type="button" onClick={toggleIA} className={`w-11 h-6 rounded-full flex items-center px-1 transition-colors ${conversacionActiva?.ai_habilitada ? "bg-emerald-700 justify-end" : "bg-slate-300 dark:bg-white/10 justify-start"}`}>
                  <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
                </button>
              </div>
              {conversacionActiva?.handoff_at && (
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-3 rounded-lg flex gap-2">
                  <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                    <p>El visitante pidió hablar con una persona.</p>
                    {conversacionActiva.handoff_resumen && <p className="mt-1 font-semibold">{conversacionActiva.handoff_resumen}</p>}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-b border-slate-200 dark:border-white/10">
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Vendedor asignado</h4>
              <div className="w-full"><SelectorWeb valor={conversacionActiva?.vendedor_id || ""} etiquetaActual={conversacionActiva?.vendedor?.nombre} onCambio={reasignarVendedor} claseBoton="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm font-medium outline-none" opciones={[{ valor: "", etiqueta: "Sin asignar" }, ...vendedores.map((v) => ({ valor: v.id, etiqueta: v.nombre }))]} /></div>
            </div>

            <div className="p-6">
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Notas</h4>
              <textarea value={notasLocales} onChange={(e) => setNotasLocales(e.target.value)} placeholder="Notas internas sobre este contacto..." className="w-full h-32 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-[13px] outline-none resize-none custom-scrollbar" />
              <button onClick={guardarNotas} disabled={guardandoNotas} className="mt-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 text-xs font-bold px-4 py-2 rounded-lg">
                {guardandoNotas ? "Guardando..." : "Guardar notas"}
              </button>
            </div>
          </div>
        </div>
      )}

      {detalleAbierto && seleccionada && (
        <LeadDetailModal
          key={seleccionada}
          leadId={seleccionada}
          origen="rodi"
          miId={miId}
          vendedores={vendedores}
          onClose={() => setDetalleAbierto(false)}
          onActualizado={(id, patch) => setConversaciones((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))}
        />
      )}
    </div>
  );
}
