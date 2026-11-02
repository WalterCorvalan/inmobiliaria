import { MessageCircle } from "lucide-react";

// Avatar del asistente virtual del chat de la web. Genérico: cada empresa podrá cambiarlo desde su configuración de marca.
export default function IconoAsistente({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <span className={`${className} rounded-full bg-[#0145F2] text-white inline-flex items-center justify-center shrink-0`} aria-hidden="true">
      <MessageCircle className="w-1/2 h-1/2" />
    </span>
  );
}
