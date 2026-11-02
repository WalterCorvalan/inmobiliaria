// Colores y cuadro de detalle comunes a todos los gráficos del panel (15/10/2026). Antes cada pantalla tenía su propia
// paleta (rosa, naranja, violeta...) y su propio tooltip; ahora todas usan estas piezas.
//
// Reglas:
// - SERIES: para distinguir categorías (canales, tipos, cuentas). Se asignan en este orden, siempre igual, nunca
//   salteando ni repitiendo; con más de 7 categorías, las chicas van a "Otros". Validadas con daltonismo y contra el
//   fondo claro (#fff) y oscuro (#161616): el amarillo, el aqua y el rosa quedan por debajo de 3:1 sobre blanco, así
//   que el gráfico que los use lleva leyenda o el valor escrito.
// - ESTADO: verde/ámbar/rojo/gris solo para estados (cumplido, por vencer, vencido). No se usan como "serie 4".
// - Los colores van como variables CSS (claro/oscuro); el SVG de recharts las lee con var(--g-...).

export const SERIES = ["s1", "s2", "s3", "s4", "s5", "s6", "s7"] as const;
export type Serie = (typeof SERIES)[number];
export type Estado = "ok" | "aviso" | "mal" | "neutro";

export const VARIABLES_GRAFICO =
  "[--g-s1:#0145F2] dark:[--g-s1:#5b8dff] " +
  "[--g-s2:#eb6834] dark:[--g-s2:#d95926] " +
  "[--g-s3:#1baf7a] dark:[--g-s3:#199e70] " +
  "[--g-s4:#eda100] dark:[--g-s4:#c98500] " +
  "[--g-s5:#e87ba4] dark:[--g-s5:#d55181] " +
  "[--g-s6:#008300] dark:[--g-s6:#008300] " +
  "[--g-s7:#4a3aa7] dark:[--g-s7:#9085e9] " +
  "[--g-ok:#059669] dark:[--g-ok:#34d399] " +
  "[--g-aviso:#d97706] dark:[--g-aviso:#fbbf24] " +
  "[--g-mal:#e11d48] dark:[--g-mal:#fb7185] " +
  "[--g-neutro:#94a3b8] dark:[--g-neutro:#64748b] " +
  // Fondo de la tarjeta: el anillo de 2 px alrededor del punto activo de una línea.
  "[--g-fondo:#ffffff] dark:[--g-fondo:#161616]";

// Color de la serie número i (0, 1, 2...). Pasado el 7 vuelve a gris: es la señal de que hay que agrupar en "Otros".
export const colorSerie = (i: number) => (i < SERIES.length ? `var(--g-${SERIES[i]})` : "var(--g-neutro)");
export const colorEstado = (e: Estado) => `var(--g-${e})`;

// Ejes y grilla: recesivos, en el color del texto secundario.
export const EJE = { tick: { fill: "currentColor", fontSize: 11 }, axisLine: false, tickLine: false } as const;
export const GRILLA = { vertical: false, stroke: "currentColor", strokeOpacity: 0.18 } as const;
export const CLASE_CONTENEDOR_GRAFICO = `text-slate-400 dark:text-slate-500 ${VARIABLES_GRAFICO}`;

// Texto de la leyenda en color de texto, no en el de la serie (la rayita de al lado ya marca cuál es).
export const textoLeyenda = (valor: unknown) => <span className="text-slate-600 dark:text-slate-300">{String(valor)}</span>;

interface FilaTooltip {
  name?: string | number;
  value?: number | string;
  color?: string;
  fill?: string;
  stroke?: string;
  payload?: Record<string, unknown>;
}

// Cuadro de detalle al pasar el mouse: primero el valor, después el nombre; una rayita con el color de la serie.
// Sirve para barras, líneas, áreas y tortas (recharts le pasa active/payload/label).
export function TooltipGrafico({
  active,
  payload,
  label,
  formato = (n: number) => n.toLocaleString("es-AR"),
}: {
  active?: boolean;
  payload?: FilaTooltip[];
  label?: string | number;
  formato?: (n: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur dark:border-white/10 dark:bg-[#1a1a1a]/95">
      {label !== undefined && label !== "" && <p className="mb-1 text-[11px] text-slate-500 dark:text-slate-400">{String(label)}</p>}
      {payload.map((p, i) => {
        const color = (p.payload?.color as string | undefined) || p.color || p.fill || p.stroke;
        return (
          <p key={i} className="flex items-center gap-2 text-xs tabular-nums text-slate-700 dark:text-slate-200">
            <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: color }} />
            <span className="font-bold text-slate-900 dark:text-white">{typeof p.value === "number" ? formato(p.value) : String(p.value ?? "")}</span>
            {p.name !== undefined && <span className="text-slate-500 dark:text-slate-400">{String(p.name)}</span>}
          </p>
        );
      })}
    </div>
  );
}
