"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Copy, Check, Loader2, ExternalLink, Brain, Plus, Trash2, ShieldCheck, ShieldAlert, RefreshCw } from "lucide-react";
import { supabase2 } from "@/lib/supabase/client";
import ConfirmDialog from "@/components/panel/ConfirmDialog";
import TokenCargado from "../TokenCargado";
import { avisar, confirmar } from "@/components/panel/Dialogos";
import { PLANTILLAS_SUGERIDAS, type PlantillaSugerida } from "@/lib/panel/plantillasSugeridas";
import { esPlantillaDeEjemploMeta } from "@/lib/panel/variablesPlantilla";
import SelectorWeb from "@/components/ui/SelectorWeb";

const inputClass = "w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-rose-500";
const labelClass = "text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1";

const CATEGORIAS_MEMORIA = [
  { value: "saludo", label: "Saludo" },
  { value: "horarios_ubicacion", label: "Horarios y ubicación" },
  { value: "pagos_financiacion", label: "Formas de pago / financiación" },
  { value: "datos_empresa", label: "Datos de la empresa" },
  { value: "fuera_horario", label: "Fuera de horario (automático, sin palabras clave)" },
  { value: "apertura", label: "Mensaje de la mañana, 9 hs (automático, sin palabras clave)" },
] as const;
// Sin palabras clave: el bot las manda solo (fuera de horario a la noche, y el de la mañana a las 9; ver lib/panel/horarioBots.ts).
const CATEGORIAS_AUTOMATICAS = new Set(["fuera_horario", "apertura"]);

interface MemoriaFila {
  id: string;
  categoria: string;
  palabras_clave: string[];
  respuesta: string;
  activo: boolean;
  orden: number;
}

