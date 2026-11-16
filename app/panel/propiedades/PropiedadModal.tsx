"use client";

import { useState } from "react";
import { X, ImagePlus, Trash2, Loader2 } from "lucide-react";
import { supabase2 } from "@/lib/supabase/client";
import { mostrarToast } from "@/lib/toast";
import {
  ESTADOS, MONEDAS, OPERACIONES, TIPOS, TIPOS_FOTO, estadosPermitidos, limpiarPropiedad,
  type EstadoPropiedad, type FormularioPropiedad, type Operacion,
} from "@/lib/propiedades";

export type Propiedad = {
  id: string; codigo: string | null; titulo: string; operacion: Operacion; tipo: keyof typeof TIPOS; estado: EstadoPropiedad;
  direccion: string | null; barrio: string | null; localidad: string | null; provincia: string | null;
  precio: number | null; moneda: "USD" | "ARS"; expensas: number | null;
  ambientes: number | null; dormitorios: number | null; banios: number | null; cocheras: number | null;
  m2_cubiertos: number | null; m2_totales: number | null; antiguedad_anios: number | null;
  descripcion: string | null; fotos: string[]; publicada: boolean; sucursal_id: string | null; vendedor_id: string | null; notas_internas: string | null;
  created_at: string;
};

const MAX_FOTOS = 20;
const MAX_BYTES = 10 * 1024 * 1024;
const campo = "w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0145F2]";
const etiqueta = "block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1";

const aTexto = (n: number | null | undefined) => (n == null ? "" : String(n));

