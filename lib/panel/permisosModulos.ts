// Qué módulos ve cada rol. En esta versión no hay "módulos apagados" ni "visibilidad por sector" configurables:
// el dueño (admin) y el encargado ven todo y el asesor (ventas) ve todo lo suyo (los filtros por asesor/oficina
// están más abajo). Sin ningún rol conocido, no ve nada. Función pura, usable en el servidor y en el navegador.
const ROLES_CON_ACCESO = ["admin", "director", "encargado", "ventas"];

export function puedeVerModulo(roles: string[] | null | undefined): boolean {
  return (roles || []).some((r) => ROLES_CON_ACCESO.includes(r));
}

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
