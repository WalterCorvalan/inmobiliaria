"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw, Send, Sparkles, ChevronLeft, CheckCheck, ArrowRight, Building2, Check } from "lucide-react";
import Link from "next/link";
import { MODULOS_DEMO } from "@/lib/demo/modulos";
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

export type PortadaDemo = { etiqueta: string; titulo: string; destacado: string; bajada: string; puntos: string[] };

export default function DemoClient({ rubro, canalInicial, negocios, portada }: { rubro: RubroPublico; canalInicial: CanalDemo; negocios: { slug: string; nombre: string }[]; portada: PortadaDemo }) {
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

  // Baja solo dentro del chat (no mueve la página entera al abrir la demo).
  useEffect(() => {
    const caja = fin.current?.parentElement;
    if (caja && (charla.burbujas.length || escribiendo)) caja.scrollTo({ top: caja.scrollHeight, behavior: "smooth" });
  }, [charla.burbujas.length, escribiendo]);

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
    <div className="min-h-screen bg-[#F6F7F9] text-slate-900">
      <section className="relative overflow-hidden bg-[#0C0F14] text-white">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -left-48 -top-48 h-[560px] w-[560px] rounded-full bg-[#C2552D]/25 blur-[130px]" />
          <div className="absolute -right-40 top-1/3 h-[480px] w-[480px] rounded-full bg-[#F59E6B]/10 blur-[130px]" />
          <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.6)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_30%_10%,black,transparent_70%)]" />
        </div>

        <header className="relative mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-5 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#C2552D] text-white shadow-[inset_0_-2px_0_rgb(0_0_0/0.2)]"><Building2 size={19} /></span>
            {negocios.length > 1 ? (
              // Mismo bot, otro negocio: cada empresa tiene su nombre, sus reglas y su tono.
              <select aria-label="Negocio de ejemplo" value={rubro.slug} onChange={(e) => { window.location.search = `?negocio=${e.target.value}&canal=${canal}`; }}
                className="min-w-0 max-w-full truncate rounded-md bg-transparent text-[16px] font-extrabold tracking-[-0.02em] outline-none [&>option]:text-slate-900">
                {negocios.map((n) => <option key={n.slug} value={n.slug}>{n.nombre}</option>)}
              </select>
            ) : (
              <p className="truncate text-[16px] font-extrabold tracking-[-0.02em]">{rubro.nombreNegocio}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={reiniciar} className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold text-white/70 transition hover:text-white sm:flex">
              <RotateCcw size={14} /> Reiniciar
            </button>
            <Link href="/panel" className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-[13px] font-semibold ring-1 ring-white/15 transition hover:bg-white/15">
              Ver el panel
            </Link>
          </div>
        </header>

        <div className="relative mx-auto max-w-6xl px-5 pb-8 pt-4 sm:px-8 lg:pb-12 lg:pt-8">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.07] px-3 py-1.5 text-[12.5px] font-semibold text-[#FDBA8C] ring-1 ring-white/10">
              <span className="h-1.5 w-1.5 rounded-full bg-[#F97316] shadow-[0_0_10px_#F97316]" /> {portada.etiqueta}
            </span>
            <h1 className="mt-5 text-[38px] font-extrabold leading-[1.03] tracking-[-0.04em] sm:text-[50px] lg:text-[58px]">
              {portada.titulo} <span className="text-[#FB9A6A]">{portada.destacado}</span>
            </h1>
            <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-white/70">{portada.bajada}</p>
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2.5 text-[13.5px] text-white/75">
              {portada.puntos.map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#F97316]/15 text-[#FDBA8C]"><Check size={12} strokeWidth={2.6} /></span>{t}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8 flex gap-1 rounded-full bg-white/10 p-1 ring-1 ring-white/15 lg:hidden">
            {(["chat", "panel"] as const).map((v) => (
              <button key={v} onClick={() => setVista(v)} className={`flex-1 rounded-full py-2 text-[13px] font-semibold transition ${vista === v ? "bg-white text-slate-900" : "text-white/70"}`}>
                {v === "chat" ? "Chat del cliente" : `Panel · ${todos.length} leads`}
              </button>
            ))}
          </div>

          <div className="mt-6 grid items-start gap-8 lg:mt-12 lg:grid-cols-[380px_1fr]">
            {/* Celular con el canal elegido */}
            <section className={`${vista === "chat" ? "block" : "hidden"} lg:block`}>
              <div className="mx-auto mb-4 flex max-w-[360px] gap-1 rounded-full bg-white/10 p-1 ring-1 ring-white/15">
                {CANALES_DEMO.map((c) => (
                  <button key={c} onClick={() => setCanal(c)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[13px] font-semibold transition ${canal === c ? "bg-white text-slate-900" : "text-white/70 hover:text-white"}`}>
                    <span className={`h-2 w-2 rounded-full ${PUNTO_CANAL[c]}`} /> {NOMBRE_CANAL[c]}
                  </button>
                ))}
              </div>
              <div className="relative mx-auto flex h-[68vh] max-h-[680px] min-h-[500px] w-full max-w-[360px] flex-col overflow-hidden rounded-[44px] border-[10px] border-[#05070A] bg-white shadow-[0_40px_80px_-24px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.08)]">
                <div className={`flex items-center justify-between px-6 pb-1 pt-2.5 text-[12px] font-semibold ${canal === "whatsapp" ? "bg-[#075E54] text-white" : "bg-white text-slate-900"}`} aria-hidden="true">
                  <span>9:41</span>
                  <span className="absolute left-1/2 top-2 h-[22px] w-[90px] -translate-x-1/2 rounded-full bg-[#05070A]" />
                  <span className="flex items-center gap-1">
                    <svg viewBox="0 0 18 12" width="17" height="11" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5" width="3" height="7" rx="1"/><rect x="10" y="2.5" width="3" height="9.5" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
                    <svg viewBox="0 0 26 12" width="24" height="11" fill="none" stroke="currentColor"><rect x="0.5" y="0.5" width="22" height="11" rx="3"/><rect x="2.5" y="2.5" width="15" height="7" rx="1.5" fill="currentColor" stroke="none"/></svg>
                  </span>
                </div>
                <div className={`flex items-center gap-3 px-4 py-2.5 ${piel.cabecera}`}>
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
                    className={`min-w-0 flex-1 px-4 py-2 text-sm text-slate-900 outline-none ${piel.input}`} />
                  <button type="submit" disabled={!texto.trim() || escribiendo} aria-label="Enviar" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-40 ${piel.boton}`}>
                    <Send size={16} />
                  </button>
                </form>
              </div>
            </section>

            {/* Panel de la inmobiliaria: bandeja única y ficha del lead */}
            <section className={`${vista === "panel" ? "block" : "hidden"} min-w-0 text-slate-900 lg:block`}>
              <div className="overflow-hidden rounded-3xl bg-white shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)] ring-1 ring-white/10">
                <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-5 py-3">
                  <span className="flex gap-1.5" aria-hidden="true"><i className="h-2.5 w-2.5 rounded-full bg-slate-300" /><i className="h-2.5 w-2.5 rounded-full bg-slate-300" /><i className="h-2.5 w-2.5 rounded-full bg-slate-300" /></span>
                  <span className="ml-2 text-[12px] font-semibold text-slate-500">Tu panel · Leads de todos los canales</span>
                  <span className="ml-auto flex items-center gap-1.5 text-[11.5px] font-semibold text-emerald-600"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> en vivo</span>
                </div>
                {abierto ? (
                  <div className="p-5"><FichaDemo key={abierto.id} lead={abierto} onVolver={() => setLeadAbierto(null)} /></div>
                ) : (
                  <div className="p-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-[20px] font-extrabold tracking-[-0.02em]">Leads <span className="ml-1 text-[14px] font-semibold text-slate-400">{visibles.length}</span></h2>
                      <div className="flex flex-wrap gap-1">
                        {(["todos", ...CANALES_DEMO] as const).map((f) => (
                          <button key={f} onClick={() => setFiltro(f)} className={`rounded-full px-3 py-1 text-[12px] font-semibold transition ${filtro === f ? "bg-slate-900 text-white" : "text-slate-500 ring-1 ring-inset ring-slate-200 hover:text-slate-900"}`}>
                            {f === "todos" ? "Todos" : NOMBRE_CANAL[f]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <ul className="-mx-2">
                      {visibles.map((l) => (
                        <li key={l.id}>
                          <button onClick={() => setLeadAbierto(l.id)} className={`flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-slate-50 ${l.id.startsWith("vivo-") ? "bg-emerald-50/60" : ""}`}>
                            <span className="relative shrink-0">
                              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-[13px] font-bold text-slate-600">{l.nombre.replace(/^[@(]+/, "").slice(0, 1).toUpperCase()}</span>
                              <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-white ${PUNTO_CANAL[l.canal]}`} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="flex items-center gap-2 truncate text-[14px] font-bold">
                                {l.nombre}
                                {l.id.startsWith("vivo-") && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-emerald-700">EN VIVO</span>}
                              </p>
                              <p className="truncate text-[12.5px] text-slate-500">{l.charla[l.charla.length - 1]?.content ?? ""}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${TEMP[l.calificacion].clase}`}>{TEMP[l.calificacion].label}</span>
                              <p className="mt-1 text-[10.5px] text-slate-400">{l.hace}</p>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </section>

      {/* Todos los módulos del sistema, con datos de ejemplo y sin usuario (Walter, 23/11/2026). */}
      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:py-24">
        <div>
          <p className="mb-2 text-[13px] font-bold uppercase tracking-[0.1em] text-[#C2552D]">El panel</p>
          <h2 className="text-[30px] font-extrabold leading-tight tracking-[-0.03em] sm:text-[38px]">Mirá todo el sistema por dentro.</h2>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-slate-500">Además del bot, tu equipo trabaja con estos módulos. Entrá a cualquiera: tiene datos de ejemplo y no hace falta usuario.</p>
          <Link href="/panel" className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-[14.5px] font-bold text-white transition hover:bg-slate-800">
            Abrir el panel de ejemplo <ArrowRight size={16} />
          </Link>
        </div>
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {MODULOS_DEMO.map((m) => (
            <li key={m.href}>
              <Link href={m.href} className="group flex items-center gap-4 px-5 py-4 transition hover:bg-slate-50">
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold">{m.nombre}</span>
                  <span className="block text-[13.5px] text-slate-500">{m.detalle}</span>
                </span>
                <ArrowRight size={17} className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-900" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <footer className="border-t border-slate-200">
        <p className="mx-auto max-w-6xl px-5 py-8 text-[13px] text-slate-400 sm:px-8">Demo con datos de ejemplo. El bot todavía no está conectado a ningún número real.</p>
      </footer>
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
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{lead.nombre}</h2>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TEMP[lead.calificacion].clase}`}>{TEMP[lead.calificacion].label}</span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {NOMBRE_CANAL[lead.canal]} · {ESTADO_LABEL[lead.estado]} · {lead.asesor ? `Asesor: ${lead.asesor}` : "Sin asesor asignado"}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 font-semibold"><Sparkles size={16} className="text-[#C2552D]" /> Resumen de la conversación</h3>
          <button onClick={resumir} disabled={paso === "generando"} className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
            {paso === "listo" ? "Volver a resumir" : "Resumir"}
          </button>
        </div>
        {paso === "nada" && <p className="text-sm text-slate-500">Tocá &quot;Resumir&quot; para ver qué pidió el cliente sin leer toda la charla.</p>}
        {paso === "generando" && <p className="animate-pulse text-sm text-slate-500">Generando resumen…</p>}
        {paso === "listo" && <div className="text-sm"><ResumenResaltado texto={lead.resumen} /></div>}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 font-semibold">Conversación</h3>
        <div className="space-y-2">
          {lead.charla.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "bg-slate-100" : "bg-[#FDF0EA] text-[#7A2E14]"}`}>
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
