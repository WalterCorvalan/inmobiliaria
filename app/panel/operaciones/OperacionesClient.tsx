"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { supabase2 } from "@/lib/supabase/client";
import Segmento from "@/components/inmo/Segmento";
import { Cifra, FONDOS, Pestanas, Pill, Tarjeta, Vacio } from "@/components/inmo/PlataUI";
import { montoTexto, porMes, rangoDelMes, type MonedaFin } from "@/lib/finanzas/finanzas";
import { HONORARIOS_SUGERIDOS, PARTE_ASESOR_SUGERIDA, rankingAsesores, repartoHonorarios, resumenOperaciones, type OperacionCerrada, type TipoOperacion } from "@/lib/finanzas/operaciones";
import { CATEGORIA_OPERACION } from "@/lib/finanzas/categorias";
import { sumarDiasISO } from "@/lib/panel/inicio";
import type { Propiedad } from "@/lib/propiedades/propiedades";
import type { Reserva } from "../reservas/ReservasClient";

interface Opcion { id: string; nombre: string }
type Filtro = "mes" | "trimestre" | "ventas" | "alquileres" | "todo";
const fechaCorta = (f: string) => new Date(`${f}T12:00:00Z`).toLocaleDateString("es-AR", { day: "numeric", month: "short", timeZone: "UTC" }).replace(".", "");

