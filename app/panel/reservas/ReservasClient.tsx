"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { supabase2 } from "@/lib/supabase/client";
import FotoPropiedad from "@/components/inmo/FotoPropiedad";
import Segmento from "@/components/inmo/Segmento";
import IconoPanel from "@/components/panel/IconoPanel";
import { Cifra, FONDOS, Pestanas, Pill, Tarjeta, Vacio } from "@/components/inmo/PlataUI";
import { diasParaVencer, estadoVisible, montoTexto, totalVigente, type EstadoSena, type EstadoSenaVisible, type MonedaFin } from "@/lib/finanzas/finanzas";
import { sumarDiasISO } from "@/lib/panel/inicio";
import type { Propiedad } from "@/lib/propiedades/propiedades";

export interface Reserva {
  id: string; propiedad_id: string | null; cliente_nombre: string; cliente_telefono: string | null; monto: number; moneda: MonedaFin;
  fecha: string; vence_el: string | null; estado: EstadoSena; asesor_id: string | null; notas: string | null;
}
interface Opcion { id: string; nombre: string }
type Pestana = "vigentes" | "vencidas" | "convertidas" | "cerradas" | "todas";

const ESTADO: Record<EstadoSenaVisible, { texto: string; color: "verde" | "ambar" | "rojo" | "azul" | "gris" }> = {
  vigente: { texto: "Vigente", color: "verde" }, vencida: { texto: "Vencida", color: "rojo" }, convertida: { texto: "Se cerró", color: "azul" },
  devuelta: { texto: "Devuelta", color: "gris" }, perdida: { texto: "Se perdió", color: "ambar" },
};
const fechaCorta = (f: string) => new Date(`${f}T12:00:00Z`).toLocaleDateString("es-AR", { day: "numeric", month: "short", timeZone: "UTC" }).replace(".", "");

