"use client";

import { useEffect, useState } from "react";
import { Copy, Sparkles } from "lucide-react";
import { supabase2 } from "@/lib/supabase/client";
import TabsConfiguracion from "@/components/inmo/TabsConfiguracion";
import { codigoParaPegar } from "@/lib/chatWeb/codigoParaPegar";
import { memoriaQueFalta } from "@/lib/panel/memoriaInicial";

// Datos de la empresa que usan el panel, el bot y el chat de la web. Una fila por empresa en configuracion_empresa.
const CAMPOS = [
  { k: "branding_nombre", label: "Nombre comercial *", ph: "Propiedades del Sur", full: false },
  { k: "branding_telefono", label: "Teléfono", ph: "11 4444 5555", full: false },
  { k: "branding_email", label: "Email", ph: "hola@inmobiliaria.com", full: false },
  { k: "branding_web", label: "Sitio web", ph: "https://...", full: false },
  { k: "branding_domicilio", label: "Dirección principal", ph: "Av. Cabildo 2300, Belgrano", full: true },
  { k: "redes_whatsapp", label: "WhatsApp (para los botones)", ph: "5491144445555", full: false },
  { k: "redes_instagram", label: "Instagram", ph: "@inmobiliaria", full: false },
  { k: "redes_facebook", label: "Facebook", ph: "facebook.com/...", full: false },
  { k: "branding_logo_url", label: "Logo (dirección de la imagen)", ph: "https://...", full: false },
] as const;
type Clave = (typeof CAMPOS)[number]["k"] | "branding_color_primario" | "bot_descripcion";
type Datos = Record<Clave, string>;
const VACIO = Object.fromEntries([...CAMPOS.map((c) => c.k), "branding_color_primario", "bot_descripcion"].map((k) => [k, ""])) as Datos;