export default function OperacionesClient({ iniciales, propiedades, asesores, reservas, reservaInicial, miId, hoy, veFinanzas, aviso }: {
  iniciales: OperacionCerrada[]; propiedades: Propiedad[]; asesores: Opcion[]; reservas: Reserva[]; reservaInicial: string | null; miId: string; hoy: string; veFinanzas: boolean; aviso: string | null;
}) {
  const [lista, setLista] = useState(iniciales);
  const [props, setProps] = useState(propiedades);
  const [filtro, setFiltro] = useState<Filtro>("mes");
  const reserva = reservas.find((r) => r.id === reservaInicial) ?? null;
  const [nueva, setNueva] = useState(!!reserva);
  const asesor = (id: string | null) => asesores.find((v) => v.id === id)?.nombre ?? "Sin asesor";

  const mes = rangoDelMes(hoy);
  const visibles = lista.filter((o) =>
    filtro === "mes" ? o.fecha >= mes.desde : filtro === "trimestre" ? o.fecha >= sumarDiasISO(hoy, -90) : filtro === "ventas" ? o.tipo === "venta" : filtro === "alquileres" ? o.tipo === "alquiler" : true);
  const delMes = resumenOperaciones(lista, mes.desde, mes.hasta);
  const misDelMes = lista.filter((o) => o.fecha >= mes.desde && o.asesor_id === miId);
  const miParte = misDelMes.reduce((acc, o) => { acc[o.moneda] += repartoHonorarios(o).asesor; return acc; }, { USD: 0, ARS: 0 } as Record<MonedaFin, number>);
  const porMesCant = useMemo(() => porMes(lista.map((o) => ({ id: o.id, fecha: o.fecha, tipo: "ingreso" as const, categoria: "", descripcion: null, monto: 1, moneda: "USD" as const })), hoy, 6).map((m) => m.USD.ingresos), [lista, hoy]);
  const ranking = rankingAsesores(lista.filter((o) => o.fecha >= sumarDiasISO(hoy, -90))).slice(0, 5);
  const maxRank = Math.max(1, ...ranking.map((x) => x.cantidad));

  return (
    <div className="im-page">
      <div className="im-head">
        <div><h1>Operaciones cerradas</h1><p>Cada venta y alquiler cerrado, con los honorarios y la parte de cada asesor.</p></div>
        <div className="im-actions"><button type="button" className="im-btn primary" onClick={() => setNueva(true)}>+ Cerrar operación</button></div>
      </div>
      {aviso && <div className="im-error" role="alert">{aviso}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cifra icono="/icons/panel/ventas.png" fondo={FONDOS.azul} titulo="Operaciones este mes" valor={delMes.cantidad} detalle={`${delMes.ventas} ${delMes.ventas === 1 ? "venta" : "ventas"} · ${delMes.alquileres} ${delMes.alquileres === 1 ? "alquiler" : "alquileres"}`} extra={<Barritas valores={porMesCant} />} />
        <Cifra icono="/icons/panel/tesoreria.png" fondo={FONDOS.verde} titulo="Honorarios en USD (mes)" valor={montoTexto(delMes.honorarios.USD, "USD")} detalle="Sobre todo de ventas" />
        <Cifra icono="/icons/panel/cobros.png" fondo={FONDOS.violeta} titulo="Honorarios en $ (mes)" valor={montoTexto(delMes.honorarios.ARS, "ARS")} detalle="Sobre todo de alquileres" />
        {veFinanzas ? (
          <Cifra icono="/icons/panel/finanzas.png" fondo={FONDOS.ambar} titulo="Queda para la inmobiliaria" valor={montoTexto(delMes.paraLaInmobiliaria.USD, "USD")} tono="ok"
            detalle={`y ${montoTexto(delMes.paraLaInmobiliaria.ARS, "ARS")}, sin la parte de los asesores`} />
        ) : (
          <Cifra icono="/icons/panel/comisiones.png" fondo={FONDOS.ambar} titulo="Tu parte este mes" valor={montoTexto(miParte.USD, "USD")} tono="ok" detalle={`y ${montoTexto(miParte.ARS, "ARS")} · ${misDelMes.length} operaciones`} />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Tarjeta titulo="Operaciones" icono="/icons/panel/ventas.png" extra={<span className="text-[12px] text-slate-500 dark:text-slate-400 tabular-nums">{visibles.length}</span>}>
          <Pestanas<Filtro> valor={filtro} onCambio={setFiltro} etiqueta="Filtrar operaciones" opciones={[
            { id: "mes", texto: "Este mes" }, { id: "trimestre", texto: "Últimos 3 meses" }, { id: "ventas", texto: "Ventas" }, { id: "alquileres", texto: "Alquileres" }, { id: "todo", texto: "Todas" },
          ]} />
          {visibles.length === 0 ? (
            <Vacio titulo="Sin operaciones acá" texto="Cuando cierres una venta o un alquiler, cargalo con “Cerrar operación”. La propiedad cambia de estado y los honorarios entran solos en Finanzas." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-[13px]">
                <thead>
                  <tr className="text-left text-[11.5px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <th className="px-4 md:px-5 py-2.5 font-semibold">Propiedad y cliente</th>
                    <th className="px-3 py-2.5 font-semibold">Fecha</th>
                    <th className="px-3 py-2.5 font-semibold">Tipo</th>
                    <th className="px-3 py-2.5 font-semibold">Asesor</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Valor</th>
                    <th className="px-4 md:px-5 py-2.5 font-semibold text-right">Honorarios</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06] border-t border-slate-100 dark:border-white/[0.06]">
                  {visibles.map((o) => {
                    const h = repartoHonorarios(o);
                    return (
                      <tr key={o.id} className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02]">
                        <td className="px-4 md:px-5 py-3"><p className="font-semibold text-slate-900 dark:text-white">{o.propiedad_descripcion ?? "Propiedad"}</p><p className="text-[12px] text-slate-500 dark:text-slate-400">{o.cliente_nombre}</p></td>
                        <td className="px-3 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">{fechaCorta(o.fecha)}</td>
                        <td className="px-3 py-3"><Pill color={o.tipo === "venta" ? "azul" : "verde"}>{o.tipo === "venta" ? "Venta" : "Alquiler"}</Pill></td>
                        <td className="px-3 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">{asesor(o.asesor_id)}</td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums whitespace-nowrap text-slate-900 dark:text-white">{montoTexto(o.valor, o.moneda)}{o.tipo === "alquiler" && <span className="text-[11px] font-normal text-slate-400"> /mes</span>}</td>
                        <td className="px-4 md:px-5 py-3 text-right whitespace-nowrap">
                          <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{montoTexto(h.total, o.moneda)}</span>
                          {h.asesor > 0 && <span className="block text-[11.5px] text-slate-400 tabular-nums">asesor {montoTexto(h.asesor, o.moneda)}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Tarjeta>

        <Tarjeta titulo="Quién cerró más" icono="/icons/panel/comisiones.png" extra={<span className="text-[12px] text-slate-500 dark:text-slate-400">3 meses</span>}>
          {ranking.length === 0 ? <Vacio titulo="Todavía nadie" texto="Acá aparece el ranking de asesores." /> : (
            <ul className="px-4 py-4 md:px-5 space-y-3">
              {ranking.map((x, i) => (
                <li key={x.asesor_id ?? "nadie"}>
                  <div className="flex justify-between text-[13px]"><span className="font-medium text-slate-700 dark:text-slate-200">{i === 0 ? "🥇 " : ""}{asesor(x.asesor_id)}</span><span className="tabular-nums text-slate-500">{x.cantidad}</span></div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(x.cantidad / maxRank) * 100}%`, background: `color-mix(in srgb, var(--marca) ${100 - i * 15}%, white)` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>

      {nueva && (
        <NuevaOperacion props={props.filter((p) => p.estado === "disponible" || p.estado === "reservada")} asesores={asesores} reserva={reserva} miId={miId} hoy={hoy}
          onClose={() => setNueva(false)}
          onGuardada={(o) => {
            setLista((prev) => [o, ...prev]);
            setProps((prev) => prev.map((p) => (p.id === o.propiedad_id ? { ...p, estado: o.tipo === "venta" ? "vendida" : "alquilada" } : p)));
            setFiltro("mes");
            setNueva(false);
          }} />
      )}
    </div>
  );
}

function Barritas({ valores }: { valores: number[] }) {
  const max = Math.max(1, ...valores);
  return (
    <span className="flex items-end gap-[3px] h-6" role="img" aria-label={`Operaciones por mes: ${valores.join(", ")}`}>
      {valores.map((v, i) => <span key={i} className="w-[7px] rounded-[2px]" style={{ height: `${Math.max(3, (v / max) * 24)}px`, background: "var(--marca)", opacity: i === valores.length - 1 ? 1 : 0.35 }} />)}
    </span>
  );
}

const aNumero = (v: string): number | null => {
  const n = Number(v.replace(/\./g, "").replace(",", ".").trim());
  return v.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : null;
};

function NuevaOperacion({ props, asesores, reserva, miId, hoy, onClose, onGuardada }: {
  props: Propiedad[]; asesores: Opcion[]; reserva: Reserva | null; miId: string; hoy: string; onClose: () => void; onGuardada: (o: OperacionCerrada) => void;
}) {
  const propReserva = props.find((p) => p.id === reserva?.propiedad_id);
  const [propiedadId, setPropiedadId] = useState(propReserva?.id ?? "");
  const elegida = props.find((p) => p.id === propiedadId);
  const [tipo, setTipo] = useState<TipoOperacion>(propReserva?.operacion ?? "venta");
  const [cliente, setCliente] = useState(reserva?.cliente_nombre ?? "");
  const [telefono, setTelefono] = useState(reserva?.cliente_telefono ?? "");
  const [fecha, setFecha] = useState(hoy);
  const [valor, setValor] = useState(propReserva?.precio != null ? String(propReserva.precio) : "");
  const [moneda, setMoneda] = useState<MonedaFin>(propReserva?.moneda ?? "USD");
  const [pct, setPct] = useState(String(HONORARIOS_SUGERIDOS[propReserva?.operacion ?? "venta"]));
  const [asesorId, setAsesorId] = useState(reserva?.asesor_id ?? miId);
  const [asesorPct, setAsesorPct] = useState(String(PARTE_ASESOR_SUGERIDA));
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const vista = repartoHonorarios({ valor: aNumero(valor) ?? 0, honorarios_pct: aNumero(pct), honorarios_monto: null, asesor_pct: aNumero(asesorPct) });

  const elegir = (id: string) => {
    setPropiedadId(id);
    const p = props.find((x) => x.id === id);
    if (!p) return;
    if (p.precio != null) { setValor(String(p.precio)); setMoneda(p.moneda); }
    setTipo(p.operacion);
    setPct(String(HONORARIOS_SUGERIDOS[p.operacion]));
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = aNumero(valor);
    if (!propiedadId) { setError("Elegí la propiedad."); return; }
    if (!cliente.trim()) { setError(tipo === "venta" ? "Completá el nombre del comprador." : "Completá el nombre del inquilino."); return; }
    if (v === null || v <= 0) { setError(tipo === "venta" ? "Poné el precio de venta." : "Poné el alquiler mensual."); return; }
    setGuardando(true);
    setError("");
    const fila = {
      tipo, propiedad_id: propiedadId, propiedad_descripcion: elegida ? `${elegida.titulo}${elegida.barrio ? `, ${elegida.barrio}` : ""}` : null,
      reserva_id: reserva && reserva.propiedad_id === propiedadId ? reserva.id : null, cliente_nombre: cliente.trim().slice(0, 120), cliente_telefono: telefono.trim() || null,
      fecha, valor: v, moneda, honorarios_pct: aNumero(pct), honorarios_monto: null, asesor_id: asesorId || null, asesor_pct: aNumero(asesorPct), notas: notas.trim().slice(0, 500) || null,
    };
    const { data, error: err } = await supabase2.from("operaciones").insert(fila).select("*").single();
    if (err) { setGuardando(false); setError(`No se pudo guardar: ${err.message}`); return; }
    const op = data as OperacionCerrada;
    const h = repartoHonorarios(op);
    // Lo que acompaña al cierre: la propiedad cambia de estado, la reserva se cierra y los honorarios entran en Finanzas.
    await Promise.all([
      supabase2.from("propiedades").update({ estado: tipo === "venta" ? "vendida" : "alquilada" }).eq("id", propiedadId),
      fila.reserva_id ? supabase2.from("reservas").update({ estado: "convertida" }).eq("id", fila.reserva_id) : Promise.resolve(),
      h.total > 0 ? supabase2.from("movimientos").insert({ fecha, tipo: "ingreso", categoria: CATEGORIA_OPERACION[tipo], descripcion: `${fila.propiedad_descripcion ?? "Propiedad"} (${fila.cliente_nombre})`, monto: h.total, moneda, operacion_id: op.id, creado_por: miId || null }) : Promise.resolve(),
    ]);
    onGuardada(op);
  };

  return (
    <div className="im-overlay" role="dialog" aria-modal="true" aria-label="Cerrar operación" onClick={() => !guardando && onClose()}>
      <form className="im-modal" onSubmit={guardar} onClick={(e) => e.stopPropagation()}>
        <div className="im-modal-h">
          <div><h2>Cerrar operación</h2><p className="im-modal-sub">{reserva ? `Viene de la reserva de ${reserva.cliente_nombre}.` : "La propiedad pasa a Vendida o Alquilada y los honorarios entran en Finanzas."}</p></div>
          <button type="button" className="im-btn" onClick={onClose} aria-label="Cerrar"><X size={16} /></button>
        </div>
        <div className="im-modal-b">
          <div className="im-field full"><label htmlFor="op-prop">Propiedad *</label>
            <select id="op-prop" className="im-input" value={propiedadId} onChange={(e) => elegir(e.target.value)} autoFocus={!reserva}>
              <option value="">Elegí la propiedad</option>
              {props.map((p) => <option key={p.id} value={p.id}>{p.titulo}{p.barrio ? ` · ${p.barrio}` : ""}{p.estado === "reservada" ? " (reservada)" : ""}</option>)}
            </select>
          </div>
          <div className="im-field full"><span className="im-label">Operación</span>
            <Segmento valor={tipo} opciones={[["venta", "Venta"], ["alquiler", "Alquiler"]]} onCambio={(v) => { setTipo(v as TipoOperacion); setPct(String(HONORARIOS_SUGERIDOS[v as TipoOperacion])); }} etiqueta="Tipo de operación" />
          </div>
          <div className="im-field"><label htmlFor="op-cli">{tipo === "venta" ? "Comprador *" : "Inquilino *"}</label><input id="op-cli" className="im-input" value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nombre y apellido" /></div>
          <div className="im-field"><label htmlFor="op-tel">WhatsApp</label><input id="op-tel" className="im-input" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="11 5555 0000" /></div>
          <div className="im-field full">
            <label htmlFor="op-valor">{tipo === "venta" ? "Precio de venta *" : "Alquiler mensual *"}</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input id="op-valor" className="im-input" style={{ flex: 1, minWidth: 0 }} inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder={tipo === "venta" ? "148000" : "650000"} />
              <Segmento valor={moneda} opciones={[["USD", "USD"], ["ARS", "$"]]} onCambio={(v) => setMoneda(v as MonedaFin)} etiqueta="Moneda" />
            </div>
          </div>
          <div className="im-field"><label htmlFor="op-pct">Honorarios (%)</label><input id="op-pct" className="im-input" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} />{tipo === "alquiler" && <span className="im-note" style={{ fontSize: 11.5 }}>100% = un mes de alquiler</span>}</div>
          <div className="im-field"><label htmlFor="op-ase">Asesor</label><select id="op-ase" className="im-input" value={asesorId} onChange={(e) => setAsesorId(e.target.value)}><option value="">Sin asignar</option>{asesores.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></div>
          <div className="im-field full rounded-lg bg-slate-50 dark:bg-white/5 px-3 py-2.5 text-[13px] text-slate-600 dark:text-slate-300">
            Honorarios: <b className="text-slate-900 dark:text-white tabular-nums">{montoTexto(vista.total, moneda)}</b>
            {vista.asesor > 0 && <> · al asesor <b className="tabular-nums">{montoTexto(vista.asesor, moneda)}</b> · queda <b className="text-emerald-700 dark:text-emerald-400 tabular-nums">{montoTexto(vista.inmobiliaria, moneda)}</b></>}
          </div>
          <details className="im-field full im-mas">
            <summary>Más datos <span>(opcional: fecha, parte del asesor y notas)</span></summary>
            <div className="im-modal-b" style={{ padding: "12px 0 0" }}>
              <div className="im-field"><label htmlFor="op-fecha">Fecha</label><input id="op-fecha" type="date" className="im-input" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value)} /></div>
              <div className="im-field"><label htmlFor="op-apct">Parte del asesor (% de los honorarios)</label><input id="op-apct" className="im-input" inputMode="decimal" value={asesorPct} onChange={(e) => setAsesorPct(e.target.value)} /></div>
              <div className="im-field full"><label htmlFor="op-notas">Notas</label><input id="op-notas" className="im-input" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder={tipo === "venta" ? "Escritura con el escribano Pérez el 15/12" : "Contrato a 3 años, ajuste cada 6 meses"} /></div>
            </div>
          </details>
          {error && <div className="im-error full" role="alert">{error}</div>}
        </div>
        <div className="im-modal-f">
          <button type="button" className="im-btn" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button type="submit" className="im-btn primary" disabled={guardando}>{guardando ? "Guardando..." : "Cerrar operación"}</button>
        </div>
      </form>
    </div>
  );
}
