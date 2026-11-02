"use client";

import { useEffect, useState } from "react";
import { supabase2 } from "@/lib/supabase/client";

// En la bandeja de chats (WhatsApp, Instagram, Messenger, Rodi) el círculo de cada conversación
// muestra a QUIÉN está asignada (foto del vendedor/encargado), no al cliente -- pedido de Walter 3/10/2026.
// Sin foto cargada: iniciales del vendedor. Sin vendedor asignado: un círculo gris con "?" (incógnito).

type PerfilFoto = { nombre: string | null; foto_url: string | null };
let cache: Record<string, PerfilFoto> | null = null;
let pendiente: Promise<Record<string, PerfilFoto>> | null = null;

function cargarPerfiles(): Promise<Record<string, PerfilFoto>> {
  if (cache) return Promise.resolve(cache);
  if (!pendiente) {
    pendiente = Promise.resolve(supabase2.from("perfiles").select("id, nombre, foto_url")).then(({ data }) => {
      const mapa: Record<string, PerfilFoto> = {};
      (data || []).forEach((p: { id: string; nombre: string | null; foto_url: string | null }) => { mapa[p.id] = { nombre: p.nombre, foto_url: p.foto_url }; });
      cache = mapa;
      return mapa;
    });
  }
  return pendiente;
}

export function useFotosVendedores() {
  const [perfiles, setPerfiles] = useState<Record<string, PerfilFoto>>(cache || {});
  useEffect(() => {
    let vivo = true;
    cargarPerfiles().then((m) => { if (vivo) setPerfiles(m); });
    return () => { vivo = false; };
  }, []);
  return perfiles;
}

export default function AvatarVendedor({
  vendedorId, nombreRespaldo, clase, claseTexto = "text-sm",
}: {
  vendedorId: string | null | undefined;
  /** Nombre del vendedor ya conocido por la conversación (por si el perfil todavía no cargó). */
  nombreRespaldo?: string | null;
  /** Tamaño, ej: "w-10 h-10". */
  clase: string;
  claseTexto?: string;
}) {
  const perfiles = useFotosVendedores();
  if (!vendedorId) return <div title="Sin asignar" className={`${clase} rounded-full bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-slate-300 flex items-center justify-center font-black shrink-0 ${claseTexto}`}>?</div>;
  const perfil = perfiles[vendedorId];
  const nombre = perfil?.nombre || nombreRespaldo || "";
  if (perfil?.foto_url) {
    return <img src={perfil.foto_url} alt={nombre} title={nombre ? `Asignado a ${nombre}` : undefined} className={`${clase} rounded-full object-cover shrink-0 bg-slate-200`} />;
  }
  const iniciales = nombre.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";
  return <div title={nombre ? `Asignado a ${nombre}` : undefined} className={`${clase} rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0 ${claseTexto}`}>{iniciales}</div>;
}
