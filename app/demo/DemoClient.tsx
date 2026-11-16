"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw, Send, Sparkles, ChevronLeft, CheckCheck } from "lucide-react";
import { chatDemo, type RespuestaChatDemo } from "./acciones";
import ResumenResaltado from "@/components/panel/conversaciones/ResumenResaltado";
import { combinarDatos, resumenDesdeDatos } from "@/lib/simulador/resumenPlantilla";
import { MAX_CARACTERES_MENSAJE } from "@/lib/simulador/limites";
import { CANALES_DEMO, type Calificacion, type CanalDemo, type DatosLead, type EstadoLeadDemo, type LeadDemo, type MensajeDemo, type RubroPublico } from "@/lib/simulador/tipos";

// Simulador de canales + panel de leads de ejemplo. La charla vive solo en este navegador: "Reiniciar demo" la borra.
// Pantalla compartida con dental-bot y automotora (dental-bot docs/simulador.md); lo propio del rubro llega en `rubro`.

type Burbuja = MensajeDemo & { nota?: boolean; hora: string };
type Charla = { burbujas: Burbuja[]; datos: DatosLead; calificacion: Calificacion | null; derivada: boolean };

const NOMBRE_CANAL: Record<CanalDemo, string> = { whatsapp: "WhatsApp", instagram: "Instagram", messenger: "Messenger" };
const PUNTO_CANAL: Record<CanalDemo, string> = { whatsapp: "bg-[#25D366]", instagram: "bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]", messenger: "bg-[#0084FF]" };

// Apariencia de cada canal: cabecera, fondo y burbujas (cliente a la derecha, negocio a la izquierda).
const PIEL: Record<CanalDemo, { cabecera: string; fondo: string; mia: string; suya: string; boton: string; input: string }> = {
  whatsapp: { cabecera: "bg-[#075E54] text-white", fondo: "bg-[#ECE5DD]", mia: "bg-[#DCF8C6] text-slate-900 rounded-lg rounded-tr-none", suya: "bg-white text-slate-900 rounded-lg rounded-tl-none", boton: "bg-[#00A884] text-white", input: "bg-white rounded-full" },
  instagram: { cabecera: "bg-white text-slate-900 border-b border-slate-200", fondo: "bg-white", mia: "bg-gradient-to-r from-[#7B3FE4] to-[#3797F0] text-white rounded-3xl", suya: "bg-[#EFEFEF] text-slate-900 rounded-3xl", boton: "bg-[#3797F0] text-white", input: "bg-white rounded-full border border-slate-300" },
  messenger: { cabecera: "bg-white text-slate-900 border-b border-slate-200", fondo: "bg-white", mia: "bg-[#0084FF] text-white rounded-2xl", suya: "bg-[#F0F0F0] text-slate-900 rounded-2xl", boton: "bg-[#0084FF] text-white", input: "bg-[#F0F0F0] rounded-full" },
};

const ESTADO_LABEL: Record<EstadoLeadDemo, string> = { nuevo: "Nuevo", asignado: "Asignado", calificando: "Calificando", convertido: "Convertido", perdido: "Perdido" };
const TEMP: Record<Calificacion, { label: string; clase: string }> = {
  caliente: { label: "Caliente", clase: "bg-red-100 text-red-700" },
  tibio: { label: "Tibio", clase: "bg-amber-100 text-amber-700" },
  frio: { label: "Frío", clase: "bg-sky-100 text-sky-700" },
};