export default function PropiedadModal({ propiedad, sucursales, equipo, miId, onCerrar, onGuardada }: {
  propiedad: Propiedad | null; sucursales: { id: string; nombre: string }[]; equipo: { id: string; nombre: string }[]; miId: string;
  onCerrar: () => void; onGuardada: (p: Propiedad) => void;
}) {
  const [f, setF] = useState<FormularioPropiedad>({
    codigo: propiedad?.codigo ?? "", titulo: propiedad?.titulo ?? "", operacion: propiedad?.operacion ?? "venta", tipo: propiedad?.tipo ?? "departamento",
    estado: propiedad?.estado ?? "disponible", direccion: propiedad?.direccion ?? "", barrio: propiedad?.barrio ?? "", localidad: propiedad?.localidad ?? "",
    provincia: propiedad?.provincia ?? "", precio: aTexto(propiedad?.precio), moneda: propiedad?.moneda ?? "USD", expensas: aTexto(propiedad?.expensas),
    ambientes: aTexto(propiedad?.ambientes), dormitorios: aTexto(propiedad?.dormitorios), banios: aTexto(propiedad?.banios), cocheras: aTexto(propiedad?.cocheras),
    m2_cubiertos: aTexto(propiedad?.m2_cubiertos), m2_totales: aTexto(propiedad?.m2_totales), antiguedad_anios: aTexto(propiedad?.antiguedad_anios),
    descripcion: propiedad?.descripcion ?? "", sucursal_id: propiedad?.sucursal_id ?? "", vendedor_id: propiedad?.vendedor_id ?? (propiedad ? "" : miId),
    notas_internas: propiedad?.notas_internas ?? "", publicada: propiedad?.publicada ?? true, fotos: propiedad?.fotos ?? [],
  });
  const [errores, setErrores] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(0);

  const set = (k: keyof FormularioPropiedad, v: string | boolean | string[]) => setF((x) => ({ ...x, [k]: v }));
  const cambiarOperacion = (op: Operacion) => {
    setF((x) => ({ ...x, operacion: op, estado: estadosPermitidos(op).includes((x.estado ?? "disponible") as EstadoPropiedad) ? x.estado : "disponible" }));
  };

  const subirFotos = async (archivos: FileList | null) => {
    if (!archivos?.length) return;
    const lista = Array.from(archivos).slice(0, MAX_FOTOS - (f.fotos?.length ?? 0));
    setSubiendo((n) => n + lista.length);
    const nuevas: string[] = [];
    for (const archivo of lista) {
      try {
        if (!TIPOS_FOTO[archivo.type]) throw new Error(`${archivo.name}: solo JPG, PNG o WebP.`);
        if (archivo.size > MAX_BYTES) throw new Error(`${archivo.name}: pesa más de 10 MB.`);
        const r = await fetch("/api/panel/propiedades/foto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentType: archivo.type }) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "No se pudo preparar la subida.");
        const put = await fetch(j.uploadUrl, { method: "PUT", headers: { "Content-Type": archivo.type }, body: archivo });
        if (!put.ok) throw new Error(`${archivo.name}: no se pudo subir.`);
        nuevas.push(j.publicUrl);
      } catch (e) {
        mostrarToast(e instanceof Error ? e.message : "No se pudo subir la foto.", "error");
      } finally {
        setSubiendo((n) => n - 1);
      }
    }
    if (nuevas.length) setF((x) => ({ ...x, fotos: [...(x.fotos ?? []), ...nuevas] }));
  };

  const guardar = async () => {
    const r = limpiarPropiedad(f);
    if (!r.ok) { setErrores(r.errores); return; }
    setErrores([]);
    setGuardando(true);
    const datos = { ...r.datos, ...(propiedad ? {} : { creado_por: miId }) };
    const consulta = propiedad
      ? supabase2.from("propiedades").update(datos).eq("id", propiedad.id).select("*").single()
      : supabase2.from("propiedades").insert(datos).select("*").single();
    const { data, error } = await consulta;
    setGuardando(false);
    if (error || !data) {
      const duplicado = /duplicate|unique/i.test(error?.message ?? "");
      setErrores([duplicado ? "Ya hay otra propiedad con ese código." : "No se pudo guardar. Probá de nuevo."]);
      return;
    }
    mostrarToast(propiedad ? "Propiedad actualizada" : "Propiedad cargada");
    onGuardada(data as Propiedad);
  };

  const opcionesEstado = estadosPermitidos((f.operacion ?? "venta") as Operacion);

  return (
    <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-0 sm:p-4" onClick={onCerrar}>
      <div role="dialog" aria-modal="true" aria-label={propiedad ? "Editar propiedad" : "Nueva propiedad"} onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 w-full sm:max-w-3xl max-h-[95vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
          <h2 className="font-bold text-slate-800 dark:text-slate-100">{propiedad ? "Editar propiedad" : "Nueva propiedad"}</h2>
          <button onClick={onCerrar} aria-label="Cerrar" className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-6 gap-3">
          <div className="sm:col-span-4"><label className={etiqueta} htmlFor="p-titulo">Título *</label><input id="p-titulo" className={campo} value={f.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Ej: Departamento 3 ambientes en Palermo" /></div>
          <div className="sm:col-span-2"><label className={etiqueta} htmlFor="p-codigo">Código interno</label><input id="p-codigo" className={campo} value={f.codigo} onChange={(e) => set("codigo", e.target.value)} placeholder="Ej: P-0012" /></div>

          <div className="sm:col-span-2"><label className={etiqueta} htmlFor="p-op">Operación *</label>
            <select id="p-op" className={campo} value={f.operacion} onChange={(e) => cambiarOperacion(e.target.value as Operacion)}>
              {Object.entries(OPERACIONES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
          <div className="sm:col-span-2"><label className={etiqueta} htmlFor="p-tipo">Tipo *</label>
            <select id="p-tipo" className={campo} value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>
              {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
          <div className="sm:col-span-2"><label className={etiqueta} htmlFor="p-estado">Estado</label>
            <select id="p-estado" className={campo} value={f.estado} onChange={(e) => set("estado", e.target.value)}>
              {opcionesEstado.map((k) => <option key={k} value={k}>{ESTADOS[k]}</option>)}
            </select></div>

          <div className="sm:col-span-2"><label className={etiqueta} htmlFor="p-precio">Precio</label><input id="p-precio" inputMode="decimal" className={campo} value={f.precio} onChange={(e) => set("precio", e.target.value)} placeholder="Ej: 120.000" /></div>
          <div className="sm:col-span-2"><label className={etiqueta} htmlFor="p-moneda">Moneda</label>
            <select id="p-moneda" className={campo} value={f.moneda} onChange={(e) => set("moneda", e.target.value)}>{MONEDAS.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
          <div className="sm:col-span-2"><label className={etiqueta} htmlFor="p-exp">Expensas (ARS)</label><input id="p-exp" inputMode="decimal" className={campo} value={f.expensas} onChange={(e) => set("expensas", e.target.value)} /></div>

          <div className="sm:col-span-3"><label className={etiqueta} htmlFor="p-dir">Dirección</label><input id="p-dir" className={campo} value={f.direccion} onChange={(e) => set("direccion", e.target.value)} /></div>
          <div className="sm:col-span-3"><label className={etiqueta} htmlFor="p-barrio">Barrio / zona</label><input id="p-barrio" className={campo} value={f.barrio} onChange={(e) => set("barrio", e.target.value)} /></div>
          <div className="sm:col-span-3"><label className={etiqueta} htmlFor="p-loc">Localidad</label><input id="p-loc" className={campo} value={f.localidad} onChange={(e) => set("localidad", e.target.value)} /></div>
          <div className="sm:col-span-3"><label className={etiqueta} htmlFor="p-prov">Provincia</label><input id="p-prov" className={campo} value={f.provincia} onChange={(e) => set("provincia", e.target.value)} /></div>

          {([["ambientes", "Ambientes"], ["dormitorios", "Dormitorios"], ["banios", "Baños"], ["cocheras", "Cocheras"], ["m2_cubiertos", "m² cubiertos"], ["m2_totales", "m² totales"]] as const).map(([k, n]) => (
            <div key={k} className="sm:col-span-1"><label className={etiqueta} htmlFor={`p-${k}`}>{n}</label><input id={`p-${k}`} inputMode="decimal" className={campo} value={f[k]} onChange={(e) => set(k, e.target.value)} /></div>
          ))}
          <div className="sm:col-span-6"><label className={etiqueta} htmlFor="p-ant">Antigüedad (años)</label><input id="p-ant" inputMode="numeric" className={`${campo} sm:max-w-[10rem]`} value={f.antiguedad_anios} onChange={(e) => set("antiguedad_anios", e.target.value)} /></div>

          <div className="sm:col-span-6"><label className={etiqueta} htmlFor="p-desc">Descripción</label><textarea id="p-desc" rows={4} className={campo} value={f.descripcion} onChange={(e) => set("descripcion", e.target.value)} placeholder="Lo que le contarías a un cliente: estado, orientación, servicios, entorno..." /></div>

          <div className="sm:col-span-3"><label className={etiqueta} htmlFor="p-of">Oficina</label>
            <select id="p-of" className={campo} value={f.sucursal_id} onChange={(e) => set("sucursal_id", e.target.value)}>
              <option value="">Sin oficina</option>{sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select></div>
          <div className="sm:col-span-3"><label className={etiqueta} htmlFor="p-resp">Responsable</label>
            <select id="p-resp" className={campo} value={f.vendedor_id} onChange={(e) => set("vendedor_id", e.target.value)}>
              <option value="">Sin responsable</option>{equipo.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select></div>

          <div className="sm:col-span-6"><label className={etiqueta} htmlFor="p-notas">Notas internas (no las ve el cliente)</label><textarea id="p-notas" rows={2} className={campo} value={f.notas_internas} onChange={(e) => set("notas_internas", e.target.value)} /></div>

          <div className="sm:col-span-6">
            <span className={etiqueta}>Fotos ({f.fotos?.length ?? 0}/{MAX_FOTOS}) — la primera es la portada</span>
            <div className="flex flex-wrap gap-2">
              {(f.fotos ?? []).map((url, i) => (
                <div key={url} className="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-200 dark:border-white/10 group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                  {i === 0 && <span className="absolute left-1 top-1 text-[9px] font-bold bg-[#0145F2] text-white rounded px-1">Portada</span>}
                  <button type="button" aria-label={`Quitar foto ${i + 1}`} onClick={() => set("fotos", (f.fotos ?? []).filter((u) => u !== url))}
                    className="absolute right-1 top-1 p-1 rounded bg-white/90 text-rose-600 opacity-100 sm:opacity-0 group-hover:opacity-100 focus-visible:opacity-100"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              {(f.fotos?.length ?? 0) + subiendo < MAX_FOTOS && (
                <label className="w-24 h-24 rounded-lg border-2 border-dashed border-slate-300 dark:border-white/20 flex flex-col items-center justify-center gap-1 text-[11px] text-slate-500 cursor-pointer hover:border-[#0145F2] hover:text-[#0145F2]">
                  {subiendo > 0 ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
                  {subiendo > 0 ? "Subiendo..." : "Agregar"}
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => { subirFotos(e.target.files); e.target.value = ""; }} />
                </label>
              )}
            </div>
          </div>

          <label className="sm:col-span-6 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input type="checkbox" checked={f.publicada ?? true} onChange={(e) => set("publicada", e.target.checked)} className="w-4 h-4 accent-[#0145F2]" />
            Se puede ofrecer a los clientes (el bot y el catálogo la muestran)
          </label>
        </div>

        {errores.length > 0 && (
          <ul role="alert" className="mx-5 mb-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 p-3 text-sm text-rose-700 dark:text-rose-300 list-disc list-inside">
            {errores.map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}
        <div className="sticky bottom-0 flex justify-end gap-2 px-5 py-3 border-t border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
          <button onClick={onCerrar} className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10">Cancelar</button>
          <button onClick={guardar} disabled={guardando || subiendo > 0} className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-[#0145F2] hover:bg-[#0138c9] disabled:opacity-60">
            {guardando ? "Guardando..." : propiedad ? "Guardar cambios" : "Cargar propiedad"}
          </button>
        </div>
      </div>
    </div>
  );
}
