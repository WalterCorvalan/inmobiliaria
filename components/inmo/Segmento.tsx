"use client";

/** Botones juntos para elegir una opción (en vez de un desplegable). Estilo en app/inmo.css (.im-seg). */
export default function Segmento({ valor, opciones, onCambio, etiqueta }: { valor: string; opciones: [string, string][]; onCambio: (v: string) => void; etiqueta: string }) {
  return (
    <div className="im-seg" role="group" aria-label={etiqueta}>
      {opciones.map(([v, t]) => (
        <button key={v} type="button" aria-pressed={valor === v} className={valor === v ? "on" : ""} onClick={() => onCambio(v)}>{t}</button>
      ))}
    </div>
  );
}
