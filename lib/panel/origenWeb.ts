import { z } from "zod";

// Origen de un contacto que llega desde la web (lo manda el navegador con datosDeOrigen() de lib/utm.ts). Lo guardan
// las rutas de visitas, consignaciones, pedidos y Rodi en un update aparte, después del alta: si las columnas todavía
// no existen (migraciones/sql_origen_web_formularios.sql sin correr), el contacto se guarda igual.
const texto = (max: number) => z.string().trim().max(max).nullable().optional();
export const OrigenWebSchema = z.object({
  canalOrigen: texto(80),
  utmSource: texto(120),
  utmMedium: texto(120),
  utmCampaign: texto(200),
});
export type OrigenWeb = z.infer<typeof OrigenWebSchema>;

/** Columnas a guardar, o null si no hay ningún dato de origen. columnaCanal: en Rodi es "canal_entrada". */
export function columnasDeOrigen(o: OrigenWeb | null | undefined, columnaCanal = "canal_origen"): Record<string, string | null> | null {
  if (!o) return null;
  const limpio = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
  const cols = {
    [columnaCanal]: limpio(o.canalOrigen),
    utm_source: limpio(o.utmSource),
    utm_medium: limpio(o.utmMedium),
    utm_campaign: limpio(o.utmCampaign),
  };
  return Object.values(cols).some((v) => v !== null) ? cols : null;
}
