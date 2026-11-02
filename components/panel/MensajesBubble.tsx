"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase2 } from "@/lib/supabase/client";
import { MessageCircle, X, Globe, Users, Plus, Inbox } from "lucide-react";
import FloatingChatWindow from "./FloatingChatWindow";
import { avisar } from "@/components/panel/Dialogos";

interface Perfil { id: string; nombre: string; roles?: string[] }
interface Canal { id: string; tipo: "general" | "directo" | "grupo"; nombre: string | null; par_clave: string | null; created_at: string; otroMiembro?: Perfil }

function nombreCanal(c: Canal) {
  if (c.tipo === "general") return "General";
  if (c.tipo === "grupo") return c.nombre || "Grupo";
  return c.otroMiembro?.nombre || "Usuario";
}

const previewAdjunto = (a: { url: string; nombre: string }[] | null) => (a && a.length > 0 ? `📎 ${a[0].nombre}` : "");

export default function MensajesBubble() {
  const router = useRouter();
  const pathname = usePathname();
  const [miId, setMiId] = useState("");
  const [canales, setCanales] = useState<Canal[]>([]);
  const [ultimoPorCanal, setUltimoPorCanal] = useState<Record<string, { texto: string | null; adjuntos: any[] | null; autor_id: string }>>({});
  const [noLeidosPorCanal, setNoLeidosPorCanal] = useState<Record<string, number>>({});
  const [popupAbierto, setPopupAbierto] = useState(false);
  const [ventanas, setVentanas] = useState<Canal[]>([]);
  const [staff, setStaff] = useState<Perfil[]>([]);
  const [showNuevoGrupo, setShowNuevoGrupo] = useState(false);
  const [nombreGrupo, setNombreGrupo] = useState("");
  const [miembrosGrupo, setMiembrosGrupo] = useState<string[]>([]);
  const [creandoGrupo, setCreandoGrupo] = useState(false);
  const [quickActionsAbierto, setQuickActionsAbierto] = useState(false);

  // Botón arrastrable a cualquier lado de la pantalla -- posición en px
  // (fixed left/top), persistida por navegador (localStorage) para que se
  // quede donde cada uno lo dejó. null = todavía en la posición default
  // (fixed bottom-24 right-6 vía clases, sin drag todavía).
  const BUBBLE_POS_KEY = "panel:mensajes-bubble-pos";
  const [dragPos, setDragPos] = useState<{ left: number; top: number } | null>(null);
  const arrastrandoRef = useRef(false);
  const justDraggedRef = useRef(false);

  useEffect(() => {
    try {
      const guardada = localStorage.getItem(BUBBLE_POS_KEY);
      if (guardada) {
        const p = JSON.parse(guardada);
        setDragPos({
          left: Math.min(Math.max(p.left, 8), window.innerWidth - 56),
          top: Math.min(Math.max(p.top, 8), window.innerHeight - 56),
        });
      }
    } catch { /* localStorage puede fallar en privado/bloqueado -- se queda en la posición default */ }
  }, []);

  const iniciarArrastre = (e: React.PointerEvent<HTMLButtonElement>) => {
    const boton = e.currentTarget;
    const rectInicial = boton.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    arrastrandoRef.current = false;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!arrastrandoRef.current && Math.abs(dx) + Math.abs(dy) > 4) arrastrandoRef.current = true;
      if (!arrastrandoRef.current) return;
      const left = Math.min(Math.max(rectInicial.left + dx, 8), window.innerWidth - rectInicial.width - 8);
      const top = Math.min(Math.max(rectInicial.top + dy, 8), window.innerHeight - rectInicial.height - 8);
      setDragPos({ left, top });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (arrastrandoRef.current) {
        justDraggedRef.current = true;
        setDragPos((actual) => {
          if (actual) { try { localStorage.setItem(BUBBLE_POS_KEY, JSON.stringify(actual)); } catch { /* ignorar */ } }
          return actual;
        });
        setTimeout(() => { justDraggedRef.current = false; }, 50);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  useEffect(() => {
    supabase2.auth.getUser().then(({ data }) => setMiId(data.user?.id || ""));
  }, []);

  useEffect(() => {
    const onToggle = (e: Event) => setQuickActionsAbierto((e as CustomEvent<{ open: boolean }>).detail.open);
    window.addEventListener("qa:toggle", onToggle);
    return () => window.removeEventListener("qa:toggle", onToggle);
  }, []);

  useEffect(() => {
    if (!miId) return;
    supabase2.from("perfiles").select("id, nombre, roles").eq("activo", true).order("nombre").then(({ data }) => {
      setStaff((data || []).filter((p) => p.id !== miId));
    });
  }, [miId]);

  const crearGrupo = async () => {
    if (!nombreGrupo.trim() || miembrosGrupo.length === 0) return;
    setCreandoGrupo(true);
    try {
      const { data: nuevo, error } = await supabase2.from("mensajes_canales").insert({ tipo: "grupo", nombre: nombreGrupo.trim(), created_by: miId }).select("id").single();
      if (error) throw error;
      const filas = [miId, ...miembrosGrupo].map((perfil_id) => ({ canal_id: nuevo.id, perfil_id }));
      await supabase2.from("mensajes_canal_miembros").insert(filas);
      setShowNuevoGrupo(false);
      setNombreGrupo("");
      setMiembrosGrupo([]);
      await cargar();
      abrirVentana({ id: nuevo.id, tipo: "grupo", nombre: nombreGrupo.trim(), par_clave: null, created_at: new Date().toISOString() });
    } catch (err) {
      console.error("crearGrupo", err);
      avisar("No se pudo crear el grupo.");
    } finally {
      setCreandoGrupo(false);
    }
  };

  const cargar = useCallback(async () => {
    if (!miId) return;
    const { data: misMembresias } = await supabase2.from("mensajes_canal_miembros").select("canal_id").eq("perfil_id", miId);
    const idsPropios = (misMembresias || []).map((m) => m.canal_id);
    const { data: canalesRaw } = await supabase2.from("mensajes_canales").select("*").or(`tipo.eq.general,id.in.(${idsPropios.length ? idsPropios.join(",") : "00000000-0000-0000-0000-000000000000"})`);
    const lista = canalesRaw || [];

    const directoIds = lista.filter((c) => c.tipo === "directo").map((c) => c.id);
    let otrosMap: Record<string, Perfil> = {};
    if (directoIds.length) {
      const { data: miembrosDirectos } = await supabase2.from("mensajes_canal_miembros").select("canal_id, perfil:perfiles(id, nombre)").in("canal_id", directoIds).neq("perfil_id", miId);
      (miembrosDirectos || []).forEach((m: any) => { otrosMap[m.canal_id] = m.perfil; });
    }
    const conOtro: Canal[] = lista.map((c) => ({ ...c, otroMiembro: otrosMap[c.id] }));
    conOtro.sort((a, b) => (a.tipo === "general" ? -1 : b.tipo === "general" ? 1 : 0));
    setCanales(conOtro);

    const idsTodos = conOtro.map((c) => c.id);
    if (idsTodos.length === 0) { setNoLeidosPorCanal({}); return; }

    const [{ data: recientes }, { data: lecturasRaw }] = await Promise.all([
      supabase2.from("mensajes").select("id, canal_id, autor_id, texto, adjuntos, created_at").in("canal_id", idsTodos).order("created_at", { ascending: false }).limit(300),
      supabase2.from("mensajes_lecturas").select("canal_id, last_read_at").eq("perfil_id", miId),
    ]);
    const lecturaMap: Record<string, number> = {};
    (lecturasRaw || []).forEach((l) => { lecturaMap[l.canal_id] = new Date(l.last_read_at).getTime(); });

    const ultimos: Record<string, { texto: string | null; adjuntos: any[] | null; autor_id: string }> = {};
    const noLeidos: Record<string, number> = {};
    (recientes || []).forEach((m) => {
      if (!ultimos[m.canal_id]) ultimos[m.canal_id] = { texto: m.texto, adjuntos: m.adjuntos, autor_id: m.autor_id };
      if (m.autor_id !== miId && new Date(m.created_at).getTime() > (lecturaMap[m.canal_id] || 0)) {
        noLeidos[m.canal_id] = (noLeidos[m.canal_id] || 0) + 1;
      }
    });
    setUltimoPorCanal(ultimos);
    setNoLeidosPorCanal(noLeidos);
  }, [miId]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    if (!miId) return;
    const canal = supabase2.channel(`mensajes-bubble-realtime-${miId}-${Math.random().toString(36).slice(2)}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "mensajes" }, cargar).subscribe();
    return () => { supabase2.removeChannel(canal); };
  }, [miId, cargar]);

  const totalNoLeidos = Object.values(noLeidosPorCanal).reduce((a, b) => a + b, 0);

  if (pathname === "/panel/mensajes") return null;

  const abrirVentana = (c: Canal) => {
    setPopupAbierto(false);
    setVentanas((prev) => (prev.some((v) => v.id === c.id) ? prev : [...prev, c]));
  };
  const cerrarVentana = (id: string) => setVentanas((prev) => prev.filter((v) => v.id !== id));

  return (
    <>
      {ventanas.map((c, i) => (
        <FloatingChatWindow key={c.id} canal={c} miId={miId} offset={24 + i * 316} onClose={() => cerrarVentana(c.id)} />
      ))}

      {/* Arrastrable a cualquier lado de la pantalla (pointer events propios,
          posición persistida en localStorage) -- mientras no se arrastró
          todavía, sigue apilado arriba del botón "+" (QuickActionsButton,
          fixed bottom-6 right-6) con las clases default. Mientras el "+"
          está abierto y despliega sus pills hacia arriba, este ícono se
          esconde (ver evento "qa:toggle" que emite QuickActionsButton) para
          no quedar tapado ni interceptar los clicks de esas pills -- eso
          solo aplica en la posición default, apilada justo arriba del "+". */}
      <div
        className={`print:hidden hidden md:block fixed z-30 transition-opacity ${!dragPos && quickActionsAbierto ? "opacity-0 pointer-events-none" : "opacity-100"} ${dragPos ? "" : "bottom-24 right-6"}`}
        style={dragPos ? { left: dragPos.left, top: dragPos.top } : undefined}
      >
        {popupAbierto && (
          <div
            className={`absolute w-80 bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden ${
              dragPos && dragPos.top < window.innerHeight / 2 ? "top-14" : "bottom-14"
            } ${dragPos && dragPos.left < window.innerWidth / 2 - 160 ? "left-0" : "right-0"}`}
          >
            <div className="flex items-start justify-between px-4 py-3 border-b border-slate-100 dark:border-white/10">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Mensajes</h3>
                <p className="text-[11px] text-slate-400">Tocá un chat para abrirlo en una ventana flotante</p>
              </div>
              <button onClick={() => setPopupAbierto(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><X className="w-4 h-4" /></button>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {canales.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-6">Sin conversaciones todavía.</p>
              ) : canales.map((c) => {
                const ultimo = ultimoPorCanal[c.id];
                const n = noLeidosPorCanal[c.id] || 0;
                const preview = ultimo ? (ultimo.texto || previewAdjunto(ultimo.adjuntos) || "Mensaje nuevo") : "Tocá para chatear";
                return (
                  <button key={c.id} onClick={() => abrirVentana(c)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left border-b border-slate-50 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 bg-indigo-500 text-white">
                      {c.tipo === "general" ? <Globe className="w-4 h-4" /> : c.tipo === "grupo" ? <Users className="w-4 h-4" /> : nombreCanal(c).slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{nombreCanal(c)}</p>
                      <p className="text-[11px] text-slate-400 truncate">{preview}</p>
                    </div>
                    {n > 0 && <span className="text-[10px] font-bold bg-[#0145F2] text-white rounded-full px-1.5 py-0.5 shrink-0">{n}</span>}
                  </button>
                );
              })}
            </div>
            <div className="border-t border-slate-100 dark:border-white/10 p-2 space-y-0.5">
              <button onClick={() => { setPopupAbierto(false); router.push("/panel/mensajes"); }} className="w-full flex items-center gap-2 px-2 py-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg">
                <Plus className="w-4 h-4" /> Mensaje nuevo
              </button>
              <button onClick={() => { setPopupAbierto(false); setShowNuevoGrupo(true); }} className="w-full flex items-center gap-2 px-2 py-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg">
                <Users className="w-4 h-4" /> Crear grupo
              </button>
              <button onClick={() => { setPopupAbierto(false); router.push("/panel/mensajes"); }} className="w-full flex items-center gap-2 px-2 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg">
                <Inbox className="w-4 h-4" /> Ver Mensajes completo
              </button>
            </div>
          </div>
        )}

        <button
          onPointerDown={iniciarArrastre}
          onClick={() => { if (justDraggedRef.current) return; setPopupAbierto((v) => !v); }}
          className="flex w-12 h-12 rounded-full bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 shadow-lg items-center justify-center hover:scale-105 transition-transform relative touch-none cursor-grab active:cursor-grabbing"
          title="Mensajes — mantené presionado y arrastrá para moverlo"
        >
          <MessageCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          {totalNoLeidos > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#0145F2] text-white text-[10px] font-bold flex items-center justify-center">
              {totalNoLeidos > 99 ? "99+" : totalNoLeidos}
            </span>
          )}
        </button>
      </div>

      {showNuevoGrupo && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !creandoGrupo && setShowNuevoGrupo(false)} />
          <div className="relative bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/10 w-full max-w-sm rounded-2xl shadow-2xl p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4"><h3 className="text-base font-bold">Crear grupo</h3><button onClick={() => setShowNuevoGrupo(false)}><X className="w-4 h-4 text-slate-400" /></button></div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Nombre del grupo</label>
            <input value={nombreGrupo} onChange={(e) => setNombreGrupo(e.target.value)} placeholder="Ej: Equipo Ventas, Gestión Marzo..." className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm outline-none mb-4" />
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Agregar miembros ({miembrosGrupo.length} seleccionados)</p>
            <div className="space-y-1 mb-4">
              {staff.map((p) => (
                <label key={p.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer">
                  <input type="checkbox" checked={miembrosGrupo.includes(p.id)} onChange={(e) => setMiembrosGrupo((prev) => e.target.checked ? [...prev, p.id] : prev.filter((x) => x !== p.id))} className="w-4 h-4 accent-[#0145F2]" />
                  <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-xs shrink-0">{p.nombre.slice(0, 1).toUpperCase()}</div>
                  <div><p className="text-sm font-semibold">{p.nombre}</p><p className="text-[10px] text-slate-400">{p.roles?.[0] || ""}</p></div>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowNuevoGrupo(false)} disabled={creandoGrupo} className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl disabled:opacity-50">Cancelar</button>
              <button onClick={crearGrupo} disabled={creandoGrupo || !nombreGrupo.trim() || miembrosGrupo.length === 0} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-bold bg-[#0145F2] hover:bg-[#0138c9] text-white rounded-xl disabled:opacity-50"><Users className="w-4 h-4" /> Crear grupo</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
