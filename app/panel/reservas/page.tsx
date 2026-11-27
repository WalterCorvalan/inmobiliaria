import { createClient } from "@/lib/supabase/server";
import { hoyArgentina } from "@/lib/panel/inicio";
import type { Propiedad } from "@/lib/propiedades/propiedades";
import ReservasClient, { type Reserva } from "./ReservasClient";

export const metadata = { title: "Reservas | Inmobiliaria CRM" };

// Reservas (pedido de Walter, 26/11/2026): la plata que deja un cliente para reservar una propiedad, cuándo vence y en qué
// terminó. Es el equivalente de las señas de la agencia de autos.
export default async function ReservasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [reservas, { data: propiedades }, { data: perfiles }] = await Promise.all([
    supabase.from("reservas").select("*").order("fecha", { ascending: false }).limit(500),
    supabase.from("propiedades").select("id, codigo, titulo, tipo, operacion, estado, precio, moneda, barrio, propiedad_fotos ( id, url, orden, es_portada )").order("titulo"),
    supabase.from("perfiles").select("id, nombre").eq("activo", true).order("nombre"),
  ]);
  const aviso = reservas.error ? `No se pudieron cargar las reservas (${reservas.error.message}). Si es la primera vez, falta correr la migración sql_011_reservas_operaciones_finanzas.sql.` : null;
  return (
    <ReservasClient iniciales={(reservas.data as Reserva[] | null) ?? []} propiedades={(propiedades as unknown as Propiedad[] | null) ?? []} asesores={perfiles ?? []}
      miId={user?.id ?? ""} hoy={hoyArgentina()} aviso={aviso} />
  );
}
