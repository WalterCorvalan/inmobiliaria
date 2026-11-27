"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { supabase2 } from "@/lib/supabase/client";
import Segmento from "@/components/inmo/Segmento";
import IconoPanel from "@/components/panel/IconoPanel";
import { Cifra, FONDOS, Pestanas, Tarjeta, Vacio } from "@/components/inmo/PlataUI";
import { montoTexto, porCategoria, porMes, rangoDelMes, totalesPorMoneda, type MonedaFin, type Movimiento, type TipoMovimiento } from "@/lib/finanzas/finanzas";
import { resumenOperaciones, type OperacionCerrada } from "@/lib/finanzas/operaciones";
import { CATEGORIAS_EGRESO, CATEGORIAS_INGRESO } from "@/lib/finanzas/categorias";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const nombreMes = (clave: string) => { const [a, m] = clave.split("-").map(Number); return `${MESES[m - 1]} ${a}`; };
const moverMes = (clave: string, n: number) => { const [a, m] = clave.split("-").map(Number); const d = new Date(Date.UTC(a, m - 1 + n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };
const fechaCorta = (f: string) => new Date(`${f}T12:00:00Z`).toLocaleDateString("es-AR", { day: "numeric", month: "short", timeZone: "UTC" }).replace(".", "");

export default function FinanzasClient({ iniciales, operaciones, miId, hoy, aviso }: { iniciales: Movimiento[]; operaciones: OperacionCerrada[]; miId: string; hoy: string; aviso: string | null }) {
  const [movs, setMovs] = useState(iniciales);
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [moneda, setMoneda] = useState<MonedaFin>("USD");
  const [filtro, setFiltro] = useState<"todos" | TipoMovimiento>("todos");
  const [nuevo, setNuevo] = useState<TipoMovimiento | null>(null);

  const { desde, hasta } = rangoDelMes(`${mes}-01`);
  const t = totalesPorMoneda(movs, desde, hasta);
  const ro = resumenOperaciones(operaciones, desde, hasta);
  const seisMeses = useMemo(() => porMes(movs, `${mes}-01`, 6), [movs, mes]);
  const gastos = porCategoria(movs, "egreso", moneda, desde, hasta);
  const totalGastos = gastos.reduce((a, g) => a + g.monto, 0) || 1;
  const delMes = movs.filter((m) => m.fecha >= desde && m.fecha <= hasta && (filtro === "todos" || m.tipo === filtro));
  const esActual = mes === hoy.slice(0, 7);

  return (
    <div className="im-page">
      <div className="im-head">
        <div><h1>Finanzas</h1><p>Lo que entró y lo que se gastó, en dólares y en pesos por separado. Nunca se mezclan.</p></div>
        <div className="im-actions">
          <div className="flex w-full sm:w-auto items-center justify-between rounded-lg border border-[#E2E5EA] bg-white dark:bg-white/5 dark:border-white/10">
            <button type="button" className="h-9 w-9 text-slate-500 hover:text-slate-900 dark:hover:text-white" onClick={() => setMes(moverMes(mes, -1))} aria-label="Mes anterior">‹</button>
            <span className="min-w-[128px] text-center text-[13px] font-semibold capitalize text-slate-800 dark:text-slate-100">{nombreMes(mes)}</span>
            <button type="button" className="h-9 w-9 text-slate-500 hover:text-slate-900 disabled:opacity-30 dark:hover:text-white" onClick={() => setMes(moverMes(mes, 1))} disabled={esActual} aria-label="Mes siguiente">›</button>
          </div>
          <button type="button" className="im-btn" onClick={() => setNuevo("ingreso")}>+ Ingreso</button>
          <button type="button" className="im-btn primary" onClick={() => setNuevo("egreso")}>+ Cargar gasto</button>
        </div>
      </div>
      {aviso && <div className="im-error" role="alert">{aviso}</div>}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_0.8fr]">
        <Balance titulo="En dólares" icono="/icons/panel/tesoreria.png" fondo={FONDOS.verde} t={t.USD} moneda="USD" />
        <Balance titulo="En pesos" icono="/icons/panel/cobros.png" fondo={FONDOS.violeta} t={t.ARS} moneda="ARS" />
        <Cifra icono="/icons/panel/finanzas.png" fondo={FONDOS.ambar} titulo="Honorarios que quedan (mes)" valor={montoTexto(ro.paraLaInmobiliaria.USD, "USD")} tono="ok"
          detalle={`y ${montoTexto(ro.paraLaInmobiliaria.ARS, "ARS")} · ${ro.cantidad} ${ro.cantidad === 1 ? "operación" : "operaciones"}, sin la parte de los asesores`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Tarjeta titulo="Últimos 6 meses" icono="/icons/panel/reportes.png" extra={<Segmento valor={moneda} opciones={[["USD", "Dólares"], ["ARS", "Pesos"]]} onCambio={(v) => setMoneda(v as MonedaFin)} etiqueta="Moneda del gráfico" />}>
          <Grafico meses={seisMeses} moneda={moneda} />
        </Tarjeta>
        <Tarjeta titulo={`En qué se gastó (${moneda === "USD" ? "dólares" : "pesos"})`} icono="/icons/panel/facturacion.png">
          {gastos.length === 0 ? <Vacio titulo="Sin gastos en esta moneda" texto="Cargá los gastos del mes con “Cargar gasto”." /> : (
            <ul className="px-4 py-4 md:px-5 space-y-3">
              {gastos.slice(0, 7).map((g, i) => (
                <li key={g.categoria}>
                  <div className="flex justify-between gap-2 text-[13px]"><span className="font-medium text-slate-700 dark:text-slate-200 truncate">{g.categoria}</span><span className="tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">{montoTexto(g.monto, moneda)} <span className="text-slate-400">· {Math.round((g.monto / totalGastos) * 100)}%</span></span></div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.max(3, (g.monto / gastos[0].monto) * 100)}%`, background: `color-mix(in srgb, var(--marca) ${100 - i * 11}%, white)` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>

      <Tarjeta titulo={`Movimientos de ${nombreMes(mes)}`} icono="/icons/panel/liquidaciones.png">
        <Pestanas valor={filtro} onCambio={setFiltro} etiqueta="Tipo de movimiento" opciones={[
          { id: "todos", texto: "Todos", n: movs.filter((m) => m.fecha >= desde && m.fecha <= hasta).length },
          { id: "ingreso", texto: "Entró", n: movs.filter((m) => m.fecha >= desde && m.fecha <= hasta && m.tipo === "ingreso").length },
          { id: "egreso", texto: "Salió", n: movs.filter((m) => m.fecha >= desde && m.fecha <= hasta && m.tipo === "egreso").length },
        ]} />
        {delMes.length === 0 ? <Vacio titulo="Sin movimientos" texto="Los honorarios de las operaciones que cierres entran solos. Los gastos (sueldos, alquiler, portales) se cargan con “Cargar gasto”." /> : (
          <ul className="divide-y divide-slate-100 dark:divide-white/[0.06]">
            {delMes.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-2.5 md:px-5">
                <span className={`grid w-8 h-8 shrink-0 place-items-center rounded-lg text-[15px] font-bold ${m.tipo === "ingreso" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300"}`} aria-hidden="true">{m.tipo === "ingreso" ? "↓" : "↑"}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-slate-900 dark:text-white">{m.descripcion || m.categoria}</p>
                  <p className="truncate text-[12px] text-slate-500 dark:text-slate-400">{m.categoria} · {fechaCorta(m.fecha)}</p>
                </div>
                <span className={`shrink-0 text-[13.5px] font-semibold tabular-nums ${m.tipo === "ingreso" ? "text-emerald-700 dark:text-emerald-400" : "text-slate-900 dark:text-white"}`}>{m.tipo === "ingreso" ? "+" : "−"}{montoTexto(m.monto, m.moneda)}</span>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      {nuevo && <NuevoMovimiento tipoInicial={nuevo} hoy={hoy} miId={miId} onClose={() => setNuevo(null)} onGuardado={(m) => { setMovs((prev) => [m, ...prev]); setMes(m.fecha.slice(0, 7)); setNuevo(null); }} />}
    </div>
  );
}

function Balance({ titulo, icono, fondo, t, moneda }: { titulo: string; icono: string; fondo: string; t: { ingresos: number; egresos: number; neto: number }; moneda: MonedaFin }) {
  const total = t.ingresos + t.egresos || 1;
  return (
    <div className="rounded-xl bg-white p-4 md:p-5 border border-[#E7E9EE] shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:bg-[#131316] dark:border-white/[0.08] min-w-0">
      <div className="flex items-center gap-3">
        <span className={`flex w-10 h-10 shrink-0 items-center justify-center rounded-lg ${fondo}`}>
          <IconoPanel src={icono} alt="" className="w-[22px] h-[22px]" />
        </span>
        <div className="min-w-0">
          <p className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400">{titulo} · resultado del mes</p>
          <p className={`text-[24px] font-semibold leading-tight tracking-tight tabular-nums whitespace-nowrap ${t.neto < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white"}`}>{montoTexto(t.neto, moneda)}</p>
        </div>
      </div>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
        <span style={{ width: `${(t.ingresos / total) * 100}%` }} className="bg-emerald-500" />
        <span style={{ width: `${(t.egresos / total) * 100}%` }} className="bg-rose-400" />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
        <p className="text-slate-500 dark:text-slate-400"><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5" />Entró <b className="block text-[13.5px] font-semibold text-slate-900 dark:text-white tabular-nums">{montoTexto(t.ingresos, moneda)}</b></p>
        <p className="text-slate-500 dark:text-slate-400"><span className="inline-block w-2 h-2 rounded-full bg-rose-400 mr-1.5" />Salió <b className="block text-[13.5px] font-semibold text-slate-900 dark:text-white tabular-nums">{montoTexto(t.egresos, moneda)}</b></p>
      </div>
    </div>
  );
}

/** Barras dobles por mes: lo que entró (verde) y lo que salió (rosa), con el resultado abajo. */
function Grafico({ meses, moneda }: { meses: { mes: string; etiqueta: string; USD: { ingresos: number; egresos: number; neto: number }; ARS: { ingresos: number; egresos: number; neto: number } }[]; moneda: MonedaFin }) {
  const max = Math.max(1, ...meses.flatMap((m) => [m[moneda].ingresos, m[moneda].egresos]));
  const corto = (n: number) => (Math.abs(n) >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(".", ",")} M` : Math.abs(n) >= 1000 ? `${Math.round(n / 1000)} mil` : `${Math.round(n)}`);
  return (
    <div className="px-4 pt-5 pb-4 md:px-5">
      <div className="flex h-[180px] items-end gap-3 md:gap-5" role="img" aria-label={`Entró y salió por mes en ${moneda === "USD" ? "dólares" : "pesos"}`}>
        {meses.map((m, i) => (
          <div key={m.mes} className="flex flex-1 flex-col items-center gap-1.5 h-full justify-end">
            <div className="flex items-end gap-1 h-full w-full justify-center">
              <span className="w-1/3 max-w-[18px] rounded-t-[4px] bg-emerald-500" style={{ height: `${Math.max(2, (m[moneda].ingresos / max) * 100)}%`, opacity: i === meses.length - 1 ? 1 : 0.75 }} title={`Entró ${montoTexto(m[moneda].ingresos, moneda)}`} />
              <span className="w-1/3 max-w-[18px] rounded-t-[4px] bg-rose-400" style={{ height: `${Math.max(2, (m[moneda].egresos / max) * 100)}%`, opacity: i === meses.length - 1 ? 1 : 0.75 }} title={`Salió ${montoTexto(m[moneda].egresos, moneda)}`} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-3 md:gap-5 border-t border-slate-100 pt-2 dark:border-white/[0.06]">
        {meses.map((m) => (
          <div key={m.mes} className="flex-1 text-center">
            <p className="text-[11.5px] font-medium text-slate-500 dark:text-slate-400">{m.etiqueta}</p>
            <p className={`text-[11px] font-semibold tabular-nums ${m[moneda].neto < 0 ? "text-rose-600" : "text-slate-700 dark:text-slate-200"}`}>{m[moneda].neto < 0 ? "−" : ""}{corto(Math.abs(m[moneda].neto))}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 flex gap-4 text-[11.5px] text-slate-500 dark:text-slate-400"><span><span className="inline-block w-2 h-2 rounded-sm bg-emerald-500 mr-1.5" />Entró</span><span><span className="inline-block w-2 h-2 rounded-sm bg-rose-400 mr-1.5" />Salió</span><span>Abajo: resultado del mes</span></p>
    </div>
  );
}

function NuevoMovimiento({ tipoInicial, hoy, miId, onClose, onGuardado }: { tipoInicial: TipoMovimiento; hoy: string; miId: string; onClose: () => void; onGuardado: (m: Movimiento) => void }) {
  const [tipo, setTipo] = useState<TipoMovimiento>(tipoInicial);
  const lista = tipo === "egreso" ? CATEGORIAS_EGRESO : CATEGORIAS_INGRESO;
  const [categoria, setCategoria] = useState(lista[0]);
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState<MonedaFin>("ARS");
  const [fecha, setFecha] = useState(hoy);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(monto.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) { setError("Poné el monto."); return; }
    setGuardando(true);
    setError("");
    const { data, error: err } = await supabase2.from("movimientos").insert({
      tipo, categoria: categoria.trim().slice(0, 60) || "Otros", descripcion: descripcion.trim().slice(0, 200) || null, monto: n, moneda, fecha, creado_por: miId || null,
    }).select("id, fecha, tipo, categoria, descripcion, monto, moneda").single();
    if (err) { setGuardando(false); setError(`No se pudo guardar: ${err.message}`); return; }
    onGuardado(data as Movimiento);
  };

  return (
    <div className="im-overlay" role="dialog" aria-modal="true" aria-label={tipo === "egreso" ? "Cargar gasto" : "Cargar ingreso"} onClick={() => !guardando && onClose()}>
      <form className="im-modal" style={{ maxWidth: 480 }} onSubmit={guardar} onClick={(e) => e.stopPropagation()}>
        <div className="im-modal-h">
          <h2>{tipo === "egreso" ? "Cargar gasto" : "Cargar ingreso"}</h2>
          <button type="button" className="im-btn" onClick={onClose} aria-label="Cerrar"><X size={16} /></button>
        </div>
        <div className="im-modal-b">
          <div className="im-field full"><Segmento valor={tipo} opciones={[["egreso", "Gasto o pago"], ["ingreso", "Ingreso"]]} onCambio={(v) => { setTipo(v as TipoMovimiento); setCategoria((v === "egreso" ? CATEGORIAS_EGRESO : CATEGORIAS_INGRESO)[0]); }} etiqueta="Tipo" /></div>
          <div className="im-field full">
            <label htmlFor="mo-monto">Monto *</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input id="mo-monto" className="im-input" style={{ flex: 1, minWidth: 0 }} inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder={moneda === "USD" ? "600" : "450000"} autoFocus />
              <Segmento valor={moneda} opciones={[["ARS", "$"], ["USD", "USD"]]} onCambio={(v) => setMoneda(v as MonedaFin)} etiqueta="Moneda" />
            </div>
          </div>
          <div className="im-field"><label htmlFor="mo-cat">Categoría</label><select id="mo-cat" className="im-input" value={categoria} onChange={(e) => setCategoria(e.target.value)}>{lista.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div className="im-field"><label htmlFor="mo-fecha">Fecha</label><input id="mo-fecha" type="date" className="im-input" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value)} /></div>
          <div className="im-field full"><label htmlFor="mo-desc">Detalle</label><input id="mo-desc" className="im-input" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder={tipo === "egreso" ? "Alquiler de la oficina de noviembre" : "Tasación de un PH en Saavedra"} /></div>
          {error && <div className="im-error full" role="alert">{error}</div>}
        </div>
        <div className="im-modal-f">
          <button type="button" className="im-btn" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button type="submit" className="im-btn primary" disabled={guardando}>{guardando ? "Guardando..." : "Guardar"}</button>
        </div>
      </form>
    </div>
  );
}
