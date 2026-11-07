"use client";

import { useMemo, useState } from "react";
import { Building2, CalendarClock, Home, Key, Plus, Search } from "lucide-react";
import KpiFila from "@/components/inmo/KpiFila";
import PropiedadCard from "@/components/inmo/PropiedadCard";
import PropiedadModal from "./PropiedadModal";
import {
  ESTADO_LABEL, ESTADOS, OPERACIONES, OPERACION_LABEL, TIPOS, TIPO_PLURAL, contarPorTipo, filtrarPropiedades, resumenCartera,
  type EstadoPropiedad, type Operacion, type Propiedad, type TipoPropiedad,
} from "@/lib/propiedades/propiedades";

interface Opcion { id: string; nombre: string }

export default function PropiedadesClient({ iniciales, sucursales, asesores, miId, aviso }: {
  iniciales: Propiedad[]; sucursales: Opcion[]; asesores: Opcion[]; miId: string; aviso: string | null;
}) {
  const [lista, setLista] = useState<Propiedad[]>(iniciales);
  const [tipo, setTipo] = useState<TipoPropiedad | "todas">("todas");
  const [operacion, setOperacion] = useState<Operacion | "todas">("todas");
  const [estado, setEstado] = useState<EstadoPropiedad | "todas">("todas");
  const [textoBusqueda, setTextoBusqueda] = useState("");
  const [modal, setModal] = useState<{ propiedad: Propiedad | null } | null>(null);

  const conteo = useMemo(() => contarPorTipo(lista), [lista]);
  const resumen = useMemo(() => resumenCartera(lista), [lista]);
  const visibles = useMemo(() => filtrarPropiedades(lista, { tipo, operacion, estado, texto: textoBusqueda }), [lista, tipo, operacion, estado, textoBusqueda]);
  // Solo se muestran las pestañas de los tipos que hay, para que no aparezcan "Terrenos 0" en una inmobiliaria que no los tiene.
  const tiposConDatos = TIPOS.filter((t) => conteo[t] > 0);

  const guardada = (p: Propiedad) => {
    setLista((prev) => (prev.some((x) => x.id === p.id) ? prev.map((x) => (x.id === p.id ? p : x)) : [p, ...prev]));
    setModal(null);
  };

  return (
    <div className="im-page">
      <div className="im-head">
        <div>
          <h1>Propiedades</h1>
          <p>Tu cartera de venta y alquiler, con foto y precio a mano.</p>
        </div>
        <div className="im-actions">
          <button type="button" className="im-btn primary" onClick={() => setModal({ propiedad: null })}><Plus size={16} />Nueva propiedad</button>
        </div>
      </div>

      {aviso && <div className="im-error" role="alert">{aviso}</div>}

      <KpiFila datos={[
        { icono: <Building2 size={15} />, titulo: "Propiedades", valor: resumen.total, nota: "en tu cartera" },
        { icono: <Home size={15} />, titulo: "Disponibles", valor: resumen.disponibles, etiqueta: resumen.reservadas ? `${resumen.reservadas} reservadas` : undefined, nota: "para mostrar hoy" },
        { icono: <Key size={15} />, titulo: "En venta", valor: resumen.enVenta, nota: "activas" },
        { icono: <CalendarClock size={15} />, titulo: "En alquiler", valor: resumen.enAlquiler, nota: "activas" },
      ]} />

      <div className="im-box">
        <div className="im-box-h">
          <h2>Mis propiedades</h2>
          <span className="im-note">{visibles.length} de {lista.length}</span>
        </div>
        <div className="im-tabs" role="tablist" aria-label="Tipo de propiedad">
          <button type="button" role="tab" className="im-tab" aria-selected={tipo === "todas"} onClick={() => setTipo("todas")}>Todas <i>{lista.length}</i></button>
          {tiposConDatos.map((t) => (
            <button key={t} type="button" role="tab" className="im-tab" aria-selected={tipo === t} onClick={() => setTipo(t)}>{TIPO_PLURAL[t]} <i>{conteo[t]}</i></button>
          ))}
        </div>
        <div className="im-toolbar">
          <label className="im-search"><Search size={15} /><input type="search" aria-label="Buscar propiedad" placeholder="Buscar por título, barrio o código" value={textoBusqueda} onChange={(e) => setTextoBusqueda(e.target.value)} /></label>
          <div className="im-chips" role="group" aria-label="Operación">
            <button type="button" className="im-chip" aria-pressed={operacion === "todas"} onClick={() => setOperacion("todas")}>Venta y alquiler</button>
            {OPERACIONES.map((o) => <button key={o} type="button" className="im-chip" aria-pressed={operacion === o} onClick={() => setOperacion(o)}>{OPERACION_LABEL[o]}</button>)}
          </div>
          <div className="im-chips" role="group" aria-label="Estado">
            <button type="button" className="im-chip" aria-pressed={estado === "todas"} onClick={() => setEstado("todas")}>Todos los estados</button>
            {ESTADOS.map((s) => <button key={s} type="button" className="im-chip" aria-pressed={estado === s} onClick={() => setEstado(s)}>{ESTADO_LABEL[s]}</button>)}
          </div>
        </div>

        {visibles.length > 0 ? (
          <div className="im-grid">
            {visibles.map((p) => <PropiedadCard key={p.id} propiedad={p} onAbrir={(x) => setModal({ propiedad: x })} />)}
          </div>
        ) : lista.length === 0 ? (
          <div className="im-vacio">
            <h3>Todavía no cargaste propiedades</h3>
            <p>Cargá la primera con su precio, ubicación y una foto. Después vas a poder ver cuántas consultas recibe cada una.</p>
            <button type="button" className="im-btn primary" onClick={() => setModal({ propiedad: null })}><Plus size={16} />Cargar la primera propiedad</button>
          </div>
        ) : (
          <div className="im-vacio"><h3>Ninguna propiedad coincide</h3><p>Probá con otro tipo, estado o búsqueda.</p></div>
        )}
      </div>

      {modal && <PropiedadModal propiedad={modal.propiedad} sucursales={sucursales} asesores={asesores} miId={miId} onClose={() => setModal(null)} onGuardada={guardada} />}
    </div>
  );
}
