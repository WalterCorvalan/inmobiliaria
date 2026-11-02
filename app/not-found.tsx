import Link from "next/link";
import { CarFront, Search } from "lucide-react";

export const metadata = {
  title: "Página no encontrada | Pfaffen Cars",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#0a0a0f] flex flex-col items-center justify-center px-4 text-center relative overflow-hidden">
      <div className="absolute top-[10%] left-[-10%] w-[500px] h-[500px] bg-[#0145F2]/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-md">
        <div className="w-20 h-20 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
          <CarFront className="w-9 h-9 text-slate-400 dark:text-slate-500" />
        </div>

        <h1 className="text-6xl font-black text-navy dark:text-white tracking-tighter mb-3">404</h1>
        <p className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">
          Esta página se nos escapó de la vidriera.
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
          El link puede estar roto o el auto que buscabas ya no está disponible. Probá desde acá:
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 bg-[#0145F2] hover:bg-blue-600 text-white font-bold text-sm px-6 py-3 rounded-xl transition-colors"
          >
            Volver al inicio
          </Link>
          <Link
            href="/catalogo"
            className="inline-flex items-center justify-center gap-2 bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 hover:border-[#0145F2] text-navy dark:text-white font-bold text-sm px-6 py-3 rounded-xl transition-colors"
          >
            <Search className="w-4 h-4" /> Ver catálogo
          </Link>
        </div>
      </div>
    </div>
  );
}
