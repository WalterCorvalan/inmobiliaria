"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { X, Send, User, RotateCcw } from "lucide-react";
import IconoAsistente from "@/components/ui/IconoAsistente";
import { NOMBRE_ASISTENTE_WEB } from "@/lib/asistenteWeb";
import { trackEvent } from "@/lib/analytics";
import { RESORTE } from "@/components/ui/movimiento";
import { m } from "framer-motion";
import { datosDeOrigen } from "@/lib/utm";
import { registrarEvento } from "@/lib/conversiones";

interface Message {
  role: "user" | "assistant";
  content: string;
  link?: string | null;
}

const MENSAJE_INICIAL: Message = {
  role: "assistant",
  content: `¡Hola! Soy ${NOMBRE_ASISTENTE_WEB.toLowerCase()} virtual. ¿Estás buscando una propiedad o querés vender o alquilar la tuya? ¡Te doy una mano!`,
};

// Botones de respuesta rápida debajo del saludo (Walter, 22/10/2026): se mandan como si el cliente los escribiera y
// desaparecen apenas arranca la charla.
const RESPUESTAS_RAPIDAS = ["Busco un auto", "Quiero vender el mío", "Financiación", "Quiero asegurar mi auto", "Hablar con un asesor"];

const SESSION_KEY = "rodi_session_id";

function obtenerSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export default function FloatingChatbot() {
  const pathname = usePathname();
  const enDetalleVehiculo = pathname?.startsWith("/catalogo/") ?? false;

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([MENSAJE_INICIAL]);
  const [handoff, setHandoff] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  const limpiarChat = () => {
    setMessages([MENSAJE_INICIAL]);
    setHandoff(false);
    // Nueva sesión: si limpia el chat, que arranque una conversación nueva
    // en vez de seguir mandando mensajes a la vieja en el CRM.
    if (typeof window !== "undefined") localStorage.removeItem(SESSION_KEY);
  };

  const enviar = async (texto: string) => {
    if (!texto || loading || handoff) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: texto }]);
    setLoading(true);

    try {
      const res = await fetch("/api/panel/rodi/mensaje", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...datosDeOrigen(), sessionId: obtenerSessionId(), texto, origenPagina: pathname }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.error || "Perdón, no pude responder. Probá de nuevo." }]);
        return;
      }
      if (data.replies?.length) setMessages((prev) => [...prev, ...data.replies.map((content: string) => ({ role: "assistant" as const, content }))]);
      if (data.handoff) setHandoff(true);
      // Rodi consiguió el teléfono o derivó a un vendedor: cuenta como consulta en Analytics (a Meta ya la mandó el servidor).
      if (data.consulta) registrarEvento({ tipo: "rodi" });
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Perdón, hubo un error de conexión. Probá de nuevo en un momento." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    void enviar(input.trim());
  };

  const avatarAsistente = (
    <div className="w-7 h-7 rounded-full bg-[#0145F2]/10 dark:bg-sky-400/15 text-[#0145F2] flex items-center justify-center shrink-0 mb-1">
      <IconoAsistente className="w-7 h-7" />
    </div>
  );

  // z-[75]: por encima del aviso de cookies (z-70), que si no tapaba el botón y la caja de texto (15/10/2026).
  return (
    <div className={`fixed ${enDetalleVehiculo ? "bottom-24 lg:bottom-6" : "bottom-6"} right-4 lg:right-6 z-[75] font-sans`}>
      {/* Botón flotante para abrir/cerrar */}
      {!isOpen && (
        <m.button
          onClick={() => { setIsOpen(true); trackEvent("abrir_chat_ia"); }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...RESORTE, delay: 0.6 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.92 }}
          className="relative bg-[#0145F2] hover:bg-blue-700 text-white p-0.5 rounded-full shadow-2xl flex items-center justify-center transition-colors duration-300 group cursor-pointer border-2 border-white/20"
          aria-label="Abrir chat de asistencia"
        >
          <IconoAsistente className="w-14 h-14 group-hover:rotate-12 transition-transform" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full animate-ping"></span>
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full"></span>
        </m.button>
      )}

      {/* Ventana del Chat. En el celular ocupa toda la pantalla; sigue el modo oscuro de la web (Walter, 22/10/2026). */}
      {isOpen && (
        <div className="bg-slate-50 dark:bg-[#0a0a0f] border-0 sm:border border-slate-200 dark:border-white/10 fixed inset-0 sm:static sm:w-[380px] sm:h-[560px] rounded-none sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fadeIn">
          {/* Cabecera del Chat */}
          <div className="bg-[#0F172A] dark:bg-[#16161b] dark:border-b dark:border-white/10 text-white px-4 py-3.5 flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-full bg-[#0145F2] flex items-center justify-center text-white shrink-0">
              <IconoAsistente className="w-10 h-10" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-black text-base leading-tight">{NOMBRE_ASISTENTE_WEB}</h3>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                Asistente virtual
              </p>
            </div>
            <button
              onClick={limpiarChat}
              className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
              title="Empezar de nuevo"
              aria-label="Empezar de nuevo"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-300 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors"
              aria-label="Cerrar chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cuerpo de los mensajes */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 custom-scrollbar">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-2.5 items-end ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "assistant" && avatarAsistente}
                <div className="max-w-[80%] flex flex-col gap-2">
                  <div
                    className={`px-3.5 py-2.5 rounded-2xl text-sm sm:text-[13px] leading-relaxed whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-[#0145F2] text-white rounded-br-md"
                        : "bg-white dark:bg-[#1c1c22] text-slate-800 dark:text-slate-200 rounded-bl-md border border-slate-200/80 dark:border-white/10"
                    }`}
                  >
                    {m.content}
                  </div>
                  {m.link && (
                    <a
                      href={m.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-center bg-[#0145F2] hover:bg-blue-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors"
                    >
                      Ver ficha completa
                    </a>
                  )}
                </div>
                {m.role === "user" && (
                  <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 mb-1">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}
            {messages.length === 1 && !loading && (
              <div className="flex flex-wrap gap-2 pl-9">
                {RESPUESTAS_RAPIDAS.map((r) => (
                  <button
                    key={r}
                    onClick={() => void enviar(r)}
                    className="text-[13px] font-semibold text-[#0145F2] dark:text-sky-300 bg-white dark:bg-sky-400/10 border border-blue-200 dark:border-sky-400/25 hover:bg-blue-50 dark:hover:bg-sky-400/20 px-3.5 py-2 rounded-full transition-colors"
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
            {loading && (
              <div className="flex gap-2.5 items-end justify-start">
                {avatarAsistente}
                <div className="bg-white dark:bg-[#1c1c22] px-3.5 py-3 rounded-2xl rounded-bl-md border border-slate-200/80 dark:border-white/10 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {handoff && (
            <div className="px-4 py-2.5 bg-emerald-50 dark:bg-emerald-400/10 border-t border-emerald-100 dark:border-emerald-400/20 text-[12px] font-semibold text-emerald-700 dark:text-emerald-300 text-center shrink-0">
              Un asesor te va a contactar en breve.
            </div>
          )}

          {/* Input de envío. Letra de 16px en el celular: con menos, el iPhone agranda la pantalla al tocar la caja.
             Abajo deja lugar a la barra del iPhone. */}
          <form
            onSubmit={handleSend}
            className="px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-white dark:bg-[#16161b] border-t border-slate-200/80 dark:border-white/10 flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={handoff ? "Un asesor te va a escribir por acá..." : "Escribí tu consulta..."}
              disabled={handoff}
              className="flex-1 min-w-0 bg-slate-100 dark:bg-white/5 border border-transparent focus:border-[#0145F2] dark:focus:border-sky-400 focus:bg-white dark:focus:bg-white/10 text-base sm:text-sm px-4 py-2.5 rounded-xl outline-none transition-all text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || !input.trim() || handoff}
              className="bg-[#0145F2] hover:bg-blue-700 disabled:opacity-40 text-white p-3 rounded-xl transition-all active:scale-95 flex items-center justify-center cursor-pointer shrink-0"
              aria-label="Enviar"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
