"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarCheck, CalendarClock, CalendarX, ChevronLeft, ChevronRight, MessageCircle, Plus, UserCheck } from "lucide-react";
import KpiFila from "@/components/inmo/KpiFila";
import { supabase2 } from "@/lib/supabase/client";
import {
  ESTADOS_VISITA, agruparPorDia, aFechaISO, desdeFechaISO, diasDeSemana, etiquetaDia, etiquetaSemana, filtrarVisitas, linkConfirmarPorWhatsapp,
  resumenVisitas, sumarDias, visitasEnConflicto, type EstadoVisita, type Visita,
} from "@/lib/visitas/visitas";
import VisitaModal, { type PropiedadOpcion } from "./VisitaModal";

interface Opcion { id: string; nombre: string }

export default function VisitasClient({ iniciales, lunesISO, asesores, sucursales, propiedades, negocio, miId, aviso }: {
  iniciales: Visita[]; lunesISO: string; asesores: Opcion[]; sucursales: string[]; propiedades: PropiedadOpcion[]; negocio: string; miId: string; aviso: string | null;
}) {
  const [lista, setLista] = useState<Visita[]>(iniciales);
  const [sucursal, setSucursal] = useState<string>("todas");
  const [vendedorId, setVendedorId] = useState<string>("todos");
  const [estado, setEstado] = useState<EstadoVisita | "todos">("todos");
  const [modal, setModal] = useState<{ visita: Visita | null; fecha?: string } | null>(null);
  const [error, setError] = useState("");

  const lunes = useMemo(() => desdeFechaISO(lunesISO), [lunesISO]);
  const dias = useMemo(() => diasDeSemana(desdeFechaISO(lunesISO)), [lunesISO]);
  const hoy = aFechaISO(new Date());
  const visibles = useMemo(() => filtrarVisitas(lista, { sucursal, vendedorId, estado }), [lista, sucursal, vendedorId, estado]);
  const porDia = useMemo(() => agruparPorDia(visibles, dias), [visibles, dias]);
  const conflictos = useMemo(() => visitasEnConflicto(lista), [lista]);
  const resumen = useMemo(() => resumenVisitas(lista), [lista]);
  const nombreAsesor = (id: string | null) => asesores.find((a) => a.id === id)?.nombre ?? "Sin asesor";
  const propiedad = (v: Visita) => propiedades.find((p) => p.id === v.propiedad_id) ?? (v.propiedad_codigo ? propiedades.find((p) => p.codigo?.toUpperCase() === v.propiedad_codigo?.toUpperCase()) : undefined);

  const cambiarEstado = async (v: Visita, nuevo: EstadoVisita) => {
    setError("");
    const anterior = v.estado;
    setLista((prev) => prev.map((x) => (x.id === v.id ? { ...x, estado: nuevo } : x)));
    const { error: err } = await supabase2.from("visitas").update({ estado: nuevo, updated_at: new Date().toISOString() }).eq("id", v.id);
    if (err) {
      setLista((prev) => prev.map((x) => (x.id === v.id ? { ...x, estado: anterior } : x)));
      setError(`No se pudo cambiar el estado: ${err.message}`);
    }
  };

  const guardada = (v: Visita) => {
    // Si se movió a otra semana, sale de esta vista.
    setLista((prev) => {
      const sin = prev.filter((x) => x.id !== v.id);
      return dias.includes(v.fecha_visita) ? [...sin, v] : sin;
    });
    setModal(null);
  };

  const semanaLink = (n: number) => `/panel/visitas?semana=${aFechaISO(sumarDias(lunes, n * 7))}`;

  return (
    <div className="im-page">
      <div className="im-head">
        <div>
          <h1>Visitas</h1>
          <p>La agenda de la semana: las que agenda el bot y las que cargás vos.</p>
        </div>
        <div className="im-actions">
          <button type="button" className="im-btn primary" onClick={() => setModal({ visita: null, fecha: dias.includes(hoy) ? hoy : dias[0] })}><Plus size={16} />Nueva visita</button>
        </div>
      </div>

      {aviso && <div className="im-error" role="alert">{aviso}</div>}
      {error && <div className="im-error" role="alert">{error}</div>}

      <KpiFila datos={[
        { icono: <CalendarClock size={15} />, titulo: "Esta semana", valor: resumen.total, nota: "visitas" },
        { icono: <CalendarClock size={15} />, titulo: "Por confirmar", valor: resumen.pendientes, etiqueta: conflictos.size ? `${conflictos.size} con choque` : undefined, nota: "pendientes" },
        { icono: <CalendarCheck size={15} />, titulo: "Confirmadas", valor: resumen.confirmadas, nota: "listas" },
        { icono: <UserCheck size={15} />, titulo: "Asistieron", valor: resumen.asistieron, etiqueta: resumen.canceladas ? `${resumen.canceladas} canceladas` : undefined, nota: "realizadas" },
      ]} />

      <div className="im-box">
        <div className="im-box-h">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link className="im-btn" href={semanaLink(-1)} aria-label="Semana anterior"><ChevronLeft size={16} /></Link>
            <h2 style={{ margin: 0 }}>{etiquetaSemana(lunes)}</h2>
            <Link className="im-btn" href={semanaLink(1)} aria-label="Semana siguiente"><ChevronRight size={16} /></Link>
            {!dias.includes(hoy) && <Link className="im-btn" href="/panel/visitas">Hoy</Link>}
          </div>
          <span className="im-note">{visibles.length} de {lista.length}</span>
        </div>
        <div className="im-toolbar">
          {sucursales.length > 1 && (
            <select className="im-input" aria-label="Oficina" value={sucursal} onChange={(e) => setSucursal(e.target.value)} style={{ maxWidth: 200 }}>
              <option value="todas">Todas las oficinas</option>
              {sucursales.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <select className="im-input" aria-label="Asesor" value={vendedorId} onChange={(e) => setVendedorId(e.target.value)} style={{ maxWidth: 200 }}>
            <option value="todos">Todos los asesores</option>
            <option value="sin">Sin asesor</option>
            {asesores.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
          <div className="im-chips" role="group" aria-label="Estado">
            <button type="button" className="im-chip" aria-pressed={estado === "todos"} onClick={() => setEstado("todos")}>Todas</button>
            {ESTADOS_VISITA.map((s) => <button key={s} type="button" className="im-chip" aria-pressed={estado === s} onClick={() => setEstado(s)}>{s}</button>)}
          </div>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          {porDia.map(({ fecha, visitas }) => (
            <section key={fecha} aria-label={etiquetaDia(fecha)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--im-line, #e7dfd3)", paddingBottom: 6, marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 15, textTransform: "capitalize", fontWeight: fecha === hoy ? 700 : 600 }}>{etiquetaDia(fecha)}{fecha === hoy ? " · hoy" : ""}</h3>
                <button type="button" className="im-btn" onClick={() => setModal({ visita: null, fecha })} aria-label={`Agregar visita el ${etiquetaDia(fecha)}`}><Plus size={14} /></button>
              </div>
              {visitas.length === 0 ? (
                <p className="im-note" style={{ margin: "4px 0 0" }}>Sin visitas.</p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
                  {visitas.map((v) => {
                    const p = propiedad(v);
                    const wa = linkConfirmarPorWhatsapp(v, negocio);
                    return (
                      <li key={v.id} className="im-card" style={{ padding: 12, opacity: v.estado === "Cancelada" ? 0.6 : 1 }}>
                        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                          <strong style={{ minWidth: 56, fontVariantNumeric: "tabular-nums" }}>{v.horario_visita}</strong>
                          <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                            <button type="button" onClick={() => setModal({ visita: v })} style={{ all: "unset", cursor: "pointer", fontWeight: 600 }}>{v.nombre_cliente}</button>
                            <div className="im-note">
                              {[v.telefono_cliente !== "sin dato" ? v.telefono_cliente : null, v.sucursal !== "Sin especificar" ? v.sucursal : null, nombreAsesor(v.vendedor_id)].filter(Boolean).join(" · ")}
                            </div>
                            {(p || v.propiedad_codigo) && <div className="im-note">🏠 {p ? `${p.codigo ? `[${p.codigo}] ` : ""}${p.titulo}${p.barrio ? `, ${p.barrio}` : ""}` : `Código ${v.propiedad_codigo}`}</div>}
                            {v.notas && <div className="im-note" style={{ whiteSpace: "pre-wrap" }}>{v.notas}</div>}
                            {conflictos.has(v.id) && <div className="im-error" style={{ marginTop: 6, padding: "4px 8px" }}><AlertTriangle size={13} /> Otra visita en la misma oficina y horario: reagendá una.</div>}
                          </div>
                          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                            {wa && v.estado === "Pendiente" && <a className="im-btn" href={wa} target="_blank" rel="noreferrer" title="Confirmar por WhatsApp"><MessageCircle size={14} />Confirmar</a>}
                            <select className="im-input" aria-label={`Estado de la visita de ${v.nombre_cliente}`} value={v.estado} onChange={(e) => cambiarEstado(v, e.target.value as EstadoVisita)} style={{ width: "auto" }}>
                              {ESTADOS_VISITA.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                            {v.estado !== "Cancelada" && <button type="button" className="im-btn" onClick={() => cambiarEstado(v, "Cancelada")} title="Cancelar visita" aria-label={`Cancelar la visita de ${v.nombre_cliente}`}><CalendarX size={14} /></button>}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>

      {modal && (
        <VisitaModal visita={modal.visita} fechaInicial={modal.fecha} asesores={asesores} sucursales={sucursales} propiedades={propiedades} miId={miId}
          onClose={() => setModal(null)} onGuardada={guardada} />
      )}
    </div>
  );
}
