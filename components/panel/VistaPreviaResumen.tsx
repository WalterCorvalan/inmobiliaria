import { parsearResumen, renglonesCortos } from "@/lib/panel/parsearResumen";

// Vista previa de una alerta de resumen (informe de marketing, resumen diario...) en la lista de Alertas: los primeros
// datos, uno por renglón, en vez de todo el texto pegado en un párrafo (Walter, 16/10/2026). El informe completo se
// abre en ResumenAlertaModal.
export function VistaPreviaResumen({ mensaje }: { mensaje: string }) {
  const { renglones, restantes } = renglonesCortos(parsearResumen(mensaje));
  return (
    <div className="mt-1.5 space-y-1">
      {renglones.map((r, i) => (
        <p key={i} className="text-xs text-slate-600 dark:text-slate-300 truncate">{r}</p>
      ))}
      {restantes > 0 && <p className="text-[11px] font-semibold text-slate-400">y {restantes} más en el informe</p>}
    </div>
  );
}

// Para la campanita, que muestra un solo renglón.
export function primerRenglon(mensaje: string): string {
  return renglonesCortos(parsearResumen(mensaje), 1).renglones[0] ?? mensaje;
}
