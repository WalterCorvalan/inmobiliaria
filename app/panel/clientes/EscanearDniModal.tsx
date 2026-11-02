"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserPDF417Reader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";
import { X, Camera, AlertTriangle } from "lucide-react";

export interface DatosDni {
  nombre: string;
  sexo: "Masculino" | "Femenino" | "";
  dniCuit: string;
  fechaNacimiento: string; // yyyy-mm-dd
}

interface Props {
  onClose: () => void;
  onEscaneado: (datos: DatosDni) => void;
}

// El dorso del DNI argentino trae un PDF417 con los campos separados por "@":
// apellido@nombre@sexo@dni@ejemplar@fechaNacimiento@fechaEmision@cuil...
// A veces el texto trae una línea previa con el número de trámite — nos
// quedamos con la línea que tiene el bloque de @.
function parsearPdf417(texto: string): DatosDni | null {
  const linea = texto.split("\n").find((l) => l.includes("@")) || texto;
  const campos = linea.startsWith("@") ? linea.slice(1).split("@") : linea.split("@");
  if (campos.length < 6) return null;

  const [apellido, nombre, sexoRaw, dni, , fechaNac] = campos;
  if (!dni) return null;

  const convertirFecha = (f: string) => {
    const m = f?.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return "";
    return `${m[3]}-${m[2]}-${m[1]}`;
  };

  return {
    nombre: [nombre, apellido].filter(Boolean).join(" ").trim(),
    sexo: sexoRaw?.trim() === "M" ? "Masculino" : sexoRaw?.trim() === "F" ? "Femenino" : "",
    dniCuit: dni.trim(),
    fechaNacimiento: convertirFecha(fechaNac || ""),
  };
}

export default function EscanearDniModal({ onClose, onEscaneado }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const readerRef = useRef<BrowserPDF417Reader | null>(null);
  const [error, setError] = useState("");
  const [procesandoArchivo, setProcesandoArchivo] = useState(false);

  useEffect(() => {
    const reader = new BrowserPDF417Reader();
    readerRef.current = reader;
    let cancelado = false;

    (async () => {
      try {
        const dispositivos = await BrowserPDF417Reader.listVideoInputDevices();
        const trasera = dispositivos.find((d) => /back|trasera|rear|environment/i.test(d.label));
        const deviceId = (trasera || dispositivos[dispositivos.length - 1])?.deviceId;

        const controls = await reader.decodeFromVideoDevice(deviceId, videoRef.current!, (result) => {
          if (cancelado || !result) return;
          const datos = parsearPdf417(result.getText());
          if (datos) {
            cancelado = true;
            controlsRef.current?.stop();
            onEscaneado(datos);
          }
        });
        controlsRef.current = controls;
      } catch (err) {
        console.error(err);
        setError("No se pudo acceder a la cámara. Podés subir una foto del dorso.");
      }
    })();

    return () => {
      cancelado = true;
      controlsRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subirFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !readerRef.current) return;
    setProcesandoArchivo(true);
    setError("");
    const url = URL.createObjectURL(file);
    try {
      const result = await readerRef.current.decodeFromImageUrl(url);
      const datos = parsearPdf417(result.getText());
      if (!datos) throw new Error("no-parseable");
      controlsRef.current?.stop();
      onEscaneado(datos);
    } catch (err) {
      console.error(err);
      setError("No se pudo leer el código de esa foto. Probá con más luz y que se vea el rectángulo completo.");
    } finally {
      URL.revokeObjectURL(url);
      setProcesandoArchivo(false);
    }
  };

  const cerrar = () => {
    controlsRef.current?.stop();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={cerrar} />
      <div className="relative bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/10 w-full max-w-md rounded-2xl shadow-2xl p-5">
        <div className="flex justify-between items-start mb-3">
          <p className="text-sm text-slate-600 dark:text-slate-300 pr-4">Apuntá al <strong>CÓDIGO DE BARRAS</strong> del dorso del DNI (el rectángulo de líneas).</p>
          <button onClick={cerrar} className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative w-full aspect-[4/3] bg-black rounded-xl overflow-hidden">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          <div className="absolute inset-x-[8%] top-[38%] h-[22%] border-2 border-emerald-400 rounded-md pointer-events-none" />
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 text-center">
          {procesandoArchivo ? "Leyendo la foto..." : "Buscando el código... mantené el dorso firme y con buena luz."}
        </p>

        {error && (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 rounded-lg px-3 py-2 mt-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
          </p>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={subirFoto} className="hidden" />
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={procesandoArchivo} className="w-full flex items-center justify-center gap-2 mt-3 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-50">
          <Camera className="w-4 h-4" /> Subir foto del dorso
        </button>

        <button type="button" onClick={cerrar} className="w-full text-center mt-3 text-sm font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 py-1.5">
          Cancelar
        </button>
      </div>
    </div>
  );
}
