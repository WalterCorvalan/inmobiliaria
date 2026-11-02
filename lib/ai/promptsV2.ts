// Prompt del agente, compartido por WhatsApp, Instagram, Messenger y el chat de la web. Neutro: sirve para cualquier empresa
// y cualquier rubro. Lo propio de cada una (nombre, qué hace, respuestas fijas, sucursales) entra por su configuración.
import { calendarioParaBot } from "@/lib/fechas";
import { bloqueEstiloYTono } from "./promptV2/estiloYTono";
import { bloqueReglas } from "./promptV2/reglas";
import { SCHEMA_SALIDA } from "./promptV2/schemaSalida";

export const SEPARADOR_MENSAJES = "|||";

export type SucursalInfo = {
  nombre: string; slug?: string | null; direccion: string | null; telefono_encargado: string | null; google_maps_url: string | null;
  encargado_nombre?: string | null; horario_texto?: string | null;
};

export type EmpresaParaBot = {
  nombre: string;
  /** Qué hace la empresa, con sus palabras (Configuración de la empresa). */
  descripcion?: string | null;
  /** Respuestas fijas cargadas en la memoria del bot (horarios, formas de pago, datos de la empresa...). */
  conocimiento?: { categoria: string; respuesta: string }[];
};

export const SALUDO_POR_DEFECTO = "¡Hola! Gracias por escribirnos. ¿En qué te puedo ayudar?";

const ETIQUETA_CATEGORIA: Record<string, string> = {
  horarios_ubicacion: "Horarios y ubicación", pagos_financiacion: "Formas de pago", datos_empresa: "Datos de la empresa", saludo: "Saludo",
};

function formatearSucursales(sucursales: SucursalInfo[]): string {
  const conDatos = sucursales.filter((s) => s.direccion || s.telefono_encargado || s.google_maps_url || s.horario_texto);
  if (conDatos.length === 0) return "";
  const lista = conDatos.map((s) => {
    // wa.me necesita 549 + característica + número, sin el 0 de troncal.
    const digitos = s.telefono_encargado?.replace(/\D/g, "").replace(/^0/, "");
    const waLink = digitos ? `https://wa.me/549${digitos}` : null;
    const contacto = s.encargado_nombre && waLink ? `${s.encargado_nombre} (encargado) → ${waLink}` : waLink;
    const mapsUrl = s.google_maps_url || (s.direccion ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.direccion} ${s.nombre}`)}` : null);
    const partes = [s.direccion, s.horario_texto ? `Horario: ${s.horario_texto}` : null, contacto, mapsUrl].filter(Boolean);
    return `- ${s.nombre}${s.slug ? ` [identificador: ${s.slug}]` : ""}${partes.length ? `: ${partes.join(" — ")}` : ""}`;
  }).join("\n");
  return `\nSUCURSALES (datos reales — usalos con confianza si preguntan dirección, horario, contacto o cuál les queda más cerca; al dar una dirección mandá también el link de mapa. Si el cliente ya dijo su zona, decidí vos cuál le queda más cerca y decíselo directo):\n${lista}\n`;
}

function formatearEmpresa(e: EmpresaParaBot): string {
  const conocimiento = (e.conocimiento ?? []).filter((c) => c.respuesta.trim() && c.categoria !== "saludo");
  const bloque = conocimiento.length
    ? `\nINFORMACIÓN DE LA EMPRESA (datos reales cargados por la empresa — respondé con ellos con confianza):\n${conocimiento.map((c) => `- ${ETIQUETA_CATEGORIA[c.categoria] ?? c.categoria}: ${c.respuesta.trim()}`).join("\n")}\n`
    : "";
  return bloque;
}

export function buildSystemPromptV2(o: {
  empresa: EmpresaParaBot; nombreBot?: string; sucursales?: SucursalInfo[]; sugerirCierre?: boolean; tono?: string | null; esInstagram?: boolean; esWeb?: boolean;
}): string {
  const { empresa, nombreBot, sucursales, sugerirCierre, tono, esInstagram, esWeb } = o;
  const quien = nombreBot ? `Te llamás ${nombreBot}, el asistente virtual de ${empresa.nombre}.` : `Sos el asistente virtual de ${empresa.nombre}.`;
  const queHace = empresa.descripcion?.trim() ? `\nQué hace la empresa: ${empresa.descripcion.trim()}\n` : "\n";
  const cierre = sugerirCierre
    ? `\nLa charla ya viene larga: sé más eficiente. Resumí en una sola pregunta lo que falta y, si el cliente ya dio lo esencial, ofrecé derivarlo con una persona del equipo para resolver el resto más rápido.\n`
    : "";
  return `${quien}${queHace}
Tu función: atender a quien escribe, entender qué necesita, juntar sus datos de contacto, calificar la oportunidad y pasarle la charla a una persona del equipo cuando corresponda. No cerrás ventas ni prometés nada que no esté acá.

${bloqueEstiloYTono(tono)}${formatearEmpresa(empresa)}${sucursales ? formatearSucursales(sucursales) : ""}${cierre}
${bloqueReglas({ esWeb, esInstagram })}

${calendarioParaBot()}
${SCHEMA_SALIDA}`;
}
