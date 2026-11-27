import { createClient } from "@/lib/supabase/server";
import { hoyArgentina } from "@/lib/panel/inicio";
import { puedeVerFinanzas } from "@/lib/panel/permisosModulos";
import type { Movimiento } from "@/lib/finanzas/finanzas";
import type { OperacionCerrada } from "@/lib/finanzas/operaciones";
import FinanzasClient from "./FinanzasClient";

export const metadata = { title: "Finanzas | Inmobiliaria CRM" };

// Finanzas simple (Walter, 26/11/2026): cuánto entró y cuánto se gastó, en dólares y en pesos por separado, y los honorarios
// que quedan para la inmobiliaria. Solo para el dueño, el director y el encargado.
export default async function FinanzasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: yo } = await supabase.from("perfiles").select("roles").eq("id", user?.id ?? "").maybeSingle();
  if (!puedeVerFinanzas(yo?.roles)) {
    return (
      <div className="im-page"><div className="im-head"><div><h1>Finanzas</h1><p>Esta parte la ven el dueño y el encargado.</p></div></div></div>
    );
  }
  const [movs, ops] = await Promise.all([
    supabase.from("movimientos").select("id, fecha, tipo, categoria, descripcion, monto, moneda, operacion_id").order("fecha", { ascending: false }).limit(3000),
    supabase.from("operaciones").select("*").order("fecha", { ascending: false }).limit(1000),
  ]);
  const aviso = movs.error ? `No se pudieron cargar los movimientos (${movs.error.message}). Si es la primera vez, falta correr la migración sql_011_reservas_operaciones_finanzas.sql.` : null;
  return <FinanzasClient iniciales={(movs.data as Movimiento[] | null) ?? []} operaciones={(ops.data as OperacionCerrada[] | null) ?? []} miId={user?.id ?? ""} hoy={hoyArgentina()} aviso={aviso} />;
}