export default function ReservasClient({ iniciales, propiedades, asesores, miId, hoy, aviso }: { iniciales: Reserva[]; propiedades: Propiedad[]; asesores: Opcion[]; miId: string; hoy: string; aviso: string | null }) {
  const [lista, setLista] = useState(iniciales);
  const [props, setProps] = useState(propiedades);
  const [pestana, setPestana] = useState<Pestana>("vigentes");
  const [nueva, setNueva] = useState(false);
  const [error, setError] = useState("");
  const prop = (id: string | null) => props.find((v) => v.id === id) ?? null;
  const asesor = (id: string | null) => asesores.find((v) => v.id === id)?.nombre ?? "Sin asesor";

  const conEstado = useMemo(() => lista.map((s) => ({ ...s, visible: estadoVisible(s, hoy) })), [lista, hoy]);
  const retenido = totalVigente(lista);
  const vigentes = conEstado.filter((s) => s.visible === "vigente");
  const vencidas = conEstado.filter((s) => s.visible === "vencida");
  const convertidas = conEstado.filter((s) => s.visible === "convertida");
  const cerradas = conEstado.filter((s) => s.visible === "devuelta" || s.visible === "perdida");
  const visibles = { vigentes, vencidas, convertidas, cerradas, todas: conEstado }[pestana];

  const cambiarEstado = async (s: Reserva, estado: EstadoSena) => {
    setError("");
    const { error: err } = await supabase2.from("reservas").update({ estado, updated_at: new Date().toISOString() }).eq("id", s.id);
    if (err) { setError(`No se pudo cambiar: ${err.message}`); return; }
    setLista((prev) => prev.map((x) => (x.id === s.id ? { ...x, estado } : x)));
    // Si se devolvió o se perdió, la propiedad vuelve a estar disponible.
    const a = prop(s.propiedad_id);
    if (a && a.estado === "reservada" && (estado === "devuelta" || estado === "perdida")) {
      await supabase2.from("propiedades").update({ estado: "disponible" }).eq("id", a.id);
      setProps((prev) => prev.map((v) => (v.id === a.id ? { ...v, estado: "disponible" } : v)));
    }
  };

  return (
    <div className="im-page">
      <div className="im-head">
        <div><h1>Reservas</h1><p>La plata que dejó cada cliente para reservar una propiedad, cuándo vence y en qué terminó.</p></div>
        <div className="im-actions"><button type="button" className="im-btn primary" onClick={() => { setError(""); setNueva(true); }}>+ Nueva reserva</button></div>
      </div>
      {aviso && <div className="im-error" role="alert">{aviso}</div>}
      {error && <div className="im-error" role="alert">{error}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cifra icono="/icons/panel/senas.png" fondo={FONDOS.azul} titulo="Reservas sin cerrar" valor={vigentes.length + vencidas.length} detalle={`${convertidas.length} ya se cerraron`} />
        <Cifra icono="/icons/panel/tesoreria.png" fondo={FONDOS.verde} titulo="Retenido en dólares" valor={montoTexto(retenido.USD, "USD")} detalle="Plata de reservas sin cerrar" />
        <Cifra icono="/icons/panel/cobros.png" fondo={FONDOS.violeta} titulo="Retenido en pesos" valor={montoTexto(retenido.ARS, "ARS")} detalle="Plata de reservas sin cerrar" />
        <Cifra icono="/icons/panel/alertas.png" fondo={FONDOS.rosa} titulo="Vencidas sin cerrar" valor={vencidas.length} tono={vencidas.length ? "mal" : undefined} detalle={vencidas.length ? "Llamá a esos clientes" : "Todo al día"} />
      </div>

      <Tarjeta titulo="Reservas" icono="/icons/panel/senas.png">
        <Pestanas<Pestana> valor={pestana} onCambio={setPestana} etiqueta="Estado de la reserva" opciones={[
          { id: "vigentes", texto: "Vigentes", n: vigentes.length }, { id: "vencidas", texto: "Vencidas", n: vencidas.length },
          { id: "convertidas", texto: "Se cerraron", n: convertidas.length }, { id: "cerradas", texto: "Devueltas o perdidas", n: cerradas.length },
          { id: "todas", texto: "Todas", n: conEstado.length },
        ]} />
        {visibles.length === 0 ? (
          <Vacio titulo="No hay reservas acá" texto={pestana === "vencidas" ? "Ninguna reserva está vencida. Bien ahí." : "Cuando un cliente deje plata para reservar una propiedad, cargala con “Nueva reserva” y la propiedad pasa a Reservada."} />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-white/[0.06]">
            {visibles.map((s) => {
              const a = prop(s.propiedad_id);
              const dias = diasParaVencer(s.vence_el, hoy);
              const e = ESTADO[s.visible];
              const abierta = s.estado === "vigente";
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:px-5">
                  <div className="w-[72px] shrink-0 overflow-hidden rounded-lg [&_.im-photo]:aspect-[4/3]">{a ? <FotoPropiedad propiedad={a} sinCartel /> : <div className="aspect-[4/3] bg-slate-100 dark:bg-white/5" />}</div>
                  <div className="min-w-0 flex-1 basis-[200px]">
                    <p className="truncate text-[13.5px] font-semibold text-slate-900 dark:text-white">{a ? a.titulo : "Propiedad sin cargar"}{a?.codigo && <span className="ml-1.5 text-[11.5px] font-medium text-slate-400">{a.codigo}</span>}</p>
                    <p className="truncate text-[12.5px] text-slate-500 dark:text-slate-400">{s.cliente_nombre} · {asesor(s.asesor_id)}{a?.barrio ? ` · ${a.barrio}` : ""}</p>
                  </div>
                  <div className="w-[120px] shrink-0">
                    <p className="text-[14px] font-semibold tabular-nums text-slate-900 dark:text-white">{montoTexto(s.monto, s.moneda)}</p>
                    <p className="text-[11.5px] text-slate-500 dark:text-slate-400">el {fechaCorta(s.fecha)}</p>
                  </div>
                  <div className="w-[130px] shrink-0 text-[12px]">
                    <Pill color={e.color}>{e.texto}</Pill>
                    {abierta && dias !== null && <p className={`mt-1 ${dias < 0 ? "text-rose-600 dark:text-rose-400 font-medium" : dias <= 2 ? "text-amber-700 dark:text-amber-400" : "text-slate-500 dark:text-slate-400"}`}>{dias < 0 ? `Venció hace ${-dias} ${-dias === 1 ? "día" : "días"}` : dias === 0 ? "Vence hoy" : `Vence en ${dias} ${dias === 1 ? "día" : "días"}`}</p>}
                  </div>
                  <div className="flex flex-wrap gap-1.5 md:ml-auto">
                    {abierta && <Link href={`/panel/operaciones?reserva=${s.id}`} className="im-btn primary" style={{ height: 30, fontSize: 12.5 }}>Cerrar operación</Link>}
                    {s.cliente_telefono && (
                      <a href={`https://wa.me/${s.cliente_telefono.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="im-btn" style={{ height: 30, fontSize: 12.5 }}>
                        <IconoPanel src="/icons/panel/whatsapp.png" alt="" className="w-3.5 h-3.5" />WhatsApp
                      </a>
                    )}
                    {abierta && <button type="button" className="im-btn" style={{ height: 30, fontSize: 12.5 }} onClick={() => cambiarEstado(s, "devuelta")}>Devolver</button>}
                    {abierta && <button type="button" className="im-btn" style={{ height: 30, fontSize: 12.5 }} onClick={() => cambiarEstado(s, "perdida")} title="El cliente no volvió y la reserva queda para la inmobiliaria">Se perdió</button>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Tarjeta>

      {nueva && (
        <NuevaReserva props={props.filter((v) => v.estado === "disponible")} asesores={asesores} miId={miId} hoy={hoy} onClose={() => setNueva(false)}
          onGuardada={(s) => {
            setLista((prev) => [s, ...prev]);
            setProps((prev) => prev.map((v) => (v.id === s.propiedad_id ? { ...v, estado: "reservada" } : v)));
            setPestana("vigentes");
            setNueva(false);
          }} />
      )}
    </div>
  );
}

function NuevaReserva({ props, asesores, miId, hoy, onClose, onGuardada }: { props: Propiedad[]; asesores: Opcion[]; miId: string; hoy: string; onClose: () => void; onGuardada: (s: Reserva) => void }) {
  const [propiedadId, setPropiedadId] = useState("");
  const [cliente, setCliente] = useState("");
  const [telefono, setTelefono] = useState("");
  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState<MonedaFin>("USD");
  const [vence, setVence] = useState(sumarDiasISO(hoy, 7));
  const [asesorId, setAsesorId] = useState(miId);
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(monto.replace(/\./g, "").replace(",", "."));
    if (!propiedadId) { setError("Elegí la propiedad que se reserva."); return; }
    if (!cliente.trim()) { setError("Completá el nombre del cliente."); return; }
    if (!Number.isFinite(n) || n <= 0) { setError("Poné el monto de la reserva."); return; }
    setGuardando(true);
    setError("");
    const { data, error: err } = await supabase2.from("reservas").insert({
      propiedad_id: propiedadId, cliente_nombre: cliente.trim().slice(0, 120), cliente_telefono: telefono.trim() || null, monto: n, moneda,
      fecha: hoy, vence_el: vence || null, estado: "vigente", asesor_id: asesorId || null, notas: notas.trim().slice(0, 500) || null,
    }).select("*").single();
    if (err) { setGuardando(false); setError(`No se pudo guardar: ${err.message}`); return; }
    await supabase2.from("propiedades").update({ estado: "reservada" }).eq("id", propiedadId);
    onGuardada(data as Reserva);
  };

  return (
    <div className="im-overlay" role="dialog" aria-modal="true" aria-label="Nueva reserva" onClick={() => !guardando && onClose()}>
      <form className="im-modal" onSubmit={guardar} onClick={(e) => e.stopPropagation()}>
        <div className="im-modal-h">
          <div><h2>Nueva reserva</h2><p className="im-modal-sub">La propiedad pasa a “Reservada” y el bot deja de ofrecerla.</p></div>
          <button type="button" className="im-btn" onClick={onClose} aria-label="Cerrar"><X size={16} /></button>
        </div>
        <div className="im-modal-b">
          <div className="im-field full"><label htmlFor="se-auto">Propiedad *</label>
            <select id="se-auto" className="im-input" value={propiedadId} onChange={(e) => setPropiedadId(e.target.value)} autoFocus>
              <option value="">Elegí una propiedad disponible</option>
              {props.map((v) => <option key={v.id} value={v.id}>{v.titulo}{v.barrio ? ` · ${v.barrio}` : ""}{v.codigo ? ` · ${v.codigo}` : ""}</option>)}
            </select>
          </div>
          <div className="im-field"><label htmlFor="se-cli">Cliente *</label><input id="se-cli" className="im-input" value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nombre y apellido" /></div>
          <div className="im-field"><label htmlFor="se-tel">WhatsApp</label><input id="se-tel" className="im-input" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="11 5555 0000" /></div>
          <div className="im-field full">
            <label htmlFor="se-monto">Monto de la reserva *</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input id="se-monto" className="im-input" style={{ flex: 1, minWidth: 0 }} inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="5000" />
              <Segmento valor={moneda} opciones={[["USD", "USD"], ["ARS", "$"]]} onCambio={(v) => setMoneda(v as MonedaFin)} etiqueta="Moneda" />
            </div>
          </div>
          <div className="im-field"><label htmlFor="se-vence">Vence el</label><input id="se-vence" type="date" className="im-input" value={vence} min={hoy} onChange={(e) => setVence(e.target.value)} /></div>
          <div className="im-field"><label htmlFor="se-vend">Asesor</label><select id="se-vend" className="im-input" value={asesorId} onChange={(e) => setAsesorId(e.target.value)}><option value="">Sin asignar</option>{asesores.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}</select></div>
          <div className="im-field full"><label htmlFor="se-notas">Notas</label><input id="se-notas" className="im-input" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Firma el boleto el lunes con el escribano" /></div>
          {error && <div className="im-error full" role="alert">{error}</div>}
        </div>
        <div className="im-modal-f">
          <button type="button" className="im-btn" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button type="submit" className="im-btn primary" disabled={guardando}>{guardando ? "Guardando..." : "Guardar reserva"}</button>
        </div>
      </form>
    </div>
  );
}
