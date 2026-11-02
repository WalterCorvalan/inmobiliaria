"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase2 } from "@/lib/supabase/client";
import { notificarEncargados } from "@/lib/panel/notificaciones";
import { generarCodigoPublico } from "@/lib/generarCodigoPublico";
import { hoyLocalISO } from "@/lib/panel/fechas";
import { Save, X, Plus, Trash2, Loader2, UserRound, Camera, Repeat, Banknote } from "lucide-react";
import { usePasosFormulario, BarraPasos, TituloPaso as TituloPasoBase, type PasoFormulario } from "@/components/panel/formulario/PasosFormulario";
import ClienteBuscador, { ClienteSeleccionado } from "@/components/panel/ClienteBuscador";
import VehiculoSelector, { VehiculoDatos } from "@/components/panel/VehiculoSelector";
import FotosEditor from "@/components/panel/FotosEditor";
import { COMBUSTIBLES, SEGMENTOS } from "@/app/panel/stock/NuevoVehiculoModal";
import { type PermutaPresupuesto, CONDICIONES_PERMUTA, OPCIONES_SERVICE, OPCIONES_ESTADO_PARTE, OPCIONES_CHOQUES, nuevaPermutaPresupuesto, permutaTieneDatos } from "@/lib/panel/presupuestoPermutas";
import SelectorWeb from "@/components/ui/SelectorWeb";

// Alta y edición de una cotización. Desde la unificación del 6/10 una
// cotización es una fila de la tabla presupuestos: este formulario (el que
// antes era "Nuevo presupuesto") guarda todo lo que ve el cliente en el link
// y en el PDF, y la deja "pendiente" hasta que un admin o encargado la
// aprueba (ver ARCHITECTURE.md).

const inputClass = "w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#0145F2] text-slate-900 dark:text-white placeholder:text-slate-400";
const labelClass = "text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1";

export interface CotizacionPrefill {
  nombre: string; telefono: string; vehiculoId: string | null;
  clienteId?: string | null; precio?: number | null; moneda?: string | null; observaciones?: string | null;
  // Desde un pedido de la web (tasación/permuta): el auto que ofrece el
  // cliente entra como permuta, con sus fotos.
  permutas?: PermutaPresupuesto[];
}

const formatoPrecio = (monto: string, moneda: "USD" | "ARS") => `${moneda === "ARS" ? "$" : "US$"} ${(Number(monto) || 0).toLocaleString("es-AR")}`;