function EstadoMeta() {
  const [consultando, setConsultando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [error, setError] = useState("");
  const [pin, setPin] = useState("");
  const [registrando, setRegistrando] = useState(false);
  // Meta responde #133006 al registrar si el número no se verificó con un código: se muestra ese paso antes.
  const [verificando, setVerificando] = useState(false);
  const [codigoPedido, setCodigoPedido] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [ocupadoCodigo, setOcupadoCodigo] = useState(false);

  const llamarVerificacion = async (cuerpo: { accion: "pedir"; metodo: "SMS" | "VOICE" } | { accion: "confirmar"; codigo: string }) => {
    setOcupadoCodigo(true);
    try {
      const res = await fetch("/api/panel/whatsapp/verificar-numero", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo completar la verificación.");
      if (cuerpo.accion === "pedir") { setCodigoPedido(true); avisar("Código pedido. Llega al número por SMS o llamada: puede tardar un minuto."); }
      else { setCodigo(""); setCodigoPedido(false); setVerificando(false); avisar("Número verificado. Ahora apretá Registrar número."); }
    } catch (e) {
      avisar(e instanceof Error ? e.message : "No se pudo completar la verificación.");
    } finally {
      setOcupadoCodigo(false);
    }
  };

  const registrar = async () => {
    if (!(await confirmar({ titulo: "Registrar el número", mensaje: "Esto conecta el número a la API de WhatsApp del panel. Si hoy se usa en la app WhatsApp Business del celular, deja de funcionar ahí. ¿Seguir?", textoConfirmar: "Registrar", peligro: true }))) return;
    setRegistrando(true);
    try {
      const res = await fetch("/api/panel/whatsapp/registrar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }) });
      const data = await res.json();
      if (!res.ok) {
        if (/133006|re-verification|necesita verificarse/i.test(String(data.error))) setVerificando(true);
        throw new Error(data.error || "No se pudo registrar el número.");
      }
      setPin("");
      avisar("Número registrado. Verificando el estado...");
      await consultar();
    } catch (e) {
      avisar(e instanceof Error ? e.message : "No se pudo registrar el número.");
    } finally {
      setRegistrando(false);
    }
  };

  const consultar = async () => {
    setConsultando(true);
    setError("");
    try {
      const res = await fetch("/api/panel/whatsapp/estado");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error consultando el estado.");
      setResultado(data);
    } catch (e: any) {
      setError(e.message || "Error consultando el estado.");
      setResultado(null);
    } finally {
      setConsultando(false);
    }
  };

  return (
    <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-5 space-y-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Estado real con Meta</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Consulta en vivo si el negocio ya está verificado — la causa más común de "llega el mensaje pero no sale la respuesta".</p>
        </div>
        <button onClick={consultar} disabled={consultando} className="shrink-0 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 disabled:opacity-50 flex items-center gap-1.5">
          {consultando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Verificar estado
        </button>
      </div>

      {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}

      {resultado && (
        <div className={`rounded-xl p-4 border ${resultado.puedeEnviar ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20" : "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20"}`}>
          <div className="flex items-center gap-2 mb-2">
            {resultado.puedeEnviar ? <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" /> : <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />}
            <p className={`text-sm font-bold ${resultado.puedeEnviar ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>{resultado.mensaje}</p>
          </div>
          <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5">
            <p><b>Número:</b> {resultado.numero.display} ({resultado.numero.verificado}){resultado.numero.estado ? ` — ${resultado.numero.estado}` : ""}</p>
            <p><b>Negocio (WABA):</b> {resultado.negocio.nombre || "—"} — verificación: <b>{resultado.negocio.verificacion}</b></p>
            {resultado.pagoAsociado === false && <p className="text-rose-600 dark:text-rose-300 font-bold">Pago: la cuenta no tiene método de pago asociado en Meta. Las plantillas y los mensajes de marketing no van a salir (Meta Business Suite → Configuración → Facturación y pagos).</p>}
            {resultado.pagoAsociado === true && <p><b>Pago:</b> método de pago asociado en Meta (si una plantilla falla con #131042, revisá que tenga fondos).</p>}
          </div>
          {resultado.numeroDesconectado && (
            <div className="mt-3 pt-3 border-t border-rose-200 dark:border-rose-500/20 space-y-2">
              <p className="text-[11px] text-slate-600 dark:text-slate-300">Registrar el número lo conecta a la API. Si antes tenía una verificación en dos pasos (por ejemplo de Twilio), ingresá ese PIN; si nunca tuvo, elegí uno nuevo de 6 números y guardalo.</p>
              <div className="flex gap-2">
                <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="PIN de 6 números" autoComplete="off" className={`${inputClass} max-w-[180px]`} />
                <button onClick={registrar} disabled={registrando || pin.length !== 6} className="shrink-0 px-3 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1.5">
                  {registrando && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Registrar número
                </button>
              </div>
              {verificando && (
                <div className="rounded-xl border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 space-y-2">
                  <p className="text-[11px] font-bold text-amber-800 dark:text-amber-300">Meta pide verificar el número antes de registrarlo</p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">Se manda un código de 6 números a la línea {resultado.numero.display} (hay que poder recibir el SMS o la llamada en ese chip). Después lo ingresás acá.</p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => llamarVerificacion({ accion: "pedir", metodo: "SMS" })} disabled={ocupadoCodigo} className="px-3 py-2 rounded-xl border border-slate-300 dark:border-white/20 text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-50">Pedir código por SMS</button>
                    <button onClick={() => llamarVerificacion({ accion: "pedir", metodo: "VOICE" })} disabled={ocupadoCodigo} className="px-3 py-2 rounded-xl border border-slate-300 dark:border-white/20 text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-50">Pedir por llamada</button>
                  </div>
                  {codigoPedido && (
                    <div className="flex gap-2">
                      <input value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="Código de 6 números" autoComplete="one-time-code" className={`${inputClass} max-w-[180px]`} />
                      <button onClick={() => llamarVerificacion({ accion: "confirmar", codigo })} disabled={ocupadoCodigo || codigo.length !== 6} className="shrink-0 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1.5">
                        {ocupadoCodigo && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Confirmar código
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MemoriaBot() {
  const [filas, setFilas] = useState<MemoriaFila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nueva, setNueva] = useState<{ categoria: string; palabras: string; respuesta: string }>({ categoria: "horarios_ubicacion", palabras: "", respuesta: "" });
  const [guardando, setGuardando] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ mensaje: string; accion: () => void } | null>(null);

  const cargar = async () => {
    setCargando(true);
    const { data } = await supabase2.from("whatsapp_memoria").select("*").order("categoria").order("orden");
    setFilas(data || []);
    setCargando(false);
  };
  useEffect(() => { cargar(); }, []);

  const agregar = async () => {
    if (!nueva.respuesta.trim()) return;
    if (!CATEGORIAS_AUTOMATICAS.has(nueva.categoria) && !nueva.palabras.trim()) return;
    setGuardando(true);
    const palabras_clave = nueva.palabras.split(",").map((p) => p.trim()).filter(Boolean);
    const { error } = await supabase2.from("whatsapp_memoria").insert({ categoria: nueva.categoria, palabras_clave, respuesta: nueva.respuesta.trim() });
    setGuardando(false);
    if (!error) { setNueva({ categoria: nueva.categoria, palabras: "", respuesta: "" }); cargar(); }
  };

  const toggleActivo = async (fila: MemoriaFila) => {
    setFilas((prev) => prev.map((f) => (f.id === fila.id ? { ...f, activo: !f.activo } : f)));
    await supabase2.from("whatsapp_memoria").update({ activo: !fila.activo }).eq("id", fila.id);
  };

  const borrar = (id: string) => {
    setConfirmDialog({
      mensaje: "¿Borrar esta respuesta de memoria?",
      accion: async () => {
        setFilas((prev) => prev.filter((f) => f.id !== id));
        await supabase2.from("whatsapp_memoria").delete().eq("id", id);
      },
    });
  };

  return (
    <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-5 space-y-4 mt-5 shadow-sm">
      <div>
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><Brain className="w-3.5 h-3.5" /> Memoria del bot</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Preguntas frecuentes que el bot contesta con una respuesta fija, sin gastar un llamado a la IA. Si el mensaje del cliente no matchea ninguna palabra clave de acá, recién ahí pasa a la IA. "Fuera de horario" no usa palabras clave — se manda solo cuando llega un mensaje fuera del horario de atención configurado arriba (una vez por día por conversación).</p>
      </div>

      {cargando ? (
        <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>
      ) : (
        <div className="space-y-2">
          {filas.length === 0 && <p className="text-xs text-slate-400 italic">Sin respuestas cargadas todavía.</p>}
          {filas.map((f) => (
            <div key={f.id} className={`rounded-xl border p-3 text-xs ${f.activo ? "border-slate-200 dark:border-white/10" : "border-slate-100 dark:border-white/5 opacity-50"}`}>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-bold text-slate-700 dark:text-slate-200">{CATEGORIAS_MEMORIA.find((c) => c.value === f.categoria)?.label || f.categoria}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => toggleActivo(f)} className={`px-2 py-1 rounded-lg text-[10px] font-bold ${f.activo ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-slate-100 text-slate-400 dark:bg-white/5"}`}>{f.activo ? "Activo" : "Inactivo"}</button>
                  <button onClick={() => borrar(f.id)} className="text-rose-400 hover:text-rose-600 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              {f.palabras_clave.length > 0 && (
                <p className="text-[10px] text-slate-400 mb-1">Palabras clave: {f.palabras_clave.join(", ")}</p>
              )}
              <p className="text-slate-600 dark:text-slate-300">{f.respuesta}</p>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-slate-100 dark:border-white/10 pt-4 space-y-2.5">
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Agregar respuesta</p>
        <div>
          <label className={labelClass}>Categoría</label>
          <div className="w-full"><SelectorWeb valor={nueva.categoria} onCambio={(v) => setNueva((n) => ({ ...n, categoria: v }))} claseBoton={inputClass} opciones={CATEGORIAS_MEMORIA.map((c) => ({ valor: c.value, etiqueta: c.label }))} /></div>
        </div>
        {!CATEGORIAS_AUTOMATICAS.has(nueva.categoria) && (
          <div>
            <label className={labelClass}>Palabras clave (separadas por coma)</label>
            <input value={nueva.palabras} onChange={(e) => setNueva((n) => ({ ...n, palabras: e.target.value }))} placeholder="Ej: horario, a que hora abren, hasta que hora" className={inputClass} />
          </div>
        )}
        <div>
          <label className={labelClass}>Respuesta</label>
          <textarea value={nueva.respuesta} onChange={(e) => setNueva((n) => ({ ...n, respuesta: e.target.value }))} rows={3} className={inputClass} />
        </div>
        <button onClick={agregar} disabled={guardando} className="px-4 py-2.5 rounded-xl bg-[#0145F2] hover:bg-[#0138c9] text-white text-sm font-bold disabled:opacity-50 flex items-center gap-1.5">
          {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Agregar
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

export default function ConfiguracionWhatsappClient() {
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [tokenCargado, setTokenCargado] = useState<{ ultimos6: string; largo: number } | null>(null);
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [secretos, setSecretos] = useState<{ appSecretCargado: boolean }>({ appSecretCargado: false });
  const [botNombre, setBotNombre] = useState("");
  const [tono, setTono] = useState("");
  const [horarioInicio, setHorarioInicio] = useState(7);
  const [horarioFin, setHorarioFin] = useState(23);
  const [copiado, setCopiado] = useState<"webhook" | "verify" | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{ mensaje: string; accion: () => void } | null>(null);
  const [numeroConfirmado, setNumeroConfirmado] = useState<{ numero: string; nombreVerificado: string } | null>(null);

  const cargar = async () => {
    setCargando(true);
    const res = await fetch("/api/panel/whatsapp/configuracion");
    const data = await res.json();
    if (res.ok) {
      if (data.secretos) setSecretos(data.secretos);
      setConfig(data.config); if ("tokenCargado" in data) setTokenCargado(data.tokenCargado);
      setPhoneNumberId(data.config?.phone_number_id || "");
      setWabaId(data.config?.waba_id || "");
      setBotNombre(data.config?.bot_nombre || "");
      setTono(data.config?.tono || "");
      setHorarioInicio(data.config?.horario_inicio ?? 7);
      setHorarioFin(data.config?.horario_fin ?? 23);
      setNumeroConfirmado(data.numeroConfirmado || null);
    }
    setCargando(false);
  };

  useEffect(() => { cargar(); }, []);

  const guardar = async () => {
    setGuardando(true);
    setMensaje("");
    try {
      const res = await fetch("/api/panel/whatsapp/configuracion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumberId, wabaId, accessToken, botNombre, tono, horarioInicio, horarioFin, appSecret }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar.");
      setConfig(data.config); if ("tokenCargado" in data) setTokenCargado(data.tokenCargado);
      setNumeroConfirmado(data.numeroConfirmado || null);
      setAccessToken("");
      setAppSecret("");
      if (data.secretos) setSecretos(data.secretos);
      setMensaje(data.numeroConfirmado ? `Guardado — Meta confirma que este ID corresponde al número ${data.numeroConfirmado.numero}.` : "Guardado correctamente (no se pudo confirmar el número contra Meta — revisá el token/ID).");
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
          const res = await fetch("/api/panel/whatsapp/configuracion", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phoneNumberId, accessToken: "", botNombre, regenerarVerifyToken: true }),
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

  const webhookUrl = config?.webhook_verify_token ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/panel/webhooks/whatsapp/${config.webhook_verify_token}` : "";

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2"><img src="/icons/panel/configuracion.png" alt="" className="w-5 h-5 object-contain shrink-0" /> Configuración</h1>
        <p className="text-sm text-slate-400">Conectá el número de WhatsApp Business de Meta para recibir los mensajes de los clientes acá (Conversaciones → WhatsApp) y que el asistente automático conteste hasta que un vendedor toma la charla.</p>
      </div>

      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-white/10 overflow-x-auto">
        <Link href="/panel/configuracion" className="px-3 py-2.5 text-sm font-bold border-b-2 border-transparent text-slate-500 whitespace-nowrap">Colaboradores</Link>
        <Link href="/panel/configuracion/empresa" className="px-3 py-2.5 text-sm font-bold border-b-2 border-transparent text-slate-500 whitespace-nowrap">Empresa</Link>
        <span className="px-3 py-2.5 text-sm font-bold border-b-2 border-[#0145F2] text-[#0145F2] whitespace-nowrap">WhatsApp</span>
        <Link href="/panel/configuracion/instagram" className="px-3 py-2.5 text-sm font-bold border-b-2 border-transparent text-slate-500 whitespace-nowrap">Instagram</Link>
        <Link href="/panel/configuracion/messenger" className="px-3 py-2.5 text-sm font-bold border-b-2 border-transparent text-slate-500 whitespace-nowrap">Messenger</Link>
        <Link href="/panel/configuracion/sucursales" className="px-3 py-2.5 text-sm font-bold border-b-2 border-transparent text-slate-500 whitespace-nowrap">Sucursales</Link>
      </div>

      <div className="max-w-2xl space-y-5">

      <div className="flex flex-wrap items-center gap-2">
        <div className={`px-3 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${config?.listo ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"}`}>
          {config?.listo ? "✅ Configurado" : "⏳ Falta completar"}
        </div>
        {config?.listo && (
          <div className={`px-3 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${numeroConfirmado ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300" : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"}`}>
            {numeroConfirmado ? `📱 Meta confirma: ${numeroConfirmado.numero} (${numeroConfirmado.nombreVerificado})` : "⚠️ No se pudo confirmar el número contra Meta — revisá el phone_number_id/token"}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-5 space-y-4 shadow-sm">
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Credenciales de Meta</p>
        <div>
          <label className={labelClass}>Identificador del número (phone_number_id)</label>
          <input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} placeholder="Ej: 1194980067042611" className={inputClass} />
          <p className="text-[10px] text-slate-400 mt-1">Meta → WhatsApp → Configuración de la API → "Identificador de número de teléfono".</p>
        </div>
        <div>
          <label className={labelClass}>WABA ID (WhatsApp Business Account)</label>
          <input value={wabaId} onChange={(e) => setWabaId(e.target.value)} placeholder="Ej: 123456789012345" className={inputClass} />
          <p className="text-[10px] text-slate-400 mt-1">Meta Business Suite → Cuentas de WhatsApp — es distinto del phone_number_id. Lo pide el envío de plantillas (fuera de la ventana de 24hs).</p>
        </div>
        <div>
          <label className={labelClass}>Secreto de la app de Meta</label>
          {secretos.appSecretCargado ? <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mb-1">Cargado (se guarda cifrado).</p> : null}
          <input type="password" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} placeholder="•••••••• (dejalo vacío para no cambiarlo)" className={inputClass} />
          <p className="text-[10px] text-slate-400 mt-1">Meta → tu app → Configuración → Básica → Clave secreta de la app. Sin ella no entra ningún mensaje.</p>
        </div>
        <div>
          <label className={labelClass}>Access Token</label>
          <div className="mb-2"><TokenCargado resumen={tokenCargado} actualizado={config?.updated_at} /></div>
          <input type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder={config?.listo ? "•••••••• (dejalo vacío para no cambiarlo)" : "Pegá el token temporal o permanente"} className={inputClass} />
          <p className="text-[10px] text-slate-400 mt-1">Se guarda cifrado. El token temporal de Meta vence en 24hs — para producción generá uno permanente (System User) en Meta Business Suite.</p>
        </div>
        <div>
          <label className={labelClass}>Nombre del bot (opcional)</label>
          <input value={botNombre} onChange={(e) => setBotNombre(e.target.value)} placeholder="Sin nombre propio — responde en nombre de la inmobiliaria" className={inputClass} />
          <p className="text-[10px] text-slate-400 mt-1">Es el nombre con el que se presenta el asistente cuando contesta por WhatsApp.</p>
        </div>
        <div>
          <label className={labelClass}>Tono de conversación (opcional)</label>
          <input value={tono} onChange={(e) => setTono(e.target.value)} placeholder="Ej: cercano y directo, sin formalismos" className={inputClass} />
          <p className="text-[10px] text-slate-400 mt-1">Reemplaza el tono por defecto ("amable, profesional, claro y breve") en las respuestas de la IA. Dejalo vacío para usar el default.</p>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className={labelClass}>Horario de atención — desde</label>
            <div className="w-full"><SelectorWeb valor={String(horarioInicio)} onCambio={(v) => setHorarioInicio(Number(v))} claseBoton={inputClass} opciones={Array.from({ length: 24 }, (_, h) => ({ valor: String(h), etiqueta: `${String(h).padStart(2, "0")}:00` }))} /></div>
          </div>
          <div>
            <label className={labelClass}>Horario de atención — hasta</label>
            <div className="w-full"><SelectorWeb valor={String(horarioFin)} onCambio={(v) => setHorarioFin(Number(v))} claseBoton={inputClass} opciones={Array.from({ length: 24 }, (_, h) => h + 1).map((h) => ({ valor: String(h), etiqueta: `${String(h % 24).padStart(2, "0")}:00` }))} /></div>
          </div>
          <p className="text-[10px] text-slate-400 col-span-2 -mt-1">Vale para los bots de WhatsApp, Instagram y Messenger (el chat de la web atiende las 24 horas). Fuera de este rango la IA no responde: manda el aviso de &quot;fuera de horario&quot; configurado abajo (uno por noche) y a las 9 de la mañana siguiente, el &quot;mensaje de la mañana&quot;, si nadie le contestó antes.</p>
        </div>
        {mensaje && <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{mensaje}</p>}
        <button onClick={guardar} disabled={guardando} className="px-4 py-2.5 rounded-xl bg-[#0145F2] hover:bg-[#0138c9] text-white text-sm font-bold disabled:opacity-50 flex items-center gap-1.5">
          {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Guardar
        </button>
      </div>

      <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-5 space-y-4 shadow-sm">
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Webhook — cargalo en Meta</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">En Meta → WhatsApp → Configuración → Webhook → Editar, pegá estos dos valores y suscribite al campo <b>messages</b>.</p>

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

      <EstadoMeta />
      <PlantillasWhatsapp />
      <MemoriaBot />
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

interface Plantilla {
  id: string;
  nombre: string;
  idioma: string;
  categoria: string;
  cuerpo: string;
  estado: "pending" | "approved" | "rejected";
  motivo_rechazo: string | null;
}

const ESTADO_LABEL: Record<Plantilla["estado"], { texto: string; clase: string }> = {
  approved: { texto: "Aprobada", clase: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" },
  pending: { texto: "Pendiente en Meta", clase: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" },
  rejected: { texto: "Rechazada", clase: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300" },
};

function PlantillasWhatsapp() {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState("");
  const [nueva, setNueva] = useState({ nombre: "", idioma: "es_AR", categoria: "UTILITY", cuerpo: "" });

  const cargar = async () => {
    setCargando(true);
    const res = await fetch("/api/panel/whatsapp/templates");
    const data = await res.json();
    if (res.ok) setPlantillas(data.templates || []);
    setCargando(false);
  };
  useEffect(() => { cargar(); }, []);

  const sincronizar = async () => {
    setSincronizando(true);
    setError("");
    try {
      const res = await fetch("/api/panel/whatsapp/templates/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await cargar();
      if (data.importadas > 0 || data.actualizadas > 0) {
        avisar(`Sincronizado con Meta: ${data.importadas} plantilla${data.importadas === 1 ? "" : "s"} nueva${data.importadas === 1 ? "" : "s"} importada${data.importadas === 1 ? "" : "s"}, ${data.actualizadas} actualizada${data.actualizadas === 1 ? "" : "s"}.`);
      } else {
        avisar("Ya estaba todo al día — no había plantillas nuevas ni cambios de estado en Meta.");
      }
    } catch (e: any) {
      setError(e.message || "Error sincronizando con Meta.");
    } finally {
      setSincronizando(false);
    }
  };

  // Plantillas para los casos reales (lib/panel/plantillasSugeridas.ts): se mandan a Meta con un clic.
  const [creandoSugerida, setCreandoSugerida] = useState<string | null>(null);
  const crearSugerida = async (s: PlantillaSugerida) => {
    setCreandoSugerida(s.nombre);
    setError("");
    try {
      const res = await fetch("/api/panel/whatsapp/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: s.nombre, idioma: "es_AR", categoria: s.categoria ?? "UTILITY", cuerpo: s.cuerpo, ejemplos: s.ejemplos }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await cargar();
    } catch (e) {
      setError(`${s.titulo}: ${e instanceof Error && e.message ? e.message : "no se pudo crear."}`);
    } finally {
      setCreandoSugerida(null);
    }
  };

  const [borrando, setBorrando] = useState<string | null>(null);
  const borrar = async (p: Plantilla) => {
    const ok = await confirmar({ titulo: `¿Borrar la plantilla "${p.nombre}"?`, mensaje: esPlantillaDeEjemploMeta(p.nombre) ? "Es un ejemplo que Meta carga en todas las cuentas: no se puede borrar allá, se saca solo de esta lista." : "Se borra también en Meta y no se puede deshacer. Ese nombre no se puede volver a usar por unas semanas.", textoConfirmar: "Borrar", peligro: true });
    if (!ok) return;
    setBorrando(p.id);
    setError("");
    try {
      const res = await fetch(`/api/panel/whatsapp/templates?id=${p.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await cargar();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "No se pudo borrar la plantilla.");
    } finally {
      setBorrando(null);
    }
  };

  const crear = async () => {
    if (!nueva.nombre.trim() || !nueva.cuerpo.trim()) return;
    setCreando(true);
    setError("");
    try {
      const res = await fetch("/api/panel/whatsapp/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nueva),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNueva({ nombre: "", idioma: "es_AR", categoria: "UTILITY", cuerpo: "" });
      await cargar();
    } catch (e: any) {
      setError(e.message || "Error creando la plantilla.");
    } finally {
      setCreando(false);
    }
  };

  return (
    <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-5 space-y-4 mt-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Plantillas (fuera de ventana 24hs)</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Cuando pasaron 24hs desde el último mensaje del cliente, Meta rechaza texto libre — hay que usar una plantilla aprobada. Se crean acá, Meta tarda en aprobarlas (minutos a horas); "Sincronizar" trae el estado actualizado.</p>
        </div>
        <button onClick={sincronizar} disabled={sincronizando} className="shrink-0 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 disabled:opacity-50 flex items-center gap-1.5">
          {sincronizando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Sincronizar
        </button>
      </div>

      {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}

      {cargando ? (
        <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>
      ) : (
        <div className="space-y-2">
          {plantillas.length === 0 && <p className="text-xs text-slate-400 italic">Sin plantillas creadas todavía.</p>}
          {plantillas.map((p) => (
            <div key={p.id} className="rounded-xl border border-slate-200 dark:border-white/10 p-3 text-xs">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-bold text-slate-700 dark:text-slate-200 font-mono">{p.nombre}</span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${ESTADO_LABEL[p.estado].clase}`}>{ESTADO_LABEL[p.estado].texto}</span>
                  <button onClick={() => borrar(p)} disabled={borrando === p.id} aria-label={`Borrar ${p.nombre}`} title="Borrar plantilla" className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 disabled:opacity-50">
                    {borrando === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-300">{p.cuerpo}</p>
              {p.estado === "rejected" && p.motivo_rechazo && (
                <p className="text-[10px] text-rose-500 mt-1">Motivo: {p.motivo_rechazo}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-slate-100 dark:border-white/10 pt-4 space-y-2">
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Plantillas para los casos de todos los días</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Los datos entre {"{{ }}"} los completa el vendedor al mandarla. Meta las revisa antes de aprobarlas.</p>
        {PLANTILLAS_SUGERIDAS.map((s) => {
          const yaEsta = plantillas.some((p) => p.nombre === s.nombre);
          return (
            <div key={s.nombre} className="rounded-xl border border-slate-200 dark:border-white/10 p-3 text-xs flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-700 dark:text-slate-200">{s.titulo}</p>
                <p className="text-slate-600 dark:text-slate-300 mt-0.5">{s.cuerpo}</p>
                <p className="text-[10px] text-slate-400 mt-1">{s.datos.map((d, i) => `{{${i + 1}}} ${d.toLowerCase()}`).join(" · ")}</p>
              </div>
              {yaEsta ? (
                <span className="shrink-0 text-[10px] font-bold text-slate-400 py-1.5">Ya creada</span>
              ) : (
                <button onClick={() => crearSugerida(s)} disabled={!!creandoSugerida} className="shrink-0 px-3 py-1.5 rounded-lg bg-[#0145F2] hover:bg-[#0138c9] text-white text-[11px] font-bold disabled:opacity-50 flex items-center gap-1">
                  {creandoSugerida === s.nombre ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Crear
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-slate-100 dark:border-white/10 pt-4 space-y-2.5">
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Crear otra plantilla</p>
        <div>
          <label className={labelClass}>Nombre (sin espacios ni tildes)</label>
          <input value={nueva.nombre} onChange={(e) => setNueva((n) => ({ ...n, nombre: e.target.value }))} placeholder="Ej: seguimiento_consulta" className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className={labelClass}>Idioma</label>
            <input value={nueva.idioma} onChange={(e) => setNueva((n) => ({ ...n, idioma: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Categoría</label>
            <div className="w-full"><SelectorWeb valor={nueva.categoria} onCambio={(v) => setNueva((n) => ({ ...n, categoria: v }))} claseBoton={inputClass} opciones={[{ valor: "UTILITY", etiqueta: "Utilidad" }, { valor: "MARKETING", etiqueta: "Marketing" }]} /></div>
          </div>
        </div>
        <div>
          <label className={labelClass}>Cuerpo del mensaje</label>
          <textarea value={nueva.cuerpo} onChange={(e) => setNueva((n) => ({ ...n, cuerpo: e.target.value }))} rows={3} placeholder="Hola {{1}}, seguimos en contacto por tu consulta." className={inputClass} />
          <p className="text-[10px] text-slate-400 mt-1">Hasta 4 datos, numerados de corrido: {"{{1}}"}, {"{{2}}"}… No puede empezar ni terminar con un dato.</p>
        </div>
        <button onClick={crear} disabled={creando} className="px-4 py-2.5 rounded-xl bg-[#0145F2] hover:bg-[#0138c9] text-white text-sm font-bold disabled:opacity-50 flex items-center gap-1.5">
          {creando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Enviar a aprobación de Meta
        </button>
      </div>
    </div>
  );
}
