"use client";

import MobileNavProgress from "@/components/panel/MobileNavProgress";
import AtrasCierraModales from "@/components/panel/AtrasCierraModales";
import { useTecladoAbierto } from "@/components/panel/useTecladoAbierto";
import NotificationBell from "@/components/panel/NotificationBell";
import AvisoNotificacionesPush from "@/components/panel/AvisoNotificacionesPush";
import { esModoDemo } from "@/lib/demo/modo";
import ToastHost from "@/components/panel/ToastHost";
import { puedeVerModulo } from "@/lib/panel/permisosModulos";
import { supabase2 } from "@/lib/supabase/client";
import {
  ChevronRight,
  LogOut,
  Menu,
  Moon,
  RotateCw,
  Sun,
  X,
  LayoutGrid,
  MessageCircle,
} from "lucide-react";
import Link from "next/link";
import IconoPanel from "@/components/panel/IconoPanel";
import { usePathname, useRouter } from "next/navigation";
import { destinoAlerta } from "@/lib/panel/destinoAlerta";
import { useEffect, useRef, useState, ViewTransition } from "react";
import { m } from "framer-motion";
import { CURVA } from "@/components/ui/movimiento";
import { CLASE_MODO_CLARO, clasesModoOscuro, temaOscuroValido, EVENTO_TEMA_OSCURO, type TemaOscuro } from "@/lib/panel/temasOscuros";

// Menú (rediseño 25/11/2026, pedido de Walter: "que se entienda"). Grupos por tarea del día: Inicio, la cartera (propiedades y
// visitas), los mensajes de cada canal y los ajustes. Íconos: los mismos dibujos en color del panel completo de Pfaffen.
// Todo item necesita "modulo" para que la visibilidad por sector (visibilidad_sector) pueda apagarlo.
type ItemMenu = { href: string; label: string; icon: string; modulo?: string; /** Rutas que lo marcan como activo, si no es su href. */ prefijo?: string };

const INICIO: ItemMenu = { href: "/panel", label: "Inicio", icon: "/icons/panel/dashboard.png", modulo: "inicio" };

const GRUPOS: { titulo: string; items: ItemMenu[] }[] = [
  { titulo: "", items: [INICIO] },
  {
    titulo: "Ventas",
    items: [
      { href: "/panel/leads", label: "Leads", icon: "/icons/panel/leads.png", modulo: "leads" },
      { href: "/panel/visitas", label: "Visitas", icon: "/icons/panel/calendario.png", modulo: "visitas" },
    ],
  },
  {
    titulo: "Cartera",
    items: [
      { href: "/panel/propiedades", label: "Propiedades", icon: "/icons/panel/consignaciones.png", modulo: "propiedades" },
    ],
  },
  {
    titulo: "Mensajes",
    items: [
      { href: "/panel/whatsapp", label: "WhatsApp", icon: "/icons/panel/whatsapp.png", modulo: "whatsapp" },
      { href: "/panel/instagram", label: "Instagram", icon: "/icons/panel/instagram.png", modulo: "instagram" },
      { href: "/panel/messenger", label: "Messenger", icon: "/icons/panel/messenger.png", modulo: "messenger" },
      { href: "/panel/rodi", label: "Chat de la web", icon: "/icons/panel/contenido-sitio.png", modulo: "rodi" },
    ],
  },
  {
    titulo: "Ajustes",
    items: [
      { href: "/panel/configuracion/empresa", prefijo: "/panel/configuracion", label: "Configuración", icon: "/icons/panel/configuracion.png", modulo: "configuracion" },
    ],
  },
];

// Barra de abajo del celular: lo que se usa todo el día. El resto (canales, ajustes) está en "Menú".
const NAV_MOBILE: ItemMenu[] = [
  INICIO,
  { href: "/panel/leads", label: "Leads", icon: "/icons/panel/leads.png" },
  { href: "/panel/propiedades", label: "Propiedades", icon: "/icons/panel/consignaciones.png" },
  { href: "/panel/visitas", label: "Agenda", icon: "/icons/panel/calendario.png" },
];

