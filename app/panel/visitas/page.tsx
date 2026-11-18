import { createClient } from "@/lib/supabase/server";
import { filtrarPorVendedorAsignado } from "@/lib/panel/permisosModulos";
import { aFechaISO, desdeFechaISO, inicioDeSemana, sumarDias, type Visita } from "@/lib/visitas/visitas";
import VisitasClient from "./VisitasClient";

// Agenda de visitas. Trae la semana pedida (?semana=AAAA-MM-DD, cualquier día de esa semana) y la siguiente, para poder
// avanzar sin recargar. El asesor ve las suyas y las sin asignar; el encargado, las de su oficina; el dueño, todas.
export default async function VisitasPage({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const { semana } = await searchParams;
  const base = semana && /^\d{4}-\d{2}-\d{2}$/.test(semana) ? desdeFechaISO(semana) : new Date();
  const lunes = inicioDeSemana(base);
  const desde = aFechaISO(lunes);
  const hasta = aFechaISO(sumarDias(lunes, 6));

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [visitas, { data: perfiles }, { data: sucursales }, { data: propiedades }, { data: cfg }] = await Promise.all([
    supabase.from("visitas").select("id, nombre_cliente, telefono_cliente, fecha_visita, horario_visita, sucursal, estado, vendedor_id, propiedad_id, propiedad_codigo, notas, canal_origen, created_at")
      .gte("fecha_visita", desde).lte("fecha_visita", hasta).order("fecha_visita").limit(1000),
    supabase.from("perfiles").select("id, nombre, roles, sucursal_id").eq("activo", true).order("nombre"),
    supabase.from("sucursales").select("id, nombre").order("nombre"),
    supabase.from("propiedades").select("id, codigo, titulo, barrio, estado").in("estado", ["disponible", "reservada"]).order("created_at", { ascending: false }).limit(500),
    supabase.from("configuracion_empresa").select("branding_nombre").maybeSingle(),
  ]);

  const aviso = visitas.error ? `No se pudieron cargar las visitas (${visitas.error.message}). Si dice que falta una columna, hay que correr la migración sql_010_visitas_propiedad.sql en Supabase.` : null;
  if (visitas.error) console.error("[visitas] no se pudo cargar:", visitas.error.message);

  const miPerfil = (perfiles || []).find((p) => p.id === user?.id);
  const soyAdmin = miPerfil?.roles?.some((r: string) => r === "admin" || r === "director") ?? false;
  const soyEncargado = miPerfil?.roles?.includes("encargado") ?? false;
  const visibles = filtrarPorVendedorAsignado((visitas.data as Visita[] | null) ?? [], {
    soyAdmin, soyEncargado, miId: user?.id ?? "", miSucursalId: miPerfil?.sucursal_id ?? null, perfiles: perfiles ?? [],
  });

  return (
    <VisitasClient
      key={desde}
      iniciales={visibles}
      lunesISO={desde}
      asesores={(perfiles ?? []).map((p) => ({ id: p.id, nombre: p.nombre }))}
      sucursales={(sucursales ?? []).map((s) => s.nombre)}
      propiedades={propiedades ?? []}
      negocio={cfg?.branding_nombre || "la inmobiliaria"}
      miId={user?.id ?? ""}
      aviso={aviso}
    />
  );
}
