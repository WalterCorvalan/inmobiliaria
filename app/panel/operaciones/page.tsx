import { createClient } from "@/lib/supabase/server";
import { hoyArgentina } from "@/lib/panel/inicio";
import { puedeVerFinanzas } from "@/lib/panel/permisosModulos";
import type { OperacionCerrada } from "@/lib/finanzas/operaciones";
import type { Propiedad } from "@/lib/propiedades/propiedades";
import type { Reserva } from "../reservas/ReservasClient";
import OperacionesClient from "./OperacionesClient";

export const metadata = { title: "Operaciones | Inmobiliaria CRM" };

// Operaciones cerradas (pedido de Walter, 26/11/2026): cada venta o alquiler cerrado, con los honorarios y la parte del
// asesor. Lo que queda para la inmobiliaria lo ven el dueño y el encargado; el asesor ve su parte.
export default async function OperacionesPage({ searchParams }: { searchParams: Promise<{ reserva?: string }> }) {
  const { reserva } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [ops, { data: propiedades }, { data: perfiles }, { data: reservas }] = await Promise.all([
    supabase.from("operaciones").select("*").order("fecha", { ascending: false }).limit(1000),
    supabase.from("propiedades").select("id, codigo, titulo, tipo, operacion, estado, precio, moneda, barrio, propiedad_fotos ( id, url, orden, es_portada )").order("titulo"),
    supabase.from("perfiles").select("id, nombre, roles").eq("activo", true).order("nombre"),
    supabase.from("reservas").select("*").eq("estado", "vigente"),
  ]);
  const roles = (perfiles ?? []).find((p) => p.id === user?.id)?.roles ?? [];
  const aviso = ops.error ? `No se pudieron cargar las operaciones (${ops.error.message}). Si es la primera vez, falta correr la migración sql_011_reservas_operaciones_finanzas.sql.` : null;
  return (
    <OperacionesClient iniciales={(ops.data as OperacionCerrada[] | null) ?? []} propiedades={(propiedades as unknown as Propiedad[] | null) ?? []}
      asesores={(perfiles ?? []).map((p) => ({ id: p.id, nombre: p.nombre }))} reservas={(reservas as Reserva[] | null) ?? []} reservaInicial={reserva ?? null}
      miId={user?.id ?? ""} hoy={hoyArgentina()} veFinanzas={puedeVerFinanzas(roles)} aviso={aviso} />
  );
}
