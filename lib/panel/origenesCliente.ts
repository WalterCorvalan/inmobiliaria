import { NOMBRE_ASISTENTE_WEB } from "@/lib/asistenteWeb";
// PRIORIDAD 1 -- lista CERRADA de orígenes de cliente (clientes.origen). Los ÚNICOS son estos 10, en este orden:
// Instagram, Facebook, MercadoLibre, Rodi, Messenger, Web, Salón, WhatsApp, Llamada, Otro.
// "Llamada" la sumó el dueño el 21/10/2026 (el que llama directo al número de la agencia).
// Lo fijó el dueño (7/10/2026) después de repetirlo muchas veces: NO agregar, sacar ni renombrar ninguno sin que él lo pida.
// Tiene que coincidir EXACTO con el CHECK clientes_origen_check de la base (migraciones/sql_clientes_origen_llamada.sql).
// Todo selector, filtro o insert de clientes.origen usa esta constante y, si el valor viene de afuera (un cliente viejo,
// un lead, un canal), lo pasa por normalizarOrigenCliente: así nunca queda seleccionado un origen que no existe.
export const ORIGENES_CLIENTE = ["Instagram", "Facebook", "MercadoLibre", "Rodi", "Messenger", "Web", "Salón", "WhatsApp", "Llamada", "Otro"] as const;
export type OrigenCliente = (typeof ORIGENES_CLIENTE)[number];

const sinTildes = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const POR_CLAVE = new Map<string, OrigenCliente>(ORIGENES_CLIENTE.map((o) => [sinTildes(o), o]));

// El origen se guarda "Rodi" (y los leads "rodi"), pero en pantalla se lee con el nombre del asistente (Walter, 20/10/2026:
// "dejalo así y cambiá Rodi por Paffy en el panel"). Solo para mostrar: nunca para guardar ni filtrar.
export function etiquetaOrigen(valor: string | null | undefined): string {
  if (!valor) return "";
  return valor.toLowerCase() === "rodi" ? NOMBRE_ASISTENTE_WEB : valor;
}

export function esOrigenClienteValido(valor: string | null | undefined): valor is OrigenCliente {
  return !!valor && (ORIGENES_CLIENTE as readonly string[]).includes(valor);
}

// Devuelve siempre uno de los 9. "Showroom" (nombre viejo del salón) pasa a "Salón"; mayúsculas, tildes y espacios
// distintos ("mercado libre", "Salon") se reconocen; todo lo demás (Referido, Google Ads, Cliente anterior, vacío...) es "Otro".
export function normalizarOrigenCliente(valor: string | null | undefined): OrigenCliente {
  if (!valor) return "Otro";
  const clave = sinTildes(valor);
  if (clave === "showroom") return "Salón";
  return POR_CLAVE.get(clave) ?? "Otro";
}
