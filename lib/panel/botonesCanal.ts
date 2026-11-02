// Botones que llevan de un lado al otro entre Leads y los chats (Walter, 31/10/2026).
//  - "Ir a la conversación" (en la ficha del lead): del color del chat al que lleva, para reconocerlo de un vistazo.
//  - "Abrir en Leads" (en el encabezado de cada chat): azul de la marca, lleno, para que se vea.

export type CanalConversacion = "whatsapp" | "instagram" | "messenger" | "rodi";

const RUTA_CANAL: Record<CanalConversacion, string> = {
  whatsapp: "/panel/whatsapp", instagram: "/panel/instagram", messenger: "/panel/messenger", rodi: "/panel/rodi",
};

export const COLOR_BOTON_CANAL: Record<CanalConversacion, string> = {
  whatsapp: "bg-[#25D366] hover:bg-[#1fb857] text-white",
  instagram: "bg-gradient-to-tr from-amber-500 via-pink-600 to-purple-600 hover:brightness-110 text-white",
  messenger: "bg-gradient-to-tr from-[#0084FF] to-[#A334FA] hover:brightness-110 text-white",
  rodi: "bg-[#0145F2] hover:bg-[#0138c9] text-white",
};

/** Link al chat del lead, o null si el lead no viene de un chat (cargado a mano). El id del lead es el de la conversación. */
export function linkConversacionDelLead(origen: string, leadId: string): string | null {
  if (!(origen in RUTA_CANAL)) return null;
  return `${RUTA_CANAL[origen as CanalConversacion]}?conversacion=${encodeURIComponent(leadId)}`;
}

export const CLASE_ABRIR_EN_LEADS =
  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white bg-[#0145F2] hover:bg-[#0138c9] shadow-sm shadow-[#0145F2]/30 transition-colors";
