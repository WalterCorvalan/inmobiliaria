"use client";

import { useImperativeHandle, useState, type Ref } from "react";
import { Edit2, Wallet, Car, CalendarClock, HandCoins } from "lucide-react";
import { BTN } from "@/components/panel/detalle/DetalleUI";
import {
  CUANDO_COMPRA, FORMAS_PAGO, estaVacia, normalizarProspeccion, textoAnticipo, textoUsado,
  type CuandoCompra, type FormaPago, type ProspeccionLead,
} from "@/lib/panel/prospeccionLead";

// Calificación del lead en la ficha (FichaLeads.tsx): cómo paga, usado que entrega, anticipo y cuándo compra.
// Se elige con toques; lo único que se escribe es el usado y el monto. Reglas y forma de los datos en
// lib/panel/prospeccionLead.ts.

const inputClass = "w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0145F2]";
const etiqueta = "text-[11px] font-semibold text-slate-500 dark:text-slate-400";

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${activo ? "bg-[#0145F2] border-[#0145F2] text-white" : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"}`}
    >
      {children}
    </button>
  );
}

function Fila({ icono: Icono, titulo, valor }: { icono: typeof Wallet; titulo: string; valor: string | null }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icono className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
      <div className="min-w-0">
        <p className={etiqueta}>{titulo}</p>
        <p className={`text-[13px] ${valor ? "text-slate-800 dark:text-slate-100" : "text-slate-400"}`}>{valor || "Sin dato"}</p>
      </div>
    </div>
  );
}

/** Para leer lo cargado desde afuera cuando se usa con soloCampos (FichaLeads guarda todo junto). */
export type ProspeccionLeadRef = { valor: () => ProspeccionLead };

