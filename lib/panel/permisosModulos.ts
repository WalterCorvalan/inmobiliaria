import type { SupabaseClient } from "@supabase/supabase-js";

// Única fuente de la verdad para "rol interno de perfiles -> sector de
// visibilidad_sector" -- antes vivía duplicado a mano en app/panel/layout.tsx
// (sidebar) y en ningún lado más, así que una alerta podía avisarle a un
// destinatario sobre un módulo que su rol tiene apagado (ver moduloVisible()
// en layout.tsx). Server-safe: sin hooks, usable desde API routes y desde
// componentes cliente por igual.
export const ROL_A_SECTOR: Record<string, string> = {
  encargado: "encargado",
  ventas: "ventas",
  finanzas: "finanzas",
  gestoria: "gestoria",
  taller: "taller",
  director: "director",
};

// "director" (rol CEO/dueño, pedido del 30/9): a propósito NO se agregó al
// array de la línea de abajo que fuerza "clientes" siempre visible -- ese
// override es justo lo que hay que evitar para este rol (el dueño no quiere
// ver Leads/Clientes/Visitas/Recontactos por default). Queda 100% controlado
// por "Visibilidad por sector" en Configuración → Empresa → Módulos: sin
// fila ahí, el módulo es visible por default (mismo criterio que cualquier
// otro rol), así que para ocultarle Leads/Clientes/Visitas/Recontactos/
// Pedidos/Peritajes/Infracciones/Mensajes/WhatsApp/Instagram/Messenger hay
// que tildar "No" en la columna "Director" de esa pantalla -- no es algo que
// el código decida solo. Acceso a Finanzas (TopTicker, tiles del Dashboard,
// secciones de Reportes, "ver todas las sucursales" en Finanzas) sí está
// forzado en código (ver PanelLayoutClient.tsx, panel/page.tsx,
// reportes/page.tsx, finanzas/page.tsx, stock/page.tsx) porque "acceso
// completo a Finanzas" fue el pedido explícito, a diferencia de Señas/Ventas
// (que el dueño solo quiere "ver", sin gate especial -- hoy no hay una
// distinción real de solo-lectura en esos módulos, ve lo mismo que
// cualquier otro rol con el módulo visible).

// Mismo criterio que moduloVisible() en layout.tsx: admin nunca se filtra;
// sin fila en visibilidad_sector, el módulo es visible por default; con
// varios roles alcanza que UNO de los sectores lo vea.
// Quién puede asignar un lead/conversación a quién. Usado en
// leads/page.tsx, whatsapp/page.tsx, instagram/page.tsx y rodi/page.tsx
// para armar la lista de "vendedores" que llega al selector de asignación
// de LeadDetailModal.tsx (compartido entre los 4 módulos) -- antes cada
// page.tsx duplicaba este filtro a mano, y leads/page.tsx en particular se
// había quedado corto (solo "ventas"+"admin" global, sin encargado y sin
// distinguir sucursal). Regla de negocio (Walter, 21/10/2026: "cualquiera puede asignar a cualquiera; si Fede tiene el
// auto, es más fácil derivarlo"): vendedores y encargados asignan a cualquier vendedor o encargado, de cualquier
// sucursal; el admin además a otros admins. Antes un encargado solo veía a los vendedores de su sucursal (Lucas solo
// podía elegir a Gabriel y a él mismo) y un vendedor no podía pasárselo a un encargado.
export function filtrarVendedoresAsignables<T extends { roles?: string[] | null; sucursal_id?: string | null }>(
  perfiles: T[],
  { soyAdmin }: { soyAdmin: boolean; soyEncargado: boolean; miSucursalId: string | null }
): T[] {
  return perfiles.filter((p) => {
    if (soyAdmin) return p.roles?.includes("ventas") || p.roles?.includes("encargado") || p.roles?.some((r: string) => r === "admin" || r === "director");
    return p.roles?.includes("ventas") || p.roles?.includes("encargado");
  });
}

