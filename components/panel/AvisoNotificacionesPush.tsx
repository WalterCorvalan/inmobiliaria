"use client";

import { useEffect, useState } from "react";
import { BellRing, Loader2, Share, X } from "lucide-react";
import { activarPush, esIphone, estaInstalada, pushSoportado, queAvisoPush, suscripcionActual, type AvisoPush } from "@/lib/panel/pushCliente";

// Aviso arriba del panel para activar las notificaciones en el celular o la compu (13/10/2026, Walter: "que les llegue
// una notificación aunque no estén en el panel, gratis"). Lo ve todo el que no las tiene activadas en ese dispositivo,
// vendedores incluidos (antes el botón estaba solo en Mi espacio, que ellos no abren). En iPhone explica cómo instalar
// el panel, porque sin eso iPhone no deja recibir notificaciones. "Ahora no" lo esconde 7 días en ese dispositivo.
const CLAVE = "aviso-push-descartado-hasta";

export default function AvisoNotificacionesPush() {
  const [aviso, setAviso] = useState<AvisoPush>("nada");
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    (async () => {
      let descartado = false;
      try { descartado = Number(localStorage.getItem(CLAVE) || 0) > Date.now(); } catch { /* sin almacenamiento: se muestra */ }
      const activo = !!(await suscripcionActual());
      const permiso = typeof Notification !== "undefined" ? Notification.permission : "desconocido";
      if (vivo) setAviso(queAvisoPush({ soportado: pushSoportado(), activo, iphone: esIphone(), instalada: estaInstalada(), permiso, descartado }));
    })();
    return () => { vivo = false; };
  }, []);

  if (aviso === "nada") return null;

  const descartar = () => {
    try { localStorage.setItem(CLAVE, String(Date.now() + 7 * 86400000)); } catch { /* nada */ }
    setAviso("nada");
  };
  const activar = async () => {
    setProcesando(true);
    setError("");
    const r = await activarPush();
    setProcesando(false);
    if (r.ok) setAviso("nada");
    else setError(r.error);
  };

  return (
    <div className="mx-4 md:mx-6 mt-4 flex items-start gap-3 rounded-2xl border border-[#0145F2]/20 bg-[#0145F2]/[0.06] dark:bg-[#0145F2]/15 px-4 py-3">
      <span className="w-9 h-9 rounded-full bg-[#0145F2] text-white flex items-center justify-center shrink-0"><BellRing className="w-4 h-4" /></span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900 dark:text-white">Enterate de cada mensaje aunque no estés en el panel</p>
        {aviso === "activar" && <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">Activá las notificaciones en este dispositivo: cuando te escriba un cliente o te asignen un lead, te llega un aviso como el de cualquier app. Es gratis.</p>}
        {aviso === "bloqueadas" && <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">Las notificaciones están bloqueadas en este navegador. Tocá el candado al lado de la dirección → Notificaciones → Permitir, y recargá la página.</p>}
        {aviso === "instalar-iphone" && (
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
            En iPhone primero hay que instalar el panel: tocá <Share className="inline w-3.5 h-3.5 -mt-0.5" /> <b>Compartir</b> → <b>Agregar a pantalla de inicio</b>, abrí el panel desde ese ícono y vas a ver acá el botón para activar las notificaciones.
          </p>
        )}
        {error && <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{error}</p>}
        {aviso === "activar" && (
          <button onClick={activar} disabled={procesando} className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#0145F2] hover:bg-[#0138c9] text-white disabled:opacity-60">
            {procesando && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Activar notificaciones
          </button>
        )}
      </div>
      <button onClick={descartar} title="Ahora no" aria-label="Cerrar el aviso por 7 días" className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 shrink-0"><X className="w-4 h-4" /></button>
    </div>
  );
}
