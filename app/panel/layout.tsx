import type { Metadata, Viewport } from "next";
import PanelLayoutClient, { type PanelInicial } from "./PanelLayoutClient";
import { createClient } from "@/lib/supabase/server";

// El layout con toda la UI (sidebar, nav, notificaciones) tiene que ser
// "use client" -- un client component no puede exportar `metadata` (regla
// de Next.js), así que ese export vive acá, en un server component chico
// que solo envuelve al de verdad. Sin esto, /panel/* heredaba el
// `robots: { index: true, follow: true }` del layout raíz -- el
// `disallow: /panel/` de app/robots.ts ya evita que Google lo rastree, pero
// una URL de panel linkeada desde afuera igual podía listarse sin contenido
// (caso documentado de Google Search); esto lo cierra a nivel de metadata.
// Con el teclado del celular abierto, la pantalla se achica para quedar arriba de las teclas (en vez de que el teclado tape
// o deje franjas en blanco).
export const viewport: Viewport = { width: "device-width", initialScale: 1, interactiveWidget: "resizes-content" };

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
  // Instalable en la pantalla de inicio (13/10/2026): en iPhone es la única forma de recibir notificaciones push.
  manifest: "/panel.webmanifest",
  appleWebApp: { capable: true, title: "Inmobiliaria CRM", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/panel-app-180.png" },
};

// Perfil, módulos, visibilidad por sector y marca se piden ACÁ, en el servidor y en paralelo (el servidor está pegado a la
// base): antes los pedía el navegador de a uno, y cada viaje de un celular a la base ronda los 300 ms.
// Sin sesión (pantalla de login) devuelve null y el cliente se arregla solo, como siempre.
async function cargarInicial(): Promise<PanelInicial | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const [{ data: perfil }, config, tema, modo] = await Promise.all([
      supabase.from("perfiles").select("nombre, roles, activo").eq("id", user.id).maybeSingle(),
      (async () => {
        const completa = await supabase.from("configuracion_empresa").select("modo_comision, branding_nombre, branding_logo_url, branding_color_primario").eq("id", true).maybeSingle();
        // Si la columna del color todavía no existe en la base, se reintenta sin ella.
        if (completa.error) return supabase.from("configuracion_empresa").select("modo_comision, branding_nombre, branding_logo_url").eq("id", true).maybeSingle();
        return completa;
      })(),
      // Color del modo oscuro (Mi Perfil). Si la columna todavía no existe, queda el de por defecto.
      supabase.from("perfiles").select("tema_oscuro").eq("id", user.id).maybeSingle(),
      // Modo oscuro prendido o apagado (27/10/2026). Si la columna todavía no existe, decide el navegador como antes.
      supabase.from("perfiles").select("modo_oscuro").eq("id", user.id).maybeSingle(),
    ]);
    if (!perfil) return null;

    const roles: string[] = perfil.roles || [];
    // El administrador no se filtra nunca: no hace falta traer módulos ni visibilidad.
    let modulosActivos: Record<string, boolean> = {};
    const visibilidadPorModulo: Record<string, Record<string, boolean>> = {};
    if (!roles.some((r: string) => r === "admin" || r === "director")) {
      const [{ data: modulos }, { data: visibilidad }] = await Promise.all([
        supabase.from("modulos_config").select("modulo, activo"),
        supabase.from("visibilidad_sector").select("modulo, sector, visible"),
      ]);
      modulosActivos = Object.fromEntries((modulos || []).map((m: any) => [m.modulo, m.activo]));
      (visibilidad || []).forEach((v: any) => {
        visibilidadPorModulo[v.modulo] = visibilidadPorModulo[v.modulo] || {};
        visibilidadPorModulo[v.modulo][v.sector] = v.visible;
      });
    }

    const c: any = config.data;
    return {
      miId: user.id,
      nombre: perfil.nombre || "Usuario",
      roles,
      activo: perfil.activo !== false,
      modulosActivos,
      visibilidadPorModulo,
      comisionesActivas: c ? c.modo_comision !== "ninguna" : true,
      branding: { nombre: c?.branding_nombre || null, logoUrl: c?.branding_logo_url || null, color: c?.branding_color_primario || null },
      temaOscuro: tema.error ? null : ((tema.data as { tema_oscuro?: string } | null)?.tema_oscuro ?? null),
      modoOscuro: modo.error ? null : ((modo.data as { modo_oscuro?: boolean | null } | null)?.modo_oscuro ?? null),
    };
  } catch {
    return null; // ante cualquier falla, el cliente carga todo como antes
  }
}

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const inicial = await cargarInicial();
  return <PanelLayoutClient inicial={inicial}>{children}</PanelLayoutClient>;
}
