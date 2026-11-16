// Resumen de la charla SIN IA, para la demo (Walter, 13/11/2026: el "resumir conversación" no gasta IA en la demo).
// Se arma con lo que el bot ya juntó en la charla (datos_detectados) y sigue el formato del resumen real
// (lib/panel/formatoResumen.ts: frases cortas, cada dato con su nombre adelante), así se ve igual en la ficha.
import type { Calificacion, CanalDemo, DatosLead } from "./tipos";

const NOMBRE_CANAL: Record<CanalDemo, string> = { whatsapp: "WhatsApp", instagram: "Instagram", messenger: "Messenger" };
const limpio = (s?: string | null) => (s ?? "").trim().replace(/[.\s]+$/, "");

/** Junta los datos nuevos con los que ya había: un dato nuevo pisa al viejo, un null no borra nada. */
export function combinarDatos(previos: DatosLead, nuevos: DatosLead | null | undefined): DatosLead {
  const out: DatosLead = { ...previos };
  for (const [k, v] of Object.entries(nuevos ?? {})) {
    if (typeof v === "string" && v.trim()) out[k as keyof DatosLead] = v.trim();
  }
  return out;
}

export function resumenDesdeDatos(o: {
  datos: DatosLead; canal: CanalDemo; calificacion: Calificacion | null; queBusca: string; nombreSucursal?: (slug: string) => string | null;
}): string {
  const { datos, canal, calificacion, queBusca } = o;
  const frases: string[] = [];
  const interes = limpio(datos.interes);
  frases.push(interes ? `Quiere ${interes.charAt(0).toLowerCase()}${interes.slice(1)}.` : `Escribió por ${NOMBRE_CANAL[canal]} y todavía no dijo qué ${queBusca} busca.`);
  if (limpio(datos.presupuesto)) frases.push(`Presupuesto: ${limpio(datos.presupuesto)}.`);
  if (limpio(datos.plazo)) frases.push(`Para cuándo: ${limpio(datos.plazo)}.`);
  if (limpio(datos.dia_visita)) {
    const sucursal = datos.zona ? (o.nombreSucursal?.(datos.zona) ?? datos.zona) : null;
    const hora = limpio(datos.horario_visita) ? ` a las ${limpio(datos.horario_visita)}` : "";
    frases.push(`Visita: ${limpio(datos.dia_visita)}${hora}${sucursal ? ` en ${sucursal}` : ""}.`);
  }
  if (limpio(datos.telefono)) frases.push(`Teléfono: ${limpio(datos.telefono)}.`);
  if (limpio(datos.email)) frases.push(`Mail: ${limpio(datos.email)}.`);
  if (calificacion) frases.push(`Temperatura: ${calificacion}.`);
  const pendiente = limpio(datos.dia_visita)
    ? "que un asesor confirme la visita"
    : interes ? `que un asesor le mande opciones de ${queBusca}` : `que un asesor lo contacte y definir qué ${queBusca} le interesa`;
  frases.push(`Pendiente: ${pendiente}.`);
  return frases.join("\n");
}
