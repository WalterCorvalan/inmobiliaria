"use client";

import { useEffect, useRef, useState } from "react";
import { supabase2 } from "@/lib/supabase/client";
import { Send, X, Globe, Users, Minus } from "lucide-react";
import { avisar } from "@/components/panel/Dialogos";

interface Perfil { id: string; nombre: string }
interface Canal { id: string; tipo: "general" | "directo" | "grupo"; nombre: string | null; otroMiembro?: Perfil }
interface Mensaje { id: string; canal_id: string; autor_id: string; texto: string | null; adjuntos: { url: string; nombre: string }[] | null; created_at: string }

function nombreCanal(c: Canal) {
  if (c.tipo === "general") return "General";
  if (c.tipo === "grupo") return c.nombre || "Grupo";
  return c.otroMiembro?.nombre || "Usuario";
}

// Ventana de chat superpuesta ("chat head") -- versión compacta de
// MensajesClient para un solo canal, sin salir de la pantalla donde estás.
// Sin adjuntos a propósito (mantiene la ventana chica); para eso está
// "Ver Mensajes completo".
export default function FloatingChatWindow({ canal, miId, offset, onClose }: { canal: Canal; miId: string; offset: number; onClose: () => void }) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [minimizada, setMinimizada] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase2.from("mensajes").select("*").eq("canal_id", canal.id).order("created_at", { ascending: true }).then(({ data }) => setMensajes(data || []));
    const ahora = new Date().toISOString();
    supabase2.from("mensajes_lecturas").upsert({ canal_id: canal.id, perfil_id: miId, last_read_at: ahora });

    const suscripcion = supabase2
      .channel(`mensajes-flotante-${canal.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensajes", filter: `canal_id=eq.${canal.id}` }, (payload: any) => {
        const row: Mensaje = payload.new;
        setMensajes((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        if (row.autor_id !== miId) {
          supabase2.from("mensajes_lecturas").upsert({ canal_id: canal.id, perfil_id: miId, last_read_at: new Date().toISOString() });
        }
      })
      .subscribe();
    return () => { supabase2.removeChannel(suscripcion); };
  }, [canal.id, miId]);

  useEffect(() => { if (!minimizada) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [mensajes, minimizada]);

  const enviar = async () => {
    if (!texto.trim()) return;
    setEnviando(true);
    const cuerpo = texto.trim();
    setTexto("");
    try {
      const { data, error } = await supabase2.from("mensajes").insert({ canal_id: canal.id, autor_id: miId, texto: cuerpo, adjuntos: [] }).select("*").single();
      if (error) throw error;
      setMensajes((prev) => [...prev, data]);
      await supabase2.from("mensajes_lecturas").upsert({ canal_id: canal.id, perfil_id: miId, last_read_at: new Date().toISOString() });
    } catch {
      avisar("No se pudo enviar el mensaje.");
      setTexto(cuerpo);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div
      className="print:hidden hidden md:flex fixed bottom-6 z-40 w-[300px] bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/10 rounded-t-xl shadow-2xl flex-col overflow-hidden"
      style={{ right: `${offset}px`, height: minimizada ? "auto" : "380px" }}
    >
      <button onClick={() => setMinimizada((v) => !v)} className="flex items-center gap-2 px-3 py-2.5 bg-indigo-600 text-white shrink-0 text-left">
        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          {canal.tipo === "general" ? <Globe className="w-3.5 h-3.5" /> : canal.tipo === "grupo" ? <Users className="w-3.5 h-3.5" /> : <span className="text-[11px] font-bold">{nombreCanal(canal).slice(0, 1).toUpperCase()}</span>}
        </div>
        <span className="flex-1 text-sm font-bold truncate">{nombreCanal(canal)}</span>
        <span onClick={(e) => { e.stopPropagation(); setMinimizada((v) => !v); }} className="p-1 hover:bg-white/10 rounded"><Minus className="w-3.5 h-3.5" /></span>
        <span onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-1 hover:bg-white/10 rounded"><X className="w-3.5 h-3.5" /></span>
      </button>

      {!minimizada && (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50 dark:bg-[#0d0d0d]">
            {mensajes.length === 0 ? (
              <p className="text-center text-xs text-slate-400 mt-6">Sé el primero en escribir algo</p>
            ) : mensajes.map((m) => {
              const esMio = m.autor_id === miId;
              return (
                <div key={m.id} className={`flex ${esMio ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-xl px-3 py-1.5 text-[13px] ${esMio ? "bg-indigo-600 text-white" : "bg-white dark:bg-white/10 text-slate-800 dark:text-white border border-slate-200 dark:border-white/10"}`}>
                    {m.texto && <p className="whitespace-pre-wrap break-words">{m.texto}</p>}
                    {m.adjuntos?.map((a, i) => (
                      <a key={i} href={a.url} target="_blank" rel="noreferrer" className={`block text-[11px] underline ${esMio ? "text-white/90" : "text-indigo-600 dark:text-indigo-400"}`}>{a.nombre}</a>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="p-2 border-t border-slate-200 dark:border-white/10 shrink-0">
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-white/5 rounded-full px-3 py-1">
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                placeholder="Escribí un mensaje..."
                className="flex-1 bg-transparent outline-none text-[13px] py-1.5"
              />
              <button onClick={enviar} disabled={enviando || !texto.trim()} className="shrink-0 w-6 h-6 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center disabled:opacity-50"><Send className="w-3 h-3" /></button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