// soloCampos (Walter, 20/10/2026: "Editar" abría otro "Editar" adentro y era poco intuitivo): se muestra directo para
// completar, sin título ni botones propios; quien lo usa lee el valor con el ref y guarda todo junto.
// onCambio: avisa que el usuario tocó algo (FichaLeads muestra "Guardar cambios" recién ahí).
export default function ProspeccionLead({ valor, onGuardar, soloCampos = false, ref, onCambio }: {
  valor: unknown; onGuardar: (p: ProspeccionLead) => Promise<void>; soloCampos?: boolean; ref?: Ref<ProspeccionLeadRef>; onCambio?: () => void;
}) {
  const actual = normalizarProspeccion(valor);
  const [editando, setEditando] = useState(soloCampos);
  const [guardando, setGuardando] = useState(false);
  const [formas, setFormasBase] = useState<FormaPago[]>(actual.formasPago);
  const [cuando, setCuandoBase] = useState<CuandoCompra | null>(actual.cuando);
  const [entregaUsado, setEntregaUsadoBase] = useState(!!actual.usado);
  const [usado, setUsadoBase] = useState({ marca: actual.usado?.marca ?? "", modelo: actual.usado?.modelo ?? "", anio: actual.usado?.anio?.toString() ?? "", km: actual.usado?.km?.toString() ?? "" });
  const [monto, setMontoBase] = useState(actual.anticipo ? actual.anticipo.monto.toString() : "");
  const [moneda, setMonedaBase] = useState<"ARS" | "USD">(actual.anticipo?.moneda ?? "ARS");
  // Cada cambio del usuario avisa con onCambio; abrir() usa los "Base" para no contar como cambio.
  const conAviso = <T,>(set: (v: T) => void) => (v: T) => { set(v); onCambio?.(); };
  const setFormas = conAviso(setFormasBase), setCuando = conAviso(setCuandoBase), setEntregaUsado = conAviso(setEntregaUsadoBase);
  const setUsado = conAviso(setUsadoBase), setMonto = conAviso(setMontoBase), setMoneda = conAviso(setMonedaBase);

  const abrir = () => {
    setFormasBase(actual.formasPago);
    setCuandoBase(actual.cuando);
    setEntregaUsadoBase(!!actual.usado);
    setUsadoBase({ marca: actual.usado?.marca ?? "", modelo: actual.usado?.modelo ?? "", anio: actual.usado?.anio?.toString() ?? "", km: actual.usado?.km?.toString() ?? "" });
    setMontoBase(actual.anticipo ? actual.anticipo.monto.toString() : "");
    setMonedaBase(actual.anticipo?.moneda ?? "ARS");
    setEditando(true);
  };

  const alternarForma = (f: FormaPago) => {
    const nuevas = formas.includes(f) ? formas.filter((x) => x !== f) : [...formas, f];
    setFormas(nuevas);
    if (f === "permuta" && !formas.includes(f)) setEntregaUsado(true);
  };

  const valorActual = () => normalizarProspeccion({ formasPago: formas, cuando, usado: entregaUsado ? usado : null, anticipo: { monto, moneda } });
  useImperativeHandle(ref, () => ({ valor: valorActual }));

  const guardar = async () => {
    setGuardando(true);
    try {
      await onGuardar(valorActual());
      setEditando(false);
    } catch {
      // El aviso ya lo mostró quien guarda (LeadDetailModal); queda abierto para reintentar.
    } finally {
      setGuardando(false);
    }
  };

  if (!editando) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Cómo compra</p>
          <button onClick={abrir} className="flex items-center gap-1 text-xs font-bold text-[#0145F2] dark:text-sky-400"><Edit2 className="w-3 h-3" /> {estaVacia(actual) ? "Cargar" : "Editar"}</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Fila icono={Wallet} titulo="Cómo paga" valor={actual.formasPago.map((f) => FORMAS_PAGO.find((x) => x.value === f)?.label).join(" + ") || null} />
          <Fila icono={CalendarClock} titulo="Cuándo compra" valor={CUANDO_COMPRA.find((c) => c.value === actual.cuando)?.label ?? null} />
          <Fila icono={HandCoins} titulo="Anticipo" valor={actual.anticipo ? textoAnticipo(actual.anticipo) : null} />
          <Fila icono={Car} titulo="Usado que entrega" valor={actual.usado ? textoUsado(actual.usado) : null} />
        </div>
      </div>
    );
  }

  // En la ficha del lead (soloCampos) van cuatro recuadros siempre a la vista (Walter, 21/10/2026).
  const caja = soloCampos ? "rounded-xl border border-slate-200 dark:border-white/10 p-3 space-y-1.5" : "space-y-1.5";
  return (
    <div className={soloCampos ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : "space-y-4"}>
      {!soloCampos && <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Cómo compra</p>}
      <div className={caja}>
        <p className={etiqueta}>Cómo paga</p>
        <div className="flex flex-wrap gap-1.5">
          {FORMAS_PAGO.map((f) => <Chip key={f.value} activo={formas.includes(f.value)} onClick={() => alternarForma(f.value)}>{f.label}</Chip>)}
        </div>
      </div>
      <div className={caja}>
        <p className={etiqueta}>Cuándo quiere comprar</p>
        <div className="flex flex-wrap gap-1.5">
          {CUANDO_COMPRA.map((c) => <Chip key={c.value} activo={cuando === c.value} onClick={() => setCuando(cuando === c.value ? null : c.value)}>{c.label}</Chip>)}
        </div>
      </div>
      <div className={caja}>
        <p className={etiqueta}>Anticipo o presupuesto</p>
        <div className="flex gap-2">
          <input inputMode="numeric" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="Monto" className={inputClass} />
          <div className="flex gap-1 shrink-0">
            {(["ARS", "USD"] as const).map((m) => <Chip key={m} activo={moneda === m} onClick={() => setMoneda(m)}>{m === "ARS" ? "$" : "US$"}</Chip>)}
          </div>
        </div>
      </div>
      <div className={caja}>
        {soloCampos && <p className={etiqueta}>Usado que entrega</p>}
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input type="checkbox" checked={entregaUsado} onChange={(e) => setEntregaUsado(e.target.checked)} className="w-4 h-4 accent-[#0145F2]" />
          Entrega un usado
        </label>
        {entregaUsado && (
          <div className="grid grid-cols-2 gap-2">
            <input value={usado.marca} onChange={(e) => setUsado({ ...usado, marca: e.target.value })} placeholder="Marca" className={inputClass} />
            <input value={usado.modelo} onChange={(e) => setUsado({ ...usado, modelo: e.target.value })} placeholder="Modelo" className={inputClass} />
            <input inputMode="numeric" value={usado.anio} onChange={(e) => setUsado({ ...usado, anio: e.target.value })} placeholder="Año" className={inputClass} />
            <input inputMode="numeric" value={usado.km} onChange={(e) => setUsado({ ...usado, km: e.target.value })} placeholder="Km" className={inputClass} />
          </div>
        )}
      </div>
      {!soloCampos && (
        <div className="flex gap-2">
          <button onClick={guardar} disabled={guardando} className={BTN.primario}>{guardando ? "Guardando…" : "Guardar"}</button>
          <button onClick={() => setEditando(false)} className={BTN.secundario}>Cancelar</button>
        </div>
      )}
    </div>
  );
}