export default function ConfiguracionEmpresaClient() {
  const [datos, setDatos] = useState<Datos>(VACIO);
  const [empresa, setEmpresa] = useState<{ id: string; slug: string } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: id }, { data: cfg }] = await Promise.all([
        supabase2.rpc("mi_empresa_id"),
        supabase2.from("configuracion_empresa").select("*").maybeSingle(),
      ]);
      if (typeof id === "string") {
        const { data: e } = await supabase2.from("empresas").select("id, slug, nombre").eq("id", id).maybeSingle();
        if (e) setEmpresa({ id: e.id, slug: e.slug });
        if (!cfg && e) setDatos((d) => ({ ...d, branding_nombre: e.nombre }));
      }
      if (cfg) setDatos((d) => Object.fromEntries(Object.keys(d).map((k) => [k, (cfg as Record<string, unknown>)[k] ?? ""])) as Datos);
      setCargando(false);
    })();
  }, []);

  const set = (k: Clave, v: string) => setDatos((d) => ({ ...d, [k]: v }));

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresa) return;
    if (!datos.branding_nombre.trim()) { setMensaje({ ok: false, texto: "Completá el nombre comercial." }); return; }
    if (datos.branding_color_primario && !/^#[0-9A-Fa-f]{6}$/.test(datos.branding_color_primario)) { setMensaje({ ok: false, texto: "El color tiene que ser del tipo #B4532A." }); return; }
    setGuardando(true);
    setMensaje(null);
    const fila = Object.fromEntries(Object.entries(datos).map(([k, v]) => [k, v.trim() || null]));
    const { error } = await supabase2.from("configuracion_empresa").upsert({ ...fila, empresa_id: empresa.id, updated_at: new Date().toISOString() });
    setGuardando(false);
    setMensaje(error ? { ok: false, texto: `No se pudo guardar: ${error.message}` } : { ok: true, texto: "Guardado. El bot ya usa estos datos en la próxima respuesta." });
  };

  const cargarMemoria = async () => {
    setMensaje(null);
    const { data: existentes } = await supabase2.from("whatsapp_memoria").select("categoria");
    const faltan = memoriaQueFalta(existentes ?? [], datos.branding_nombre);
    if (faltan.length === 0) { setMensaje({ ok: true, texto: "El bot ya tiene respuestas en todas las categorías. Editalas en Configuración > WhatsApp." }); return; }
    const { error } = await supabase2.from("whatsapp_memoria").insert(faltan.map((f, i) => ({ ...f, orden: i })));
    setMensaje(error ? { ok: false, texto: `No se pudieron cargar: ${error.message}` } : { ok: true, texto: `Se cargaron ${faltan.length} respuestas de ejemplo. Revisalas y cambialas por las tuyas en Configuración > WhatsApp.` });
  };

  const codigo = empresa && typeof window !== "undefined" ? codigoParaPegar({ origen: window.location.origin, empresa: empresa.slug, color: datos.branding_color_primario }) : "";
  const copiar = async () => {
    try { await navigator.clipboard.writeText(codigo); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* el usuario puede copiarlo a mano */ }
  };

  return (
    <div className="im-page">
      <div className="im-head"><div><h1>Configuración</h1><p>Los datos de tu inmobiliaria: los usa el panel, el bot y el chat de tu web.</p></div></div>
      <TabsConfiguracion activa="/panel/configuracion/empresa" />
      {cargando ? <p className="im-note">Cargando…</p> : (
        <>
          <form className="im-box" onSubmit={guardar}>
            <div className="im-box-h"><h2>Datos de la empresa</h2></div>
            <div className="im-modal-b">
              {CAMPOS.map((c) => (
                <div key={c.k} className={`im-field${c.full ? " full" : ""}`}>
                  <label htmlFor={`em-${c.k}`}>{c.label}</label>
                  <input id={`em-${c.k}`} className="im-input" value={datos[c.k]} onChange={(e) => set(c.k, e.target.value)} placeholder={c.ph} />
                </div>
              ))}
              <div className="im-field">
                <label htmlFor="em-color">Color de la marca</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="color" aria-label="Elegir color" value={/^#[0-9A-Fa-f]{6}$/.test(datos.branding_color_primario) ? datos.branding_color_primario : "#B4532A"} onChange={(e) => set("branding_color_primario", e.target.value)} style={{ width: 44, height: 38, border: 0, background: "none" }} />
                  <input id="em-color" className="im-input" value={datos.branding_color_primario} onChange={(e) => set("branding_color_primario", e.target.value)} placeholder="#B4532A" />
                </div>
              </div>
              <div className="im-field full">
                <label htmlFor="em-desc">Qué hace la inmobiliaria (lo lee el bot para presentarse)</label>
                <textarea id="em-desc" className="im-input" rows={4} value={datos.bot_descripcion} onChange={(e) => set("bot_descripcion", e.target.value)}
                  placeholder="Inmobiliaria familiar con 20 años en zona norte. Vendemos y alquilamos departamentos y casas en Belgrano, Núñez y Saavedra. Hacemos tasaciones sin cargo." />
              </div>
              {mensaje && <div className={mensaje.ok ? "im-note" : "im-error"} role="status">{mensaje.texto}</div>}
            </div>
            <div className="im-modal-f"><button type="submit" className="im-btn primary" disabled={guardando}>{guardando ? "Guardando..." : "Guardar"}</button></div>
          </form>

          <div className="im-box">
            <div className="im-box-h"><h2>Respuestas del bot</h2></div>
            <p className="im-note">Si recién empezás, cargá respuestas de ejemplo (saludo, horarios, requisitos, tasaciones, fuera de horario) y después cambialas por las tuyas. No se pisa nada de lo que ya cargaste.</p>
            <div><button type="button" className="im-btn" onClick={cargarMemoria}><Sparkles size={15} />Cargar respuestas de ejemplo</button></div>
          </div>

          {empresa && (
            <div className="im-box">
              <div className="im-box-h"><h2>Chat para tu web</h2></div>
              <p className="im-note">Pegá esta línea en tu sitio, antes de <code>&lt;/body&gt;</code>. Aparece un botón de chat abajo a la derecha y cada charla entra en Leads &gt; Chat de la web.</p>
              <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", background: "rgba(0,0,0,.04)", padding: 12, borderRadius: 8, fontSize: 13 }}>{codigo}</pre>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="im-btn" onClick={copiar}><Copy size={15} />{copiado ? "Copiado" : "Copiar código"}</button>
                <a className="im-btn" href={`/chat/${empresa.slug}`} target="_blank" rel="noreferrer">Probar el chat</a>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
