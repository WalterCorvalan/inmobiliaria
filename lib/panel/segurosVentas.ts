// Financiación y seguros → Seguros (Walter, 20/10/2026). Separa las ventas cerradas entre las que salieron con seguro y
// las que no, para ofrecérselo a esos compradores. La marca "contrató seguro" se carga en la venta (NuevaVentaModal).

// Con el número de socio de la agencia en La Caja (22791), para que la cotización quede a nombre de Pfaffen (Walter, 22/10/2026).
export const SOCIO_LA_CAJA = "22791";
export const LINK_COTIZADOR_SEGURO_DEFAULT = `https://cotizadorsocios.lacaja.com.ar/seguro-auto-socios/?socio=${SOCIO_LA_CAJA}`;

/** Si el link es del cotizador de La Caja y no trae el número de socio (el guardado en Configuración antes del 22/10), se lo agrega. */
export function linkCotizadorConSocio(url: string | null | undefined): string {
  if (!url) return LINK_COTIZADOR_SEGURO_DEFAULT;
  try {
    const u = new URL(url);
    if (u.hostname.endsWith("lacaja.com.ar") && !u.searchParams.has("socio")) u.searchParams.set("socio", SOCIO_LA_CAJA);
    return u.toString();
  } catch {
    return url;
  }
}

export type VentaSeguro = {
  id: string;
  comprador_nombre?: string | null;
  comprador_telefono?: string | null;
  comprador_telefono_celular?: string | null;
  vehiculo_marca?: string | null;
  vehiculo_modelo?: string | null;
  fecha_cierre?: string | null;
  seguro_contratado?: boolean | null;
  seguro_compania?: string | null;
  seguro_importe_mensual?: number | string | null;
};

/** Con seguro y sin seguro, las más recientes primero. */
export function separarPorSeguro<T extends VentaSeguro>(ventas: T[]): { con: T[]; sin: T[] } {
  const ordenadas = [...ventas].sort((a, b) => (b.fecha_cierre || "").localeCompare(a.fecha_cierre || ""));
  return { con: ordenadas.filter((v) => v.seguro_contratado), sin: ordenadas.filter((v) => !v.seguro_contratado) };
}

/** El celular si está; si no, el teléfono. */
export function telefonoComprador(v: VentaSeguro): string | null {
  return (v.comprador_telefono_celular || v.comprador_telefono || "").trim() || null;
}
