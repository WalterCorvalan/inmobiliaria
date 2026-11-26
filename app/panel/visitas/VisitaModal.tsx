"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { supabase2 } from "@/lib/supabase/client";
import { ESTADOS_VISITA, type EstadoVisita, type Visita } from "@/lib/visitas/visitas";

interface Opcion { id: string; nombre: string }
export interface PropiedadOpcion { id: string; codigo: string | null; titulo: string; barrio: string | null; estado: string }

const SELECT = "id, nombre_cliente, telefono_cliente, fecha_visita, horario_visita, sucursal, estado, vendedor_id, propiedad_id, propiedad_codigo, notas, canal_origen, created_at";

/** Alta y edición de una visita cargada a mano. Con `visita` edita; sin ella crea. */
export default function VisitaModal({ visita, fechaInicial, asesores, sucursales, propiedades, miId, onClose, onGuardada }: {
  visita: Visita | null; fechaInicial?: string; asesores: Opcion[]; sucursales: string[]; propiedades: PropiedadOpcion[]; miId: string;
  onClose: () => void; onGuardada: (v: Visita) => void;
}) {
  const edita = !!visita;
  const [nombre, setNombre] = useState(visita?.nombre_cliente ?? "");
  const [telefono, setTelefono] = useState(visita?.telefono_cliente === "sin dato" ? "" : visita?.telefono_cliente ?? "");
  const [fecha, setFecha] = useState(visita?.fecha_visita ?? fechaInicial ?? "");
  const [horario, setHorario] = useState(visita?.horario_visita ?? "");
  const [sucursal, setSucursal] = useState(visita?.sucursal ?? sucursales[0] ?? "Sin especificar");
  const [estado, setEstado] = useState<EstadoVisita>(visita?.estado ?? "Pendiente");
  const [vendedorId, setVendedorId] = useState(visita?.vendedor_id ?? miId);
  const [propiedadId, setPropiedadId] = useState(visita?.propiedad_id ?? "");
  const [notas, setNotas] = useState(visita?.notas ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) { setError("Completá el nombre del cliente."); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) { setError("Elegí la fecha."); return; }
    if (!horario.trim()) { setError("Completá el horario."); return; }
    setGuardando(true);
    setError("");
    const prop = propiedades.find((p) => p.id === propiedadId);
    const datos = {
      nombre_cliente: nombre.trim(), telefono_cliente: telefono.trim() || "sin dato", fecha_visita: fecha, horario_visita: horario.trim(),
      sucursal: sucursal || "Sin especificar", estado, vendedor_id: vendedorId || null,
      propiedad_id: propiedadId || null, propiedad_codigo: prop?.codigo ?? (propiedadId ? null : visita?.propiedad_codigo ?? null),
      notas: notas.trim() || null, updated_at: new Date().toISOString(),
    };
    const res = edita
      ? await supabase2.from("visitas").update(datos).eq("id", visita!.id).select(SELECT).single()
      : await supabase2.from("visitas").insert({ ...datos, creado_por: miId, canal_origen: "manual" }).select(SELECT).single();
    setGuardando(false);
    if (res.error) { setError(`No se pudo guardar: ${res.error.message}`); return; }
    onGuardada(res.data as Visita);
  };

  return (
    <div className="im-overlay" role="dialog" aria-modal="true" aria-label={edita ? "Editar visita" : "Nueva visita"} onClick={() => !guardando && onClose()}>
      <form className="im-modal" onSubmit={guardar} onClick={(e) => e.stopPropagation()}>
        <div className="im-modal-h">
          <h2>{edita ? "Editar visita" : "Nueva visita"}</h2>
          <button type="button" className="im-btn" onClick={onClose} aria-label="Cerrar"><X size={16} /></button>
        </div>
        <div className="im-modal-b">
          <div className="im-field"><label htmlFor="vi-nombre">Cliente *</label><input id="vi-nombre" className="im-input" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus /></div>
          <div className="im-field"><label htmlFor="vi-tel">Teléfono</label><input id="vi-tel" className="im-input" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="11 4444 5555" /></div>
          <div className="im-field"><label htmlFor="vi-fecha">Fecha *</label><input id="vi-fecha" type="date" className="im-input" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
          <div className="im-field"><label htmlFor="vi-hora">Horario *</label><input id="vi-hora" className="im-input" value={horario} onChange={(e) => setHorario(e.target.value)} placeholder="10:30" /></div>
          <div className="im-field full"><label htmlFor="vi-prop">Propiedad</label>
            <select id="vi-prop" className="im-input" value={propiedadId} onChange={(e) => setPropiedadId(e.target.value)}>
              <option value="">{visita?.propiedad_codigo && !visita.propiedad_id ? `Código ${visita.propiedad_codigo} (no encontrada)` : "Sin propiedad"}</option>
              {propiedades.map((p) => <option key={p.id} value={p.id}>{p.codigo ? `[${p.codigo}] ` : ""}{p.titulo}{p.barrio ? `, ${p.barrio}` : ""}{p.estado === "reservada" ? " (reservada)" : ""}</option>)}
            </select>
          </div>
          <div className="im-field"><label htmlFor="vi-suc">Oficina</label>
            <select id="vi-suc" className="im-input" value={sucursal} onChange={(e) => setSucursal(e.target.value)}>
              <option value="Sin especificar">Sin especificar</option>
              {sucursales.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="im-field"><label htmlFor="vi-asesor">Asesor</label>
            <select id="vi-asesor" className="im-input" value={vendedorId} onChange={(e) => setVendedorId(e.target.value)}>
              <option value="">Sin asignar</option>
              {asesores.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </div>
          <div className="im-field"><label htmlFor="vi-estado">Estado</label>
            <select id="vi-estado" className="im-input" value={estado} onChange={(e) => setEstado(e.target.value as EstadoVisita)}>{ESTADOS_VISITA.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          </div>
          <div className="im-field full"><label htmlFor="vi-notas">Notas</label><textarea id="vi-notas" className="im-input" rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Llave en portería, viene con su pareja..." /></div>
          {error && <div className="im-error" role="alert">{error}</div>}
        </div>
        <div className="im-modal-f">
          <button type="button" className="im-btn" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button type="submit" className="im-btn primary" disabled={guardando}>{guardando ? "Guardando..." : edita ? "Guardar cambios" : "Agendar visita"}</button>
        </div>
      </form>
    </div>
  );
}
