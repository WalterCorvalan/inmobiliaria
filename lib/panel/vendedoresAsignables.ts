// Quién puede quedar como "vendedor asignado" de un auto del Stock: solo los
// que venden, es decir rol `ventas`, `encargado` o ambos (pedido de Walter,
// 8/10/2026: en "Asignar vendedor" salían todos los usuarios, incluidos
// administración y dueños). Ojo: el vendedor asignado define a quién le llegan
// las consultas del auto (Rodi, Instagram, cotizaciones), ver
// app/panel/stock/ARCHITECTURE.md.
//
// Si el auto ya tiene asignada a alguien que no cumple (asignación vieja), se
// lo deja en la lista para que el selector muestre el valor actual.

export interface PerfilAsignable {
  id: string;
  roles?: string[] | null;
}

export function puedeTenerAutosAsignados(roles: string[] | null | undefined): boolean {
  return !!roles && (roles.includes("ventas") || roles.includes("encargado"));
}

/**
 * Un auto solo lo puede tener alguien de su sucursal (Walter, 21/10/2026: "si Fede, de Casa Central, tiene un auto de Don
 * Torcuato, tiene que salir un error"): el lead de ese auto va a quien lo tiene (lib/panel/asignacionPorAuto.ts).
 * Si el auto o la persona no tienen sucursal cargada, no se frena.
 */
export function esDeOtraSucursal(perfil: { sucursal_id?: string | null } | null | undefined, sucursalDelAuto: string | null | undefined): boolean {
  return !!perfil?.sucursal_id && !!sucursalDelAuto && perfil.sucursal_id !== sucursalDelAuto;
}

export function vendedoresAsignables<T extends PerfilAsignable>(perfiles: T[], asignadoActualId?: string | null): T[] {
  return perfiles.filter((p) => puedeTenerAutosAsignados(p.roles) || p.id === asignadoActualId);
}

/**
 * Para asignar un reclamo y similares (no operan stock): todos menos los que son SOLO gestoría. Antes se dejaba
 * afuera a cualquiera que tuviera el rol gestoría aunque además fuera encargado (pasaba con Gabriel Pfaffen).
 * "Publicado por", "Consignado por" y "Responsable de la consignación" usan la regla de vendedoresAsignables:
 * pueden los que tienen rol ventas o encargado (pedido de Walter, 9/10/2026: permitir por rol, no bloquear).
 */
export function sinSoloGestoria<T extends { roles?: string[] | null }>(perfiles: T[]): T[] {
  return perfiles.filter((p) => {
    const roles = p.roles ?? [];
    return !(roles.length > 0 && roles.every((r) => r === "gestoria"));
  });
}
