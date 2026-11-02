// A quién conviene pasarle un lead según la sucursal donde está el auto (14/10/2026, Walter): un auto de Casa Central
// lo atienden Julián o Fede; uno de Don Torcuato (Panamericana), Lucas. No reasigna solo: la ficha del lead muestra el
// aviso y un botón para pasárselo. Pura, para poder probarla.

export type PerfilSucursal = { id: string; nombre: string; roles: string[] | null; sucursal_id: string | null };

export function vendedoresSugeridosPorSucursal({ sucursalAutoId, vendedorActualId, perfiles }: {
  sucursalAutoId: string | null | undefined;
  vendedorActualId: string | null | undefined;
  perfiles: PerfilSucursal[];
}): { id: string; nombre: string }[] {
  if (!sucursalAutoId) return [];
  const deLaSucursal = perfiles.filter((p) => p.sucursal_id === sucursalAutoId && (p.roles || []).includes("ventas"));
  // Si ya lo tiene alguien de esa sucursal, no hay nada que sugerir.
  if (deLaSucursal.length === 0 || deLaSucursal.some((p) => p.id === vendedorActualId)) return [];
  return deLaSucursal.map((p) => ({ id: p.id, nombre: p.nombre }));
}