const esActivo = (href: string, ruta: string | null, prefijo?: string) => (href === "/panel" ? ruta === "/panel" : !!ruta?.startsWith(prefijo ?? href));

const ROL_LABEL: Record<string, string> = {
  admin: "Administrador",
  encargado: "Encargado",
  ventas: "Ventas",
};

// Datos que el servidor ya trajo en paralelo antes de mandar la página (ver layout.tsx). Con esto el menú sale armado
// de entrada, sin la cadena de pedidos desde el navegador (perfil → módulos → marca) que antes tardaba 3 viajes seguidos.
export type PanelInicial = {
  miId: string;
  nombre: string;
  roles: string[];
  activo: boolean;
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
  // Pantallas grandes (1280 px o más): el menú queda siempre abierto con los nombres (rediseño 25/11/2026).
  const [anchoGrande, setAnchoGrande] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const aplicar = () => setAnchoGrande(mq.matches);
    aplicar();
    mq.addEventListener("change", aplicar);
    return () => mq.removeEventListener("change", aplicar);
  }, []);
  const colapsado = !menuAbierto && !anchoGrande;
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

  // Qué ve cada rol: lib/panel/permisosModulos.ts (misma regla que en el servidor).
  const moduloVisible = (modulo?: string) => !modulo || puedeVerModulo(roles);

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
      let res: { data: any; error: any } = await supabase2.from("configuracion_empresa").select("branding_nombre, branding_logo_url, branding_color_primario").maybeSingle();
      // Si la columna del color todavía no existe en la base, se reintenta sin ella.
      if (res.error) res = await supabase2.from("configuracion_empresa").select("branding_nombre, branding_logo_url").maybeSingle();
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
    setComisionesActivas(inicial.comisionesActivas);
    setBranding(inicial.branding);
  }, [inicial]);
  const nombreEmpresa = branding.nombre || "Inmobiliaria CRM";
  // Los títulos de página vienen escritos como "Pantalla | Pfaffen Cars" -- se reemplaza el nombre en la pestaña del navegador.
  useEffect(() => {
    const nombre = branding.nombre;
    if (!nombre || nombre.includes("Inmobiliaria CRM")) return;
    const aplicar = () => { if (document.title.includes("Inmobiliaria CRM")) document.title = document.title.replace("Inmobiliaria CRM", nombre); };
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
    return moduloVisible(item.modulo);
  };

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
  const itemDeLaRuta = GRUPOS.flatMap((g) => g.items).find((item) => esActivo(item.href, pathname, item.prefijo));
  if (miId && itemDeLaRuta && !itemVisible(itemDeLaRuta)) {
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
  const demo = esModoDemo();
  const tituloPagina = itemDeLaRuta?.label ?? "Panel";
  const gruposVisibles = GRUPOS.map((g) => ({ ...g, items: g.items.filter(itemVisible) })).filter((g) => g.items.length > 0);

  // Lista del menú: la usa la barra lateral de la compu (angosta o abierta) y el menú del celular (siempre abierta).
  const listaMenu = (angosto: boolean, celular: boolean) => (
    <nav aria-label="Secciones del panel" className="flex-1 overflow-y-auto px-3 py-3 custom-scrollbar">
      {gruposVisibles.map((grupo, gi) => (
        <div key={grupo.titulo || gi} className={gi > 0 ? "mt-4" : ""}>
          {grupo.titulo && (
            angosto
              ? <div className="mx-2 mb-2 border-t border-slate-100 dark:border-white/5" />
              : <p className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">{grupo.titulo}</p>
          )}
          <div className="space-y-0.5">
            {grupo.items.map((item) => {
              const activo = esActivo(item.href, pathname, item.prefijo);
              const cargando = navegandoA === item.href && !activo;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={angosto ? item.label : undefined}
                  aria-current={activo ? "page" : undefined}
                  onClick={() => { setIsOpen(false); if (!activo) setNavegandoA(item.href); }}
                  className={`relative flex items-center gap-3 rounded-xl ${celular ? "py-3" : "py-2.5"} ${angosto ? "justify-center px-0" : "px-3"} text-[14px] transition-colors active:scale-[0.98] ${
                    activo
                      ? "font-bold text-indigo-700 dark:text-indigo-300"
                      : "font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/5 dark:hover:text-white"
                  }`}
                >
                  {activo && <m.span layoutId={celular ? "menu-activo-cel" : "menu-activo"} transition={{ duration: 0.16, ease: CURVA }} className="absolute inset-0 rounded-xl bg-indigo-50 ring-1 ring-indigo-100 dark:bg-indigo-500/15 dark:ring-indigo-400/20" />}
                  <span className="relative flex items-center gap-3 min-w-0">
                    {cargando
                      ? <RotateCw className="w-[22px] h-[22px] animate-spin shrink-0 text-slate-400" />
                      : <IconoPanel src={item.icon} alt="" className="w-[22px] h-[22px]  shrink-0" />}
                    {!angosto && <span className="truncate">{item.label}</span>}
                  </span>
                  {celular && !activo && <ChevronRight className="relative ml-auto w-4 h-4 text-slate-300 dark:text-slate-600" aria-hidden="true" />}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const marcaEmpresa = (angosto: boolean) => (
    <Link href="/" target="_blank" title="Ver la web pública" className={`flex items-center gap-3 min-w-0 ${angosto ? "justify-center" : ""}`}>
      <IconoPanel src={branding.logoUrl || "/logo-placeholder.svg"} alt="" className="w-9 h-9 rounded-xl object-cover shrink-0 ring-1 ring-slate-200 dark:ring-white/10" />
      {!angosto && (
        <div className="min-w-0">
          <p className="text-[15px] font-extrabold leading-tight tracking-tight truncate">{nombreEmpresa}</p>
          <p className="text-[11px] font-medium text-slate-400 leading-tight mt-0.5">Panel de ventas</p>
        </div>
      )}
    </Link>
  );

  const usuario = (angosto: boolean) => (
    <div className={`flex items-center gap-3 ${angosto ? "justify-center" : ""}`} title={angosto ? nombre : undefined}>
      <div className="w-9 h-9 rounded-full bg-[#0145F2] text-white flex items-center justify-center text-sm font-bold shrink-0">
        {nombre.charAt(0).toUpperCase()}
      </div>
      {!angosto && (
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold truncate">{nombre}</p>
          <p className="text-[11px] text-slate-400 truncate">{ROL_LABEL[rolPrincipal] || rolPrincipal || "Equipo"}</p>
        </div>
      )}
      {!angosto && (
        <button onClick={handleLogout} title="Cerrar sesión" aria-label="Cerrar sesión" className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors">
          <LogOut className="w-4 h-4" />
        </button>
      )}
    </div>
  );

  return (
    <div className={darkMode ? clasesModoOscuro(temaOscuro) : CLASE_MODO_CLARO}>
      {/* Celular: el panel ocupa la pantalla con fixed inset-0, igual que la barra de abajo (fixed bottom-0). Con h-dvh, en
          navegadores como Vivaldi el alto quedaba más corto que la pantalla (captura de Walter del 18/10/2026).
          data-sin-atras: con ese fixed inset-0, AtrasCierraModales tomaba el panel entero por una ventana abierta. */}
      <div data-sin-atras style={branding.color ? ({ "--marca": branding.color } as React.CSSProperties) : undefined} className="panel-v2-root flex fixed inset-0 md:static md:h-dvh w-full bg-[#F6F7F9] dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-100 overflow-hidden print:static print:h-auto print:overflow-visible print:block">

        {/* COMPU: barra lateral. En pantallas grandes, abierta con nombres; en las medianas, solo íconos y se abre al pasar el mouse. */}
        <aside
          onMouseEnter={() => moverMenu(true)}
          onMouseLeave={() => moverMenu(false)}
          className={`hidden md:flex print:hidden relative h-full ${colapsado ? "w-[76px]" : "w-[252px]"} bg-white dark:bg-[#111] border-r border-slate-200/80 dark:border-white/10 flex-col shrink-0 transition-[width] duration-150 ease-out z-40`}
        >
          <div className={`h-16 flex items-center border-b border-slate-100 dark:border-white/5 shrink-0 ${colapsado ? "justify-center px-2" : "px-5"}`}>
            {marcaEmpresa(colapsado)}
          </div>
          {listaMenu(colapsado, false)}
          <div className={`border-t border-slate-100 dark:border-white/5 shrink-0 ${colapsado ? "p-3" : "px-4 py-3"}`}>
            {usuario(colapsado)}
          </div>
        </aside>

        {/* CELULAR: menú completo que entra desde la izquierda, por encima de todo, con fondo oscuro para cerrarlo. */}
        <div className={`md:hidden print:hidden fixed inset-0 z-[60] ${isOpen ? "" : "pointer-events-none"}`} aria-hidden={!isOpen}>
          <div className={`absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] transition-opacity duration-200 ${isOpen ? "opacity-100" : "opacity-0"}`} onClick={() => setIsOpen(false)} />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Menú"
            onTouchStart={(e) => { swipeInicioX.current = e.touches[0]?.clientX ?? null; }}
            onTouchEnd={(e) => {
              const inicio = swipeInicioX.current; swipeInicioX.current = null;
              const fin = e.changedTouches[0]?.clientX;
              if (isOpen && inicio !== null && fin !== undefined && inicio - fin > 60) setIsOpen(false);
            }}
            className={`absolute inset-y-0 left-0 w-[86%] max-w-[330px] bg-white dark:bg-[#111] shadow-2xl flex flex-col transition-transform duration-200 ease-out ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
          >
            <div className="h-16 flex items-center justify-between gap-2 pl-5 pr-3 border-b border-slate-100 dark:border-white/5 shrink-0">
              {marcaEmpresa(false)}
              <button onClick={() => setIsOpen(false)} aria-label="Cerrar menú" className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10">
                <X className="w-5 h-5" />
              </button>
            </div>
            {listaMenu(false, true)}
            <div className="border-t border-slate-100 dark:border-white/5 px-4 py-3 space-y-3 shrink-0 pb-[max(12px,env(safe-area-inset-bottom))]">
              <button onClick={toggleDarkMode} className="w-full flex items-center gap-3 px-1 text-[14px] font-medium text-slate-600 dark:text-slate-300">
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                {darkMode ? "Modo claro" : "Modo oscuro"}
              </button>
              {usuario(false)}
            </div>
          </aside>
        </div>

        {/* CONTENIDO */}
        <div className="flex-1 min-w-0 h-full flex flex-col print:h-auto print:block">
          {/* Barra de arriba: en el celular, menú + nombre de la pantalla; en la compu, nombre de la pantalla y accesos. */}
          <header className="print:hidden h-14 md:h-16 flex items-center gap-2 px-2 md:px-6 bg-white/95 dark:bg-[#111]/95 backdrop-blur border-b border-slate-200/80 dark:border-white/10 shrink-0 z-30">
            <button onClick={() => setIsOpen(true)} aria-label="Abrir menú" className="md:hidden p-2.5 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10">
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="md:hidden text-[11px] font-semibold text-slate-400 leading-none truncate">{nombreEmpresa}</p>
              <h1 className="text-[17px] md:text-[20px] font-extrabold tracking-tight leading-tight truncate">{tituloPagina}</h1>
            </div>
            {demo && (
              <Link href="/demo" className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-white/10 px-3.5 py-2 text-[13px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5">
                <MessageCircle className="w-4 h-4 text-[#0145F2]" /> Probar el bot
              </Link>
            )}
            <button
              onClick={toggleDarkMode}
              className="hidden md:inline-flex p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-300"
              title={darkMode ? "Modo claro" : "Modo oscuro"}
              aria-label={darkMode ? "Modo claro" : "Modo oscuro"}
            >
              {darkMode ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
            </button>
            <NotificationBell miId={miId || ""} />
          </header>

          {demo && (
            <div className="print:hidden shrink-0 flex items-center gap-2 px-4 md:px-6 py-1.5 bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200/70 dark:border-amber-500/20 text-[12px] text-amber-900 dark:text-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" aria-hidden="true" />
              <p className="truncate"><b className="font-semibold">Demo con datos de ejemplo.</b><span className="hidden sm:inline"> Probá todo: los cambios no se guardan.</span></p>
              <Link href="/demo" className="sm:hidden ml-auto shrink-0 font-semibold underline underline-offset-2">Probar el bot</Link>
            </div>
          )}

          <main className={`relative flex-1 min-w-0 overflow-y-auto bg-[#F6F7F9] dark:bg-[#0A0A0A] overscroll-y-contain ${tecladoAbierto ? "pb-0" : "pb-[calc(68px+env(safe-area-inset-bottom))]"} md:pb-0 print:overflow-visible print:pb-0 print:bg-white`}>
            {navegandoA && (
              <div className="absolute top-0 left-0 right-0 h-0.5 z-50 overflow-hidden bg-indigo-100 dark:bg-indigo-500/10">
                <div className="h-full w-1/3 bg-indigo-600 dark:bg-indigo-400 animate-barra-carga" />
              </div>
            )}
            {!demo && <AvisoNotificacionesPush />}
            {/* Cambio de módulo: el contenido viejo se desvanece mientras entra el nuevo (View Transitions, ver globals.css). */}
            <ViewTransition key={pathname} name="panel-contenido" share="auto" enter="auto" exit="auto" default="none">
              {children}
            </ViewTransition>
          </main>
        </div>

        {/* CELULAR: barra de abajo con lo de todos los días + "Menú" para el resto. */}
        <nav aria-label="Accesos rápidos" className={`panel-nav-abajo md:hidden print:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-[#111]/95 backdrop-blur border-t border-slate-200 dark:border-white/10 z-40 ${tecladoAbierto ? "hidden" : "grid"} grid-cols-5`}>
          {NAV_MOBILE.filter(itemVisible).map((item) => {
            const activo = esActivo(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={activo ? "page" : undefined}
                onClick={() => { if (!activo) setNavegandoA(item.href); }}
                className="flex flex-col items-center justify-center gap-1 h-[64px]"
              >
                <span className={`flex items-center justify-center w-12 h-7 rounded-full transition-colors ${activo ? "bg-indigo-100 dark:bg-indigo-500/20" : ""}`}>
                  <IconoPanel src={item.icon} alt="" className="w-[22px] h-[22px]" />
                </span>
                <span className={`text-[11px] leading-none ${activo ? "font-bold text-indigo-700 dark:text-indigo-300" : "font-medium text-slate-500 dark:text-slate-400"}`}>{item.label}</span>
              </Link>
            );
          })}
          <button onClick={() => setIsOpen(true)} className="flex flex-col items-center justify-center gap-1 h-[64px]" aria-label="Abrir menú con todas las secciones">
            <span className="flex items-center justify-center w-12 h-7 rounded-full">
              <LayoutGrid className="w-[21px] h-[21px] text-slate-600 dark:text-slate-300" />
            </span>
            <span className="text-[11px] leading-none font-medium text-slate-500 dark:text-slate-400">Menú</span>
          </button>
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

      {/* Cartel de auto nuevo en stock: para el equipo comercial (no taller solo). */}
      <MobileNavProgress />
      <AtrasCierraModales />
      <ToastHost />
    </div>
  );
}
