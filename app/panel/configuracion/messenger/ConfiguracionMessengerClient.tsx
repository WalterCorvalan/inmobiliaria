"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Copy, Check, Loader2, ExternalLink, CheckCircle2 } from "lucide-react";
import ConfirmDialog from "@/components/panel/ConfirmDialog";
import TokenCargado from "../TokenCargado";

// Versión simplificada de ConfiguracionInstagramClient.tsx: Messenger no
// tiene el problema de namespace de token de Instagram (Send API usa el
// mismo token de Página de siempre, generado directo en Meta for Developers
// -> tu app -> Messenger -> Configuración de la API -> Generar identificador
// de acceso para tu Página), así que no hace falta el flujo de OAuth
// "Conectar con Instagram" -- se pega el token a mano acá, como WhatsApp.
// Tampoco hay "Automatizaciones de comentarios" (Messenger no tiene
// comentario-a-DM) ni backfill de @usuario (Messenger no tiene username
// público, solo nombre real).

const inputClass = "w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500";
const labelClass = "text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1";

export default function ConfiguracionMessengerClient() {
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [tokenCargado, setTokenCargado] = useState<{ ultimos6: string; largo: number } | null>(null);
  const [pageId, setPageId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [tono, setTono] = useState("");
  const [copiado, setCopiado] = useState<"webhook" | "verify" | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{ mensaje: string; accion: () => void } | null>(null);
  const [importando, setImportando] = useState(false);
  const [resultadoImportar, setResultadoImportar] = useState("");

  // Trae las conversaciones de los últimos 21 días que llegaron antes de que el
  // webhook funcionara. No contesta a nadie; se puede repetir sin duplicar.
  const importarHistorial = () => {
    setConfirmDialog({
      mensaje: "¿Importar las conversaciones de Messenger de los últimos 21 días? No se le responde a nadie: solo aparecen en la bandeja y en Leads.",
      accion: async () => {
        setImportando(true);
        setResultadoImportar("");
        try {
          const res = await fetch("/api/panel/messenger/importar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dias: 21 }) });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "No se pudo importar.");
          setResultadoImportar(`Listo: ${data.conversaciones} conversaciones, ${data.mensajesNuevos} mensajes nuevos (${data.mensajesYaGuardados} ya estaban guardados).`);
        } catch (e: any) {
          setResultadoImportar(e.message || "Error al importar.");
        } finally {
          setImportando(false);
        }
      },
    });
  };

  const cargar = async () => {
    setCargando(true);
    const res = await fetch("/api/panel/messenger/configuracion");
    const data = await res.json();
    if (res.ok) {
      setConfig(data.config); if ("tokenCargado" in data) setTokenCargado(data.tokenCargado);
      setPageId(data.config?.page_id || "");
      setTono(data.config?.tono || "");
    }
    setCargando(false);
  };

  useEffect(() => { cargar(); }, []);

  const guardar = async () => {
    setGuardando(true);
    setMensaje("");
    try {
      const res = await fetch("/api/panel/messenger/configuracion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, accessToken, tono }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar.");
      setConfig(data.config); if ("tokenCargado" in data) setTokenCargado(data.tokenCargado);
      setAccessToken("");
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
          const res = await fetch("/api/panel/messenger/configuracion", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pageId, accessToken: "", regenerarVerifyToken: true }),
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

  if (cargando) return <div className="p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;

  const webhookUrl = config?.verify_token ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/panel/webhooks/messenger/${config.verify_token}` : "";

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2"><img src="/icons/panel/configuracion.png" alt="" className="w-5 h-5 object-contain shrink-0" /> Configuración</h1>
        <p className="text-sm text-slate-400">Conectá la página de Facebook Messenger para recibir mensajes acá (Conversaciones → Messenger), con el mismo asistente automático que WhatsApp e Instagram.</p>
      </div>

      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-white/10 overflow-x-auto">
        <Link href="/panel/configuracion" className="px-3 py-2.5 text-sm font-bold border-b-2 border-transparent text-slate-500 whitespace-nowrap">Colaboradores</Link>
        <Link href="/panel/configuracion/empresa" className="px-3 py-2.5 text-sm font-bold border-b-2 border-transparent text-slate-500 whitespace-nowrap">Empresa</Link>
        <Link href="/panel/configuracion/whatsapp" className="px-3 py-2.5 text-sm font-bold border-b-2 border-transparent text-slate-500 whitespace-nowrap">WhatsApp</Link>
        <Link href="/panel/configuracion/instagram" className="px-3 py-2.5 text-sm font-bold border-b-2 border-transparent text-slate-500 whitespace-nowrap">Instagram</Link>
        <span className="px-3 py-2.5 text-sm font-bold border-b-2 border-[#0145F2] text-[#0145F2] whitespace-nowrap">Messenger</span>
        <Link href="/panel/configuracion/sucursales" className="px-3 py-2.5 text-sm font-bold border-b-2 border-transparent text-slate-500 whitespace-nowrap">Sucursales</Link>
      </div>

      <div className="max-w-2xl space-y-5">

      <div className={`px-3 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${config?.listo ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"}`}>
        {config?.listo ? "✅ Configurado" : "⏳ Falta completar"}
      </div>

      {config?.listo && (
        <div className="px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-bold inline-flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4" /> Conectado
        </div>
      )}

      <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-5 space-y-4 shadow-sm">
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Credenciales de Meta</p>

        <div>
          <label className={labelClass}>Page ID</label>
          <input value={pageId} onChange={(e) => setPageId(e.target.value)} placeholder="Ej: 123456789012345" className={inputClass} />
          <p className="text-[10px] text-slate-400 mt-1">Meta → Página → Configuración → ID de la página.</p>
        </div>
        <div>
          <label className={labelClass}>Access Token</label>
          <div className="mb-2"><TokenCargado resumen={tokenCargado} actualizado={config?.updated_at} /></div>
          <input type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder={config?.listo ? "•••••••• (dejalo vacío para no cambiarlo)" : "Pegá el token de página"} className={inputClass} />
          <p className="text-[10px] text-slate-400 mt-1">Se guarda cifrado. Generalo en Meta for Developers → tu app → Messenger → Configuración de la API → Generar identificador de acceso para tu Página (elegí un token permanente / System User para producción).</p>
        </div>
        <div>
          <label className={labelClass}>Tono de conversación (opcional)</label>
          <input value={tono} onChange={(e) => setTono(e.target.value)} placeholder="Ej: informal y cercano, con algún emoji" className={inputClass} />
          <p className="text-[10px] text-slate-400 mt-1">Reemplaza el tono por defecto solo en las respuestas de Messenger. Dejalo vacío para usar el default.</p>
        </div>
        {mensaje && <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{mensaje}</p>}
        <button onClick={guardar} disabled={guardando} className="px-4 py-2.5 rounded-xl bg-[#0145F2] hover:bg-[#0138c9] text-white text-sm font-bold disabled:opacity-50 flex items-center gap-1.5">
          {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Guardar
        </button>
      </div>

      {config?.listo && (
        <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-5 space-y-3 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Importar conversaciones anteriores</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Meta no reenvía los mensajes que llegaron antes de conectar el webhook. Este botón trae los de los últimos 21 días como leads, sin responderle a nadie. Se puede repetir sin duplicar.</p>
          {resultadoImportar && <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{resultadoImportar}</p>}
          <button onClick={importarHistorial} disabled={importando} className="px-4 py-2.5 rounded-xl border border-[#0145F2] text-[#0145F2] text-sm font-bold disabled:opacity-50 flex items-center gap-1.5">
            {importando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Importar últimos 21 días
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-5 space-y-4 shadow-sm">
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Webhook — cargalo en Meta</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">En Meta → tu app → Messenger → Configuración → Webhook → Editar, pegá estos dos valores y suscribite al campo <b>messages</b> (y opcionalmente <b>messaging_postbacks</b>, <b>message_reads</b>).</p>

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
            <input readOnly value={config?.verify_token || ""} className={`${inputClass} font-mono text-xs`} />
            <button onClick={() => copiar(config?.verify_token || "", "verify")} className="px-3 rounded-xl border border-slate-200 dark:border-white/10 text-slate-500 shrink-0">
              {copiado === "verify" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <button onClick={regenerarVerify} className="text-[11px] font-semibold text-[#0145F2] mt-1.5">Regenerar (invalida el actual)</button>
        </div>

        <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-300">
          Abrir Meta for Developers <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
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