export default function NuevaCotizacionModal({
  clientes, vehiculos, vendedores, sucursales, initial, editando, puedeDecidir = false, onClose,
}: { clientes: any[]; vehiculos: any[]; vendedores: any[]; sucursales: any[]; initial?: CotizacionPrefill | null; editando?: any; puedeDecidir?: boolean; onClose: () => void }) {
  const router = useRouter();
  // Edición: mismo formulario precargado con la cotización existente. Se
  // conservan número y link (token_publico); solo se actualizan los datos.
  const esEdicion = !!editando;
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const [cliente, setCliente] = useState<ClienteSeleccionado | null>(null);
  const [vehiculo, setVehiculo] = useState<VehiculoDatos | null>(editando ? {
    vehiculo_id: editando.vehiculo_id || null, dominio: editando.dominio || "", segmento: editando.segmento || "", marca: editando.marca || "", modelo: editando.modelo || "",
    tipo: editando.tipo || "", marca_motor: "", numero_motor: "", marca_chasis: "", numero_chasis: "", modelo_anio: editando.modelo_anio ? String(editando.modelo_anio) : "",
    color: editando.color || "", kilometros: editando.kilometros ? String(editando.kilometros) : "", combustible: editando.combustible || "", transmision: "", traccion: "",
  } : null);

  // El cliente de la cotización que se edita: de la lista ya cargada o, si no
  // está (la lista trae un tope), directo de la base.
  useEffect(() => {
    if (!editando?.cliente_id) return;
    const c = clientes.find((x) => x.id === editando.cliente_id);
    if (c) { setCliente(c as ClienteSeleccionado); return; }
    supabase2.from("clientes").select("*").eq("id", editando.cliente_id).maybeSingle().then(({ data }) => { if (data) setCliente(data as ClienteSeleccionado); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editando?.cliente_id]);

  // Precarga desde un lead (botón "Cotización" en LeadDetailModal.tsx) --
  // mismo criterio que NuevaSenaModal.tsx.
  useEffect(() => {
    if (!initial?.vehiculoId) return;
    const v = vehiculos.find((x) => x.id === initial.vehiculoId);
    if (!v) return;
    setVehiculo({
      vehiculo_id: v.id, dominio: v.patente || "", segmento: v.segmento || "", marca: v.marca || "", modelo: v.modelo || "",
      tipo: v.tipo || "", marca_motor: v.marca_motor || "", numero_motor: v.numero_motor || "",
      marca_chasis: v.marca_chasis || "", numero_chasis: v.numero_chasis || "", modelo_anio: String(v.anio || ""),
      color: v.color || "", kilometros: String(v.km || ""), combustible: v.combustible || "", transmision: v.transmision || "",
      traccion: v.traccion || "", precio_publicado_ars: v.precio_publicado_ars ?? null, precio_publicado_usd: v.precio_publicado_usd ?? null,
      precio_venta: v.precio_venta ?? null, moneda_venta: v.moneda_venta ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.vehiculoId]);

  const [vendedorId, setVendedorId] = useState(editando?.vendedor_id || "");
  const [sucursalId, setSucursalId] = useState("");
  const [miId, setMiId] = useState<string | null>(null);
  useEffect(() => {
    supabase2.auth.getUser().then(({ data }) => setMiId(data.user?.id || null));
  }, []);
  // Solo vendedores y encargados pueden figurar como vendedor de la cotización (el resto del personal no).
  // La lista completa se sigue usando más abajo para buscar la sucursal de quien la arma.
  const vendedoresSinYo = vendedores.filter((v) => v.id !== miId && (v.roles?.includes("ventas") || v.roles?.includes("encargado")));

  // Un solo precio con su moneda; se guarda en precio_ars o precio_usd según
  // la moneda (siguen siendo excluyentes).
  const [precio, setPrecio] = useState(editando ? String(editando.precio_ars ?? editando.precio_usd ?? "") : "");
  const [moneda, setMoneda] = useState<"USD" | "ARS">(editando?.precio_ars ? "ARS" : "USD");
  const [fechaEmision, setFechaEmision] = useState(editando?.fecha || hoyLocalISO());
  const [fechaVencimiento, setFechaVencimiento] = useState(editando?.fecha_vencimiento || "");
  const [condicionesPago, setCondicionesPago] = useState(editando?.condiciones_pago || "");
  const [imprimirEn, setImprimirEn] = useState(editando?.imprimir_en || "");
  const [observaciones, setObservaciones] = useState(editando?.observaciones || "");

  useEffect(() => {
    if (!vehiculo?.vehiculo_id) return;
    if (esEdicion && vehiculo.vehiculo_id === editando.vehiculo_id) return; // se mantiene el precio guardado
    // "Precio publicado" es un campo aparte para catálogo/financiación que
    // casi nunca se carga -- la inmensa mayoría del stock solo tiene
    // precio_venta (el interno), así que sin este fallback el precio
    // quedaba en 0 para casi cualquier auto real.
    if (vehiculo.precio_publicado_ars) { setPrecio(String(vehiculo.precio_publicado_ars)); setMoneda("ARS"); }
    else if (vehiculo.precio_publicado_usd) { setPrecio(String(vehiculo.precio_publicado_usd)); setMoneda("USD"); }
    else if (vehiculo.precio_venta) { setPrecio(String(vehiculo.precio_venta)); setMoneda(vehiculo.moneda_venta === "ARS" ? "ARS" : "USD"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehiculo?.vehiculo_id]);

  // Precarga con cliente ya cargado y/o precio acordado (declarado DESPUÉS
  // del efecto del precio de lista para pisarlo).
  useEffect(() => {
    if (!initial) return;
    if (initial.clienteId) {
      const c = clientes.find((x) => x.id === initial.clienteId);
      if (c) setCliente(c as ClienteSeleccionado);
    }
    if (initial.observaciones) setObservaciones(initial.observaciones);
    if (initial.precio) {
      setPrecio(String(initial.precio));
      setMoneda(initial.moneda === "ARS" ? "ARS" : "USD");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.clienteId, initial?.precio, initial?.moneda, initial?.observaciones, vehiculo?.vehiculo_id]);

  // Fotos que se ven debajo del PDF y en el link público: arrancan con las que
  // el auto ya tiene en Stock y se pueden agregar, quitar y reordenar acá sin
  // tocar las del stock.
  const [fotos, setFotos] = useState<string[]>(Array.isArray(editando?.fotos) ? editando.fotos : []);
  useEffect(() => {
    if (!vehiculo?.vehiculo_id) { setFotos([]); return; }
    // Al abrir en edición se mantienen las fotos elegidas (si había).
    if (esEdicion && vehiculo.vehiculo_id === editando.vehiculo_id && Array.isArray(editando.fotos) && editando.fotos.length > 0) return;
    let cancelado = false;
    supabase2.from("vehiculos").select("fotos").eq("id", vehiculo.vehiculo_id).maybeSingle().then(({ data }) => {
      if (!cancelado) setFotos(Array.isArray(data?.fotos) ? data.fotos : []);
    });
    return () => { cancelado = true; };
  }, [vehiculo?.vehiculo_id]);

  // Autos que el cliente entrega en permuta (el cliente los ve en el link y
  // en el PDF). Siempre hay al menos una ficha visible; si queda vacía no se
  // guarda.
  const permutasIniciales: any[] = Array.isArray(editando?.permutas) && editando.permutas.length > 0 ? editando.permutas : initial?.permutas || [];
  const [permutas, setPermutas] = useState<PermutaPresupuesto[]>(
    permutasIniciales.length > 0
      ? permutasIniciales.map((pm: any) => ({ ...nuevaPermutaPresupuesto(), ...pm, fotos: Array.isArray(pm.fotos) ? pm.fotos : [] }))
      : [nuevaPermutaPresupuesto()]
  );
  const actualizarPermuta = (i: number, cambios: Partial<PermutaPresupuesto>) => setPermutas((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...cambios } : p)));
  const quitarPermuta = (i: number) => setPermutas((prev) => {
    const next = prev.filter((_, idx) => idx !== i);
    return next.length ? next : [{ ...nuevaPermutaPresupuesto(), moneda }];
  });
  // El valor de toma arranca en la moneda de la cotización: antes quedaba
  // siempre en USD y una toma en pesos ($ 7.000.000) le salía al cliente
  // como "US$ 7.000.000". Solo se ajustan las permutas sin valor cargado.
  useEffect(() => {
    setPermutas((prev) => prev.map((pm) => (pm.valor ? pm : { ...pm, moneda })));
  }, [moneda]);

  const guardar = async () => {
    if (!cliente) { setError("Elegí o cargá un cliente."); return; }
    if (!vehiculo || !vehiculo.marca || !vehiculo.modelo) { setError("Elegí o cargá el vehículo."); return; }
    if (!precio) { setError("Completá el precio de venta."); return; }
    setGuardando(true);
    setError("");
    try {
      const { data: { user } } = await supabase2.auth.getUser();
      const miNombre = vendedores.find((v) => v.id === user?.id)?.nombre || "Usuario";
      const ahora = new Date().toISOString();
      const datos: Record<string, unknown> = {
        fecha: fechaEmision || hoyLocalISO(),
        vendedor_id: vendedorId || user?.id,
        cliente_id: cliente.id,
        cliente_nombre: `${cliente.apellido || ""} ${cliente.nombre}`.trim(),
        dominio: vehiculo.dominio,
        segmento: vehiculo.segmento,
        marca: vehiculo.marca,
        modelo: vehiculo.modelo,
        tipo: vehiculo.tipo,
        modelo_anio: vehiculo.modelo_anio ? Number(vehiculo.modelo_anio) : null,
        color: vehiculo.color,
        kilometros: vehiculo.kilometros ? Number(vehiculo.kilometros) : null,
        combustible: vehiculo.combustible,
        vehiculo_id: vehiculo.vehiculo_id,
        precio_ars: moneda === "ARS" ? Number(precio) : null,
        precio_usd: moneda === "USD" ? Number(precio) : null,
        imprimir_en: imprimirEn || null,
        observaciones: observaciones || null,
        fotos,
        permutas: permutas.filter(permutaTieneDatos),
        fecha_vencimiento: fechaVencimiento || null,
        condiciones_pago: condicionesPago.trim() || null,
        updated_at: ahora,
      };
      // Un vendedor que edita una cotización ya aprobada o rechazada la
      // vuelve a mandar a revisión: si no, cambiaría precio/auto/permuta de
      // algo ya aprobado sin que nadie lo vea. Admin y encargado (los que
      // aprueban) editan sin cambiar el estado.
      if (esEdicion && !puedeDecidir && editando.estado !== "pendiente") {
        datos.estado = "pendiente";
        datos.historial = [...(editando.historial || []), { estado: "pendiente", actor_nombre: miNombre, created_at: ahora, nota: "Editada, requiere re-aprobación" }];
      }
      if (!esEdicion) {
        datos.estado = "pendiente";
        datos.historial = [{ estado: "pendiente", actor_nombre: miNombre, created_at: ahora }];
      }

      // El número lo asigna la base (secuencia real) — ver fix en Señas,
      // mismo problema: calcularlo acá con max(numero)+1 podía duplicar.
      const { data, error: dbError } = esEdicion
        ? await supabase2.from("presupuestos").update(datos).eq("id", editando.id).select("id, numero").maybeSingle()
        : await supabase2.from("presupuestos").insert({ ...datos, token_publico: generarCodigoPublico() }).select("id, numero").single();

      if (dbError) throw dbError;
      if (!data) throw new Error("No se pudo confirmar el guardado. Verificá permisos y volvé a intentar.");

      // Aviso a admin/encargados (de la sucursal del vendedor) de que hay una
      // cotización para revisar: nueva, o editada y vuelta a pendiente.
      if (datos.estado === "pendiente") {
        const vendedorFinalId = vendedorId || user?.id;
        const sucursalVendedor = vendedores.find((v) => v.id === vendedorFinalId)?.sucursal_id || null;
        await notificarEncargados(
          supabase2,
          `${miNombre} ${esEdicion ? "editó" : "creó"} la cotización N° ${data.numero} — ${cliente.nombre} ${cliente.apellido || ""} (${vehiculo.marca} ${vehiculo.modelo}, ${formatoPrecio(precio, moneda)}). Revisala para aprobarla.`,
          `/panel/cotizaciones?ver=${data.id}`,
          "cotizacion",
          sucursalVendedor,
          "media",
          { categoriaNotif: "cotizaciones", modulo: "cotizaciones" }
        );
      }

      onClose();
      if (esEdicion) router.refresh();
      router.push(`/panel/cotizaciones/imprimir/${data.id}`);
    } catch (err: any) {
      console.error(err);
      setError(err?.message ? `No se pudo guardar la cotización: ${err.message}` : "No se pudo guardar la cotización.");
    } finally {
      setGuardando(false);
    }
  };

  // Índice de pasos: solo navegación dentro del formulario (ver
  // components/panel/formulario/PasosFormulario.tsx). El paso de fotos solo
  // existe cuando hay un auto del stock elegido, igual que su sección.
  const pasos: PasoFormulario[] = [
    { id: "cliente", label: "Cliente y vehículo", icono: UserRound },
    ...(vehiculo?.vehiculo_id ? [{ id: "fotos", label: "Fotos", icono: Camera }] : []),
    { id: "permuta", label: "Permuta", icono: Repeat },
    { id: "precio", label: "Precio y condiciones", icono: Banknote },
  ];
  const { cuerpoRef, pasoActivo, nPaso, irAPaso, alScrollear } = usePasosFormulario(pasos, "cotizacion");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !guardando && onClose()} />
      <div className="relative bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/10 w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex justify-between items-start p-6 pb-3 shrink-0">
          <p className="text-xs text-slate-500 dark:text-slate-400 pr-4">{esEdicion ? `Editando la cotización N° ${editando.numero}. Se mantienen el número y el link que ya tiene el cliente.` : "Nueva cotización. Queda pendiente hasta que la apruebe un admin o encargado; al guardar se abre el documento para imprimir o compartir."}</p>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <BarraPasos pasos={pasos} activo={pasoActivo} onIr={irAPaso} />

        <div ref={cuerpoRef} onScroll={alScrollear} className="space-y-5 px-6 py-4 overflow-y-auto overflow-x-hidden flex-1 min-h-0 border-t border-slate-100 dark:border-white/10">
          <div>
            <TituloPaso id="cliente" n={nPaso("cliente")} titulo="Cliente y vehículo" icono={UserRound} primero />
            <div className="space-y-3 mt-3">
              <div>
                <label className={labelClass}>Cliente (del CRM) *</label>
                <ClienteBuscador clientes={clientes} seleccionado={cliente} onSeleccionar={setCliente} prefillNuevo={initial ? { nombre: initial.nombre, telefono: initial.telefono } : null} />
              </div>
              {!vehiculo?.vehiculo_id && (
                <div>
                  <label className={labelClass}>Sucursal (para cargar un auto nuevo al stock)</label>
                  <div className="w-full"><SelectorWeb valor={sucursalId} onCambio={setSucursalId} claseBoton={inputClass} opciones={[{ valor: "", etiqueta: "Seleccionar..." }, ...sucursales.map((s) => ({ valor: s.id, etiqueta: s.nombre }))]} /></div>
                </div>
              )}
              <div>
                <label className={labelClass}>Vehículo (del stock) *</label>
                <VehiculoSelector vehiculos={vehiculos} datos={vehiculo} onCambiar={setVehiculo} persistirManual sucursalId={sucursalId} />
                <p className="text-[10px] text-slate-400 mt-1">Si no está en el stock, cargalo a mano.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Vendedor</label>
                  <div className="w-full"><SelectorWeb valor={vendedorId} etiquetaActual={vendedorId === miId ? "Vos (usuario actual)" : vendedores.find((v) => v.id === vendedorId)?.nombre} onCambio={setVendedorId} claseBoton={inputClass} opciones={[{ valor: "", etiqueta: "Vos (usuario actual)" }, ...vendedoresSinYo.map((v) => ({ valor: v.id, etiqueta: v.nombre }))]} /></div>
                </div>
                <div><label className={labelClass}>Imprimir en</label><input className={inputClass} value={imprimirEn} onChange={(e) => setImprimirEn(e.target.value)} placeholder="Ej: Casa Central" /></div>
              </div>
            </div>
          </div>

          {vehiculo?.vehiculo_id && (
            <div>
              <TituloPaso id="fotos" n={nPaso("fotos")} titulo="Fotos del vehículo" icono={Camera} />
              <div className="mt-3" />
              <FotosEditor fotos={fotos} onChange={setFotos} carpeta="presupuestos" ayuda="Se ven en el link que se manda al cliente. Arrancan con las del stock: podés agregar, quitar o cambiar el orden sin tocar las del stock." />
            </div>
          )}

          <div>
            <TituloPaso id="permuta" n={nPaso("permuta")} titulo="Auto que el cliente entrega en permuta" icono={Repeat} />
            <div className="mt-3" />
            <p className="text-[10px] text-slate-400 -mt-1 mb-2">El cliente ve todo esto en el link (con fotos) y en el PDF (sin fotos), incluido el valor de toma. Cargá todo el detalle posible: también le sirve al encargado para evaluar la toma.</p>
            <div className="space-y-3">
              {permutas.map((pm, i) => (
                <div key={i} className={permutas.length > 1 ? "border border-slate-200 dark:border-white/10 rounded-xl p-3 space-y-3" : "space-y-3"}>
                  {permutas.length > 1 && (
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Auto {i + 1}</p>
                      <button type="button" onClick={() => quitarPermuta(i)} title="Quitar este auto" className="text-slate-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div><label className={labelClass}>Marca</label><input value={pm.marca} onChange={(e) => actualizarPermuta(i, { marca: e.target.value })} placeholder="BMW, Audi, Toyota..." className={inputClass} /></div>
                    <div><label className={labelClass}>Modelo</label><input value={pm.modelo} onChange={(e) => actualizarPermuta(i, { modelo: e.target.value })} placeholder="X3, A4, Hilux..." className={inputClass} /></div>
                    <div><label className={labelClass}>Versión</label><input value={pm.version ?? ""} onChange={(e) => actualizarPermuta(i, { version: e.target.value })} placeholder="1.6 Highline AT" className={inputClass} /></div>
                    <div><label className={labelClass}>Año</label><input type="text" inputMode="numeric" value={pm.anio} onChange={(e) => actualizarPermuta(i, { anio: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="2020" className={inputClass} /></div>
                    <div><label className={labelClass}>Kilómetros</label><input type="text" inputMode="numeric" value={pm.km} onChange={(e) => actualizarPermuta(i, { km: e.target.value.replace(/\D/g, "") })} placeholder="50000" className={inputClass} /></div>
                    <div>
                      <label className={labelClass}>Estado general</label>
                      <div className="w-full"><SelectorWeb valor={pm.condicion} onCambio={(v) => actualizarPermuta(i, { condicion: v })} claseBoton={inputClass} opciones={CONDICIONES_PERMUTA.map((c) => ({ valor: c, etiqueta: c }))} /></div>
                    </div>
                    <div><label className={labelClass}>Patente / Dominio</label><input value={pm.patente} onChange={(e) => actualizarPermuta(i, { patente: e.target.value.toUpperCase() })} placeholder="AB123CD" className={inputClass} /></div>
                    <div><label className={labelClass}>Color</label><input value={pm.color} onChange={(e) => actualizarPermuta(i, { color: e.target.value })} className={inputClass} /></div>
                    <div><label className={labelClass}>Segmento</label><div className="w-full"><SelectorWeb valor={pm.segmento} onCambio={(v) => actualizarPermuta(i, { segmento: v })} claseBoton={inputClass} opciones={[{ valor: "", etiqueta: "—" }, ...SEGMENTOS.map((s) => ({ valor: s, etiqueta: s }))]} /></div></div>
                    <div><label className={labelClass}>Combustible</label><div className="w-full"><SelectorWeb valor={pm.combustible} onCambio={(v) => actualizarPermuta(i, { combustible: v })} claseBoton={inputClass} opciones={[{ valor: "", etiqueta: "—" }, ...COMBUSTIBLES.map((c) => ({ valor: c, etiqueta: c }))]} /></div></div>
                    <div><label className={labelClass}>Dueños anteriores</label><input type="text" inputMode="numeric" value={pm.duenos ?? ""} onChange={(e) => actualizarPermuta(i, { duenos: e.target.value.replace(/\D/g, "").slice(0, 2) })} placeholder="1" className={inputClass} /></div>
                    <div><label className={labelClass}>Service</label><div className="w-full"><SelectorWeb valor={pm.service ?? ""} onCambio={(v) => actualizarPermuta(i, { service: v })} claseBoton={inputClass} opciones={[{ valor: "", etiqueta: "—" }, ...OPCIONES_SERVICE.map((o) => ({ valor: o, etiqueta: o }))]} /></div></div>
                    <div><label className={labelClass}>Chapa y pintura</label><div className="w-full"><SelectorWeb valor={pm.chapaPintura ?? ""} onCambio={(v) => actualizarPermuta(i, { chapaPintura: v })} claseBoton={inputClass} opciones={[{ valor: "", etiqueta: "—" }, ...OPCIONES_ESTADO_PARTE.map((o) => ({ valor: o, etiqueta: o }))]} /></div></div>
                    <div><label className={labelClass}>Cubiertas</label><div className="w-full"><SelectorWeb valor={pm.cubiertas ?? ""} onCambio={(v) => actualizarPermuta(i, { cubiertas: v })} claseBoton={inputClass} opciones={[{ valor: "", etiqueta: "—" }, ...OPCIONES_ESTADO_PARTE.map((o) => ({ valor: o, etiqueta: o }))]} /></div></div>
                    <div><label className={labelClass}>Choques</label><div className="w-full"><SelectorWeb valor={pm.choques ?? ""} onCambio={(v) => actualizarPermuta(i, { choques: v })} claseBoton={inputClass} opciones={[{ valor: "", etiqueta: "—" }, ...OPCIONES_CHOQUES.map((o) => ({ valor: o, etiqueta: o }))]} /></div></div>
                  </div>
                  <div>
                    <label className={labelClass}>Detalles del auto</label>
                    <textarea value={pm.detalles ?? ""} onChange={(e) => actualizarPermuta(i, { detalles: e.target.value })} rows={3} placeholder="Rayones, golpes, qué hay que arreglar, mecánica, interior, papeles, deudas, VTV..." className={`${inputClass} resize-none`} />
                  </div>
                  <div>
                    <label className={labelClass}>Valor que tomamos</label>
                    <div className="flex gap-1">
                      <input type="text" inputMode="numeric" value={pm.valor} onChange={(e) => actualizarPermuta(i, { valor: e.target.value.replace(/\D/g, "") })} placeholder="0" className={`${inputClass} flex-1 min-w-0`} />
                      <div className="shrink-0"><SelectorWeb valor={pm.moneda} onCambio={(v) => actualizarPermuta(i, { moneda: v as "ARS" | "USD" })} claseBoton={`${inputClass} !w-20`} opciones={[{ valor: "USD", etiqueta: "USD" }, { valor: "ARS", etiqueta: "ARS" }]} /></div>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Fotos del auto que se toma</label>
                    <FotosEditor fotos={pm.fotos} onChange={(f) => actualizarPermuta(i, { fotos: f })} carpeta="presupuestos-permutas" ayuda="Frente, laterales, cola, interior, tablero con los km, motor y cualquier detalle o daño." />
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => setPermutas((prev) => [...prev, { ...nuevaPermutaPresupuesto(), moneda }])} className="flex items-center gap-1.5 text-xs font-bold text-[#0145F2] hover:underline"><Plus className="w-3.5 h-3.5" /> Agregar otro auto</button>
            </div>
          </div>

          <div>
            <TituloPaso id="precio" n={nPaso("precio")} titulo="Precio y condiciones" icono={Banknote} />
            <div className="mt-3" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Precio de venta *</label>
                <div className="flex gap-1">
                  <input type="text" inputMode="numeric" value={precio} onChange={(e) => setPrecio(e.target.value.replace(/\D/g, ""))} placeholder="15000000" className={`${inputClass} flex-1 min-w-0`} />
                  <div className="shrink-0"><SelectorWeb valor={moneda} onCambio={(v) => setMoneda(v as "USD" | "ARS")} claseBoton={`${inputClass} !w-20`} opciones={[{ valor: "USD", etiqueta: "USD" }, { valor: "ARS", etiqueta: "ARS" }]} /></div>
                </div>
              </div>
              <div><label className={labelClass}>Fecha de emisión *</label><input type="date" value={fechaEmision} onChange={(e) => setFechaEmision(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Vence (opcional)</label><input type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} className={inputClass} /></div>
            </div>
            <div className="mt-3">
              <label className={labelClass}>Condiciones de pago</label>
              <textarea value={condicionesPago} onChange={(e) => setCondicionesPago(e.target.value)} rows={2} placeholder="Ej. Entrega su vehículo en parte de pago + diferencia de $ ... Incluye/no incluye transferencia." className={`${inputClass} resize-none`} />
              <p className="text-[10px] text-slate-400 mt-1">Sale en la cotización del cliente (link y PDF). Ej.: entrega Chevrolet Onix 2018 en parte de pago + diferencia en pesos, llave contra llave, incluye transferencia.</p>
            </div>
            <div className="mt-3">
              <label className={labelClass}>Observaciones</label>
              <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} className={`${inputClass} resize-none`} />
              <p className="text-[10px] text-slate-400 mt-1">Salen en el link y en el PDF. Para algo interno usá los comentarios de la cotización.</p>
            </div>
          </div>

          {error && <p className="text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-500/10 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="flex gap-2 p-6 pt-3 border-t border-slate-100 dark:border-white/10 shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-semibold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 rounded-xl">Cancelar</button>
          <button type="button" onClick={guardar} disabled={guardando} className="flex-1 py-2.5 flex items-center justify-center gap-2 text-sm font-bold bg-[#0145F2] hover:bg-[#0138c9] text-white rounded-xl disabled:opacity-50">
            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> {esEdicion ? "Guardar cambios" : "Crear cotización"}</>}
          </button>
        </div>
      </div>

    </div>
  );
}

// Prefijo "cotizacion" para los ids de DOM de los títulos de sección.
function TituloPaso(props: Omit<Parameters<typeof TituloPasoBase>[0], "prefijo">) {
  return <TituloPasoBase prefijo="cotizacion" {...props} />;
}
