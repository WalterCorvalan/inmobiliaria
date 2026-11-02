"use client";

import { useEffect } from "react";
import Link from "next/link";

// Boundary genérico para toda la app: si algo explota en el cliente, esto
// evita la pantalla default de Next (que en dev muestra stack trace) y te
// manda algo prolijo. El error real ya quedó logueado server-side si vino
// de una API — esto es solo la UI de fallback del lado del cliente.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    fetch("/api/panel/log-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensaje: error.message, stack: error.stack, url: window.location.href }),
    }).catch(() => {});
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-[#0a0a0f] px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-400/10 border border-rose-100 dark:border-rose-400/20 flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl">⚠️</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-3">
          Algo salió mal
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-8">
          Tuvimos un problema inesperado. Ya quedó registrado — probá de nuevo en un momento.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="bg-[#0145F2] hover:bg-blue-700 text-white font-bold text-sm px-6 py-3 rounded-xl transition-colors"
          >
            Reintentar
          </button>
          <Link
            href="/"
            className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-bold text-sm px-6 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
