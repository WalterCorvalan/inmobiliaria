"use client";

import { ReactNode } from "react";

// Tabla con muchas columnas + overflow-x-auto es el patrón que se repite en
// casi todos los módulos de panel-v2 (Stock, Ventas, Clientes, Cotizaciones...)
// y en el celular queda como una tira angosta que hay que scrollear de costado.
// Este componente resuelve eso una sola vez: en desktop se ve la tabla normal,
// en mobile cada fila se convierte en una tarjeta (dato principal arriba,
// el resto como pares clave/valor, acciones al final) — nada de scroll horizontal.
export interface ColumnaTabla<T> {
  key: string;
  header: string;
  cell: (fila: T) => ReactNode;
  claseTh?: string;
  claseTd?: string;
  /** No se muestra en la tarjeta mobile (para datos redundantes con la cabecera de la tarjeta, o de relleno visual en desktop). */
  ocultarEnMobile?: boolean;
  /** La columna ocupa las 2 columnas de la tarjeta mobile en vez de la mitad — para contenido rico/multilínea (botones, barras de progreso) que no entra apretado. */
  anchoCompletoMobile?: boolean;
}

export default function TablaResponsiva<T>({
  columnas,
  filas,
  keyExtractor,
  onRowClick,
  encabezadoMobile,
  acciones,
  vacio,
  claseFila,
}: {
  columnas: ColumnaTabla<T>[];
  filas: T[];
  keyExtractor: (fila: T) => string;
  onRowClick?: (fila: T) => void;
  /** Contenido destacado arriba de cada tarjeta mobile (ej: nombre + foto). Si no se pasa, se usa la primera columna. */
  encabezadoMobile?: (fila: T) => ReactNode;
  /** Botones de acción de la fila — se repiten al final de cada tarjeta mobile y en la última columna desktop. */
  acciones?: (fila: T) => ReactNode;
  vacio?: ReactNode;
  /** Clases extra por fila (ej: resaltar en rojo una fila pendiente) — se aplican tanto a la fila desktop como a la tarjeta mobile. */
  claseFila?: (fila: T) => string;
}) {
  if (filas.length === 0) return vacio ?? null;

  const columnasCard = columnas.filter((c) => !c.ocultarEnMobile);

  return (
    <>
      {/* Desktop / tablet: tabla completa */}
      <div className="hidden md:block bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-white/[0.03] border-b border-slate-200 dark:border-white/5">
              {columnas.map((c) => (
                <th key={c.key} className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 whitespace-nowrap ${c.claseTh || ""}`}>
                  {c.header}
                </th>
              ))}
              {acciones && <th className="px-4 py-3 w-px whitespace-nowrap">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr
                key={keyExtractor(fila)}
                onClick={onRowClick ? () => onRowClick(fila) : undefined}
                className={`border-b border-slate-100 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/[0.02] ${onRowClick ? "cursor-pointer" : ""} ${claseFila?.(fila) || ""}`}
              >
                {columnas.map((c) => (
                  <td key={c.key} className={`px-4 py-3 ${c.claseTd || ""}`}>
                    {c.cell(fila)}
                  </td>
                ))}
                {acciones && (
                  <td className="px-4 py-3 w-px whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {acciones(fila)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: una tarjeta por fila, sin scroll horizontal. Mismo lenguaje que las tarjetas de Visitas, Pedidos y
          Señas: cuerpo arriba y las acciones en una franja al pie. Sin overflow-hidden a propósito: hay celdas con
          menús desplegables propios que se cortarían; por eso la franja redondea sus esquinas ella misma. */}
      <div className="md:hidden flex flex-col gap-3">
        {filas.map((fila) => (
          <div
            key={keyExtractor(fila)}
            onClick={onRowClick ? () => onRowClick(fila) : undefined}
            className={`bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm flex flex-col ${onRowClick ? "cursor-pointer hover:shadow-md active:bg-slate-50 dark:active:bg-white/[0.05] active:shadow-none transition-shadow" : ""} ${claseFila?.(fila) || ""}`}
          >
            <div className="p-4">
              <div className="mb-2.5">{(encabezadoMobile ?? columnasCard[0]?.cell)(fila)}</div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
                {(encabezadoMobile ? columnasCard : columnasCard.slice(1)).map((c) => (
                  <div key={c.key} className={`min-w-0 ${c.anchoCompletoMobile ? "col-span-2" : ""}`}>
                    <dt className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{c.header}</dt>
                    <dd className={`text-xs text-slate-700 dark:text-slate-300 ${c.anchoCompletoMobile ? "" : "truncate"}`}>{c.cell(fila)}</dd>
                  </div>
                ))}
              </dl>
            </div>
            {acciones && (
              <div className="mt-auto flex items-center flex-wrap gap-1 px-4 py-2.5 border-t border-slate-100 dark:border-white/5 bg-slate-50/60 dark:bg-white/[0.02] rounded-b-2xl" onClick={(e) => e.stopPropagation()}>
                {acciones(fila)}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
