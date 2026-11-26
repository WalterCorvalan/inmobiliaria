"use client";

import { useState } from "react";
import { Plus, UserRound } from "lucide-react";
import { supabase2 } from "@/lib/supabase/client";
import TabsConfiguracion from "@/components/inmo/TabsConfiguracion";
import { ROLES_EQUIPO, ROL_LABEL, type RolEquipo } from "@/lib/panel/equipo";

export interface Persona { id: string; nombre: string; roles: string[]; sucursal_id: string | null; whatsapp: string | null; activo: boolean }
interface Opcion { id: string; nombre: string }

const rolPrincipal = (roles: string[]): RolEquipo => (roles.includes("admin") ? "admin" : roles.includes("encargado") ? "encargado" : "ventas");

export default function EquipoClient({ iniciales, sucursales, miId, aviso }: { iniciales: Persona[]; sucursales: Opcion[]; miId: string; aviso: string | null }) {
  const [lista, setLista] = useState(iniciales);
  const [alta, setAlta] = useState<{ nombre: string; email: string; rol: RolEquipo; sucursal_id: string; whatsapp: string } | null>(null);
  const [clave, setClave] = useState<{ email: string; clave: string } | null>(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const actualizar = async (p: Persona, cambio: Partial<Persona>) => {
    setError("");
    const { error: err } = await supabase2.from("perfiles").update(cambio).eq("id", p.id);
    if (err) { setError(`No se pudo guardar: ${err.message}`); return; }
    setLista((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...cambio } : x)));
  };

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alta) return;
    setGuardando(true);
    setError("");
    const res = await fetch("/api/panel/equipo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...alta, sucursal_id: alta.sucursal_id || null }) });
    const json = await res.json().catch(() => ({}));
    setGuardando(false);
    if (!res.ok) { setError(json.error || "No se pudo crear."); return; }
    setLista((prev) => [...prev, json.perfil as Persona].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    setClave({ email: alta.email, clave: json.claveTemporal });
    setAlta(null);
  };

  return (
    <div className="im-page">
      <div className="im-head">
        <div><h1>Configuración</h1><p>Las personas que usan el panel. Los asesores reciben los leads por turno en su oficina.</p></div>
        <div className="im-actions"><button type="button" className="im-btn primary" onClick={() => { setError(""); setAlta({ nombre: "", email: "", rol: "ventas", sucursal_id: sucursales[0]?.id ?? "", whatsapp: "" }); }}><Plus size={16} />Sumar persona</button></div>
      </div>
      <TabsConfiguracion activa="/panel/configuracion" />
      {aviso && <div className="im-error" role="alert">{aviso}</div>}
      {error && !alta && <div className="im-error" role="alert">{error}</div>}
      {clave && (
        <div className="im-box" role="status">
          <strong>Listo. Pasale estos datos a la persona (la clave no se vuelve a mostrar):</strong>
          <p style={{ margin: "6px 0 0" }}>Entra en <code>{typeof window !== "undefined" ? `${window.location.origin}/panel/login` : "/panel/login"}</code> con <strong>{clave.email}</strong> y la clave <code style={{ fontSize: 16 }}>{clave.clave}</code></p>
          <button type="button" className="im-btn" style={{ marginTop: 8 }} onClick={() => setClave(null)}>Ya la pasé</button>
        </div>
      )}

      <div className="im-box">
        <div className="im-box-h"><h2>Equipo</h2><span className="im-note">{lista.filter((p) => p.activo).length} activos</span></div>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
          {lista.map((p) => (
            <li key={p.id} className="im-card" style={{ padding: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", opacity: p.activo ? 1 : 0.6 }}>
              <UserRound size={18} aria-hidden />
              <strong style={{ flex: "1 1 160px" }}>{p.nombre}{p.id === miId ? " (vos)" : ""}</strong>
              <select className="im-input" style={{ width: "auto" }} aria-label={`Rol de ${p.nombre}`} value={rolPrincipal(p.roles)} disabled={p.id === miId}
                onChange={(e) => actualizar(p, { roles: [e.target.value] })}>
                {ROLES_EQUIPO.map((r) => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
              </select>
              {sucursales.length > 0 && (
                <select className="im-input" style={{ width: "auto" }} aria-label={`Oficina de ${p.nombre}`} value={p.sucursal_id ?? ""} onChange={(e) => actualizar(p, { sucursal_id: e.target.value || null })}>
                  <option value="">Sin oficina</option>
                  {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              )}
              {p.id !== miId && <button type="button" className="im-btn" onClick={() => actualizar(p, { activo: !p.activo })}>{p.activo ? "Dar de baja" : "Reactivar"}</button>}
            </li>
          ))}
        </ul>
      </div>

      {alta && (
        <div className="im-overlay" role="dialog" aria-modal="true" aria-label="Sumar persona" onClick={() => !guardando && setAlta(null)}>
          <form className="im-modal" onSubmit={crear} onClick={(e) => e.stopPropagation()}>
            <div className="im-modal-h"><h2>Sumar persona</h2></div>
            <div className="im-modal-b">
              <div className="im-field"><label htmlFor="eq-nombre">Nombre *</label><input id="eq-nombre" className="im-input" value={alta.nombre} onChange={(e) => setAlta({ ...alta, nombre: e.target.value })} autoFocus /></div>
              <div className="im-field"><label htmlFor="eq-email">Email *</label><input id="eq-email" type="email" className="im-input" value={alta.email} onChange={(e) => setAlta({ ...alta, email: e.target.value })} /></div>
              <div className="im-field"><label htmlFor="eq-rol">Rol</label><select id="eq-rol" className="im-input" value={alta.rol} onChange={(e) => setAlta({ ...alta, rol: e.target.value as RolEquipo })}>{ROLES_EQUIPO.map((r) => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}</select></div>
              {sucursales.length > 0 && <div className="im-field"><label htmlFor="eq-suc">Oficina</label><select id="eq-suc" className="im-input" value={alta.sucursal_id} onChange={(e) => setAlta({ ...alta, sucursal_id: e.target.value })}><option value="">Sin oficina</option>{sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></div>}
              <div className="im-field"><label htmlFor="eq-wa">WhatsApp (para los avisos)</label><input id="eq-wa" className="im-input" inputMode="tel" value={alta.whatsapp} onChange={(e) => setAlta({ ...alta, whatsapp: e.target.value })} /></div>
              {error && <div className="im-error" role="alert">{error}</div>}
            </div>
            <div className="im-modal-f">
              <button type="button" className="im-btn" onClick={() => setAlta(null)} disabled={guardando}>Cancelar</button>
              <button type="submit" className="im-btn primary" disabled={guardando}>{guardando ? "Creando..." : "Crear acceso"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
