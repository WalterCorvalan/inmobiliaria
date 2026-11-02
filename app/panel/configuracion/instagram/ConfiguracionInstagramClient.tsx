"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Camera, Copy, Check, Loader2, ExternalLink, CheckCircle2, MessageSquareReply, Plus, Trash2, UserSearch } from "lucide-react";
import { supabase2 } from "@/lib/supabase/client";
import ConfirmDialog from "@/components/panel/ConfirmDialog";
import TokenCargado from "../TokenCargado";
import { avisar } from "@/components/panel/Dialogos";

const inputClass = "w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-rose-500";
const labelClass = "text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1";

interface ReglaAutomatizacion {
  id: string;
  palabras_clave: string[];
  respuesta_dm: string;
  respuesta_publica: string | null;
  activo: boolean;
  orden: number;
}

// Automatización tipo ManyChat: comentario con una palabra clave -> DM
// automático puntual (y opcionalmente respuesta pública debajo del
// comentario), en vez del mensaje de apertura genérico fijo. Reglas
// globales (no por post) -- mismo patrón de "Memoria del bot" de WhatsApp.
function AutomatizacionesComentarios() {
  const [reglas, setReglas] = useState<ReglaAutomatizacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nueva, setNueva] = useState({ palabras: "", respuestaDm: "", respuestaPublica: "" });
  const [guardando, setGuardando] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ mensaje: string; accion: () => void } | null>(null);

  const cargar = async () => {
    setCargando(true);
    const { data } = await supabase2.from("instagram_automatizaciones_comentarios").select("*").order("orden");
    setReglas(data || []);
    setCargando(false);
  };
  useEffect(() => { cargar(); }, []);

  const agregar = async () => {
    if (!nueva.palabras.trim() || !nueva.respuestaDm.trim()) return;
    setGuardando(true);
    const palabras_clave = nueva.palabras.split(",").map((p) => p.trim()).filter(Boolean);
    const { error } = await supabase2.from("instagram_automatizaciones_comentarios").insert({
      palabras_clave, respuesta_dm: nueva.respuestaDm.trim(), respuesta_publica: nueva.respuestaPublica.trim() || null,
    });
    setGuardando(false);
    if (!error) { setNueva({ palabras: "", respuestaDm: "", respuestaPublica: "" }); cargar(); }
  };

  const toggleActivo = async (regla: ReglaAutomatizacion) => {
    setReglas((prev) => prev.map((r) => (r.id === regla.id ? { ...r, activo: !r.activo } : r)));
    await supabase2.from("instagram_automatizaciones_comentarios").update({ activo: !regla.activo }).eq("id", regla.id);
  };

  const borrar = (id: string) => {
    setConfirmDialog({
      mensaje: "¿Borrar esta automatización?",
      accion: async () => {
        setReglas((prev) => prev.filter((r) => r.id !== id));
        await supabase2.from("instagram_automatizaciones_comentarios").delete().eq("id", id);
      },
    });
  };

  return (
    <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-5 space-y-4 shadow-sm">
      <div>
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><MessageSquareReply className="w-3.5 h-3.5" /> Automatizaciones de comentarios</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Tipo ManyChat: si un comentario en un posteo contiene alguna de estas palabras clave, se manda ese DM puntual (y opcionalmente una respuesta pública debajo del comentario) en vez del mensaje de apertura genérico. Si ningún comentario matchea ninguna regla, sigue el comportamiento de siempre.</p>
      </div>

      {cargando ? (
        <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>
      ) : (
        <div className="space-y-2">
          {reglas.length === 0 && <p className="text-xs text-slate-400 italic">Sin automatizaciones cargadas todavía.</p>}
          {reglas.map((r) => (
            <div key={r.id} className="border border-slate-200 dark:border-white/10 rounded-xl p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                  {r.palabras_clave.map((p) => (
                    <span key={p} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">{p}</span>
                  ))}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => toggleActivo(r)} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.activo ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-white/5"}`}>{r.activo ? "Activa" : "Pausada"}</button>
                  <button onClick={() => borrar(r.id)} className="text-slate-400 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300"><span className="font-semibold">DM:</span> {r.respuesta_dm}</p>
              {r.respuesta_publica && <p className="text-xs text-slate-500 dark:text-slate-400"><span className="font-semibold">Público:</span> {r.respuesta_publica}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-slate-200 dark:border-white/10 pt-4 space-y-2">
        <div>
          <label className={labelClass}>Palabras clave (separadas por coma)</label>
          <input value={nueva.palabras} onChange={(e) => setNueva({ ...nueva, palabras: e.target.value })} placeholder="Ej: precio, financiación, cuotas" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>DM automático</label>
          <textarea value={nueva.respuestaDm} onChange={(e) => setNueva({ ...nueva, respuestaDm: e.target.value })} placeholder="Ej: ¡Hola! Te paso el precio y la financiación por acá 👇" className={`${inputClass} min-h-[70px]`} />
        </div>
        <div>
          <label className={labelClass}>Respuesta pública debajo del comentario (opcional)</label>
          <input value={nueva.respuestaPublica} onChange={(e) => setNueva({ ...nueva, respuestaPublica: e.target.value })} placeholder="Ej: ¡Te escribimos por DM! 📩" className={inputClass} />
        </div>
        <button onClick={agregar} disabled={guardando} className="px-4 py-2 rounded-xl bg-[#0145F2] hover:bg-[#0138c9] text-white text-sm font-bold disabled:opacity-50 flex items-center gap-1.5">
          {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Agregar automatización
        </button>
      </div>

      <ConfirmDialog
        abierto={!!confirmDialog}
        mensaje={confirmDialog?.mensaje || ""}
        onConfirmar={() => { confirmDialog?.accion(); setConfirmDialog(null); }}
        onCancelar={() => setConfirmDialog(null)}
      />
    </div>
  );
}

export default function ConfiguracionInstagramClient() {
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [tokenCargado, setTokenCargado] = useState<{ ultimos6: string; largo: number } | null>(null);
  const [igUserId, setIgUserId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [metaAppSecret, setMetaAppSecret] = useState("");
  const [secretos, setSecretos] = useState<{ appSecretCargado: boolean; metaAppSecretCargado: boolean }>({ appSecretCargado: false, metaAppSecretCargado: false });
  const [tono, setTono] = useState("");
  const [copiado, setCopiado] = useState<"webhook" | "verify" | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [conectando, setConectando] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ mensaje: string; accion: () => void } | null>(null);
  const [backfilleando, setBackfilleando] = useState(false);

  const cargar = async () => {
    setCargando(true);
    const res = await fetch("/api/panel/instagram/configuracion");
    const data = await res.json();
    if (res.ok) {
      setConfig(data.config); if ("tokenCargado" in data) setTokenCargado(data.tokenCargado);
      setIgUserId(data.config?.ig_user_id || "");
      setAppId(data.config?.app_id || "");
      if (data.secretos) setSecretos(data.secretos);
      setTono(data.config?.tono || "");
    }
    setCargando(false);
  };

  useEffect(() => { cargar(); }, []);

  // Vuelta del login de Instagram (Business Login): Meta redirige acá con
  // ?code=..., lo canjeamos por un access token real -- a diferencia del
  // botón "Generar identificador" del dashboard de Meta, que no sirve para
  // el Send API (ver error "Cannot parse access token" código 190, 24/9).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return;
    const redirectUri = `${window.location.origin}${window.location.pathname}`;
    window.history.replaceState({}, "", window.location.pathname);
    setConectando(true);
    setMensaje("");
    fetch("/api/panel/instagram/oauth-callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, redirectUri }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No se pudo conectar con Instagram.");
        setConfig(data.config); cargar();
        setIgUserId(data.config?.ig_user_id || "");
        setMensaje(`Conectado — token válido por ${data.expiresInDias ?? 60} días.`);
      })
      .catch((e) => setMensaje(e.message || "Error al conectar con Instagram."))
      .finally(() => setConectando(false));
  }, []);

  const conectarConInstagram = () => {
    if (!config?.app_id) return;
    const redirectUri = `${window.location.origin}${window.location.pathname}`;
    const scope = "instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish,instagram_business_manage_insights";
    const url = `https://www.instagram.com/oauth/authorize?force_reauth=true&client_id=${encodeURIComponent(config.app_id)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;
    window.location.href = url;
  };

  const guardar = async () => {
    setGuardando(true);
    setMensaje("");
    try {
      const res = await fetch("/api/panel/instagram/configuracion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ igUserId, accessToken, tono, appId, appSecret, metaAppSecret }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar.");
      setConfig(data.config); if ("tokenCargado" in data) setTokenCargado(data.tokenCargado);
      setAccessToken("");
      setAppSecret(""); setMetaAppSecret("");
      if (data.secretos) setSecretos(data.secretos);
      setMensaje("Guardado correctamente.");
    } catch (e: any) {
      setMensaje(e.message || "Error al guardar.");
    } finally {
      setGuardando(false);
    }
  };

  const regenerarVerify = () => {
    setConfirmDialog({
      mensaje: "¿Regenerar el Verify Token? Vas a tener que actualizarlo también en el dashboard de Meta.",
      accion: async () => {
        setGuardando(true);
        try {
          const res = await fetch("/api/panel/instagram/configuracion", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ igUserId, accessToken: "", regenerarVerifyToken: true }),
          });
          const data = await res.json();
          if (res.ok) setConfig(data.config); if ("tokenCargado" in data) setTokenCargado(data.tokenCargado);
        } finally {
          setGuardando(false);
        }
      },
    });
  };

  const copiar = (texto: string, cual: "webhook" | "verify") => {
    navigator.clipboard.writeText(texto);
    setCopiado(cual);
    setTimeout(() => setCopiado(null), 1500);
  };

  const recuperarUsuarios = async () => {
    setBackfilleando(true);
    try {
      const res = await fetch("/api/panel/instagram/backfill-usernames", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo recuperar los usuarios.");
      if (data.resueltos === 0 && data.pendientes === 0) avisar("No había ningún lead pendiente de recuperar @usuario.");
      else avisar(`Recuperados ${data.resueltos} @usuario${data.resueltos === 1 ? "" : "s"}.${data.pendientes > 0 ? ` Quedan ${data.pendientes} pendientes — volvé a apretar el botón para seguir.` : ""}`);
    } catch (e: any) {
      avisar(e.message || "Error recuperando usuarios.");
    } finally {
      setBackfilleando(false);
    }
  };

  if (cargando) return <div className="p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;

  const webhookUrl = config?.webhook_verify_token ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/panel/webhooks/instagram/${config.webhook_verify_token}` : "";

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2"><img src="/icons/panel/configuracion.png" alt="" className="w-5 h-5 object-contain shrink-0" /> Configuración</h1>
        <p className="text-sm text-slate-400">Conectá la cuenta de Instagram de Meta para recibir DMs y respuestas privadas a comentarios acá (Conversaciones → Instagram), con el mismo asistente automático que WhatsApp.</p>
      </div>

      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-white/10 overflow-x-auto">
        <Link href="/panel/configuracion" className="px-3 py-2.5 text-sm font-bold border-b-2 border-transparent text-slate-500 whitespace-nowrap">Colaboradores</Link>
        <Link href="/panel/configuracion/empresa" className="px-3 py-2.5 text-sm font-bold border-b-2 border-transparent text-slate-500 whitespace-nowrap">Empresa</Link>
        <Link href="/panel/configuracion/whatsapp" className="px-3 py-2.5 text-sm font-bold border-b-2 border-transparent text-slate-500 whitespace-nowrap">WhatsApp</Link>
        <span className="px-3 py-2.5 text-sm font-bold border-b-2 border-[#0145F2] text-[#0145F2] whitespace-nowrap">Instagram</span>
        <Link href="/panel/configuracion/messenger" className="px-3 py-2.5 text-sm font-bold border-b-2 border-transparent text-slate-500 whitespace-nowrap">Messenger</Link>
        <Link href="/panel/configuracion/sucursales" className="px-3 py-2.5 text-sm font-bold border-b-2 border-transparent text-slate-500 whitespace-nowrap">Sucursales</Link>
      </div>

      <div className="max-w-2xl space-y-5">

      <div className={`px-3 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${config?.listo ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"}`}>
        {config?.listo ? "✅ Configurado" : "⏳ Falta completar"}
      </div>

      <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-5 space-y-4 shadow-sm">
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Credenciales de Meta</p>

        <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-xl p-3 space-y-2">
          <p className="text-xs text-indigo-700 dark:text-indigo-300">El botón &quot;Generar identificador&quot; del dashboard de Meta no sirve para enviar mensajes. Usá este login en su lugar — genera un token real de 60 días.</p>
          {config?.listo ? (
            <div className="flex items-center gap-2">
              <span className="px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-sm font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Conectado
              </span>
              <button onClick={conectarConInstagram} disabled={conectando || !config?.app_id} title={!config?.app_id ? "Primero guardá el ID y el secreto de la app de Instagram" : undefined} className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-300 hover:underline disabled:opacity-50 flex items-center gap-1">
                {conectando ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Reconectar
              </button>
            </div>
          ) : (
            <button onClick={conectarConInstagram} disabled={conectando || !config?.app_id} title={!config?.app_id ? "Primero guardá el ID y el secreto de la app de Instagram" : undefined} className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white text-sm font-bold disabled:opacity-50 flex items-center gap-1.5">
              {conectando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Conectar con Instagram
            </button>
          )}
          <p className="text-[10px] text-indigo-600/70 dark:text-indigo-300/70">Requiere que esta URL esté en la lista de &quot;URIs de redirección OAuth válidas&quot; de Meta: {typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}` : ""}</p>
        </div>

        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">App de Instagram de esta empresa</p>
        <div>
          <label className={labelClass}>ID de la app de Instagram</label>
          
          <input value={appId} onChange={(e) => setAppId(e.target.value)} placeholder="Ej: 1891064935199738" className={inputClass} />
          <p className="text-[10px] text-slate-400 mt-1">Meta → tu app → Instagram → Configuración de la API de Instagram. Es público.</p>
        </div>
        <div>
          <label className={labelClass}>Secreto de la app de Instagram</label>
          {secretos.appSecretCargado ? <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mb-1">Cargado (se guarda cifrado).</p> : null}
          <input type="password" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} placeholder="•••••••• (dejalo vacío para no cambiarlo)" className={inputClass} />
          <p className="text-[10px] text-slate-400 mt-1">Misma pantalla: "Secreto de la app de Instagram". Con él se firman los mensajes y se conecta la cuenta.</p>
        </div>
        <div>
          <label className={labelClass}>Secreto de la app de Meta (opcional)</label>
          {secretos.metaAppSecretCargado ? <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mb-1">Cargado (se guarda cifrado).</p> : null}
          <input type="password" value={metaAppSecret} onChange={(e) => setMetaAppSecret(e.target.value)} placeholder="•••••••• (dejalo vacío para no cambiarlo)" className={inputClass} />
          <p className="text-[10px] text-slate-400 mt-1">Configuración → Básica de la app. Solo hace falta si Meta firma con ese secreto en vez del de Instagram.</p>
        </div>
        <div>
          <label className={labelClass}>Instagram User ID (ig_user_id)</label>
          <input value={igUserId} onChange={(e) => setIgUserId(e.target.value)} placeholder="Ej: 17841400000000000" className={inputClass} />
          <p className="text-[10px] text-slate-400 mt-1">Meta → Instagram → Configuración de la API → ID de la cuenta profesional.</p>
        </div>
        <div>
          <label className={labelClass}>Access Token</label>
          <div className="mb-2"><TokenCargado resumen={tokenCargado} actualizado={config?.updated_at} /></div>
          <input type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder={config?.listo ? "•••••••• (dejalo vacío para no cambiarlo)" : "Pegá el token temporal o permanente"} className={inputClass} />
          <p className="text-[10px] text-slate-400 mt-1">Se guarda cifrado. Para producción generá un token permanente (System User) en Meta Business Suite.</p>
        </div>
        <div>
          <label className={labelClass}>Tono de conversación (opcional)</label>
          <input value={tono} onChange={(e) => setTono(e.target.value)} placeholder="Ej: informal y cercano, con algún emoji" className={inputClass} />
          <p className="text-[10px] text-slate-400 mt-1">Reemplaza el tono por defecto (&quot;amable, profesional, claro y breve&quot;) solo en las respuestas de Instagram. Dejalo vacío para usar el default.</p>
        </div>
        {mensaje && <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{mensaje}</p>}
        <button onClick={guardar} disabled={guardando} className="px-4 py-2.5 rounded-xl bg-[#0145F2] hover:bg-[#0138c9] text-white text-sm font-bold disabled:opacity-50 flex items-center gap-1.5">
          {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Guardar
        </button>

        {config?.listo && (
          <div className="border-t border-slate-200 dark:border-white/10 pt-4">
            <button onClick={recuperarUsuarios} disabled={backfilleando} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 text-sm font-bold disabled:opacity-50 flex items-center gap-1.5">
              {backfilleando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserSearch className="w-3.5 h-3.5" />} Recuperar @usuario de leads viejos
            </button>
            <p className="text-[10px] text-slate-400 mt-1.5">Leads que llegaron por DM antes de que el bot supiera resolver el @usuario real (quedaron guardados solo con un número interno de Instagram) — le pregunta a Meta el @ correcto para cada uno. Hasta 200 por vez, volvé a apretarlo si quedan pendientes.</p>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-5 space-y-4 shadow-sm">
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Webhook — cargalo en Meta</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">En Meta → Instagram → Configuración → Webhook → Editar, pegá estos dos valores y suscribite a los campos <b>comments</b> y <b>messages</b>.</p>

        <div>
          <label className={labelClass}>URL de devolución de llamada (Callback URL)</label>
          <div className="flex gap-2">
            <input readOnly value={webhookUrl} className={`${inputClass} font-mono text-xs`} />
            <button onClick={() => copiar(webhookUrl, "webhook")} className="px-3 rounded-xl border border-slate-200 dark:border-white/10 text-slate-500 shrink-0">
              {copiado === "webhook" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className={labelClass}>Verify Token</label>
          <div className="flex gap-2">
            <input readOnly value={config?.webhook_verify_token || ""} className={`${inputClass} font-mono text-xs`} />
            <button onClick={() => copiar(config?.webhook_verify_token || "", "verify")} className="px-3 rounded-xl border border-slate-200 dark:border-white/10 text-slate-500 shrink-0">
              {copiado === "verify" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <button onClick={regenerarVerify} className="text-[11px] font-semibold text-[#0145F2] mt-1.5">Regenerar (invalida el actual)</button>
        </div>

        <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-300">
          Abrir Meta for Developers <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      <AutomatizacionesComentarios />
      </div>

      <ConfirmDialog
        abierto={!!confirmDialog}
        mensaje={confirmDialog?.mensaje || ""}
        onConfirmar={() => { confirmDialog?.accion(); setConfirmDialog(null); }}
        onCancelar={() => setConfirmDialog(null)}
      />
    </div>
  );
}
