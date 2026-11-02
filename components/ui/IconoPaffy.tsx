// Cara de Paffy, el golden retriever del chat del sitio (foto que pasó Walter el 20/10/2026, con "PAFFY" en el collar).
// Reemplaza al dibujo en SVG de Firu. Es chica (256 px) porque se ve como avatar.
export default function IconoPaffy({ className = "w-6 h-6" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/paffy.webp" alt="" aria-hidden="true" width={256} height={256} className={`${className} rounded-full object-cover`} />;
}
