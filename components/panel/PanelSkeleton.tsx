// Skeleton generico para los loading.tsx de los modulos del panel -- Next
// muestra esto al instante mientras el page.tsx (server component) espera
// sus queries a Supabase, en vez de dejar la pantalla en blanco/colgada
// hasta que toda la data llegue. El sidebar/nav no se re-renderiza (vive en
// layout.tsx), solo el area de contenido.

function Bloque({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200 dark:bg-white/5 ${className}`} />;
}

export function PanelSkeletonTabla() {
  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Bloque className="h-7 w-40" />
        <Bloque className="h-9 w-32" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => <Bloque key={i} className="h-8 w-24" />)}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => <Bloque key={i} className="h-14 w-full" />)}
      </div>
    </div>
  );
}

export function PanelSkeletonLista() {
  return (
    <div className="flex h-full">
      <div className="w-full max-w-sm border-r border-slate-200 dark:border-white/10 p-3 space-y-2">
        {Array.from({ length: 10 }).map((_, i) => <Bloque key={i} className="h-16 w-full" />)}
      </div>
      <div className="hidden lg:flex flex-1 items-center justify-center">
        <Bloque className="h-10 w-10 rounded-full" />
      </div>
    </div>
  );
}

export function PanelSkeletonDashboard() {
  return (
    <div className="p-4 lg:p-6 space-y-4">
      <Bloque className="h-7 w-56" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <Bloque key={i} className="h-24 w-full" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <Bloque key={i} className="h-56 w-full" />)}
      </div>
    </div>
  );
}
