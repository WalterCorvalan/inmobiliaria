import { etiquetaDia } from "@/lib/panel/ventana24h";

// Separador de día en los chats (Walter, 19/10/2026). WhatsApp y Rodi: cartelito como en WhatsApp ("Hoy", "Ayer",
// "sábado", "10/10/2026"). Instagram y Messenger: como en esas apps, texto gris centrado con la hora del primer mensaje.
export default function SeparadorDia({ fecha, ahora, estilo }: { fecha: string; ahora: Date; estilo: "whatsapp" | "instagram" }) {
  const etiqueta = etiquetaDia(fecha, ahora);
  if (estilo === "instagram") {
    const hora = new Date(fecha).toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    return <p className="text-center text-[11px] font-semibold text-slate-400 dark:text-slate-500 my-3">{etiqueta} {hora}</p>;
  }
  return (
    <div className="flex justify-center my-2">
      <span className="text-[12px] font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-[#1f2c34] shadow-sm rounded-lg px-3 py-1">{etiqueta}</span>
    </div>
  );
}
