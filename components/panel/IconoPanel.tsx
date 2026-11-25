// Ícono en color del menú y de Inicio (los dibujos de public/icons/panel, los mismos del panel completo de Pfaffen).
// Son archivos chicos y fijos: con <img> alcanza, no hace falta el optimizador de imágenes de Next.
export default function IconoPanel({ src, className = "", alt = "" }: { src: string; className?: string; alt?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={`object-contain ${className}`} />;
}
