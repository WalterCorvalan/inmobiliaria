"use client";

import MensajesBubble from "@/components/panel/MensajesBubble";
import MobileNavProgress from "@/components/panel/MobileNavProgress";
import AtrasCierraModales from "@/components/panel/AtrasCierraModales";
import { useTecladoAbierto } from "@/components/panel/useTecladoAbierto";
import NotificationBell from "@/components/panel/NotificationBell";
import AvisoNotificacionesPush from "@/components/panel/AvisoNotificacionesPush";
import ToastHost from "@/components/panel/ToastHost";
import QuickActionsButton from "@/components/panel/QuickActionsButton";
import TopTicker from "@/components/panel/TopTicker";
import { ROL_A_SECTOR, MODULOS_ROL_TALLER, esSoloTaller } from "@/lib/panel/permisosModulos";
import { veMiDia } from "@/lib/panel/miDia";
import NuevoIngresoAviso from "@/components/panel/NuevoIngresoAviso";
import { supabase2 } from "@/lib/supabase/client";
import {
  LogOut,
  Menu,
  Moon,
  RotateCw,
  Search,
  Sun,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { destinoAlerta } from "@/lib/panel/destinoAlerta";
import { useEffect, useRef, useState, ViewTransition } from "react";
import { m } from "framer-motion";
import { CURVA } from "@/components/ui/movimiento";
import { CLASE_MODO_CLARO, clasesModoOscuro, temaOscuroValido, EVENTO_TEMA_OSCURO, type TemaOscuro } from "@/lib/panel/temasOscuros";

// Grupos calcados del índice del manual del CRM viejo — todo lo que todavía
// no construimos queda listado pero deshabilitado, para que el mapa completo
// se vea desde ahora y cada módulo se "prenda" cuando lo hagamos.
// Grupos reorganizados según el nuevo índice del panel Principal.
// Marketing ya está habilitado apuntando a /panel/marketing.
// Grupos calcados del esquema principal solicitado
// Accesos rápidos de la bottom nav en mobile — el resto de los módulos
// sigue disponible detrás del hamburger (sidebar completa).
const NAV_MOBILE: { href: string; label: string; icon: string }[] = [
  { href: "/panel/stock", label: "Stock", icon: "/icons/panel/stock.png" },
  { href: "/panel/leads", label: "Leads", icon: "/icons/panel/leads.png" },
  // Cotizaciones en vez de Clientes (Walter, 19/10/2026).
  { href: "/panel/cotizaciones", label: "Cotizaciones", icon: "/icons/panel/cotizaciones.png" },
  { href: "/panel/ventas", label: "Ventas", icon: "/icons/panel/ventas.png" },
  { href: "/panel/whatsapp", label: "WhatsApp", icon: "/icons/panel/whatsapp.png" },
];

// Todo item necesita "modulo" para que la visibilidad por sector
// (visibilidad_sector) pueda apagarlo -- sin modulo, moduloVisible() lo
// deja pasar para cualquier rol (ver itemVisible más abajo). Dashboard SÍ
// puede apagarse por rol (solo admin/finanzas) -- el login manda siempre
// a "/panel", así que hay un useEffect más abajo que reenvía a quien
// no lo tenga habilitado al primer módulo que sí vea.
const GRUPOS: {
  titulo: string;
  items: { href?: string; label: string; icon: string; modulo?: string }[];
}[] = [
  {
    titulo: "Inicio",
    items: [
      {
        href: "/panel",
        label: "Dashboard",
        icon: "/icons/panel/dashboard.png",
        modulo: "dashboard",
      },
      {
        href: "/panel/reportes",
        label: "Reportes",
        icon: "/icons/panel/reportes.png",
        modulo: "reportes",
      },
      {
        href: "/panel/calendario",
        label: "Calendario",
        icon: "/icons/panel/calendario.png",
        modulo: "calendario",
      },
      // Mi día: el módulo del vendedor (Walter, 27/10/2026). Solo lo ve quien usa Mi día (veMiDia, lib/panel/miDia.ts);
      // el resto tiene Mi Espacio.
      {
        href: "/panel/mi-dia",
        label: "Mi día",
        icon: "/icons/panel/mi-dia.png",
        modulo: "mi_dia",
      },
      {
        href: "/panel/mi-espacio",
        label: "Mi Espacio",
        icon: "/icons/panel/mi-espacio.png",
        modulo: "mi_espacio",
      },
      {
        href: "/panel/mi-perfil",
        label: "Mi Perfil",
        icon: "/icons/panel/mi-perfil.png",
        modulo: "mi_perfil",
      },
    ],
  },
  {
    titulo: "Ventas",
    items: [
      { href: "/panel/leads", label: "Leads", icon: "/icons/panel/leads.png", modulo: "leads" },
      {
        href: "/panel/visitas",
        label: "Visitas",
        icon: "/icons/panel/visitas.png",
        modulo: "visitas",
      },
      {
        href: "/panel/cotizaciones",
        label: "Cotizaciones",
        icon: "/icons/panel/cotizaciones.png",
        modulo: "cotizaciones",
      },
      {
        href: "/panel/financiaciones",
        label: "Financiación y seguros",
        icon: "/icons/panel/financiaciones.png",
        modulo: "financiaciones",
      },
      {
        href: "/panel/senas",
        label: "Señas",
        icon: "/icons/panel/senas.png",
        modulo: "senas",
      },
      {
        href: "/panel/ventas",
        label: "Ventas",
        icon: "/icons/panel/ventas.png",
        modulo: "ventas",
      },
      {
        href: "/panel/mis-ventas",
        label: "Mis ventas",
        icon: "/icons/panel/mis-ventas.png",
        modulo: "mis_ventas",
      },
    ],
  },
  {
    titulo: "Autos",
    items: [
      { href: "/panel/stock", label: "Stock", icon: "/icons/panel/stock.png", modulo: "stock" },
      {
        href: "/panel/consignaciones",
        label: "Consignaciones",
        icon: "/icons/panel/consignaciones.png",
        modulo: "consignaciones",
      },
      {
        href: "/panel/peritajes",
        label: "Peritajes",
        icon: "/icons/panel/peritajes.png",
        modulo: "peritajes",
      },
      {
        href: "/panel/taller",
        label: "Taller",
        icon: "/icons/panel/taller.png",
        modulo: "taller",
      },
      { label: "Service", icon: "/icons/panel/service.png", modulo: "service" },
      {
        href: "/panel/pedidos",
        label: "Pedidos",
        icon: "/icons/panel/pedidos.png",
        modulo: "pedidos",
      },
    ],
  },
  {
    titulo: "Mensajes",
    items: [
      {
        href: "/panel/whatsapp",
        label: "WhatsApp",
        icon: "/icons/panel/whatsapp.png",
        modulo: "whatsapp",
      },
      {
        href: "/panel/instagram",
        label: "Instagram",
        icon: "/icons/panel/instagram.png",
        modulo: "instagram",
      },
      {
        href: "/panel/messenger",
        label: "Messenger",
        icon: "/icons/panel/messenger.png",
        modulo: "messenger",
      },
      {
        href: "/panel/rodi",
        label: "Paffy (chat web)",
        icon: "/icons/panel/rodi.png",
        modulo: "rodi",
      },
      {
        href: "/panel/mensajes",
        label: "Mensajes internos",
        icon: "/icons/panel/mensajes.png",
        modulo: "mensajes",
      },
      { label: "Correos", icon: "/icons/panel/correos.png", modulo: "correos" },
    ],
  },
  {
    titulo: "Clientes",
    items: [
      {
        href: "/panel/clientes",
        label: "Clientes",
        icon: "/icons/panel/clientes.png",
        modulo: "clientes",
      },
      {
        href: "/panel/dormidos",
        label: "Dormidos",
        icon: "/icons/panel/dormidos.png",
        modulo: "dormidos",
      },
      {
        href: "/panel/recontactos",
        label: "Recontactos",
        icon: "/icons/panel/recontactos.png",
        modulo: "recontactos",
      },
      {
        href: "/panel/postventa",
        label: "Postventa",
        icon: "/icons/panel/postventa.png",
        modulo: "postventa",
      },
      {
        href: "/panel/reclamos",
        label: "Reclamos",
        icon: "/icons/panel/reclamos.png",
        modulo: "reclamos",
      },
      { href: "/panel/nps", label: "NPS", icon: "/icons/panel/nps.png", modulo: "nps" },
    ],
  },
  {
    titulo: "Papeles",
    items: [
      {
        href: "/panel/expedientes",
        label: "Expedientes",
        icon: "/icons/panel/expedientes.png",
        modulo: "expedientes",
      },
      {
        href: "/panel/gestoria",
        label: "Gestoría",
        icon: "/icons/panel/gestoria.png",
        modulo: "gestoria",
      },
      {
        href: "/panel/infracciones",
        label: "Infracciones",
        icon: "/icons/panel/infracciones.png",
        modulo: "infracciones",
      },
    ],
  },
  {
    titulo: "Plata",
    items: [
      {
        href: "/panel/finanzas",
        label: "Finanzas",
        icon: "/icons/panel/finanzas.png",
        modulo: "finanzas",
      },
      {
        href: "/panel/cobros",
        label: "Cobros",
        icon: "/icons/panel/cobros.png",
        modulo: "cobros",
      },
      {
        href: "/panel/liquidaciones",
        label: "Transferencias",
        icon: "/icons/panel/liquidaciones.png",
        modulo: "liquidaciones",
      },
      {
        href: "/panel/comisiones",
        label: "Mis Comisiones",
        icon: "/icons/panel/comisiones.png",
        modulo: "comisiones",
      },
      {
        href: "/panel/facturacion",
        label: "Facturación",
        icon: "/icons/panel/facturacion.png",
        modulo: "facturacion",
      },
    ],
  },
  {
    titulo: "Marketing y análisis",
    items: [
      {
        href: "/panel/marketing", // entra al Dashboard (app/panel/marketing/page.tsx) y queda marcado en todas las pestañas
        label: "Marketing",
        icon: "/icons/panel/marketing.png",
        modulo: "marketing",
      },
      {
        href: "/panel/contenido-sitio/entregas",
        label: "Contenido del Sitio",
        icon: "/icons/panel/contenido-sitio.png",
        modulo: "contenido_sitio",
      },
      { href: "/panel/oportunidades", label: "Oportunidades", icon: "/icons/panel/oportunidades.png", modulo: "oportunidades" },
      {
        href: "/panel/alertas",
        label: "Alertas",
        icon: "/icons/panel/alertas.png",
        modulo: "alertas",
      },
    ],
  },
  {
    titulo: "Equipo",
    items: [
      {
        href: "/panel/postulaciones",
        label: "Postulaciones",
        icon: "/icons/panel/postulaciones.png",
        modulo: "postulaciones",
      },
      {
        href: "/panel/sueldos/liquidador",
        label: "Liquidador de Sueldos",
        icon: "/icons/panel/liquidador-sueldos.png",
        modulo: "liquidador_sueldos",
      },
      {
        href: "/panel/sueldos/equipo",
        label: "Dashboard de Equipo",
        icon: "/icons/panel/categorias-empleados.png",
        modulo: "liquidador_sueldos",
      },
      {
        href: "/panel/sueldos/categorias",
        label: "Categorías del convenio",
        icon: "/icons/panel/convenio.png",
        modulo: "categorias_empleados",
      },
    ],
  },
  {
    titulo: "Sistema",
    items: [
      {
        href: "/panel/configuracion",
        label: "Configuración",
        icon: "/icons/panel/configuracion.png",
        modulo: "configuracion",
      },
      // Visible para todos por defecto (sin fila en visibilidad_sector); se puede apagar por sector en Configuración → Empresa → Módulos.
      { href: "/panel/ayuda", label: "Ayuda", icon: "/icons/panel/ayuda.png", modulo: "ayuda" },
      {
        href: "/panel/telefonos",
        label: "Teléfonos útiles",
        icon: "/icons/panel/telefonos.png",
        modulo: "telefonos_utiles",
      },
      { label: "Sugerencias", icon: "/icons/panel/sugerencias.png", modulo: "sugerencias" },
      { href: "/panel/papelera", label: "Papelera", icon: "/icons/panel/papelera.png", modulo: "papelera" },
      {
        href: "/panel/errores",
        label: "Errores del sistema",
        icon: "/icons/panel/errores.png",
        modulo: "errores_sistema",
      },
      {
        href: "/panel/logs",
        label: "Registro de Cambios",
        icon: "/icons/panel/registro-cambios.png",
        modulo: "logs",
      },
    ],
  },
];

const ROL_LABEL: Record<string, string> = {
  admin: "Administrador",
  encargado: "Encargado",
  ventas: "Ventas",
  finanzas: "Finanzas",
  gestoria: "Gestoría",
};
const ROL_COLOR: Record<string, string> = {
  admin: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  encargado: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  ventas: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  finanzas:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  gestoria:
    "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300",
};

// Datos que el servidor ya trajo en paralelo antes de mandar la página (ver layout.tsx). Con esto el menú sale armado
// de entrada, sin la cadena de pedidos desde el navegador (perfil → módulos → marca) que antes tardaba 3 viajes seguidos.
export type PanelInicial = {
  miId: string;
  nombre: string;
  roles: string[];
  activo: boolean;
  modulosActivos: Record<string, boolean>;
  visibilidadPorModulo: Record<string, Record<string, boolean>>;
  comisionesActivas: boolean;
  branding: { nombre: string | null; logoUrl: string | null; color: string | null };
  /** Color del modo oscuro elegido en Mi Perfil (lib/panel/temasOscuros.ts). */
  temaOscuro?: string | null;
  /** Modo oscuro prendido o apagado, guardado en el perfil (27/10/2026). null = nunca lo tocó: decide el navegador. */
  modoOscuro?: boolean | null;
};

/** Guarda en el perfil si el modo oscuro quedó prendido. Si falla, queda igual en este navegador. */
function guardarModoOscuro(prendido: boolean) {
  return fetch("/api/panel/perfil", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modo_oscuro: prendido }),
  }).catch(() => undefined);
}

