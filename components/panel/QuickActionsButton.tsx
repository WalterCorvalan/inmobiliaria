"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Receipt, Calculator, Car, UserPlus, ShoppingCart, Loader2, type LucideIcon } from "lucide-react";
import { supabase2 } from "@/lib/supabase/client";
import NuevaSenaModal from "@/app/panel/senas/NuevaSenaModal";
import NuevaCotizacionModal from "@/app/panel/cotizaciones/NuevaCotizacionModal";
import NuevoVehiculoModal from "@/app/panel/stock/NuevoVehiculoModal";
import NuevoClienteModal from "@/app/panel/clientes/NuevoClienteModal";
import NuevaVentaModal from "@/app/panel/ventas/NuevaVentaModal";
import { avisar } from "@/components/panel/Dialogos";

type AccionId = "recibo" | "presupuesto" | "vehiculo" | "cliente" | "venta";

// Botón "+" flotante global (calcado del CRM viejo) — despliega los 5 accesos
// directos de creación rápida. Cada uno abre su modal ACÁ MISMO (sin navegar
// a todo el módulo) -- antes hacía router.push("/panel/x?nuevo=1"), que
// abandonaba la pantalla en la que estabas para cargar el módulo entero solo
// para mostrar el modal. Los datos que necesita cada modal se traen recién
// al abrirlo (una función de carga por acción, con su propio estado) -- no
// se comparte un solo estado "any" entre las 5 porque cada modal de destino
// ya declara su propia forma de Perfil/Cliente/etc, no exportada.
const ACCIONES: { id: AccionId; label: string; icon: LucideIcon; color: string }[] = [
  { id: "recibo", label: "Nuevo recibo (seña)", icon: Receipt, color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" },
  { id: "presupuesto", label: "Nueva cotización", icon: Calculator, color: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300" },
  { id: "vehiculo", label: "Nuevo vehículo", icon: Car, color: "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300" },
  { id: "cliente", label: "Nuevo cliente", icon: UserPlus, color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" },
  { id: "venta", label: "Nueva venta", icon: ShoppingCart, color: "bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300" },
];

async function cargarDatosRecibo() {
  const [{ data: clientes }, { data: vehiculos }, { data: vendedores }, { data: sucursales }, { data: cuentas }] = await Promise.all([
    supabase2.from("clientes").select("*").order("nombre"),
    supabase2.from("vehiculos").select("*").eq("estado", "disponible").order("marca"),
    supabase2.from("perfiles").select("id, nombre").eq("activo", true).order("nombre"),
    supabase2.from("sucursales").select("id, nombre").order("nombre"),
    supabase2.from("cuentas").select("id, nombre, moneda").eq("activa", true).order("nombre"),
  ]);
  return { clientes: clientes || [], vehiculos: vehiculos || [], vendedores: vendedores || [], sucursales: sucursales || [], cuentas: cuentas || [] };
}
async function cargarDatosPresupuesto() {
  const [{ data: clientes }, { data: vehiculos }, { data: vendedores }, { data: sucursales }] = await Promise.all([
    supabase2.from("clientes").select("*").order("nombre").limit(2000),
    supabase2.from("vehiculos").select("*").eq("estado", "disponible").order("marca"),
    supabase2.from("perfiles").select("id, nombre, sucursal_id, roles").eq("activo", true).order("nombre"),
    supabase2.from("sucursales").select("id, nombre").order("nombre"),
  ]);
  return { clientes: clientes || [], vehiculos: vehiculos || [], vendedores: vendedores || [], sucursales: sucursales || [] };
}
async function cargarDatosVehiculo(miId: string) {
  const [{ data: perfiles }, { data: clientes }, { data: sucursales }] = await Promise.all([
    supabase2.from("perfiles").select("id, nombre, roles, sucursal_id").eq("activo", true).order("nombre"),
    supabase2.from("clientes").select("id, nombre, telefono, dni_cuit").order("nombre").limit(5000),
    supabase2.from("sucursales").select("id, nombre").order("nombre"),
  ]);
  return { perfiles: perfiles || [], clientes: clientes || [], sucursales: sucursales || [], miId };
}
async function cargarDatosCliente(miId: string) {
  const [{ data: perfiles }, { data: disponibilidad }] = await Promise.all([
    supabase2.from("perfiles").select("id, nombre, roles").eq("activo", true).order("nombre"),
    supabase2.from("disponibilidad_vendedor").select("*"),
  ]);
  return { perfiles: perfiles || [], disponibilidad: disponibilidad || [], miId };
}
async function cargarDatosVenta(miId: string) {
  const [{ data: perfiles }, { data: clientes }, { data: vehiculos }, { data: cuentas }] = await Promise.all([
    supabase2.from("perfiles").select("id, nombre, roles").eq("activo", true).order("nombre"),
    supabase2.from("clientes").select("id, nombre, apellido, telefono, email, dni_cuit").order("nombre"),
    supabase2.from("vehiculos").select("id, marca, modelo, anio, patente, km, precio_venta, moneda_venta, estado, color, consignado_por").in("estado", ["disponible", "reservado", "señado"]).order("marca"),
    supabase2.from("cuentas").select("id, nombre, moneda").eq("activa", true).order("nombre"),
  ]);
  // "perfiles" ya trae los roles de todos los activos, el usuario actual
  // incluido -- se deriva soyAdmin de ahí en vez de pedirlo aparte.
  const misRoles = (perfiles || []).find((p) => p.id === miId)?.roles || [];
  const soyAdmin = misRoles.some((r: string) => r === "admin" || r === "director");
  const puedeVerComision = soyAdmin || misRoles.some((r: string) => r === "finanzas" || r === "director");
  return { perfiles: perfiles || [], clientes: clientes || [], vehiculos: vehiculos || [], cuentas: cuentas || [], miId, soyAdmin, puedeVerComision };
}

export default function QuickActionsButton() {
  const [open, setOpen] = useState(false);
  // MensajesBubble (apilado justo arriba de este botón) escucha "qa:toggle"
  // para esconderse mientras las 5 pills están desplegadas y así no quedar
  // tapado ni interceptar sus clicks.
  const cambiarOpen = (nuevo: boolean) => {
    setOpen(nuevo);
    window.dispatchEvent(new CustomEvent("qa:toggle", { detail: { open: nuevo } }));
  };

  // Arrastrable a cualquier lado de la pantalla, mismo patrón que
  // MensajesBubble.tsx (posición en px vía pointer events propios,
  // persistida en localStorage). null = todavía en la posición default
  // (fixed bottom-6 right-6 vía clases, sin drag todavía).
  const BTN_POS_KEY = "panel:quick-actions-btn-pos";
  const [dragPos, setDragPos] = useState<{ left: number; top: number } | null>(null);
  const arrastrandoRef = useRef(false);
  const justDraggedRef = useRef(false);

  const clamp = (p: { left: number; top: number }) => ({
    left: Math.min(Math.max(p.left, 8), window.innerWidth - 56 - 8),
    top: Math.min(Math.max(p.top, 8), window.innerHeight - 56 - 8),
  });

  useEffect(() => {
    try {
      const guardada = localStorage.getItem(BTN_POS_KEY);
      if (guardada) setDragPos(clamp(JSON.parse(guardada)));
    } catch { /* localStorage puede fallar en privado/bloqueado -- se queda en la posición default */ }
  }, []);

  // Si la ventana se achica (resize, rotar el celular, devtools abiertas)
  // después de haber arrastrado el botón, la posición guardada puede quedar
  // afuera del viewport nuevo -- sin este listener, el botón se veía cortado
  // en una esquina hasta el próximo drag manual.
  useEffect(() => {
    const onResize = () => setDragPos((actual) => (actual ? clamp(actual) : actual));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const iniciarArrastre = (e: React.PointerEvent<HTMLButtonElement>) => {
    const boton = e.currentTarget;
    const rectInicial = boton.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    arrastrandoRef.current = false;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!arrastrandoRef.current && Math.abs(dx) + Math.abs(dy) > 4) arrastrandoRef.current = true;
      if (!arrastrandoRef.current) return;
      const left = Math.min(Math.max(rectInicial.left + dx, 8), window.innerWidth - rectInicial.width - 8);
      const top = Math.min(Math.max(rectInicial.top + dy, 8), window.innerHeight - rectInicial.height - 8);
      setDragPos({ left, top });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (arrastrandoRef.current) {
        justDraggedRef.current = true;
        setDragPos((actual) => {
          if (actual) { try { localStorage.setItem(BTN_POS_KEY, JSON.stringify(actual)); } catch { /* ignorar */ } }
          return actual;
        });
        setTimeout(() => { justDraggedRef.current = false; }, 50);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // Pedido explícito: los accesos directos siempre se despliegan hacia
  // ARRIBA del botón sin importar dónde se arrastre (antes se invertía en
  // la mitad superior de la pantalla para no salirse -- eso confundía más
  // de lo que ayudaba). En la mitad izquierda sí se alinean a la izquierda
  // en vez de a la derecha, para no salirse por ese lado.
  const izquierdaAlineaAIzquierda = !!dragPos && dragPos.left < (typeof window !== "undefined" ? window.innerWidth / 2 : 0);
  const [cargando, setCargando] = useState<AccionId | null>(null);
  const router = useRouter();

  const [reciboDatos, setReciboDatos] = useState<Awaited<ReturnType<typeof cargarDatosRecibo>> | null>(null);
  const [presupuestoDatos, setPresupuestoDatos] = useState<Awaited<ReturnType<typeof cargarDatosPresupuesto>> | null>(null);
  const [vehiculoDatos, setVehiculoDatos] = useState<Awaited<ReturnType<typeof cargarDatosVehiculo>> | null>(null);
  const [clienteDatos, setClienteDatos] = useState<Awaited<ReturnType<typeof cargarDatosCliente>> | null>(null);
  const [ventaDatos, setVentaDatos] = useState<Awaited<ReturnType<typeof cargarDatosVenta>> | null>(null);

  const cerrarModales = () => { setReciboDatos(null); setPresupuestoDatos(null); setVehiculoDatos(null); setClienteDatos(null); setVentaDatos(null); };
  const onCreadoGenerico = () => { cerrarModales(); router.refresh(); };

  const elegir = async (id: AccionId) => {
    cambiarOpen(false);
    setCargando(id);
    try {
      const { data: { user } } = await supabase2.auth.getUser();
      const miId = user?.id || "";

      if (id === "recibo") setReciboDatos(await cargarDatosRecibo());
      else if (id === "presupuesto") setPresupuestoDatos(await cargarDatosPresupuesto());
      else if (id === "vehiculo") setVehiculoDatos(await cargarDatosVehiculo(miId));
      else if (id === "cliente") setClienteDatos(await cargarDatosCliente(miId));
      else if (id === "venta") setVentaDatos(await cargarDatosVenta(miId));
    } catch {
      avisar("No se pudo cargar el formulario. Probá de nuevo.");
    } finally {
      setCargando(null);
    }
  };

  return (
    <>
      <div
        className={`print:hidden hidden md:block fixed z-40 ${dragPos ? "" : "bottom-6 right-6"}`}
        style={dragPos ? { left: dragPos.left, top: dragPos.top } : undefined}
      >
        {/* Menú posicionado absolute anclado al botón (bottom-full = pegado
           a su borde superior) -- así el botón NUNCA se mueve al abrir, sin
           importar si el contenedor está anclado por "bottom" (posición
           default) o por "top" (arrastrado): antes vivían en el mismo flujo
           flex-col, y con anclaje "top" agregar el menú ANTES del botón en
           el DOM empujaba al botón hacia abajo en vez de crecer para arriba. */}
        {open && (
          <>
            <div className="fixed inset-0 -z-10" onClick={() => cambiarOpen(false)} />
            <div className={`absolute bottom-full mb-1 flex gap-2 flex-col ${izquierdaAlineaAIzquierda ? "left-0 items-start" : "right-0 items-end"}`}>
              {ACCIONES.map((a) => {
                const Icon = a.icon;
                const ocupado = cargando === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => elegir(a.id)}
                    disabled={cargando !== null}
                    className="flex items-center gap-2.5 pl-3 pr-4 py-2 rounded-full bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 shadow-lg text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all hover:shadow-xl hover:-translate-x-0.5 cursor-pointer disabled:opacity-60 disabled:cursor-wait whitespace-nowrap"
                  >
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${a.color}`}>
                      {ocupado ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
                    </span>
                    {a.label}
                  </button>
                );
              })}
            </div>
          </>
        )}
        <button
          type="button"
          onPointerDown={iniciarArrastre}
          onClick={() => { if (justDraggedRef.current) return; cambiarOpen(!open); }}
          className="w-14 h-14 rounded-full bg-[#0145F2] hover:bg-[#0138c9] text-white shadow-xl flex items-center justify-center transition-transform active:scale-95 touch-none cursor-grab active:cursor-grabbing"
          title="Acciones rápidas — mantené presionado y arrastrá para moverlo"
        >
          {open ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </button>
      </div>

      {reciboDatos && (
        <NuevaSenaModal clientes={reciboDatos.clientes} vehiculos={reciboDatos.vehiculos} vendedores={reciboDatos.vendedores} sucursales={reciboDatos.sucursales} cuentas={reciboDatos.cuentas} onClose={cerrarModales} />
      )}
      {presupuestoDatos && (
        <NuevaCotizacionModal clientes={presupuestoDatos.clientes} vehiculos={presupuestoDatos.vehiculos} vendedores={presupuestoDatos.vendedores} sucursales={presupuestoDatos.sucursales} onClose={cerrarModales} />
      )}
      {vehiculoDatos && (
        <NuevoVehiculoModal perfiles={vehiculoDatos.perfiles} clientes={vehiculoDatos.clientes} sucursales={vehiculoDatos.sucursales} miId={vehiculoDatos.miId} onClose={cerrarModales} onCreado={onCreadoGenerico} />
      )}
      {clienteDatos && (
        <NuevoClienteModal perfiles={clienteDatos.perfiles} disponibilidad={clienteDatos.disponibilidad} miId={clienteDatos.miId} onClose={cerrarModales} onCreado={onCreadoGenerico} />
      )}
      {ventaDatos && (
        <NuevaVentaModal perfiles={ventaDatos.perfiles} clientes={ventaDatos.clientes} vehiculos={ventaDatos.vehiculos} cuentas={ventaDatos.cuentas} miId={ventaDatos.miId} soyAdmin={ventaDatos.soyAdmin} puedeVerComision={ventaDatos.puedeVerComision} onClose={cerrarModales} onCreado={onCreadoGenerico} />
      )}
    </>
  );
}
