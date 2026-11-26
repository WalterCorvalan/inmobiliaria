import Link from "next/link";

// Pestañas de Configuración, iguales a las de las pantallas de cada canal (WhatsApp, Instagram, Messenger).
const PESTANAS = [
  { href: "/panel/configuracion", label: "Equipo" },
  { href: "/panel/configuracion/empresa", label: "Empresa" },
  { href: "/panel/configuracion/whatsapp", label: "WhatsApp" },
  { href: "/panel/configuracion/instagram", label: "Instagram" },
  { href: "/panel/configuracion/messenger", label: "Messenger" },
  { href: "/panel/configuracion/sucursales", label: "Oficinas" },
];

export default function TabsConfiguracion({ activa }: { activa: string }) {
  return (
    <div className="im-tabs" role="tablist" aria-label="Secciones de configuración">
      {PESTANAS.map((p) => (
        <Link key={p.href} href={p.href} role="tab" className="im-tab" aria-selected={p.href === activa}>{p.label}</Link>
      ))}
    </div>
  );
}
