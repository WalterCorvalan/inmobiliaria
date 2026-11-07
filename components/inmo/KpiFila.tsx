import type { ReactNode } from "react";

export interface KpiDato { icono: ReactNode; titulo: string; valor: string | number; nota?: string; etiqueta?: string; tono?: "ok" | "mal" | "neutro" }

/** Fila de números de arriba: un cuadro con 4 indicadores separados por una línea. */
export default function KpiFila({ datos }: { datos: KpiDato[] }) {
  return (
    <div className="im-kpis">
      {datos.map((d) => (
        <div className="im-kpi" key={d.titulo}>
          <div className="k1">{d.icono}{d.titulo}</div>
          <div className="k2">
            <strong>{d.valor}</strong>
            {d.etiqueta && <span className={`im-delta${d.tono === "ok" ? " ok" : d.tono === "mal" ? " mal" : ""}`}>{d.etiqueta}</span>}
          </div>
          {d.nota && <small>{d.nota}</small>}
        </div>
      ))}
    </div>
  );
}
