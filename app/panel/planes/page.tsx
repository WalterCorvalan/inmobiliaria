import IconoPanel from "@/components/panel/IconoPanel";
import { FUNCIONES, PLANES, precioTexto, type Funcion, type Plan } from "@/lib/planes";
import { esModoDemo } from "@/lib/demo/modo";

export const metadata = { title: "Planes | Inmobiliaria CRM" };

// Vistazo a los planes (Walter, 27/11/2026: "qué diferencia hay del Básico del Pro"). Informativo: en la demo se ve todo,
// como el Pro, y lo que no trae el Básico lleva la etiqueta "Pro" en el menú.
const DESTACADOS: Record<Plan, string[]> = {
  basico: ["Bot de WhatsApp que ofrece tu cartera", "Leads, visitas, reservas y operaciones", "Propiedades con fotos y estados", "Hasta 2 asesores"],
  pro: ["Todo lo del Básico", "Instagram, Messenger y chat de la web", "Seguimiento con tareas y embudo", "Finanzas en dólares y pesos", "Hasta 6 asesores y varias oficinas"],
};

export default function PlanesPage() {
  const demo = esModoDemo();
  const grupos = [...new Set(FUNCIONES.map((f) => f.grupo))];
  return (
    <div className="im-page">
      <div className="im-head">
        <div>
          <h1>Planes</h1>
          <p>{demo ? "En la demo estás viendo el plan Pro completo. Esto es lo que cambia con el Básico." : "Qué trae cada plan. Abono mensual fijo, sin comisión por operación."}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {(["basico", "pro"] as Plan[]).map((id) => {
          const p = PLANES[id];
          const pro = id === "pro";
          return (
            <section key={id} className={`relative overflow-hidden rounded-xl bg-white p-5 md:p-6 border shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:bg-[#131316] ${pro ? "border-[var(--marca)] ring-1 ring-[var(--marca)]" : "border-[#E7E9EE] dark:border-white/[0.08]"}`}>
              {pro && <span className="absolute right-4 top-4 rounded-full menu-activo px-2.5 py-0.5 text-[11px] font-semibold text-white">{demo ? "El que estás viendo" : "Recomendado"}</span>}
              <div className="flex items-center gap-3">
                <span className={`flex w-10 h-10 items-center justify-center rounded-lg ${pro ? "bg-amber-50 dark:bg-amber-500/15" : "bg-slate-100 dark:bg-white/10"}`}>
                  <IconoPanel src={pro ? "/icons/panel/oportunidades.png" : "/icons/panel/consignaciones.png"} alt="" className="w-[22px] h-[22px]" />
                </span>
                <div>
                  <h2 className="text-[17px] font-semibold text-slate-900 dark:text-white">{p.nombre}</h2>
                  <p className="text-[12.5px] text-slate-500 dark:text-slate-400">{p.para}</p>
                </div>
              </div>
              <p className="mt-5 flex items-baseline gap-1.5">
                <span className="text-[32px] font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white">{precioTexto(p.precioMensual)}</span>
                <span className="text-[13px] text-slate-500 dark:text-slate-400">por mes</span>
              </p>
              <ul className="mt-4 space-y-2">
                {DESTACADOS[id].map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-[13.5px] text-slate-700 dark:text-slate-200">
                    <span className="mt-0.5 grid w-[18px] h-[18px] shrink-0 place-items-center rounded-full bg-emerald-50 text-[11px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" aria-hidden="true">✓</span>{t}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <p className="text-[12.5px] text-slate-500 dark:text-slate-400">Los dos tienen 14 días de prueba. Pagando el año, son 10 meses (2 de regalo). Los precios se ajustan cada 3 meses.</p>

      <section className="overflow-hidden rounded-xl bg-white border border-[#E7E9EE] shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:bg-[#131316] dark:border-white/[0.08]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/[0.06]">
                <th className="px-4 md:px-5 py-3 text-left text-[14px] font-semibold text-slate-900 dark:text-white">Qué trae cada uno</th>
                <th className="w-[120px] px-3 py-3 text-center text-[12.5px] font-semibold text-slate-600 dark:text-slate-300">Básico</th>
                <th className="w-[120px] px-3 py-3 text-center text-[12.5px] font-semibold text-slate-900 dark:text-white">Pro</th>
              </tr>
            </thead>
            {grupos.map((g) => (
              <tbody key={g}>
                <tr><td colSpan={3} className="bg-slate-50/70 px-4 md:px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:bg-white/[0.02] dark:text-slate-400">{g}</td></tr>
                {FUNCIONES.filter((f) => f.grupo === g).map((f) => (
                  <tr key={f.nombre} className="border-t border-slate-100 dark:border-white/[0.06]">
                    <td className="px-4 md:px-5 py-3">
                      <p className="font-medium text-slate-900 dark:text-white">{f.nombre}{!f.basico && <span className="ml-2 rounded px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">Pro</span>}</p>
                      <p className="text-[12px] text-slate-500 dark:text-slate-400">{f.detalle}</p>
                    </td>
                    <td className="px-3 py-3 text-center"><Celda v={f.basico} /></td>
                    <td className="px-3 py-3 text-center"><Celda v={f.pro} /></td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </section>
    </div>
  );
}

function Celda({ v }: { v: Funcion["basico"] }) {
  if (typeof v === "string") return <span className="font-semibold text-slate-800 dark:text-slate-100">{v}</span>;
  return v
    ? <span className="inline-grid w-6 h-6 place-items-center rounded-full bg-emerald-50 text-[12px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" aria-label="Incluido">✓</span>
    : <span className="text-slate-300 dark:text-slate-600" aria-label="No incluido">—</span>;
}
