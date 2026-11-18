"use client";

import { useState } from "react";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { supabase2 } from "@/lib/supabase/client";
import TabsConfiguracion from "@/components/inmo/TabsConfiguracion";
import { DIAS_CORTOS, slugDeNombre, textoHorario } from "@/lib/panel/oficinas";

export interface Oficina {
  id: string; nombre: string; slug: string | null; direccion: string | null; telefono_encargado: string | null; encargado_nombre: string | null;
  google_maps_url: string | null; horario_texto: string | null; horario_dia_desde: number; horario_dia_hasta: number; horario_hora_desde: number; horario_hora_hasta: number;
}

const NUEVA: Omit<Oficina, "id"> = {
  nombre: "", slug: "", direccion: "", telefono_encargado: "", encargado_nombre: "", google_maps_url: "", horario_texto: "",
  horario_dia_desde: 1, horario_dia_hasta: 5, horario_hora_desde: 9, horario_hora_hasta: 18,
};
const SELECT = "id, nombre, slug, direccion, telefono_encargado, encargado_nombre, google_maps_url, horario_texto, horario_dia_desde, horario_dia_hasta, horario_hora_desde, horario_hora_hasta";

export default function OficinasClient({ iniciales, aviso }: { iniciales: Oficina[]; aviso: string | null }) {
  const [lista, setLista] = useState(iniciales);
  const [editando, setEditando] = useState<(Omit<Oficina, "id"> & { id?: string }) | null>(null);
  const [borrar, setBorrar] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editando) return;
    if (!editando.nombre.trim()) { setError("Completá el nombre de la oficina."); return; }
    setGuardando(true);
    setError("");
    const horarioAuto = textoHorario({ diaDesde: editando.horario_dia_desde, diaHasta: editando.horario_dia_hasta, horaDesde: editando.horario_hora_desde, horaHasta: editando.horario_hora_hasta });
    const fila = {
      nombre: editando.nombre.trim(), slug: (editando.slug || "").trim() || slugDeNombre(editando.nombre),
      direccion: editando.direccion?.trim() || null, telefono_encargado: editando.telefono_encargado?.trim() || null,
      encargado_nombre: editando.encargado_nombre?.trim() || null, google_maps_url: editando.google_maps_url?.trim() || null,
      horario_texto: editando.horario_texto?.trim() || horarioAuto,
      horario_dia_desde: editando.horario_dia_desde, horario_dia_hasta: editando.horario_dia_hasta,
      horario_hora_desde: editando.horario_hora_desde, horario_hora_hasta: editando.horario_hora_hasta,
    };
    const res = editando.id
      ? await supabase2.from("sucursales").update(fila).eq("id", editando.id).select(SELECT).single()
      : await supabase2.from("sucursales").insert(fila).select(SELECT).single();
    setGuardando(false);
    if (res.error) { setError(res.error.message.includes("duplicate") ? "Ya hay una oficina con ese nombre o identificador." : `No se pudo guardar: ${res.error.message}`); return; }
    const o = res.data as Oficina;
    setLista((prev) => (prev.some((x) => x.id === o.id) ? prev.map((x) => (x.id === o.id ? o : x)) : [...prev, o]).sort((a, b) => a.nombre.localeCompare(b.nombre)));
    setEditando(null);
  };

  const confirmarBorrado = async (id: string) => {
    const { error: err } = await supabase2.from("sucursales").delete().eq("id", id);
    setBorrar(null);
    if (err) { setError(`No se pudo borrar (puede tener asesores o leads asignados): ${err.message}`); return; }
    setLista((prev) => prev.filter((x) => x.id !== id));
  };

  const num = (k: keyof Oficina, v: string) => setEditando((x) => (x ? { ...x, [k]: Number(v) } : x));
  const txt = (k: keyof Oficina, v: string) => setEditando((x) => (x ? { ...x, [k]: v } : x));

  return (
    <div className="im-page">
      <div className="im-head">
        <div><h1>Configuración</h1><p>Tus oficinas: el bot da su dirección y horario, y reparte los leads entre los asesores de cada una.</p></div>
        <div className="im-actions"><button type="button" className="im-btn primary" onClick={() => { setError(""); setEditando({ ...NUEVA }); }}><Plus size={16} />Nueva oficina</button></div>
      </div>
      <TabsConfiguracion activa="/panel/configuracion/sucursales" />
      {aviso && <div className="im-error" role="alert">{aviso}</div>}
      {error && !editando && <div className="im-error" role="alert">{error}</div>}

      <div className="im-box">
        <div className="im-box-h"><h2>Oficinas</h2><span className="im-note">{lista.length}</span></div>
        {lista.length === 0 ? (
          <div className="im-vacio"><h3>Todavía no cargaste oficinas</h3><p>Con una alcanza. Si tenés varias, el bot le dice a cada cliente cuál le queda más cerca.</p></div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
            {lista.map((o) => (
              <li key={o.id} className="im-card" style={{ padding: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <MapPin size={18} aria-hidden />
                <div style={{ flex: "1 1 220px" }}>
                  <strong>{o.nombre}</strong>
                  <div className="im-note">{[o.direccion, o.horario_texto, o.encargado_nombre ? `Encargado: ${o.encargado_nombre}` : null].filter(Boolean).join(" · ") || "Sin datos"}</div>
                </div>
                <button type="button" className="im-btn" onClick={() => { setError(""); setEditando({ ...o }); }}>Editar</button>
                {borrar === o.id
                  ? <button type="button" className="im-btn" onClick={() => confirmarBorrado(o.id)}>¿Seguro? Borrar</button>
                  : <button type="button" className="im-btn" onClick={() => setBorrar(o.id)} aria-label={`Borrar ${o.nombre}`}><Trash2 size={15} /></button>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {editando && (
        <div className="im-overlay" role="dialog" aria-modal="true" aria-label={editando.id ? "Editar oficina" : "Nueva oficina"} onClick={() => !guardando && setEditando(null)}>
          <form className="im-modal" onSubmit={guardar} onClick={(e) => e.stopPropagation()}>
            <div className="im-modal-h"><h2>{editando.id ? "Editar oficina" : "Nueva oficina"}</h2></div>
            <div className="im-modal-b">
              <div className="im-field"><label htmlFor="of-nombre">Nombre *</label><input id="of-nombre" className="im-input" value={editando.nombre} onChange={(e) => txt("nombre", e.target.value)} placeholder="Belgrano" autoFocus /></div>
              <div className="im-field"><label htmlFor="of-dir">Dirección</label><input id="of-dir" className="im-input" value={editando.direccion ?? ""} onChange={(e) => txt("direccion", e.target.value)} placeholder="Av. Cabildo 2300" /></div>
              <div className="im-field"><label htmlFor="of-enc">Encargado</label><input id="of-enc" className="im-input" value={editando.encargado_nombre ?? ""} onChange={(e) => txt("encargado_nombre", e.target.value)} /></div>
              <div className="im-field"><label htmlFor="of-tel">WhatsApp del encargado</label><input id="of-tel" className="im-input" inputMode="tel" value={editando.telefono_encargado ?? ""} onChange={(e) => txt("telefono_encargado", e.target.value)} placeholder="11 4444 5555" /></div>
              <div className="im-field"><label htmlFor="of-dd">Atiende de</label><select id="of-dd" className="im-input" value={editando.horario_dia_desde} onChange={(e) => num("horario_dia_desde", e.target.value)}>{DIAS_CORTOS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></div>
              <div className="im-field"><label htmlFor="of-dh">a</label><select id="of-dh" className="im-input" value={editando.horario_dia_hasta} onChange={(e) => num("horario_dia_hasta", e.target.value)}>{DIAS_CORTOS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></div>
              <div className="im-field"><label htmlFor="of-hd">Desde las</label><input id="of-hd" type="number" min={0} max={23.5} step={0.5} className="im-input" value={editando.horario_hora_desde} onChange={(e) => num("horario_hora_desde", e.target.value)} /></div>
              <div className="im-field"><label htmlFor="of-hh">Hasta las</label><input id="of-hh" type="number" min={0} max={24} step={0.5} className="im-input" value={editando.horario_hora_hasta} onChange={(e) => num("horario_hora_hasta", e.target.value)} /></div>
              <div className="im-field full"><label htmlFor="of-ht">Horario como lo dice el bot (opcional, si hay sábados u otro horario)</label><input id="of-ht" className="im-input" value={editando.horario_texto ?? ""} onChange={(e) => txt("horario_texto", e.target.value)} placeholder="lunes a viernes de 9 a 18 y sábados de 9 a 13" /></div>
              <div className="im-field full"><label htmlFor="of-maps">Link de Google Maps (opcional)</label><input id="of-maps" className="im-input" value={editando.google_maps_url ?? ""} onChange={(e) => txt("google_maps_url", e.target.value)} placeholder="https://maps.app.goo.gl/..." /></div>
              {error && <div className="im-error" role="alert">{error}</div>}
            </div>
            <div className="im-modal-f">
              <button type="button" className="im-btn" onClick={() => setEditando(null)} disabled={guardando}>Cancelar</button>
              <button type="submit" className="im-btn primary" disabled={guardando}>{guardando ? "Guardando..." : "Guardar"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