const horaAhora = () => new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
const charlaVacia = (): Charla => ({ burbujas: [], datos: {}, calificacion: null, derivada: false });
const charlasVacias = (): Record<CanalDemo, Charla> => ({ whatsapp: charlaVacia(), instagram: charlaVacia(), messenger: charlaVacia() });
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function DemoClient({ rubro, canalInicial }: { rubro: RubroPublico; canalInicial: CanalDemo }) {
  const [canal, setCanal] = useState<CanalDemo>(canalInicial);
  const [charlas, setCharlas] = useState(charlasVacias);
  const [texto, setTexto] = useState("");
  const [escribiendo, setEscribiendo] = useState(false);
  const [vista, setVista] = useState<"chat" | "panel">("chat");
  const [leadAbierto, setLeadAbierto] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<CanalDemo | "todos">("todos");
  const fin = useRef<HTMLDivElement>(null);

  const charla = charlas[canal];
  const piel = PIEL[canal];
  const nombreSucursal = (slug: string) => rubro.sucursales.find((s) => s.slug === slug)?.nombre ?? null;

  useEffect(() => { fin.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [charla.burbujas.length, escribiendo]);

  async function enviar(mensaje: string) {
    const limpio = mensaje.trim().slice(0, MAX_CARACTERES_MENSAJE);
    if (!limpio || escribiendo) return;
    const canalDeEnvio = canal;
    const previa = charlas[canalDeEnvio];
    const historial: MensajeDemo[] = [...previa.burbujas.filter((b) => !b.nota).map(({ role, content }) => ({ role, content })), { role: "user", content: limpio }];
    setCharlas((c) => ({ ...c, [canalDeEnvio]: { ...c[canalDeEnvio], burbujas: [...c[canalDeEnvio].burbujas, { role: "user", content: limpio, hora: horaAhora() }] } }));
    setTexto("");
    setEscribiendo(true);
    let respuesta: RespuestaChatDemo;
    try {
      respuesta = await chatDemo({ rubro: rubro.slug, canal: canalDeEnvio, historial });
    } catch {
      respuesta = { mensajes: ["Perdón, se me cortó la conexión. ¿Me lo repetís?"] };
    }
    const mensajes = respuesta.mensajes?.length ? respuesta.mensajes : ["Perdón, no te entendí. ¿Me lo repetís?"];
    // Cada parte llega como un mensaje aparte, con una pausa corta, igual que en el canal real.
    for (let i = 0; i < mensajes.length; i++) {
      if (i > 0) { setEscribiendo(true); await esperar(700); }
      const burbuja: Burbuja = { role: "assistant", content: mensajes[i], hora: horaAhora() };
      setCharlas((c) => ({ ...c, [canalDeEnvio]: { ...c[canalDeEnvio], burbujas: [...c[canalDeEnvio].burbujas, burbuja] } }));
      setEscribiendo(false);
    }
    setCharlas((c) => {
      const actual = c[canalDeEnvio];
      const derivaAhora = !!respuesta.handoff && !actual.derivada;
      const nota: Burbuja[] = derivaAhora ? [{ role: "assistant", nota: true, hora: horaAhora(), content: "La charla pasó a un asesor: en el sistema real le llega un aviso y sigue él desde el panel." }] : [];
      return { ...c, [canalDeEnvio]: { burbujas: [...actual.burbujas, ...nota], datos: combinarDatos(actual.datos, respuesta.datos), calificacion: respuesta.calificacion ?? actual.calificacion, derivada: actual.derivada || !!respuesta.handoff } };
    });
  }

  function reiniciar() {
    setCharlas(charlasVacias());
    setLeadAbierto(null);
    setTexto("");
  }

  // Las charlas de la demo aparecen arriba de la bandeja, como leads nuevos.
  const leadsEnVivo: LeadDemo[] = CANALES_DEMO.filter((c) => charlas[c].burbujas.length > 0).map((c) => {
    const ch = charlas[c];
    return {
      id: `vivo-${c}`, nombre: ch.datos.nombre || `Vos (demo ${NOMBRE_CANAL[c]})`, canal: c, estado: ch.derivada ? "asignado" : "calificando",
      calificacion: ch.calificacion ?? "tibio", asesor: ch.derivada ? rubro.asesores[0] ?? null : null, hace: "ahora",
      resumen: resumenDesdeDatos({ datos: ch.datos, canal: c, calificacion: ch.calificacion, queBusca: rubro.queBusca, nombreSucursal }),
      charla: ch.burbujas.filter((b) => !b.nota).map(({ role, content }) => ({ role, content })),
    };
  });

  const todos = [...leadsEnVivo, ...rubro.leads];
  const visibles = todos.filter((l) => filtro === "todos" || l.canal === filtro);
  const abierto = todos.find((l) => l.id === leadAbierto) ?? null;

  return (
    <div className="min-h-screen bg-[#F6F1EA] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-black/5 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">{rubro.nombreNegocio}</p>
            <p className="text-xs text-slate-500">Demo: el bot todavía no está conectado a tu número. Los datos son de ejemplo.</p>
          </div>
          <button onClick={reiniciar} className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
            <RotateCcw size={14} /> Reiniciar demo
          </button>
        </div>
        <div className="mx-auto flex max-w-6xl gap-2 px-4 pb-2 lg:hidden">
          {(["chat", "panel"] as const).map((v) => (
            <button key={v} onClick={() => setVista(v)} className={`flex-1 rounded-full py-1.5 text-sm font-medium ${vista === v ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>
              {v === "chat" ? "Chat del cliente" : `Panel (${todos.length} leads)`}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-4 lg:grid-cols-[400px_1fr]">
        {/* Celular con el canal elegido */}
        <section className={`${vista === "chat" ? "block" : "hidden"} lg:block`}>
          <div className="mb-3 flex gap-1 rounded-full bg-white p-1 shadow-sm">
            {CANALES_DEMO.map((c) => (
              <button key={c} onClick={() => setCanal(c)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-sm ${canal === c ? "bg-slate-900 text-white" : "text-slate-600"}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${PUNTO_CANAL[c]}`} /> {NOMBRE_CANAL[c]}
              </button>
            ))}
          </div>
          <div className="mx-auto flex h-[70vh] max-h-[720px] min-h-[480px] w-full max-w-[400px] flex-col overflow-hidden rounded-[2rem] border-[6px] border-slate-900 bg-white shadow-xl">
            <div className={`flex items-center gap-3 px-4 py-3 ${piel.cabecera}`}>
              <ChevronLeft size={20} className="opacity-80" />
              <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white ${canal === "whatsapp" ? "bg-[#128C7E]" : PUNTO_CANAL[canal]}`}>{rubro.nombreNegocio.charAt(0)}</div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{rubro.nombreNegocio}</p>
                <p className="text-xs opacity-70">{escribiendo ? "escribiendo…" : "en línea"}</p>
              </div>
            </div>

            <div className={`flex-1 space-y-2 overflow-y-auto px-3 py-4 ${piel.fondo}`}>
              {charla.burbujas.length === 0 && (
                <div className="space-y-2 pt-6 text-center">
                  <p className="text-sm text-slate-500">Escribí como si fueras un cliente de {rubro.nombreNegocio}.</p>
                  <div className="flex flex-wrap justify-center gap-2 pt-2">
                    {rubro.sugerencias.map((s) => (
                      <button key={s} onClick={() => enviar(s)} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50">{s}</button>
                    ))}
                  </div>
                </div>
              )}
              {charla.burbujas.map((b, i) => b.nota ? (
                <p key={i} className="mx-auto max-w-[85%] rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">{b.content}</p>
              ) : (
                <div key={i} className={`flex ${b.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] whitespace-pre-wrap px-3 py-2 text-sm shadow-sm ${b.role === "user" ? piel.mia : piel.suya}`}>
                    {b.content}
                    {canal === "whatsapp" && (
                      <span className="ml-2 inline-flex translate-y-1 items-center gap-0.5 text-[10px] text-slate-500">{b.hora}{b.role === "user" && <CheckCheck size={12} className="text-sky-500" />}</span>
                    )}
                  </div>
                </div>
              ))}
              {escribiendo && (
                <div className="flex justify-start">
                  <div className={`px-3 py-2 text-sm ${piel.suya}`}><span className="inline-flex gap-1"><Punto d="0ms" /><Punto d="150ms" /><Punto d="300ms" /></span></div>
                </div>
              )}
              <div ref={fin} />
            </div>

            <form onSubmit={(e) => { e.preventDefault(); enviar(texto); }} className={`flex items-center gap-2 px-2 py-2 ${canal === "whatsapp" ? "bg-[#F0F0F0]" : "bg-white"}`}>
              <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={MAX_CARACTERES_MENSAJE} placeholder={canal === "whatsapp" ? "Mensaje" : "Enviar mensaje…"}
                className={`min-w-0 flex-1 px-4 py-2 text-sm outline-none ${piel.input}`} />
              <button type="submit" disabled={!texto.trim() || escribiendo} aria-label="Enviar" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-40 ${piel.boton}`}>
                <Send size={16} />
              </button>
            </form>
          </div>
        </section>

        {/* Panel de la inmobiliaria: bandeja única y ficha del lead */}
        <section className={`${vista === "panel" ? "block" : "hidden"} min-w-0 lg:block`}>
          {abierto ? (
            <FichaDemo key={abierto.id} lead={abierto} onVolver={() => setLeadAbierto(null)} />
          ) : (
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Leads</h2>
                <div className="flex flex-wrap gap-1">
                  {(["todos", ...CANALES_DEMO] as const).map((f) => (
                    <button key={f} onClick={() => setFiltro(f)} className={`rounded-full px-3 py-1 text-xs ${filtro === f ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>
                      {f === "todos" ? "Todos" : NOMBRE_CANAL[f]}
                    </button>
                  ))}
                </div>
              </div>
              <ul className="divide-y divide-slate-100">
                {visibles.map((l) => (
                  <li key={l.id}>
                    <button onClick={() => setLeadAbierto(l.id)} className="flex w-full items-center gap-3 py-3 text-left hover:bg-slate-50">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${PUNTO_CANAL[l.canal]}`} />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 truncate text-sm font-medium">
                          {l.nombre}
                          {l.id.startsWith("vivo-") && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">EN VIVO</span>}
                        </p>
                        <p className="truncate text-xs text-slate-500">{l.charla[l.charla.length - 1]?.content ?? ""}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TEMP[l.calificacion].clase}`}>{TEMP[l.calificacion].label}</span>
                        <p className="mt-1 text-[10px] text-slate-400">{l.hace}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Punto({ d }: { d: string }) {
  return <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: d }} />;
}

// Ficha del lead. "Resumir" muestra un resumen ya armado (escrito a mano o con plantilla): en la demo no se llama a la IA.
function FichaDemo({ lead, onVolver }: { lead: LeadDemo; onVolver: () => void }) {
  const [paso, setPaso] = useState<"nada" | "generando" | "listo">("nada");
  async function resumir() {
    setPaso("generando");
    await esperar(1100);
    setPaso("listo");
  }
  return (
    <div className="space-y-4">
      <button onClick={onVolver} className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"><ChevronLeft size={16} /> Volver a la bandeja</button>
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{lead.nombre}</h2>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TEMP[lead.calificacion].clase}`}>{TEMP[lead.calificacion].label}</span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {NOMBRE_CANAL[lead.canal]} · {ESTADO_LABEL[lead.estado]} · {lead.asesor ? `Asesor: ${lead.asesor}` : "Sin asesor asignado"}
        </p>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 font-semibold"><Sparkles size={16} className="text-violet-600" /> Resumen de la conversación</h3>
          <button onClick={resumir} disabled={paso === "generando"} className="rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
            {paso === "listo" ? "Volver a resumir" : "Resumir"}
          </button>
        </div>
        {paso === "nada" && <p className="text-sm text-slate-500">Tocá &quot;Resumir&quot; para ver qué pidió el cliente sin leer toda la charla.</p>}
        {paso === "generando" && <p className="animate-pulse text-sm text-slate-500">Generando resumen…</p>}
        {paso === "listo" && <div className="text-sm"><ResumenResaltado texto={lead.resumen} /></div>}
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h3 className="mb-3 font-semibold">Conversación</h3>
        <div className="space-y-2">
          {lead.charla.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "bg-slate-100" : "bg-violet-50 text-violet-900"}`}>
                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-60">{m.role === "user" ? "Cliente" : "Bot"}</p>
                {m.content}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
