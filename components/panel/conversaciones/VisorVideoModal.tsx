"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// Video de un chat (WhatsApp, Instagram, Messenger) en grande, en el centro de la pantalla (pedido de Walter,
// 30/10/2026). Se cierra con la X, con Escape o tocando afuera.
export default function VisorVideoModal({ src, onClose }: { src: string; onClose: () => void }) {
  // onClose llega nuevo en cada dibujo: se guarda en una ref para que el efecto corra una sola vez y devuelva bien
  // el scroll de la página al cerrar.
  const cerrar = useRef(onClose);
  useEffect(() => { cerrar.current = onClose; }, [onClose]);
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => { if (e.key === "Escape") cerrar.current(); };
    window.addEventListener("keydown", alTeclear);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", alTeclear); document.body.style.overflow = overflowPrevio; };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="Video">
      <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center" aria-label="Cerrar">
        <X className="w-5 h-5" />
      </button>
      <video src={src} controls autoPlay playsInline onClick={(e) => e.stopPropagation()} className="max-w-full max-h-[85vh] rounded-xl bg-black" />
    </div>,
    document.body,
  );
}
