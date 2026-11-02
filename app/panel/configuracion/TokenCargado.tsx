// Muestra qué token hay guardado hoy en la configuración del canal (WhatsApp,
// Instagram o Messenger): últimos 6 caracteres, largo y cuándo se tocó la
// configuración. Sirve para comparar con el último token generado en Meta y
// detectar si quedó uno viejo sin actualizar.
export default function TokenCargado({ resumen, actualizado }: { resumen: { ultimos6: string; largo: number } | null | undefined; actualizado?: string | null }) {
  const fecha = actualizado ? new Date(actualizado).toLocaleString("es-AR") : null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-2.5">
      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Token cargado actualmente</p>
      {resumen ? (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Termina en <span className="font-mono font-bold text-slate-800 dark:text-slate-100">…{resumen.ultimos6}</span> ({resumen.largo} caracteres)
          {fecha ? ` · configuración modificada el ${fecha}` : ""}
        </p>
      ) : (
        <p className="text-xs text-amber-600 dark:text-amber-300 mt-0.5">No hay ningún token cargado.</p>
      )}
    </div>
  );
}
