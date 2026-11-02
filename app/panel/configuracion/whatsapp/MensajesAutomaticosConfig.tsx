"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ANIOS_RENOVACION_DEFAULT, PLANTILLA_CUMPLEANOS, PLANTILLA_CUMPLEANOS_RENOVACION, PLANTILLA_FIN_DE_PAGO } from "@/lib/panel/mensajesAutomaticos";

// Interruptores de los mensajes automáticos a clientes por WhatsApp (Walter, 20/10/2026): cumpleaños y fin de pago.
// Arrancan apagados. Para que salgan hace falta la plantilla aprobada por Meta (se crea con un clic en "Plantillas
// sugeridas", más abajo). Reglas en lib/panel/mensajesAutomaticos.ts.

type Estado = { cumple: boolean | null; finPago: boolean | null; renovacion: boolean | null; anios: number };

export default function MensajesAutomaticosConfig() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  // null = la columna todavía no existe (falta el SQL).
  const leer = async (): Promise<Estado> => {
    const res = await fetch("/api/panel/configuracion-empresa");
    const data = await res.json().catch(() => null);
    const fila = data?.config;
    return {
      cumple: fila && "mensaje_cumpleanos_activo" in fila ? !!fila.mensaje_cumpleanos_activo : null,
      finPago: fila && "mensaje_fin_pago_activo" in fila ? !!fila.mensaje_fin_pago_activo : null,
      renovacion: fila && "mensaje_renovacion_activo" in fila ? !!fila.mensaje_renovacion_activo : null,
      anios: Number(fila?.renovacion_anios) > 0 ? Number(fila.renovacion_anios) : ANIOS_RENOVACION_DEFAULT,
    };
  };
  const cargar = async () => setEstado(await leer());
  useEffect(() => {
    let vivo = true;
    leer().then((e) => { if (vivo) setEstado(e); });
    return () => { vivo = false; };
  }, []);

  const guardar = async (patch: Record<string, boolean | number>, ok: string) => {
    setGuardando(true); setMensaje("");
    const res = await fetch("/api/panel/configuracion-empresa", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    const data = await res.json().catch(() => ({}));
    setMensaje(res.ok ? ok : data.error || "No se pudo guardar.");
    setGuardando(false);
    if (res.ok) cargar();
    setTimeout(() => setMensaje(""), 3000);
  };

  return (
    <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm p-5 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Mensajes automáticos a clientes</h3>
        <p className="text-xs text-slate-400 mt-1">Salen solos por WhatsApp a las 9 de la mañana, una sola vez por cliente. Cada mensaje lo cobra Meta (unos US$ 0,06). Para que salgan, la plantilla tiene que estar aprobada: creala abajo, en Plantillas sugeridas.</p>
      </div>
      {!estado ? (
        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
      ) : (
        <>
          <Interruptor titulo="Feliz cumpleaños" texto={`El día del cumpleaños del cliente (sale de la fecha de nacimiento de su ficha). Plantilla: ${PLANTILLA_CUMPLEANOS}.`}
            activo={estado.cumple} deshabilitado={guardando}
            onCambio={(v) => guardar({ mensaje_cumpleanos_activo: v }, v ? "Saludo de cumpleaños prendido." : "Saludo de cumpleaños apagado.")} />
          {/* Renovación (20/10/2026): reemplaza al saludo común ese día; necesita el de cumpleaños prendido. */}
          <Interruptor titulo="Cumpleaños con oferta de renovar" texto={`El día del cumpleaños, si ya pasaron ${estado.anios} años desde su última compra, el saludo sale con la oferta de renovar el auto (una vez por compra). No sale si escribió por WhatsApp en los últimos 30 días. Necesita el saludo de cumpleaños prendido. Plantilla: ${PLANTILLA_CUMPLEANOS_RENOVACION}.`}
            activo={estado.renovacion} deshabilitado={guardando}
            onCambio={(v) => guardar({ mensaje_renovacion_activo: v }, v ? "Oferta de renovar prendida." : "Oferta de renovar apagada.")} />
          {estado.renovacion !== null && (
            <label className="flex items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400 -mt-2">
              Años desde la compra para ofrecer renovar
              <input type="number" min={1} max={15} defaultValue={estado.anios} disabled={guardando} key={estado.anios}
                onBlur={(e) => { const n = Math.round(Number(e.target.value)); if (n >= 1 && n <= 15 && n !== estado.anios) guardar({ renovacion_anios: n }, `Se ofrece renovar a los ${n} años.`); }}
                className="w-16 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 text-sm text-right outline-none" />
            </label>
          )}
          <Interruptor titulo="Terminó de pagar" texto={`A principio del mes en que vence su última cuota, sumando las que cobra la agencia y las de la financiera. Plantilla: ${PLANTILLA_FIN_DE_PAGO}.`}
            activo={estado.finPago} deshabilitado={guardando}
            onCambio={(v) => guardar({ mensaje_fin_pago_activo: v }, v ? "Mensaje de fin de pago prendido." : "Mensaje de fin de pago apagado.")} />
        </>
      )}
      {mensaje && <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{mensaje}</p>}
    </div>
  );
}

function Interruptor({ titulo, texto, activo, deshabilitado, onCambio }: { titulo: string; texto: string; activo: boolean | null; deshabilitado: boolean; onCambio: (v: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer border-t border-slate-100 dark:border-white/5 pt-4 first:border-0 first:pt-0">
      <span>
        <span className="block text-sm font-bold text-slate-800 dark:text-white">{titulo}</span>
        <span className="block text-xs text-slate-400 mt-1">{texto}</span>
        {activo === null && <span className="block text-[11px] text-amber-600 mt-1">Falta correr el SQL de los mensajes automáticos (migraciones/sql_mensajes_automaticos.sql y sql_mensaje_renovacion.sql).</span>}
      </span>
      <input type="checkbox" checked={!!activo} disabled={deshabilitado || activo === null} onChange={(e) => onCambio(e.target.checked)} className="w-5 h-5 mt-0.5 accent-[#0145F2] shrink-0" />
    </label>
  );
}
