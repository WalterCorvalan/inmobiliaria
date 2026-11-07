"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { supabase2 } from "@/lib/supabase/client";
import {
  ESTADOS, ESTADO_LABEL, MONEDAS, OPERACIONES, OPERACION_LABEL, TIPOS, TIPO_LABEL, fotoPortada,
  type EstadoPropiedad, type Moneda, type Operacion, type Propiedad, type TipoPropiedad,
} from "@/lib/propiedades/propiedades";

interface Opcion { id: string; nombre: string }

const SELECT = "*, propiedad_fotos ( id, url, orden, es_portada )";
const aNumero = (v: string): number | null => {
  const n = Number(v.replace(",", ".").trim());
  return v.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : null;
};
const aEntero = (v: string): number | null => { const n = aNumero(v); return n === null ? null : Math.round(n); };
const texto = (v: string): string | null => (v.trim() === "" ? null : v.trim());

/** Alta y edición de una propiedad. Con `propiedad` edita; sin ella crea. */
export default function PropiedadModal({ propiedad, sucursales, asesores, miId, onClose, onGuardada }: {
  propiedad: Propiedad | null; sucursales: Opcion[]; asesores: Opcion[]; miId: string; onClose: () => void; onGuardada: (p: Propiedad) => void;
}) {
  const edita = !!propiedad;
  const [titulo, setTitulo] = useState(propiedad?.titulo ?? "");
  const [codigo, setCodigo] = useState(propiedad?.codigo ?? "");
  const [tipo, setTipo] = useState<TipoPropiedad>(propiedad?.tipo ?? "departamento");
  const [operacion, setOperacion] = useState<Operacion>(propiedad?.operacion ?? "venta");
  const [estado, setEstado] = useState<EstadoPropiedad>(propiedad?.estado ?? "disponible");
  const [precio, setPrecio] = useState(propiedad?.precio != null ? String(propiedad.precio) : "");
  const [moneda, setMoneda] = useState<Moneda>(propiedad?.moneda ?? "USD");
  const [direccion, setDireccion] = useState(propiedad?.direccion ?? "");
  const [barrio, setBarrio] = useState(propiedad?.barrio ?? "");
  const [ambientes, setAmbientes] = useState(propiedad?.ambientes != null ? String(propiedad.ambientes) : "");
  const [banos, setBanos] = useState(propiedad?.banos != null ? String(propiedad.banos) : "");
  const [cocheras, setCocheras] = useState(propiedad?.cocheras != null ? String(propiedad.cocheras) : "");
  const [m2Cubiertos, setM2Cubiertos] = useState(propiedad?.superficie_cubierta != null ? String(propiedad.superficie_cubierta) : "");
  const [m2Totales, setM2Totales] = useState(propiedad?.superficie_total != null ? String(propiedad.superficie_total) : "");
  const [asesorId, setAsesorId] = useState(propiedad?.asesor_id ?? miId);
  const [sucursalId, setSucursalId] = useState(propiedad?.sucursal_id ?? "");
  const [descripcion, setDescripcion] = useState(propiedad?.descripcion ?? "");
  const [foto, setFoto] = useState(propiedad ? fotoPortada(propiedad) ?? "" : "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) { setError("Completá el título."); return; }
    if (foto.trim() && !/^https?:\/\//i.test(foto.trim())) { setError("La foto tiene que ser una dirección web que empiece con http:// o https://."); return; }
    setGuardando(true);
    setError("");
    try {
      const datos = {
        titulo: titulo.trim(), codigo: texto(codigo), tipo, operacion, estado, precio: aNumero(precio), moneda,
        direccion: texto(direccion), barrio: texto(barrio), ambientes: aEntero(ambientes), banos: aEntero(banos), cocheras: aEntero(cocheras),
        superficie_cubierta: aNumero(m2Cubiertos), superficie_total: aNumero(m2Totales), descripcion: texto(descripcion),
        asesor_id: asesorId || null, sucursal_id: sucursalId || null, updated_at: new Date().toISOString(),
      };
      let id = propiedad?.id ?? "";
      if (edita) {
        const { error: err } = await supabase2.from("propiedades").update(datos).eq("id", id);
        if (err) throw err;
      } else {
        const { data, error: err } = await supabase2.from("propiedades").insert({ ...datos, creado_por: miId }).select("id").single();
        if (err) throw err;
        id = data.id;
      }
      const urlNueva = foto.trim();
      const portadaActual = propiedad?.propiedad_fotos?.find((f) => f.es_portada) ?? propiedad?.propiedad_fotos?.[0];
      if (urlNueva && urlNueva !== portadaActual?.url) {
        const { error: errFoto } = portadaActual
          ? await supabase2.from("propiedad_fotos").update({ url: urlNueva }).eq("id", portadaActual.id)
          : await supabase2.from("propiedad_fotos").insert({ propiedad_id: id, url: urlNueva, orden: 0, es_portada: true });
        if (errFoto) throw errFoto;
      } else if (!urlNueva && portadaActual) {
        const { error: errFoto } = await supabase2.from("propiedad_fotos").delete().eq("id", portadaActual.id);
        if (errFoto) throw errFoto;
      }
      const { data: guardada, error: errLeer } = await supabase2.from("propiedades").select(SELECT).eq("id", id).single();
      if (errLeer) throw errLeer;
      onGuardada(guardada as Propiedad);
    } catch (err) {
      console.error(err);
      const mensaje = (err as { message?: string })?.message;
      setError(mensaje ? `No se pudo guardar: ${mensaje}` : "No se pudo guardar la propiedad.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="im-overlay" role="dialog" aria-modal="true" aria-label={edita ? "Editar propiedad" : "Nueva propiedad"} onClick={() => !guardando && onClose()}>
      <form className="im-modal" onSubmit={guardar} onClick={(e) => e.stopPropagation()}>
        <div className="im-modal-h">
          <h2>{edita ? "Editar propiedad" : "Nueva propiedad"}</h2>
          <button type="button" className="im-btn" onClick={onClose} aria-label="Cerrar"><X size={16} /></button>
        </div>
        <div className="im-modal-b">
          <div className="im-field full"><label htmlFor="pr-titulo">Título *</label><input id="pr-titulo" className="im-input" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Depto 2 amb. con balcón" autoFocus /></div>
          <div className="im-field"><label htmlFor="pr-tipo">Tipo</label><select id="pr-tipo" className="im-input" value={tipo} onChange={(e) => setTipo(e.target.value as TipoPropiedad)}>{TIPOS.map((t) => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}</select></div>
          <div className="im-field"><label htmlFor="pr-op">Operación</label><select id="pr-op" className="im-input" value={operacion} onChange={(e) => setOperacion(e.target.value as Operacion)}>{OPERACIONES.map((o) => <option key={o} value={o}>{OPERACION_LABEL[o]}</option>)}</select></div>
          <div className="im-field"><label htmlFor="pr-precio">Precio{operacion === "alquiler" ? " por mes" : ""}</label><input id="pr-precio" className="im-input" inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="148000" /></div>
          <div className="im-field"><label htmlFor="pr-moneda">Moneda</label><select id="pr-moneda" className="im-input" value={moneda} onChange={(e) => setMoneda(e.target.value as Moneda)}>{MONEDAS.map((m) => <option key={m} value={m}>{m === "USD" ? "Dólares (USD)" : "Pesos ($)"}</option>)}</select></div>
          <div className="im-field"><label htmlFor="pr-dir">Dirección</label><input id="pr-dir" className="im-input" value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Honduras 4800" /></div>
          <div className="im-field"><label htmlFor="pr-barrio">Barrio</label><input id="pr-barrio" className="im-input" value={barrio} onChange={(e) => setBarrio(e.target.value)} placeholder="Palermo" /></div>
          <div className="im-field"><label htmlFor="pr-amb">Ambientes</label><input id="pr-amb" className="im-input" inputMode="numeric" value={ambientes} onChange={(e) => setAmbientes(e.target.value)} /></div>
          <div className="im-field"><label htmlFor="pr-banos">Baños</label><input id="pr-banos" className="im-input" inputMode="numeric" value={banos} onChange={(e) => setBanos(e.target.value)} /></div>
          <div className="im-field"><label htmlFor="pr-coch">Cocheras</label><input id="pr-coch" className="im-input" inputMode="numeric" value={cocheras} onChange={(e) => setCocheras(e.target.value)} /></div>
          <div className="im-field"><label htmlFor="pr-m2c">Metros cubiertos</label><input id="pr-m2c" className="im-input" inputMode="decimal" value={m2Cubiertos} onChange={(e) => setM2Cubiertos(e.target.value)} /></div>
          <div className="im-field"><label htmlFor="pr-m2t">Metros totales</label><input id="pr-m2t" className="im-input" inputMode="decimal" value={m2Totales} onChange={(e) => setM2Totales(e.target.value)} /></div>
          <div className="im-field"><label htmlFor="pr-cod">Código interno</label><input id="pr-cod" className="im-input" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="PAL-014" /></div>
          <div className="im-field"><label htmlFor="pr-estado">Estado</label><select id="pr-estado" className="im-input" value={estado} onChange={(e) => setEstado(e.target.value as EstadoPropiedad)}>{ESTADOS.map((s) => <option key={s} value={s}>{ESTADO_LABEL[s]}</option>)}</select></div>
          <div className="im-field"><label htmlFor="pr-asesor">Asesor</label><select id="pr-asesor" className="im-input" value={asesorId} onChange={(e) => setAsesorId(e.target.value)}><option value="">Sin asignar</option>{asesores.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></div>
          {sucursales.length > 0 && (
            <div className="im-field"><label htmlFor="pr-suc">Oficina</label><select id="pr-suc" className="im-input" value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}><option value="">Sin oficina</option>{sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></div>
          )}
          <div className="im-field full"><label htmlFor="pr-foto">Foto de portada (dirección de la imagen)</label><input id="pr-foto" className="im-input" value={foto} onChange={(e) => setFoto(e.target.value)} placeholder="https://..." /></div>
          <div className="im-field full"><label htmlFor="pr-desc">Descripción</label><textarea id="pr-desc" className="im-input" rows={3} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} /></div>
          {error && <div className="im-error" role="alert">{error}</div>}
        </div>
        <div className="im-modal-f">
          <button type="button" className="im-btn" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button type="submit" className="im-btn primary" disabled={guardando}>{guardando ? "Guardando..." : edita ? "Guardar cambios" : "Crear propiedad"}</button>
        </div>
      </form>
    </div>
  );
}
