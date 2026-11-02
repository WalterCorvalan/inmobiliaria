import { frasesDelResumen, resaltarFrase } from "@/lib/panel/resaltarResumen";
import { etiquetaDeFrase } from "@/lib/panel/formatoResumen";

// Resumen de la IA con una frase por renglón y los datos clave marcados (autos, plata, km, años, teléfono).
// Reglas en lib/panel/resaltarResumen.ts.
export default function ResumenResaltado({ texto }: { texto: string }) {
  return (
    <div className="space-y-1.5 text-slate-600 dark:text-slate-300">
      {frasesDelResumen(texto).map((frase, i) => {
        // "Anticipo: $ 4.000.000": el nombre del dato va marcado para que el número no quede suelto (21/10/2026).
        const conEtiqueta = etiquetaDeFrase(frase);
        return (
        <p key={i}>
          {conEtiqueta && <span className="font-semibold text-slate-900 dark:text-white">{conEtiqueta.etiqueta}: </span>}
          {resaltarFrase(conEtiqueta ? conEtiqueta.resto : frase).map((t, j) => {
            if (t.tipo === "telefono") {
              return <a key={j} href={`tel:${t.texto.replace(/[^\d+]/g, "")}`} className="font-semibold text-[#0145F2] dark:text-[#6B92FF] hover:underline tabular-nums">{t.texto}</a>;
            }
            if (t.tipo === "auto") return <strong key={j} className="font-semibold text-slate-900 dark:text-white">{t.texto}</strong>;
            if (t.tipo === "dato") return <strong key={j} className="font-semibold text-slate-900 dark:text-white tabular-nums">{t.texto}</strong>;
            return <span key={j}>{t.texto}</span>;
          })}
        </p>
        );
      })}
    </div>
  );
}
