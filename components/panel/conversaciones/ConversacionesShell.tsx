"use client";

import ChatClient from "./ChatClient";
import CabeceraBandejaNuevo, { ESTILO_BANDEJA_NUEVO } from "./CabeceraBandejaNuevo";
import { ESTILO_BANDEJA_PLANA } from "./estiloBandejaPlana";

interface Perfil { id: string; nombre: string; roles: string[] }

// canalFijo: cuando el shell se monta en un módulo de un solo canal
// (/panel/whatsapp, /panel/instagram o /panel/messenger, separados el 25/9 -- antes compartían
// esta misma pantalla con un selector de canal adentro), bloquea el canal y
// oculta el switcher de ChatClient.
// Solo la bandeja (Walter, 11/11/2026): se sacaron las pestañas "Leads" (lista, tablero y gráficos) y "Nuevo mensaje"
// (era un cartel de "próximamente") porque no se usaban. Sus direcciones viejas ("?tab=leads&lead=...") las manda cada
// page.tsx al módulo Leads (lib/panel/pestanaLeadsVieja.ts).
export default function ConversacionesShell({
  conversacionesIniciales, conversacionesInstagramIniciales, conversacionesMessengerIniciales = [], vendedores, miId, canalFijo, nuevo = false,
}: { conversacionesIniciales: any[]; conversacionesInstagramIniciales: any[]; conversacionesMessengerIniciales?: any[]; vendedores: Perfil[]; miId: string; canalFijo?: "whatsapp" | "instagram" | "messenger"; nuevo?: boolean }) {
  const leadsConConversacion = conversacionesIniciales.filter((c) => c.estado_lead && c.estado_lead !== "nuevo").length
    + conversacionesInstagramIniciales.filter((c) => c.estado_lead && c.estado_lead !== "nuevo").length
    + conversacionesMessengerIniciales.filter((c) => c.estado_lead && c.estado_lead !== "nuevo").length;

  const titulo = canalFijo === "instagram" ? "Instagram" : canalFijo === "whatsapp" ? "WhatsApp" : canalFijo === "messenger" ? "Messenger" : "Conversaciones";

  // En la compu va arriba de la lista de charlas (ChatClient); en el celular, arriba de todo (Walter, 11/11/2026).
  // WhatsApp con el diseño Nuevo: columnas planas como la imagen de referencia (Walter, 19/11/2026). Ver ChatClient.
  // Bandeja plana (estilo SaaS): WhatsApp desde el 19/11/2026 y, el mismo día, también Instagram y Messenger (Walter).
  const plano = nuevo && (canalFijo === "whatsapp" || canalFijo === "instagram" || canalFijo === "messenger");
  const cabecera = (enColumna: boolean) => <CabeceraBandejaNuevo icono={canalFijo ?? "mensajes"} titulo={plano ? "Charlas" : titulo} subtitulo={`${leadsConConversacion} lead${leadsConConversacion === 1 ? "" : "s"} con conversación`} pestanas={[]} activa="" onCambiar={() => {}} enColumna={enColumna} plano={plano} />;

  return (
    <div className={`w-full h-full flex flex-col overflow-hidden ${plano ? "diseno-material bg-white dark:bg-[#111]" : nuevo ? "diseno-material bg-[#F3F4F7] dark:bg-[#0a0a0f]" : "bg-white dark:bg-[#0A0A0A]"}`}>
      {nuevo ? (<>
        <style>{ESTILO_BANDEJA_NUEVO}</style>
        {plano && <style>{ESTILO_BANDEJA_PLANA}</style>}
        <div className="bandeja-cabecera shrink-0 md:hidden">{cabecera(false)}</div>
      </>) : (
      <div className="bandeja-cabecera px-4 py-2 border-b border-slate-200 dark:border-white/10 shrink-0 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-3 ml-auto">
          <p className="text-[10px] text-slate-400 shrink-0 hidden sm:block">{leadsConConversacion} lead{leadsConConversacion === 1 ? "" : "s"} con conversación</p>
          <h1 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 shrink-0">
            <img src={`/icons/panel/${canalFijo === "instagram" ? "instagram" : canalFijo === "whatsapp" ? "whatsapp" : canalFijo === "messenger" ? "messenger" : "mensajes"}.png`} alt="" className="w-4 h-4 object-contain shrink-0" /> {titulo}
          </h1>
        </div>
      </div>
      )}

      <div className={`bandeja-cuerpo flex-1 min-h-0 ${nuevo && !plano ? "pt-2" : ""}`}>
        <ChatClient conversacionesIniciales={conversacionesIniciales} conversacionesInstagramIniciales={conversacionesInstagramIniciales} conversacionesMessengerIniciales={conversacionesMessengerIniciales} vendedores={vendedores} miId={miId} canalFijo={canalFijo} nuevo={nuevo} cabecera={nuevo ? cabecera(true) : undefined} />
      </div>
    </div>
  );
}
