// Lista CERRADA de orígenes de cliente (clientes.origen). Los ÚNICOS son estos 11, en este orden:
// Zonaprop, Argenprop, MercadoLibre, Instagram, Facebook, Messenger, WhatsApp, Web, Oficina, Llamada, Otro.
// La definió Walter el 2/11/2026: NO agregar, sacar ni renombrar ninguno sin que él lo pida.
// Tiene que coincidir EXACTO con el CHECK clientes_origen_check de la base.
// Todo selector, filtro o insert de clientes.origen usa esta constante y, si el valor viene de afuera (un cliente viejo,
// un lead, un canal), lo pasa por normalizarOrigenCliente: así nunca queda seleccionado un origen que no existe.
export const ORIGENES_CLIENTE = ["Zonaprop", "Argenprop", "MercadoLibre", "Instagram", "Facebook", "Messenger", "WhatsApp", "Web", "Oficina", "Llamada", "Otro"] as const;
export type OrigenCliente = (typeof ORIGENES_CLIENTE)[number];

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const POR_CLAVE = new Map<string, OrigenCliente>(ORIGENES_CLIENTE.map((o) => [sinTildes(o), o]));
// Nombres que ya circulan y se leen como uno de la lista: el chat de la web guarda "Rodi" por dentro y llega como "Web";
// el salón o showroom de otros rubros es la oficina.
const SINONIMOS: Record<string, OrigenCliente> = { rodi: "Web", showroom: "Oficina", salon: "Oficina" };

// El chat de la web se guarda "Rodi" por dentro (tablas rodi_*), pero en pantalla se lee "Chat web". Solo para mostrar:
// nunca para guardar ni filtrar.
export function etiquetaOrigen(valor: string | null | undefined): string {
  if (!valor) return "";
  return valor.toLowerCase() === "rodi" ? "Chat web" : valor;
}

export function esOrigenClienteValido(valor: string | null | undefined): valor is OrigenCliente {
  return !!valor && (ORIGENES_CLIENTE as readonly string[]).includes(valor);
}

// Devuelve siempre uno de la lista. Mayúsculas, tildes y espacios distintos ("mercado libre") se reconocen; los nombres
// viejos de SINONIMOS pasan a su equivalente; todo lo demás (Referido, Google Ads, Cliente anterior, vacío...) es "Otro".
export function normalizarOrigenCliente(valor: string | null | undefined): OrigenCliente {
  if (!valor) return "Otro";
  const clave = sinTildes(valor);
  return POR_CLAVE.get(clave) ?? SINONIMOS[clave] ?? "Otro";
}
