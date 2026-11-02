"use client";

import { useEffect } from "react";

// Solo se activa si el root layout mismo explota (caso extremo). Tiene que
// traer su propio <html>/<body> porque reemplaza todo lo que envuelve.
export default function GlobalError({
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
    <html lang="es">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f8fafc",
            padding: "1rem",
          }}
        >
          <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0f172a", marginBottom: 12 }}>
              Algo salió mal
            </h1>
            <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6, marginBottom: 24 }}>
              Tuvimos un problema inesperado cargando la página. Probá de nuevo en un momento.
            </p>
            <button
              onClick={reset}
              style={{
                background: "#0145F2",
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                padding: "12px 24px",
                borderRadius: 12,
                border: "none",
                cursor: "pointer",
              }}
            >
              Reintentar
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
