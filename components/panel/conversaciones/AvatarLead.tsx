"use client";

import { useState } from "react";
import { User } from "lucide-react";
import { colorDeAvatar, esNombreSinLetras, inicialesDeLead } from "@/lib/panel/avatarLead";

// Círculo del CLIENTE (no del vendedor: ese es AvatarVendedor). Foto de Meta si hay; si no hay o el link
// se venció, inicial con color propio; sin nombre real (solo un número), ícono de persona.
export default function AvatarLead({
  nombre, fotoUrl, clase, claseTexto = "text-lg", children,
}: {
  nombre: string | null | undefined;
  fotoUrl?: string | null;
  /** Tamaño, ej: "w-11 h-11". */
  clase: string;
  claseTexto?: string;
  /** Para el ícono chiquito del canal en la esquina. */
  children?: React.ReactNode;
}) {
  const [fallo, setFallo] = useState<string | null>(null);
  const conFoto = !!fotoUrl && fallo !== fotoUrl;
  return (
    <div className={`relative shrink-0 rounded-full flex items-center justify-center font-bold ${clase} ${conFoto ? "bg-slate-200 dark:bg-white/10" : colorDeAvatar(nombre)} ${claseTexto}`}>
      {conFoto ? (
        // El ref cubre el caso en que la imagen ya falló antes de que React enganchara onError (dibujo desde el servidor).
        // eslint-disable-next-line @next/next/no-img-element -- link de Meta que se vence; si falla, vuelve la inicial
        <img
          ref={(el) => { if (el && el.complete && el.naturalWidth === 0) setFallo(fotoUrl!); }}
          src={fotoUrl!} alt="" referrerPolicy="no-referrer" onError={() => setFallo(fotoUrl!)} className="w-full h-full rounded-full object-cover"
        />
      ) : esNombreSinLetras(nombre) ? (
        <User className="w-1/2 h-1/2" aria-hidden="true" />
      ) : (
        inicialesDeLead(nombre)
      )}
      {children}
    </div>
  );
}
