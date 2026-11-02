"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";

// Cargador de fotos con el mismo manejo que la ficha de Stock
// (app/panel/stock/NuevoVehiculoModal.tsx): subir varias, arrastrar para
// reordenar, "Hacer portada" y quitar. Lo usan los Presupuestos (fotos del auto
// y fotos de cada permuta); la lista vive en el padre, acá solo se edita.

export default function FotosEditor({ fotos, onChange, carpeta = "panel-v2", ayuda, tamano = "normal" }: {
  fotos: string[]; onChange: (fotos: string[]) => void; carpeta?: string; ayuda?: string; tamano?: "normal" | "chico";
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");
  const [arrastrada, setArrastrada] = useState<number | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const subir = async (files: FileList) => {
    setSubiendo(true);
    setError("");
    try {
      const subidas: string[] = [];
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("carpeta", carpeta);
        const res = await fetch("/api/panel/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error subiendo la imagen");
        subidas.push(data.publicUrl);
      }
      onChange([...fotos, ...subidas]);
    } catch (err: any) {
      setError(err?.message || "No se pudieron subir una o más fotos.");
    } finally {
      setSubiendo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const mover = (desde: number, hasta: number) => {
    if (desde === hasta) return;
    const copia = [...fotos];
    const [movida] = copia.splice(desde, 1);
    copia.splice(hasta, 0, movida);
    onChange(copia);
  };

  return (
    <div>
      <div className={`grid gap-2 ${tamano === "chico" ? "grid-cols-4 sm:grid-cols-6" : "grid-cols-3 sm:grid-cols-4"}`}>
        {fotos.map((url, index) => (
          <div
            key={url}
            draggable
            onDragStart={() => setArrastrada(index)}
            onDragOver={(e) => {
              e.preventDefault();
              setSobre(index);
              if (arrastrada === null || arrastrada === index) return;
              mover(arrastrada, index);
              setArrastrada(index);
            }}
            onDragEnd={() => { setArrastrada(null); setSobre(null); }}
            className={`relative aspect-square rounded-lg overflow-hidden border group cursor-grab active:cursor-grabbing transition-colors ${sobre === index && arrastrada !== index ? "border-[#0145F2] border-2" : "border-slate-200 dark:border-white/10"} ${arrastrada === index ? "opacity-40" : ""}`}
          >
            <img src={url} alt="" draggable={false} className="w-full h-full object-cover pointer-events-none" />
            {index === 0 ? (
              <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md bg-[#0145F2] text-white text-[9px] font-bold uppercase tracking-wide">Portada</span>
            ) : (
              <button type="button" onClick={() => mover(index, 0)} title="Usar como portada" className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[9px] font-bold uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-opacity">Hacer portada</button>
            )}
            <button type="button" onClick={() => onChange(fotos.filter((f) => f !== url))} title="Quitar foto" className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        <label className={`aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${subiendo ? "opacity-60 pointer-events-none" : "hover:bg-slate-50 dark:hover:bg-white/5"} border-slate-300 dark:border-white/20`}>
          {subiendo ? <Loader2 className="w-5 h-5 text-slate-400 animate-spin" /> : <ImagePlus className="w-5 h-5 text-slate-400" />}
          <span className="text-[10px] font-semibold text-slate-400">{subiendo ? "Subiendo..." : "Agregar"}</span>
          <input ref={fileRef} type="file" accept="image/*" multiple disabled={subiendo} className="hidden" onChange={(e) => e.target.files?.length && subir(e.target.files)} />
        </label>
      </div>
      {error && <p className="text-[11px] font-semibold text-rose-600 mt-1.5">{error}</p>}
      {ayuda && <p className="text-[10px] text-slate-400 mt-1.5">{ayuda}</p>}
    </div>
  );
}