export default function PanelLayoutClient({
  children,
  inicial = null,
}: {
  children: React.ReactNode;
  inicial?: PanelInicial | null;
}) {
  // Color del modo oscuro de cada uno (Walter, 21/10/2026; app/panel-tema-oscuro.css). Las clases van en el mismo <div>
  // que lleva "dark" (abajo, en el return): el modo oscuro del panel vive ahí y no en <html>. Mi Perfil avisa cuando se cambia.
  const [temaOscuro, setTemaOscuro] = useState<TemaOscuro>(() => temaOscuroValido(inicial?.temaOscuro));
  useEffect(() => {
    const alCambiar = (e: Event) => setTemaOscuro(temaOscuroValido((e as CustomEvent<string>).detail));
    window.addEventListener(EVENTO_TEMA_OSCURO, alCambiar);
    return () => window.removeEventListener(EVENTO_TEMA_OSCURO, alCambiar);
  }, []);
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const swipeInicioX = useRef<number | null>(null);
  // Compu: el menú está cerrado (solo íconos) y se abre al pasar el mouse, empujando la página igual que hacía el botón
  // de abrir/cerrar, que se sacó (Walter, 27/10/2026). Cerrado, las pantallas usan todo el ancho. En el celular no cuenta.
  const [menuAbierto, setMenuAbierto] = useState(false);
  const esperaMenu = useRef<ReturnType<typeof setTimeout> | null>(null);
  const colapsado = !menuAbierto;
  const moverMenu = (abrir: boolean) => {
    if (esperaMenu.current) clearTimeout(esperaMenu.current);
    // Un instante antes de abrir, para que cruzar el mouse rápido por el borde no lo abra.
    esperaMenu.current = setTimeout(() => setMenuAbierto(abrir), abrir ? 70 : 40);
  };
  // Prendido o apagado sale del perfil (27/10/2026): así llega del servidor ya oscuro, sin arrancar en claro y saltar, y
  // queda igual en cualquier computadora. Antes vivía solo en el navegador.
  const [darkMode, setDarkMode] = useState(inicial?.modoOscuro ?? false);
  const modoInicial = useRef({ guardado: inicial?.modoOscuro ?? null, conSesion: !!inicial });
  const [nombre, setNombre] = useState(inicial?.nombre ?? "Cargando...");
  const [roles, setRoles] = useState<string[]>(inicial?.roles ?? []);
  const [miId, setMiId] = useState<string | null>(inicial?.miId ?? null);
  const [toast, setToast] = useState<{
    id: string;
    titulo: string;
    mensaje: string | null;
    link: string | null;
  } | null>(null);
  // Feedback de "toqué esto, se está cargando" en la navegación del sidebar —
  // sin esto, un click tarda ~1-2s en mostrar algo y parece que no pasó nada.
  const [navegandoA, setNavegandoA] = useState<string | null>(null);

  // Con el teclado del celular abierto se esconde la barra de abajo (si no, queda una franja en blanco sobre las teclas).
  const tecladoAbierto = useTecladoAbierto();

  useEffect(() => {
    setNavegandoA(null);
  }, [pathname]);

  useEffect(() => {
    // Sin nada en el perfil (o sin sesión todavía), lo que tenga guardado el navegador, como antes; y se pasa al perfil.
    if (modoInicial.current.guardado == null && localStorage.getItem("panelV2DarkMode") === "true") {
      setDarkMode(true);
      if (modoInicial.current.conSesion) void guardarModoOscuro(true);
    }
  }, []);

  useEffect(() => {
    const cargarPerfil = async (userId: string) => {
      const { data } = await supabase2
        .from("perfiles")
        .select("nombre, roles, activo")
        .eq("id", userId)
        .maybeSingle();
      // Si lo desactivaron (Configuración → Usuarios) mientras tenía sesión
      // abierta, cerrarla acá -- el chequeo en /panel/login solo cubre el
      // login nuevo, no a alguien que ya estaba adentro.
      if (data?.activo === false) {
        await supabase2.auth.signOut();
        router.replace("/panel/login");
        return;
      }
      setMiId(userId);
      setNombre(data?.nombre || "Usuario");
      setRoles(data?.roles || []);
    };

    // getSession lee la sesión guardada en el navegador (sin red): el proxy y cada página ya validaron el usuario contra
    // Supabase en el servidor, así que acá no hace falta otra vuelta de ida y vuelta para saber quién es.
    if (!inicial) {
      supabase2.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) cargarPerfil(session.user.id);
      });
    } else if (inicial.activo === false) {
      // Lo desactivaron mientras tenía sesión: se cierra igual que antes.
      supabase2.auth.signOut().then(() => router.replace("/panel/login"));
    }

    // El layout envuelve /panel/login y no se remonta al navegar a
    // /panel tras el login (misma instancia de layout) -- sin este
    // listener, getUser() de arriba corre una sola vez con user=null
    // (corrió mientras estaba en /login sin sesión) y roles nunca se
    // vuelve a pedir hasta un F5 real. onAuthStateChange reacciona al
    // SIGNED_IN aunque no haya remount.
    const { data: sub } = supabase2.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        cargarPerfil(session.user.id);
      } else if (event === "SIGNED_OUT") {
        setMiId(null);
        setRoles([]);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [router]);

  // Módulos apagados por Empresa → Módulos, y visibilidad por sector —
  // el admin no se filtra nunca, así que solo hace falta traer esto para
  // el resto de los roles.
  const [modulosActivos, setModulosActivos] = useState<Record<string, boolean>>(
    inicial?.modulosActivos ?? {},
  );
  const [visibilidadPorModulo, setVisibilidadPorModulo] = useState<
    Record<string, Record<string, boolean>>
  >(inicial?.visibilidadPorModulo ?? {});
  useEffect(() => {
    if (inicial) return; // ya vino del servidor
    if (roles.some((r: string) => r === "admin" || r === "director")) return;
    Promise.all([
      supabase2.from("modulos_config").select("modulo, activo"),
      supabase2.from("visibilidad_sector").select("modulo, sector, visible"),
    ]).then(([{ data: modulos }, { data: visibilidad }]) => {
      setModulosActivos(
        Object.fromEntries((modulos || []).map((m) => [m.modulo, m.activo])),
      );
      const porModulo: Record<string, Record<string, boolean>> = {};
      (visibilidad || []).forEach((v) => {
        porModulo[v.modulo] = porModulo[v.modulo] || {};
        porModulo[v.modulo][v.sector] = v.visible;
      });
      setVisibilidadPorModulo(porModulo);
    });
  }, [roles.join(",")]);

  const esAdmin = roles.some((r: string) => r === "admin" || r === "director");
  const moduloVisible = (modulo?: string) => {
    if (esAdmin || !modulo) return true;
    if (modulosActivos[modulo] === false) return false;
    // Rol taller solo: Stock y Taller (lib/panel/permisosModulos.ts, misma regla que puedeVerModulo en el servidor).
    if (esSoloTaller(roles)) return MODULOS_ROL_TALLER.includes(modulo) || visibilidadPorModulo[modulo]?.[ROL_A_SECTOR.taller] === true;

    // Clientes siempre visible para todos los roles salvo taller, sin
    // depender de que "Visibilidad por sector" esté bien configurado --
    // pedido explícito para no dejar a ventas/encargado/finanzas/gestoría
    // sin acceso si alguien lo apaga sin querer desde Configuración →
    // Empresa → Módulos. Taller queda afuera a propósito.
    if (modulo === "clientes" && roles.some((r) => ["ventas", "encargado", "finanzas", "gestoria"].includes(r))) return true;

    const sectores = roles.map((r) => ROL_A_SECTOR[r]).filter(Boolean);
    if (sectores.length === 0) return true;

    // Sin fila en visibilidad_sector para ese módulo+sector, el módulo
    // queda VISIBLE por default -- solo se apaga con una fila explícita en
    // false (ver sql_panel_v2_permisos_sector_ventas.sql/_encargado.sql).
    // Multi-rol suma permisos: alcanza que UN sector del usuario lo vea.
    return sectores.some((s) => visibilidadPorModulo[modulo]?.[s] ?? true);
  };

  // "Mis Comisiones" se esconde para todos (admin incluido, como en el
  // resto de la agencia) cuando Empresa → Comisiones está en modo "ninguna".
  const [comisionesActivas, setComisionesActivas] = useState(inicial?.comisionesActivas ?? true);

  // Identidad de la empresa (Configuración > Empresa > Branding): nombre, logo y color principal del panel.
  // Sin nada cargado queda como siempre (Pfaffen Cars, su ícono y el azul de marca).
  const [branding, setBranding] = useState<{ nombre: string | null; logoUrl: string | null; color: string | null }>(inicial?.branding ?? { nombre: null, logoUrl: null, color: null });
  useEffect(() => {
    if (inicial) return; // ya vino del servidor
    (async () => {
      // Una sola consulta a la fila de la empresa: modo de comisiones + identidad (antes eran dos pedidos).
      let res: { data: any; error: any } = await supabase2.from("configuracion_empresa").select("modo_comision, branding_nombre, branding_logo_url, branding_color_primario").eq("id", true).maybeSingle();
      // Si la columna del color todavía no existe en la base, se reintenta sin ella.
      if (res.error) res = await supabase2.from("configuracion_empresa").select("modo_comision, branding_nombre, branding_logo_url").eq("id", true).maybeSingle();
      if (res.data) setComisionesActivas(res.data.modo_comision !== "ninguna");
      if (res.data) setBranding({ nombre: res.data.branding_nombre || null, logoUrl: res.data.branding_logo_url || null, color: res.data.branding_color_primario || null });
    })();
  }, []);
  // El layout no se remonta al entrar y salir (login, logout, otro usuario): cuando el servidor manda datos nuevos
  // (router.refresh() después del login) hay que volcarlos a los estados, si no quedarían los del usuario anterior.
  useEffect(() => {
    if (!inicial) return;
    setMiId(inicial.miId);
    setNombre(inicial.nombre);
    setRoles(inicial.roles);
    setModulosActivos(inicial.modulosActivos);
    setVisibilidadPorModulo(inicial.visibilidadPorModulo);
    setComisionesActivas(inicial.comisionesActivas);
    setBranding(inicial.branding);
  }, [inicial]);
  const nombreEmpresa = branding.nombre || "Pfaffen Cars";
  // Los títulos de página vienen escritos como "Pantalla | Pfaffen Cars" -- se reemplaza el nombre en la pestaña del navegador.
  useEffect(() => {
    const nombre = branding.nombre;
    if (!nombre || nombre.includes("Pfaffen Cars")) return;
    const aplicar = () => { if (document.title.includes("Pfaffen Cars")) document.title = document.title.replace("Pfaffen Cars", nombre); };
    aplicar();
    const t = document.querySelector("title");
    if (!t) return;
    const mo = new MutationObserver(aplicar);
    mo.observe(t, { childList: true, characterData: true, subtree: true });
    return () => mo.disconnect();
  }, [branding.nombre, pathname]);

  const itemVisible = (item: { href?: string; modulo?: string }) => {
    if (item.href === "/panel/comisiones" && !comisionesActivas)
      return false;
    if (item.modulo === "mi_dia") return veMiDia(roles);
    return moduloVisible(item.modulo);
  };

  // El login manda siempre a "/panel" (Dashboard) sin importar el rol --
  // ahora que Dashboard puede estar apagado para un rol (solo admin/finanzas
  // lo ven), a alguien sin acceso lo mandaríamos directo a la pantalla de
  // "Módulo no habilitado" apenas entra. En vez de eso, lo reenviamos solo
  // ahí al primer módulo que sí tenga habilitado.
  useEffect(() => {
    if (!miId || pathname !== "/panel") return;
    if (moduloVisible("dashboard")) return;
    const primerVisible = GRUPOS.flatMap((g) => g.items).find(
      (item) => item.href && item.href !== "/panel" && itemVisible(item),
    );
    if (primerVisible?.href) router.replace(primerVisible.href);
    // Módulos y visibilidad también cuentan: llegan después de los roles (o con el refresh del login) y si no se re-evalúa
    // quien no ve el Dashboard se quedaría en una pantalla en blanco.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miId, pathname, roles.join(","), modulosActivos, visibilidadPorModulo]);

  // Toast de alertas urgentes en vivo (se cierra solo a los 10s, o con
  // click) — el contador de la campana lo maneja NotificationBell aparte.
  useEffect(() => {
    if (!miId) return;

    const canal = supabase2
      .channel(`alertas-${miId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "alertas",
          filter: `destinatario_id=eq.${miId}`,
        },
        (payload) => {
          if (payload.new.prioridad === "alta") {
            setToast({
              id: payload.new.id,
              titulo: payload.new.titulo,
              mensaje: payload.new.mensaje,
              link: payload.new.link,
            });
            setTimeout(
              () =>
                setToast((prev) => (prev?.id === payload.new.id ? null : prev)),
              5000,
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase2.removeChannel(canal);
    };
  }, [miId]);

  const toggleDarkMode = () => {
    const nuevo = !darkMode;
    setDarkMode(nuevo);
    localStorage.setItem("panelV2DarkMode", String(nuevo));
    void guardarModoOscuro(nuevo);
  };

  const handleLogout = async () => {
    await supabase2.auth.signOut();
    router.push("/panel/login");
  };

  const esLogin = pathname === "/panel/login";
  if (esLogin) return <>{children}</>;

  // Guard de acceso directo por URL: un módulo apagado o sin visibilidad
  // para el sector del usuario no debe abrirse solo porque conoce el link.
  const itemDeLaRuta = GRUPOS.flatMap((g) => g.items).find(
    (item) =>
      item.href &&
      (item.href === "/panel"
        ? pathname === item.href
        : pathname?.startsWith(item.href)),
  );
  if (miId && itemDeLaRuta && !itemVisible(itemDeLaRuta)) {
    // "/panel" (Dashboard) es a donde manda el login sin importar el
    // rol -- si no lo tiene habilitado, el useEffect de arriba ya lo está
    // reenviando a otro lado; no mostrar el cartel de bloqueo acá, solo
    // parpadearía un instante antes de la redirección.
    if (pathname === "/panel") return null;
    return (
      <div className="min-h-screen flex items-center justify-center text-center p-6">
        <div>
          <p className="text-lg font-bold text-slate-700 dark:text-slate-200">
            Módulo no habilitado
          </p>
          <p className="text-sm text-slate-400 mt-1">
            Esta sección está apagada o no está disponible para tu rol.
          </p>
        </div>
      </div>
    );
  }

  const rolPrincipal = roles[0] || "";

  return (
    <div className={darkMode ? clasesModoOscuro(temaOscuro) : CLASE_MODO_CLARO}>
      {/* Celular: el panel ocupa la pantalla con fixed inset-0, igual que la barra de abajo (fixed bottom-0). Con h-dvh, en
          navegadores como Vivaldi el alto quedaba más corto que la pantalla y aparecía un espacio vacío entre el campo para
          escribir y los accesos directos (captura de Walter del 18/10/2026, /panel/instagram).
          data-sin-atras: con ese fixed inset-0, AtrasCierraModales tomaba el panel entero por una ventana abierta y agregaba
          una entrada al historial al cargar, sin que el usuario tocara nada; el celular salta esas entradas, y "atrás" con
          un formulario abierto (Nueva orden de Taller) se iba de la pantalla en vez de cerrarlo (Walter, 27/10/2026). */}
      <div data-sin-atras style={branding.color ? ({ "--marca": branding.color } as React.CSSProperties) : undefined} className="panel-v2-root flex fixed inset-0 md:static md:h-dvh w-full bg-[#F8FAFC] dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-100 overflow-hidden print:static print:h-auto print:overflow-visible print:block">
        <div className="md:hidden print:hidden fixed top-0 left-0 right-0 h-14 bg-white dark:bg-[#111] border-b border-slate-200 dark:border-white/10 flex items-center gap-2 px-3 z-50">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="shrink-0 p-1 text-slate-600 dark:text-slate-300"
          >
            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              disabled
              placeholder="Buscar clientes, patentes..."
              title="El buscador global se conecta cuando construyamos esos módulos"
              className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full py-1.5 pl-9 pr-3 text-[12px] outline-none text-slate-900 dark:text-white placeholder:text-slate-400 disabled:cursor-not-allowed"
            />
          </div>
          <button
            onClick={toggleDarkMode}
            className="shrink-0 p-1.5 rounded-lg text-slate-500 dark:text-slate-300"
            title={darkMode ? "Modo claro" : "Modo oscuro"}
          >
            {darkMode ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>
          <NotificationBell miId={miId || ""} />
        </div>

        {/* Celular: tocar fuera del menú lo cierra (y deslizar el menú hacia la izquierda también) */}
        {isOpen && <div className="md:hidden print:hidden fixed inset-x-0 bottom-0 top-14 bg-black/40 z-30" onClick={() => setIsOpen(false)} aria-hidden="true" />}

        {/* SIDEBAR */}
        <aside
          onMouseEnter={() => moverMenu(true)}
          onMouseLeave={() => moverMenu(false)}
          onTouchStart={(e) => { swipeInicioX.current = e.touches[0]?.clientX ?? null; }}
          onTouchEnd={(e) => {
            const inicio = swipeInicioX.current; swipeInicioX.current = null;
            const fin = e.changedTouches[0]?.clientX;
            if (isOpen && inicio !== null && fin !== undefined && inicio - fin > 60) setIsOpen(false);
          }}
          className={`print:hidden fixed md:relative top-14 md:top-0 left-0 h-[calc(100dvh-3.5rem)] md:h-full ${colapsado ? "md:w-[68px]" : "md:w-[230px]"} w-[230px] bg-white dark:bg-[#111] border-r border-slate-200 dark:border-white/10 flex flex-col shrink-0 transform transition-[width,transform] duration-150 ease-out z-40 ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
        >
          <div
            className={`h-[60px] flex items-center gap-2 border-b border-slate-200 dark:border-white/10 shrink-0 ${colapsado ? "md:justify-center md:px-2 px-4" : "px-4"}`}
          >
            <Link href="/" target="_blank" title="Ver la web pública" className="flex items-center gap-2 min-w-0">
              <img src={branding.logoUrl || "/pfaffen-automotores-icono.webp"} alt={nombreEmpresa} className={`rounded-lg object-cover shrink-0 transition-[width,height] duration-150 ease-out ${colapsado ? "w-8 h-8 md:w-11 md:h-11" : "w-8 h-8"}`} />
              <div className={colapsado ? "md:hidden" : ""}>
                <p className="text-sm font-bold leading-none">Panel</p>
                <p className="text-[10px] text-slate-400 leading-none mt-0.5">
                  {nombreEmpresa}
                </p>
              </div>
            </Link>
          </div>

          <nav className="flex-1 overflow-y-auto py-2 custom-scrollbar">
            {GRUPOS.map(
              (grupo) =>
                grupo.items.some((item) => itemVisible(item)) && (
                  <div key={grupo.titulo} className="mb-1">
                    <p
                      className={`px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 ${colapsado ? "md:hidden" : ""}`}
                    >
                      {grupo.titulo}
                    </p>
                    {colapsado && (
                      <div className="hidden md:block mx-3 my-1.5 border-t border-slate-100 dark:border-white/5 first:mt-0" />
                    )}
                    {grupo.items
                      .filter((item) => itemVisible(item))
                      .map((item) => {
                        const activo =
                          item.href &&
                          (item.href === "/panel"
                            ? pathname === item.href
                            : pathname?.startsWith(item.href));
                        if (!item.href) {
                          return (
                            <div
                              key={item.label}
                              title="Todavía no construido"
                              className={`flex items-center gap-3 py-2 mx-2 rounded-lg text-sm text-slate-300 dark:text-slate-600 cursor-not-allowed ${colapsado ? "md:justify-center px-4 md:px-0" : "px-4"}`}
                            >
                              <img src={item.icon} alt="" className="w-5 h-5 shrink-0 object-contain opacity-50" />{" "}
                              <span className={`whitespace-nowrap ${colapsado ? "md:hidden" : ""}`}>
                                {item.label}
                              </span>
                            </div>
                          );
                        }
                        const cargando = navegandoA === item.href && !activo;
                        return (
                          <Link
                            key={item.label}
                            href={item.href}
                            title={colapsado ? item.label : undefined}
                            onClick={() => {
                              setIsOpen(false);
                              if (!activo) setNavegandoA(item.href!);
                            }}
                            className={`relative flex items-center gap-3 py-2 mx-2 rounded-lg text-sm transition-all active:scale-[0.97] ${colapsado ? "md:justify-center px-4 md:px-0" : "px-4"} ${
                              activo
                                ? "text-indigo-700 dark:text-indigo-300 font-semibold"
                                : cargando
                                  ? "bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-300"
                                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                            }`}
                          >
                            {activo && <m.span layoutId="menu-activo" transition={{ duration: 0.16, ease: CURVA }} className="absolute inset-0 rounded-lg border border-indigo-200 border-l-[3px] border-l-indigo-500 bg-indigo-50 dark:border-indigo-400/45 dark:border-l-indigo-400 dark:bg-indigo-500/10" />}
                            <span className="relative flex items-center gap-3">
                              {cargando ? (
                                <RotateCw className="w-5 h-5 animate-spin shrink-0" />
                              ) : (
                                <img src={item.icon} alt="" className="w-5 h-5 shrink-0 object-contain" />
                              )}{" "}
                              <span className={`whitespace-nowrap ${colapsado ? "md:hidden" : ""}`}>
                                {item.label}
                              </span>
                            </span>
                          </Link>
                        );
                      })}
                  </div>
                ),
            )}
          </nav>

          <div className="border-t border-slate-200 dark:border-white/10 p-3 shrink-0 space-y-2">
            <div
              className={`flex items-center gap-2 px-1 ${colapsado ? "md:justify-center" : ""}`}
              title={colapsado ? nombre : undefined}
            >
              <div className="w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                {nombre.charAt(0).toUpperCase()}
              </div>
              <div className={`min-w-0 flex-1 ${colapsado ? "md:hidden" : ""}`}>
                <p className="text-xs font-bold truncate">{nombre}</p>
                {rolPrincipal && (
                  <span
                    className={`inline-block text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${ROL_COLOR[rolPrincipal] || "bg-slate-100 text-slate-600"}`}
                  >
                    {ROL_LABEL[rolPrincipal] || rolPrincipal}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={handleLogout}
              title={colapsado ? "Cerrar sesión" : undefined}
              className={`w-full flex items-center gap-2 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors ${colapsado ? "md:justify-center px-2" : "px-2"}`}
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />{" "}
              <span className={colapsado ? "md:hidden" : ""}>
                Cerrar sesión
              </span>
            </button>
          </div>
        </aside>

        {/* CONTENIDO */}
        <div className="flex-1 min-w-0 h-full flex flex-col pt-14 md:pt-0 print:pt-0 print:h-auto print:block">
          {/* TOPBAR */}
          <div className="hidden md:flex print:hidden items-center gap-3 px-4 py-2 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-[#111] shrink-0">
            <div className="relative w-64 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                disabled
                placeholder="Buscar clientes, patentes, etc..."
                title="El buscador global se conecta cuando construyamos esos módulos"
                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full py-1.5 pl-9 pr-3 text-[11px] outline-none text-slate-900 dark:text-white placeholder:text-slate-400 disabled:cursor-not-allowed"
              />
            </div>

            <TopTicker puedeVerCaja={esAdmin || roles.includes("finanzas") || roles.includes("director")} />

            <button
              onClick={toggleDarkMode}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-300 shrink-0"
              title={darkMode ? "Modo claro" : "Modo oscuro"}
            >
              {darkMode ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
            <NotificationBell miId={miId || ""} />
          </div>

          <main className={`relative flex-1 min-w-0 overflow-y-auto bg-[#F8FAFC] dark:bg-[#0A0A0A] overscroll-y-contain ${tecladoAbierto ? "pb-0" : "pb-16"} md:pb-0 print:overflow-visible print:pb-0 print:bg-white`}>
            {navegandoA && (
              <div className="absolute top-0 left-0 right-0 h-0.5 z-50 overflow-hidden bg-indigo-100 dark:bg-indigo-500/10">
                <div className="h-full w-1/3 bg-indigo-600 dark:bg-indigo-400 animate-barra-carga" />
              </div>
            )}
            {/* Cambio de módulo: el contenido viejo se desvanece mientras entra el nuevo (View Transitions, ver globals.css). El menú y la barra de arriba no se mueven. */}
            <AvisoNotificacionesPush />
            <ViewTransition key={pathname} name="panel-contenido" share="auto" enter="auto" exit="auto" default="none">
              {children}
            </ViewTransition>
          </main>
        </div>

        {/* BOTTOM NAV — accesos rápidos en mobile, la barra lateral completa
            queda detrás del hamburger para lo demás. */}
        <nav className={`md:hidden print:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-[#111] border-t border-slate-200 dark:border-white/10 items-stretch z-40 ${isOpen || tecladoAbierto ? "hidden" : "flex"}`}>
          {NAV_MOBILE.map((item) => {
            const activo = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${activo ? "text-[#0145F2] dark:text-[#5b8dff]" : "text-slate-500 dark:text-slate-400"}`}
              >
                <img src={item.icon} alt="" className="w-5 h-5 object-contain" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {toast && (
        <div
          onClick={() => {
            if (toast.link) router.push(destinoAlerta(toast.link) ?? toast.link);
            setToast(null);
          }}
          className="print:hidden fixed top-4 right-4 z-[100] w-80 bg-white dark:bg-[#1A1A1A] border border-rose-200 dark:border-rose-500/30 rounded-xl shadow-2xl p-4 cursor-pointer animate-fadeIn"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold text-rose-600 dark:text-rose-400">
              {toast.titulo}
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setToast(null);
              }}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {toast.mensaje && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {toast.mensaje}
            </p>
          )}
        </div>
      )}

      <QuickActionsButton />
      <MensajesBubble />
      {/* Cartel de auto nuevo en stock: para el equipo comercial (no taller solo). */}
      {roles.some((r) => ["admin", "encargado", "ventas", "director"].includes(r)) && <NuevoIngresoAviso miId={miId} />}
      <MobileNavProgress />
      <AtrasCierraModales />
      <ToastHost />
    </div>
  );
}