// Round robin de leads (pedido 1/10): un vendedor solo tiene que ver las
// conversaciones/leads que le llegaron a ÉL (en whatsapp/page.tsx,
// instagram/page.tsx, messenger/page.tsx, rodi/page.tsx y leads/page.tsx),
// no las de los demás vendedores -- antes los 5 módulos traían TODO sin
// filtrar y lo mandaban igual al cliente, así que cualquier vendedor podía
// ver la bandeja completa de la agencia. Encargado y admin siguen viendo
// todo (regla de negocio explícita: "los encargados pueden ver todos los
// chats y todos los leads"). Un lead sin vendedor_id todavía (recién
// entrado, antes de que el reparto por ronda lo asigne) se le sigue
// mostrando a un vendedor -- si no, nadie lo vería hasta que se le asigne.
//
// Desde el 21/10/2026 (Walter): el encargado ve solo lo de SU sucursal (lo suyo y lo de los vendedores con su misma
// sucursal), aunque además sea admin: Gabriel (Casa Central) ve lo de Fede y Julián pero no lo de Lucas, y Lucas
// (Don Torcuato, sin vendedores a cargo) ve solo lo suyo. El admin que no es encargado (Walter) sigue viendo todo.
// Sin sucursal cargada o sin la lista de perfiles, el encargado sigue viendo todo, para no esconderle nada por un dato faltante.
export function filtrarPorVendedorAsignado<T extends { vendedor_id?: string | null }>(
  items: T[],
  { soyAdmin, soyEncargado, miId, miSucursalId, perfiles }: {
    soyAdmin: boolean; soyEncargado: boolean; miId: string;
    miSucursalId?: string | null; perfiles?: { id: string; sucursal_id?: string | null }[];
  }
): T[] {
  if (soyEncargado && miSucursalId && perfiles?.length) {
    const equipo = new Set(perfiles.filter((p) => p.sucursal_id === miSucursalId).map((p) => p.id));
    equipo.add(miId);
    return items.filter((i) => !i.vendedor_id || equipo.has(i.vendedor_id));
  }
  if (soyAdmin || soyEncargado) return items;
  return items.filter((i) => !i.vendedor_id || i.vendedor_id === miId);
}

// Rol taller (pedido de Walter 9/10): quien es SOLO taller (sin otro rol de oficina) ve Stock, sin precios, y
// Taller, sin la plata ni la configuración. Otro módulo solo si se le habilita a mano en Configuración →
// Visibilidad por sector (fila con visible = true para el sector "taller"; ej. Clientes, para buscar por cliente).
// Con cualquier otro rol además, se suman sus permisos.
export const MODULOS_ROL_TALLER = ["stock", "taller", "calendario"];
const ROLES_DE_OFICINA = ["admin", "director", "encargado", "ventas", "finanzas", "gestoria"];
export function esSoloTaller(roles: string[] | null | undefined): boolean {
  const r = roles || [];
  return r.includes("taller") && !r.some((x) => ROLES_DE_OFICINA.includes(x));
}

export async function puedeVerModulo(supabase: SupabaseClient, perfilId: string, modulo: string): Promise<boolean> {
  const { data: perfil } = await supabase.from("perfiles").select("roles").eq("id", perfilId).maybeSingle();
  // Sin perfil (lookup falló o el id no existe) no podemos confirmar ningún
  // rol -- antes esto caía a roles=[] y por el default de la línea de abajo
  // ("sin sector mapeado, visible") terminaba dando acceso a Tesorería/
  // Facturación/Finanzas/Reportes a un perfil que ni siquiera pudimos leer.
  // Denegar acá, no dejar pasar.
  if (!perfil) return false;
  const roles: string[] = perfil.roles || [];
  if (roles.some((r: string) => r === "admin" || r === "director")) return true;
  if (esSoloTaller(roles)) {
    if (MODULOS_ROL_TALLER.includes(modulo)) return true;
    const { data: fila } = await supabase.from("visibilidad_sector").select("visible").eq("modulo", modulo).eq("sector", ROL_A_SECTOR.taller).maybeSingle();
    return fila?.visible === true;
  }

  const { data: config } = await supabase.from("modulos_config").select("activo").eq("modulo", modulo).maybeSingle();
  if (config?.activo === false) return false;

  // Mismo override que moduloVisible() en layout.tsx -- Clientes siempre
  // visible para todos los roles salvo taller, sin depender de
  // "Visibilidad por sector".
  if (modulo === "clientes" && roles.some((r) => ["ventas", "encargado", "finanzas", "gestoria"].includes(r))) return true;

  const sectores = roles.map((r) => ROL_A_SECTOR[r]).filter(Boolean);
  if (sectores.length === 0) return true;

  const { data: filas } = await supabase.from("visibilidad_sector").select("sector, visible").eq("modulo", modulo).in("sector", sectores);
  if (!filas || filas.length === 0) return true;
  return sectores.some((s) => filas.find((f) => f.sector === s)?.visible ?? true);
}
