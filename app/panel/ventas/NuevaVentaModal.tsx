"use client";
// Estado general del auto que entrega el cliente (misma lista que el presupuesto). No es 0 km/usado: eso se decide por los km.
import { CONDICIONES_PERMUTA } from "@/lib/panel/presupuestoPermutas";

import { useState, useEffect, useRef } from "react";
import { supabase2 } from "@/lib/supabase/client";
import { X, Loader2, Save, Trash2, Plus, Bell, Star, Search, Check, Megaphone, Car, UserRound, Wallet, Repeat, PackageCheck, ClipboardList, Landmark, Link2, Paperclip } from "lucide-react";
import { hoyLocalISO, parseFechaLocal, fmtFechaLocal } from "@/lib/panel/fechas";
import { crearAlerta } from "@/lib/panel/alertas";
import { generarCodigoPublico } from "@/lib/generarCodigoPublico";
import { totalEnMoneda, faltaCotizacion, type Moneda } from "@/lib/moneda";
import { remanenteVenta, ventaCubierta } from "@/lib/panel/remanenteVenta";
import { buscarLeadsPorTexto, LEAD_ORIGEN_LABEL, type LeadEncontrado } from "@/lib/panel/buscarLeads";
import { SEGMENTOS, COMBUSTIBLES } from "@/app/panel/stock/NuevoVehiculoModal";
import { usePasosFormulario, BarraPasos, TituloPaso as TituloPasoBase, type PasoFormulario } from "@/components/panel/formulario/PasosFormulario";
import { normalizarOrigenCliente } from "@/lib/panel/origenesCliente";
import { planDeCuotas } from "@/lib/panel/cuotas";
import { avisar } from "@/components/panel/Dialogos";
import { limpiarParaFiltro } from "@/lib/busquedaCatalogo";

const TIPOS_RECORDATORIO: { value: string; label: string }[] = [
  { value: "llamada_seguimiento", label: "Llamada de seguimiento" },
  { value: "control_post_entrega", label: "Control post-entrega" },
  { value: "vtv", label: "VTV / Revisión técnica" },
  { value: "service", label: "Service / Mantenimiento" },
  { value: "seguro", label: "Renovación de seguro" },
  { value: "patente", label: "Patente / Impuesto vehicular" },
  { value: "garantia", label: "Fin de garantía" },
  { value: "cumpleanos", label: "Cumpleaños del cliente" },
  { value: "otro", label: "Otro recordatorio" },
];

interface Vehiculo { id: string; marca: string; modelo: string; anio: number; patente: string | null; km: number | null; precio_venta: number; moneda_venta: string; estado: string; color: string | null; consignado_por: string | null }
interface Cliente { id: string; nombre: string; apellido: string | null; telefono: string | null; email: string | null; dni_cuit: string | null }
interface Perfil { id: string; nombre: string; roles: string[]; comision_tipo?: "porcentaje" | "fijo" | null; comision_valor?: number | null; comision_moneda?: "ARS" | "USD" | null }

interface Seña { monto: string; moneda: string; fecha: string; cajaDestino: string; senaOrigenId?: string | null }
interface Permuta {
  valor: string; moneda: string; precioPublicacion: string; marca: string; modelo: string; anio: string; km: string; patente: string; color: string; condicion: string; cargarAlStock: boolean; duenoNombre: string;
  segmento: string; tipo: string; marcaMotor: string; numeroMotor: string; marcaChasis: string; numeroChasis: string; combustible: string; radicadoLocalidad: string; radicadoProvincia: string; tasadoEn: string;
  // Presentes solo si la permuta ya existe en la base (edición) -- id de la
  // fila en venta_permutas y, si ya se cargó a Stock, el id del vehiculo
  // creado (para no duplicarlo al guardar de nuevo).
  id?: string;
  vehiculoCreadoId?: string | null;
}

export interface VentaPrefill {
  compradorNombre?: string;
  compradorTelefono?: string;
  vehiculoDescripcion?: string;
  precioVenta?: string;
  monedaVenta?: string;
  vehiculoId?: string;
  clienteId?: string;
  // Desde una seña ("Pasar a venta" en Señas, 13/10/2026): se vincula sola apenas cargan las señas activas.
  senaId?: string;
  // Desde una cotización aprobada: todas sus permutas (mismos nombres de
  // campo que Permuta, ver lib/panel/presupuestoPermutas.ts).
  permutas?: Partial<Permuta>[];
  permuta?: {
    marca?: string | null; modelo?: string | null; anio?: number | null; km?: number | null;
    estado?: string | null; patente?: string | null; tasacion?: number | null; moneda?: string | null;
  };
}

interface Props {
  perfiles: Perfil[];
  clientes: Cliente[];
  vehiculos: Vehiculo[];
  miId: string;
  soyAdmin: boolean;
  puedeVerComision: boolean;
  initial?: VentaPrefill;
  editando?: any;
  cuentas: any[];
  onClose: () => void;
  onCreado: (venta: any) => void;
}

const nuevaPermuta = (): Permuta => ({
  valor: "", moneda: "USD", precioPublicacion: "", marca: "", modelo: "", anio: "", km: "", patente: "", color: "", condicion: "Muy bueno", cargarAlStock: true, duenoNombre: "",
  segmento: "", tipo: "", marcaMotor: "", numeroMotor: "", marcaChasis: "", numeroChasis: "", combustible: "", radicadoLocalidad: "", radicadoProvincia: "", tasadoEn: "",
});

export default function NuevaVentaModal({ perfiles, clientes, vehiculos, miId, initial, editando, cuentas, onClose, onCreado }: Props) {
  const esEdicion = !!editando;
  const miPerfil = perfiles.find((p) => p.id === miId);
  const puedeGenerarCuotas = miPerfil?.roles?.some((r) => r === "admin" || r === "finanzas" || r === "director") ?? false;
  // Auditoría de filtros 29/9: "Vendedor" y "Responsable de la
  // consignación" son ventas/encargado (el segundo, cualquiera menos
  // gestoría); "Gestor asignado" es exclusivo de gestoría.
  const vendedores = perfiles.filter((p) => p.roles?.includes("ventas") || p.roles?.includes("encargado"));

  const [cargaManual, setCargaManual] = useState(false);

  const [vehiculoId, setVehiculoId] = useState(editando?.vehiculo_id || initial?.vehiculoId || "");
  const [vMarca, setVMarca] = useState(editando?.vehiculo_marca || initial?.vehiculoDescripcion?.split(" ")[0] || "");
  const [vModelo, setVModelo] = useState(editando?.vehiculo_modelo || initial?.vehiculoDescripcion?.split(" ").slice(1).join(" ") || "");
  const [vAnio, setVAnio] = useState(editando?.vehiculo_anio ? String(editando.vehiculo_anio) : "");
  const [vPatente, setVPatente] = useState(editando?.vehiculo_patente || "");
  // Combobox de Vehículo -- mismo patrón que "Cliente del CRM" más abajo
  // (chip + búsqueda), local porque `vehiculos` ya llega filtrado a
  // disponible/reservado/señado desde page.tsx (no hay corte de 1000 filas
  // como sí pasaba con clientes).
  const [busquedaVehiculo, setBusquedaVehiculo] = useState(
    (editando?.vehiculo_id || initial?.vehiculoId) && (editando?.vehiculo_marca || initial?.vehiculoDescripcion)
      ? `${editando?.vehiculo_marca || initial?.vehiculoDescripcion} ${editando?.vehiculo_anio || ""} · ${editando?.vehiculo_patente || "s/patente"}`.trim()
      : ""
  );
  const [vehiculoDropdownAbierto, setVehiculoDropdownAbierto] = useState(false);
  const [vColor, setVColor] = useState(editando?.vehiculo_color || "");
  const [km, setKm] = useState(editando?.km ? String(editando.km) : "");
  const [estado, setEstado] = useState(editando?.estado || "borrador");
  const [estadoTocado, setEstadoTocado] = useState(false);
  const [precioVenta, setPrecioVenta] = useState(editando?.precio_venta ? String(editando.precio_venta) : initial?.precioVenta || "");
  const [monedaVenta, setMonedaVenta] = useState(editando?.moneda_venta || initial?.monedaVenta || "USD");
  const [vendedorId, setVendedorId] = useState(editando?.vendedor_id || "");
  const [fechaCierre, setFechaCierre] = useState(editando?.fecha_cierre || hoyLocalISO());

  const [clienteId, setClienteId] = useState(editando?.cliente_id || initial?.clienteId || "");
  // "Cliente del CRM" era un <select> con la lista completa recibida por
  // prop -- con >1000 clientes, Supabase/PostgREST corta esa query en 1000
  // filas por default, así que todo lo que quedaba afuera del corte (medio
  // alfabeto para arriba, en la base real) era literalmente imposible de
  // elegir (bug P1-11 de la auditoría de flujo real, confirmado en vivo con
  // la base real: 1002 clientes, corte en "Gonzalez ...", nada después
  // aparecía). Mismo patrón de búsqueda en vivo que ya usa ClienteBuscador
  // (Señas/Presupuestos): 1 carácter filtra el array local (instantáneo),
  // desde 2 caracteres dispara una consulta real server-side (debounce
  // 300ms) que sí ve la base completa.
  const [busquedaCliente, setBusquedaCliente] = useState(editando?.comprador_nombre || "");
  const [clienteDropdownAbierto, setClienteDropdownAbierto] = useState(false);
  const [resultadosClienteVivo, setResultadosClienteVivo] = useState<Cliente[] | null>(null);
  const [leadsEncontrados, setLeadsEncontrados] = useState<LeadEncontrado[]>([]);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  useEffect(() => {
    const q = busquedaCliente.trim();
    if (q.length < 2) { setResultadosClienteVivo(null); setLeadsEncontrados([]); return; }
    setBuscandoCliente(true);
    const timer = setTimeout(async () => {
      const [{ data }, leads] = await Promise.all([
        supabase2
          .from("clientes")
          .select("id, nombre, apellido, telefono, email, dni_cuit")
          .or(`nombre.ilike.%${limpiarParaFiltro(q)}%,apellido.ilike.%${limpiarParaFiltro(q)}%,dni_cuit.ilike.%${limpiarParaFiltro(q)}%`)
          .order("nombre")
          .limit(20),
        buscarLeadsPorTexto(supabase2, q),
      ]);
      setResultadosClienteVivo(data || []);
      setLeadsEncontrados(leads);
      setBuscandoCliente(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [busquedaCliente]);
  const clientesFiltrados = resultadosClienteVivo ?? clientes.filter((c) => {
    const q = busquedaCliente.toLowerCase();
    return !q || `${c.nombre} ${c.apellido || ""} ${c.dni_cuit || ""}`.toLowerCase().includes(q);
  });
  const [compradorNombre, setCompradorNombre] = useState(editando?.comprador_nombre || initial?.compradorNombre || "");
  const [compradorTelefono, setCompradorTelefono] = useState(editando?.comprador_telefono || initial?.compradorTelefono || "");
  const [compradorEmail, setCompradorEmail] = useState(editando?.comprador_email || "");
  const [compradorDni, setCompradorDni] = useState(editando?.comprador_dni || "");
  const [compradorTelefonoCelular, setCompradorTelefonoCelular] = useState(editando?.comprador_telefono_celular || "");
  const [compradorFechaNacimiento, setCompradorFechaNacimiento] = useState(editando?.comprador_fecha_nacimiento || "");
  const [compradorCuitCuil, setCompradorCuitCuil] = useState(editando?.comprador_cuit_cuil || "");
  const [compradorEstadoCivil, setCompradorEstadoCivil] = useState(editando?.comprador_estado_civil || "");
  const [compradorProfesion, setCompradorProfesion] = useState(editando?.comprador_profesion || "");
  const [compradorCalle, setCompradorCalle] = useState(editando?.comprador_calle || "");
  const [compradorNumero, setCompradorNumero] = useState(editando?.comprador_numero || "");
  const [compradorDepto, setCompradorDepto] = useState(editando?.comprador_depto || "");
  const [compradorLocalidad, setCompradorLocalidad] = useState(editando?.comprador_localidad || "");
  const [compradorCodigoPostal, setCompradorCodigoPostal] = useState(editando?.comprador_codigo_postal || "");
  const [compradorProvincia, setCompradorProvincia] = useState(editando?.comprador_provincia || "");
  const [propietarioNombre, setPropietarioNombre] = useState(editando?.propietario_nombre || "");
  const [propietarioTelefono, setPropietarioTelefono] = useState(editando?.propietario_telefono || "");

  const [senas, setSenas] = useState<Seña[]>([]);
  const [senasActivas, setSenasActivas] = useState<any[]>([]);
  const senasActivasOriginal = useRef<any[]>([]);
  const [senaAVincular, setSenaAVincular] = useState("");
  const [metodoPago, setMetodoPago] = useState(editando?.metodo_pago || "");
  const [cuotasPlazo, setCuotasPlazo] = useState(editando?.cuotas_plazo ? String(editando.cuotas_plazo) : "");
  const [montoFinanciacion, setMontoFinanciacion] = useState(editando?.monto_financiacion ? String(editando.monto_financiacion) : "");
  const [prendaBanco, setPrendaBanco] = useState(editando?.prenda_banco || "");
  const [prendaMonto, setPrendaMonto] = useState(editando?.prenda_monto ? String(editando.prenda_monto) : "");
  const [prendaCuotaMonto, setPrendaCuotaMonto] = useState(editando?.prenda_cuota_monto ? String(editando.prenda_cuota_monto) : "");
  const [prendaSeguroMonto, setPrendaSeguroMonto] = useState(editando?.prenda_seguro_monto ? String(editando.prenda_seguro_monto) : "");
  const [seguroContratado, setSeguroContratado] = useState(editando?.seguro_contratado || false);
  const [seguroCompania, setSeguroCompania] = useState(editando?.seguro_compania || "");
  const [seguroImporteMensual, setSeguroImporteMensual] = useState(editando?.seguro_importe_mensual ? String(editando.seguro_importe_mensual) : "");
  const [pagoEfectivoArs, setPagoEfectivoArs] = useState(editando?.pago_efectivo_ars ? String(editando.pago_efectivo_ars) : "");
  const [pagoEfectivoUsd, setPagoEfectivoUsd] = useState(editando?.pago_efectivo_usd ? String(editando.pago_efectivo_usd) : "");
  const [pagoEfectivoArsCuentaId, setPagoEfectivoArsCuentaId] = useState(editando?.pago_efectivo_ars_cuenta_id || "");
  const [pagoEfectivoUsdCuentaId, setPagoEfectivoUsdCuentaId] = useState(editando?.pago_efectivo_usd_cuenta_id || "");
  const [tipoCambio, setTipoCambio] = useState(editando?.tipo_cambio ? String(editando.tipo_cambio) : "");
  const [patentamientoMonto] = useState(editando?.patentamiento_transferencia_monto ? String(editando.patentamiento_transferencia_monto) : "");

  // Si viene de "Convertir en venta" de una cotización con permutas cargadas
  // (NuevaCotizacionModal.tsx), precargarlas acá -- si no, se pierden por
  // completo y el vendedor tiene que recordarlas y volver a tipearlas.
  const [docsComprador, setDocsComprador] = useState<Record<string, File | null>>({});
  const [docsPermutas, setDocsPermutas] = useState<Record<number, Record<string, File | null>>>({});
  const [incluirPermuta, setIncluirPermuta] = useState(!!initial?.permuta || !!initial?.permutas?.length);
  const [permutas, setPermutas] = useState<Permuta[]>(initial?.permutas?.length ? initial.permutas.map((pm) => ({
    ...nuevaPermuta(),
    valor: pm.valor || "", moneda: pm.moneda || "USD", marca: pm.marca || "", modelo: pm.modelo || "", anio: pm.anio || "", km: pm.km || "",
    patente: pm.patente || "", color: pm.color || "", condicion: pm.condicion || "Muy bueno", segmento: pm.segmento || "", combustible: pm.combustible || "",
  })) : initial?.permuta ? [{
    ...nuevaPermuta(),
    marca: initial.permuta.marca || "", modelo: initial.permuta.modelo || "",
    anio: initial.permuta.anio ? String(initial.permuta.anio) : "",
    km: initial.permuta.km ? String(initial.permuta.km) : "",
    condicion: initial.permuta.estado || "Muy bueno",
    patente: initial.permuta.patente || "",
    valor: initial.permuta.tasacion ? String(initial.permuta.tasacion) : "",
    moneda: initial.permuta.moneda || "USD",
  }] : []);

  const [responsableConsignacion, setResponsableConsignacion] = useState(editando?.responsable_consignacion_id || "");
  const [gestorAsignado] = useState(editando?.gestor_asignado_id || "");

  const [comisionManual] = useState(editando?.comision_manual || false);
  const [comisionVendedorPct, setComisionVendedorPct] = useState(editando?.comision_vendedor_pct != null ? String(editando.comision_vendedor_pct) : "1");
  // Esquema de comisión del vendedor elegido -- "porcentaje" (default) o
  // "fijo" (monto fijo por venta). Se autocompleta desde perfiles.comision_tipo
  // al elegir vendedor (solo en alta nueva) y queda "congelado" en la venta
  // para no moverse si después cambiás el esquema del vendedor en Configuración.
  const [comisionVendedorTipo, setComisionVendedorTipo] = useState<"porcentaje" | "fijo">(editando?.comision_vendedor_tipo || "porcentaje");
  const [comisionMontoFijo, setComisionMontoFijo] = useState(editando?.comision_vendedor_monto_fijo != null ? String(editando.comision_vendedor_monto_fijo) : "");
  // Moneda del monto fijo del vendedor (puede ser cualquiera, no necesariamente la de la venta). Se autocompleta desde el perfil.
  const [comisionMonedaFijo, setComisionMonedaFijo] = useState<"ARS" | "USD">(editando?.comision_vendedor_moneda === "USD" ? "USD" : editando?.comision_vendedor_moneda === "ARS" ? "ARS" : (editando?.moneda_venta === "USD" ? "USD" : "ARS"));
  const [comisionConsignacionPct, setComisionConsignacionPct] = useState(editando?.comision_consignacion_pct != null ? String(editando.comision_consignacion_pct) : "0.5");
  const [extraMonto, setExtraMonto] = useState(editando?.extra_cobrado_monto ? String(editando.extra_cobrado_monto) : "");
  const [extraMoneda, setExtraMoneda] = useState(editando?.extra_cobrado_moneda || "USD");
  const [combinarTransferenciaBoleto, setCombinarTransferenciaBoleto] = useState(editando?.combinar_transferencia_boleto || false);
  // Transferencia / patentamiento (Walter, 21/10/2026): aparte (se suma en el boleto), incluida en el precio (el boleto
  // muestra un solo total; por dentro el auto y la transferencia quedan separados, así la ganancia del auto no la cuenta)
  // o la hace el cliente (no se cobra). El monto es el "extra cobrado", el mismo que Gestoría registra en su caja.
  const [modoTransferencia, setModoTransferencia] = useState<"aparte" | "incluido" | "cliente">(
    !editando ? "aparte" : editando.combinar_transferencia_boleto ? "incluido" : editando.extra_cobrado_monto ? "aparte" : "cliente"
  );
  // Caja donde entra la transferencia: la de Gestoría (Walter, 21/10/2026). Se cobra aparte del efectivo del auto.
  const [extraCuentaId, setExtraCuentaId] = useState<string>(editando?.extra_cobrado_cuenta_id || "");
  const cajasTransferencia = (moneda: string) => {
    const deMoneda = cuentas.filter((c) => c.moneda === moneda);
    return [...deMoneda.filter((c) => /gestor/i.test(c.nombre || "")), ...deMoneda.filter((c) => !/gestor/i.test(c.nombre || ""))];
  };
  // Si no se eligió (o es de otra moneda), la de Gestoría de esa moneda.
  const cajaTransferencia = cuentas.some((c) => c.id === extraCuentaId && c.moneda === extraMoneda) ? extraCuentaId : cuentas.find((c) => c.moneda === extraMoneda && /gestor/i.test(c.nombre || ""))?.id || "";
  const transferenciaACobrar = modoTransferencia !== "cliente" && Number(extraMonto) > 0;
  // Registra (o corrige) la transferencia en la caja elegida; el RPC revierte el movimiento anterior si había uno.
  const guardarTransferencia = async (ventaId: string) => {
    const { error: err } = await supabase2.rpc("registrar_extra_cobrado_venta", {
      p_venta_id: ventaId, p_monto: transferenciaACobrar ? Number(extraMonto) : null, p_moneda: extraMoneda,
      p_cuenta_id: transferenciaACobrar ? cajaTransferencia || null : null, p_forma_pago: null, p_detalle: transferenciaACobrar ? "Transferencia / patentamiento" : null,
    });
    if (err) throw err;
  };
  const elegirModoTransferencia = (m: "aparte" | "incluido" | "cliente") => {
    setModoTransferencia(m);
    setCombinarTransferenciaBoleto(m === "incluido");
    if (m === "cliente") setExtraMonto("");
  };
  // Bancos de prenda: la misma lista que la seña (Configuración → Empresa → Bancos de prenda).
  const [bancosPrenda, setBancosPrenda] = useState<{ id: string; nombre: string }[]>([]);
  useEffect(() => {
    supabase2.from("bancos_prenda").select("id, nombre").eq("activo", true).order("nombre").then(({ data }) => setBancosPrenda(data ?? []));
  }, []);
  const [vendedorCompartido] = useState(editando?.vendedor_compartido || false);
  const [companeroId] = useState(editando?.vendedor_compartido_id || "");
  const [companeroPct] = useState(editando?.vendedor_compartido_pct != null ? String(editando.vendedor_compartido_pct) : "0.5");

  const [entregaTuerca, setEntregaTuerca] = useState(editando?.entrega_tuerca_seguridad || false);
  const [entregaLlave, setEntregaLlave] = useState(editando?.entrega_duplicado_llave || false);
  const [entregaManuales, setEntregaManuales] = useState(editando?.entrega_manuales || false);
  const [entregaCedula, setEntregaCedula] = useState(editando?.entrega_cedula || false);
  const [fechaEntrega, setFechaEntrega] = useState(editando?.fecha_entrega || "");
  const [notas, setNotas] = useState(editando?.notas || "");
  const [comentarioGestoria, setComentarioGestoria] = useState(editando?.comentario_gestoria || "");
  const [comentarioFinanzas, setComentarioFinanzas] = useState(editando?.comentario_finanzas || "");

  const [recordatorios, setRecordatorios] = useState<any[]>([]);
  const [recordatoriosNuevos, setRecordatoriosNuevos] = useState<{ tipo: string; fecha: string; notas: string }[]>([]);
  const [rTipo, setRTipo] = useState("llamada_seguimiento");
  const [rFecha, setRFecha] = useState("");
  const [rNotas, setRNotas] = useState("");
  const [calificacionPedida, setCalificacionPedida] = useState(editando?.calificacion_pedida || false);

  // Defaults de comisión configurables en Configuración → Empresa →
  // Comisiones — solo pisan el estado inicial en una venta NUEVA, nunca una
  // ya guardada (esa mantiene lo que tenía cuando se cerró).
  useEffect(() => {
    supabase2.from("configuracion_empresa").select("comision_vendedor_pct_default, comision_consignacion_pct_default, comision_presets").eq("id", true).maybeSingle().then(({ data }) => {
      if (!data) return;
      if (!esEdicion) {
        if (data.comision_vendedor_pct_default != null) setComisionVendedorPct(String(data.comision_vendedor_pct_default));
        if (data.comision_consignacion_pct_default != null) setComisionConsignacionPct(String(data.comision_consignacion_pct_default));
      }
    });
  }, []);

  useEffect(() => {
    if (!esEdicion) return;
    supabase2.from("venta_recordatorios").select("*").eq("venta_id", editando.id).eq("estado", "pendiente").order("fecha_vencimiento").then(({ data }) => setRecordatorios(data || []));
  }, [esEdicion, editando?.id]);

  // Permutas ya guardadas -- antes el bloque de Permuta ni se mostraba en
  // edición (ver más abajo, "{!esEdicion && ...}"), así que una vez cerrada
  // la venta la permuta quedaba congelada para siempre, sin forma de
  // corregir un dato mal cargado ni de cargarla a Stock si no se había
  // tildado en su momento.
  useEffect(() => {
    if (!esEdicion) return;
    supabase2.from("venta_permutas").select("*").eq("venta_id", editando.id).then(({ data }) => {
      if (!data || data.length === 0) return;
      setIncluirPermuta(true);
      setPermutas(data.map((p): Permuta => ({
        id: p.id, vehiculoCreadoId: p.vehiculo_creado_id,
        valor: p.valor != null ? String(p.valor) : "", moneda: p.moneda || "USD",
        precioPublicacion: p.precio_publicacion != null ? String(p.precio_publicacion) : "",
        marca: p.marca || "", modelo: p.modelo || "", anio: p.anio != null ? String(p.anio) : "",
        km: p.km != null ? String(p.km) : "", patente: p.patente || "", color: p.color || "",
        condicion: p.condicion || "Muy bueno", cargarAlStock: !!p.vehiculo_creado_id, duenoNombre: p.dueno_nombre || "",
        segmento: p.segmento || "", tipo: p.tipo || "", marcaMotor: p.marca_motor || "", numeroMotor: p.numero_motor || "",
        marcaChasis: p.marca_chasis || "", numeroChasis: p.numero_chasis || "", combustible: p.combustible || "",
        radicadoLocalidad: p.radicado_localidad || "", radicadoProvincia: p.radicado_provincia || "", tasadoEn: p.tasado_en || "",
      })));
    });
  }, [esEdicion, editando?.id]);

  // Señas activas del módulo Señas, para vincularlas acá en vez de tipear el
  // monto de nuevo a mano (esto es lo que causaba que la seña quedara
  // registrada dos veces y sin conexión real con la venta).
  useEffect(() => {
    if (esEdicion) return;
    supabase2.from("senas").select("id, numero, cliente_id, cliente_nombre, apellido, nombre, dni, telefono_celular, correo_electronico, sena_ars, sena_usd, monto, moneda, fecha, marca, modelo, vehiculo_id")
      .eq("estado", "Activa").order("created_at", { ascending: false }).then(({ data }) => { setSenasActivas(data || []); senasActivasOriginal.current = data || []; });
  }, [esEdicion]);

  // Como el sistema viejo (Walter, 21/10/2026): con el número de la seña se traen sus datos.
  const [numeroSena, setNumeroSena] = useState("");
  const [errorNumeroSena, setErrorNumeroSena] = useState("");
  const traerSenaPorNumero = () => {
    const n = numeroSena.trim().replace(/^0+/, "");
    const s = senasActivas.find((x) => String(x.numero ?? "").replace(/^0+/, "") === n);
    if (!n) return;
    if (!s) { setErrorNumeroSena(`No hay una seña activa con el número ${numeroSena.trim()}.`); return; }
    setErrorNumeroSena("");
    setNumeroSena("");
    vincularSena(s.id);
  };
  const vincularSena = (senaId: string) => {
    setSenaAVincular(senaId);
    if (!senaId) return;
    const s = senasActivas.find((x) => x.id === senaId);
    if (!s) return;
    const monto = s.sena_ars ?? s.sena_usd ?? s.monto ?? 0;
    const moneda = s.sena_ars ? "ARS" : s.sena_usd ? "USD" : s.moneda || monedaVenta;
    setSenas((prev) => [...prev, { monto: String(monto), moneda, fecha: s.fecha || hoyLocalISO(), cajaDestino: "", senaOrigenId: s.id }]);
    setSenasActivas((prev) => prev.filter((x) => x.id !== senaId));
    setSenaAVincular("");

    // Autocompletar cliente y vehículo desde la seña de origen -- antes
    // vincular una seña solo copiaba el pago y había que retipear a mano el
    // comprador (y el cliente del CRM quedaba sin engancharse aunque la
    // seña ya lo tuviera identificado).
    if (!clienteId) {
      const clienteDeSena = s.cliente_id ? clientes.find((c) => c.id === s.cliente_id) : null;
      if (clienteDeSena) {
        elegirCliente(clienteDeSena);
      } else {
        const nombre = `${s.apellido || ""} ${s.nombre || ""}`.trim() || s.cliente_nombre || "";
        if (nombre) setCompradorNombre(nombre);
        if (s.dni) setCompradorDni(s.dni);
        if (s.telefono_celular) setCompradorTelefono(s.telefono_celular);
        if (s.correo_electronico) setCompradorEmail(s.correo_electronico);
      }
    }
    if (!vehiculoId && s.vehiculo_id && vehiculos.some((v) => v.id === s.vehiculo_id)) {
      elegirVehiculo(s.vehiculo_id);
    }
  };

  const agregarRecordatorio = () => {
    if (!rFecha) return;
    setRecordatoriosNuevos((prev) => [...prev, { tipo: rTipo, fecha: rFecha, notas: rNotas.trim() }]);
    setRFecha(""); setRNotas("");
  };
  const quitarRecordatorioNuevo = (i: number) => setRecordatoriosNuevos((prev) => prev.filter((_, idx) => idx !== i));

  const generarRecordatoriosAutomaticos = () => {
    const base = fechaEntrega ? parseFechaLocal(fechaEntrega) : parseFechaLocal(fechaCierre);
    const sumarDias = (d: Date, dias: number) => { const n = new Date(d); n.setDate(n.getDate() + dias); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`; };
    setRecordatoriosNuevos((prev) => [
      ...prev,
      { tipo: "control_post_entrega", fecha: sumarDias(base, 7), notas: "Llamado de control a los 7 días de la entrega." },
      { tipo: "service", fecha: sumarDias(base, 180), notas: "Recordar service/mantenimiento a los 6 meses." },
    ]);
  };

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const comisionVendedorEfectiva = vendedorCompartido ? "0.5" : comisionVendedorPct;

  // Cuentas de la venta en vivo: lo que falta cubrir (lib/panel/remanenteVenta.ts). El boleto no se imprime sin $ 0.
  const enMonedaVenta = (items: { monto: unknown; moneda: string }[]) =>
    totalEnMoneda(items.map((x) => ({ monto: Number(x.monto) || 0, moneda: x.moneda as Moneda })), monedaVenta as Moneda, tipoCambio);
  const cuentaVenta = remanenteVenta({
    precio: Number(precioVenta) || 0,
    transferencia: modoTransferencia === "cliente" ? 0 : enMonedaVenta([{ monto: extraMonto, moneda: extraMoneda }]),
    senas: enMonedaVenta(senas.map((x) => ({ monto: x.monto, moneda: x.moneda }))),
    financiera: metodoPago === "Financiado" ? Number(montoFinanciacion) || Number(prendaMonto) || 0 : 0,
    efectivo: enMonedaVenta([{ monto: pagoEfectivoArs, moneda: "ARS" }, { monto: pagoEfectivoUsd, moneda: "USD" }]),
    transferenciaCobrada: transferenciaACobrar && cajaTransferencia ? enMonedaVenta([{ monto: extraMonto, moneda: extraMoneda }]) : 0,
    permutas: incluirPermuta ? enMonedaVenta(permutas.filter((p) => p.valor || p.marca).map((p) => ({ monto: p.valor, moneda: p.moneda }))) : 0,
    conCuotasPropias: metodoPago === "Financiado" && Number(cuotasPlazo) > 0,
  });
  const simboloVenta = monedaVenta === "USD" ? "US$" : "$";
  const fmtVenta = (n: number) => `${n < 0 ? "−" : ""}${simboloVenta} ${Math.abs(n).toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;

  const elegirVehiculo = (id: string) => {
    setVehiculoId(id);
    setVehiculoDropdownAbierto(false);
    const v = vehiculos.find((x) => x.id === id);
    if (v) {
      setVMarca(v.marca); setVModelo(v.modelo); setVAnio(String(v.anio)); setVPatente(v.patente || ""); setVColor(v.color || "");
      setKm(v.km ? String(v.km) : ""); setPrecioVenta(String(v.precio_venta)); setMonedaVenta(v.moneda_venta);
      setBusquedaVehiculo(`${v.marca} ${v.modelo} ${v.anio} · ${v.patente || "s/patente"}`);
      // Autocompleta quién trajo la consignación -- antes había que
      // acordarse de elegirlo a mano, y si se olvidaba esa persona nunca
      // cobraba su comisión (comision_consignacion_pct solo se paga si
      // responsable_consignacion_id quedó cargado).
      setResponsableConsignacion(v.consignado_por || "");
      if (!estadoTocado) setEstado("activa");
    } else {
      setBusquedaVehiculo("");
      // Limpia los datos del vehículo anterior -- si no, "Cambiar" para
      // tildar Carga manual dejaba marca/modelo/año/patente/precio/moneda
      // del auto ya deseleccionado pisando los campos de carga manual
      // (comparten el mismo estado) sin ninguna señal visual de que
      // quedaron datos viejos.
      setVMarca(""); setVModelo(""); setVAnio(""); setVPatente(""); setVColor("");
      setKm(""); setPrecioVenta(""); setMonedaVenta("USD"); setResponsableConsignacion("");
      if (!estadoTocado) setEstado("borrador");
    }
  };

  // La patente se encuentra con o sin espacios y guiones ("AF 669 DQ" = "AF669DQ").
  const sinSeparadores = (t: string) => t.toLowerCase().replace(/[\s-]/g, "");
  const vehiculosFiltrados = vehiculos.filter((v) => {
    const q = busquedaVehiculo.trim().toLowerCase();
    return !q || `${v.marca} ${v.modelo} ${v.anio} ${v.patente || ""}`.toLowerCase().includes(q) || (!!v.patente && sinSeparadores(v.patente).includes(sinSeparadores(q)));
  });

  const elegirCliente = (c: Cliente | null) => {
    setClienteId(c?.id || "");
    setClienteDropdownAbierto(false);
    if (c) {
      const nombreCompleto = `${c.nombre} ${c.apellido || ""}`.trim();
      setBusquedaCliente(nombreCompleto);
      setCompradorNombre(nombreCompleto); setCompradorTelefono(c.telefono || ""); setCompradorEmail(c.email || ""); setCompradorDni(c.dni_cuit || "");
    } else {
      setBusquedaCliente("");
    }
  };

  // "Pasar a venta" desde Señas: vincula esa seña una sola vez, con el mismo vincularSena de la lista de abajo
  // (copia el pago y completa cliente y auto).
  const senaInicialVinculada = useRef(false);
  useEffect(() => {
    if (senaInicialVinculada.current || !initial?.senaId || !senasActivas.some((x) => x.id === initial.senaId)) return;
    senaInicialVinculada.current = true;
    vincularSena(initial.senaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando llegan las señas activas
  }, [senasActivas, initial?.senaId]);

  // Un lead no tiene ficha en "clientes" -- a diferencia de Presupuesto/Seña,
  // acá no hace falta crear una: comprador_nombre/telefono/email de la venta
  // son texto libre (cliente_id queda vacío), así que el dato del lead se
  // vuelca directo sin pasar por un alta.
  const elegirLead = (l: LeadEncontrado) => {
    setClienteId("");
    setClienteDropdownAbierto(false);
    setBusquedaCliente(l.nombre);
    setCompradorNombre(l.nombre);
    setCompradorTelefono(l.telefono || "");
  };

  const agregarSeña = () => setSenas((prev) => [...prev, { monto: "", moneda: monedaVenta, fecha: hoyLocalISO(), cajaDestino: "" }]);
  const quitarSeña = (i: number) => setSenas((prev) => {
    const quitada = prev[i];
    if (quitada?.senaOrigenId) {
      const s = senasActivasOriginal.current.find((x) => x.id === quitada.senaOrigenId);
      if (s) setSenasActivas((act) => [s, ...act]);
    }
    return prev.filter((_, idx) => idx !== i);
  });
  const actualizarSeña = (i: number, campo: keyof Seña, val: string) => setSenas((prev) => prev.map((s, idx) => (idx === i ? { ...s, [campo]: val } : s)));

  const togglePermuta = (on: boolean) => {
    setIncluirPermuta(on);
    if (on && permutas.length === 0) setPermutas([nuevaPermuta()]);
    if (!on) setPermutas([]);
  };
  const agregarPermuta = () => setPermutas((prev) => [...prev, nuevaPermuta()]);
  const quitarPermuta = (i: number) => setPermutas((prev) => {
    const next = prev.filter((_, idx) => idx !== i);
    if (next.length === 0) setIncluirPermuta(false);
    return next;
  });
  const actualizarPermuta = (i: number, campo: keyof Permuta, val: string | boolean) => setPermutas((prev) => prev.map((p, idx) => (idx === i ? { ...p, [campo]: val } : p)));

  // Compartido entre alta y edición -- inserta permutas nuevas (sin p.id) y
  // actualiza las que ya existían en la base. Si una permuta ya tiene
  // vehiculoCreadoId (cargada a Stock en un guardado anterior) no la vuelve
  // a crear, solo actualiza sus datos.
  const guardarPermutas = async (ventaId: string, compradorNombreFinal: string) => {
    if (!incluirPermuta || permutas.length === 0) return;
    for (const p of permutas) {
      if (!p.valor && !p.marca) continue;
      let vehiculoCreadoId: string | null = p.vehiculoCreadoId || null;
      if (p.cargarAlStock && p.marca && p.modelo && !vehiculoCreadoId) {
        // "tipo" NO se manda acá -- es una nota de texto libre en este
        // formulario ("Ej: Sedan 5p") pero vehiculos.tipo tiene un CHECK
        // en la base que solo acepta un set fijo de valores (ningún otro
        // alta de stock, ni NuevoVehiculoModal.tsx ni NuevoMandatoModal.tsx,
        // escribe esa columna) -- mandar cualquier texto tiraba "violates
        // check constraint vehiculos_tipo_check" y dejaba la permuta
        // guardada pero el auto sin cargar al stock. El texto igual queda
        // guardado en venta_permutas.tipo (sin esa restricción), solo no se
        // copia al vehículo del stock. "segmento" y "combustible" son
        // <select> validados (ver JSX) para no pisar el mismo CHECK.
        const { data: vCreado, error: errVehiculo } = await supabase2.from("vehiculos").insert({
          categoria: "Auto", marca: p.marca.trim(), modelo: p.modelo.trim(), anio: p.anio ? Number(p.anio) : new Date().getFullYear(),
          km: p.km ? Number(p.km) : 0, patente: (p.patente || `PERMUTA-${ventaId.slice(0, 8)}`).toUpperCase(), color: p.color || "—",
          precio_venta: p.precioPublicacion ? Number(p.precioPublicacion) : Number(p.valor || 0), moneda_venta: p.moneda,
          estado: "disponible", propio_agencia: true, propietario_nombre: p.duenoNombre || compradorNombreFinal, origen: "Permuta",
          segmento: p.segmento || null, marca_motor: p.marcaMotor || null, numero_motor: p.numeroMotor || null,
          marca_chasis: p.marcaChasis || null, numero_chasis: p.numeroChasis || null, combustible: p.combustible || null,
          radicado_localidad: p.radicadoLocalidad || null, radicado_provincia: p.radicadoProvincia || null,
          // Ubicación vacía a propósito: sin esto la base ponía "Salón principal" (valor por defecto del sistema viejo, 17/10/2026).
          ubicacion: null, creado_por: miId || null,
        }).select().single();
        if (errVehiculo) avisar(`La permuta se guardó, pero no se pudo cargar el auto al stock: ${errVehiculo.message}. Avisá a un encargado para cargarlo a mano.`);
        vehiculoCreadoId = vCreado?.id || null;
      }
      const filaPermuta = {
        venta_id: ventaId, valor: p.valor ? Number(p.valor) : null, moneda: p.moneda, precio_publicacion: p.precioPublicacion ? Number(p.precioPublicacion) : null,
        marca: p.marca || null, modelo: p.modelo || null, anio: p.anio ? Number(p.anio) : null, km: p.km ? Number(p.km) : null,
        patente: p.patente || null, color: p.color || null, condicion: p.condicion, cargar_a_stock: !!vehiculoCreadoId, dueno_nombre: p.duenoNombre || null,
        vehiculo_creado_id: vehiculoCreadoId,
        segmento: p.segmento || null, tipo: p.tipo || null, marca_motor: p.marcaMotor || null, numero_motor: p.numeroMotor || null,
        marca_chasis: p.marcaChasis || null, numero_chasis: p.numeroChasis || null, combustible: p.combustible || null,
        radicado_localidad: p.radicadoLocalidad || null, radicado_provincia: p.radicadoProvincia || null, tasado_en: p.tasadoEn || null,
      };
      // cargar_a_stock refleja si el vehículo realmente se creó, no el
      // checkbox tal cual (marca/modelo vacíos o el insert fallando
      // dejaban esto en true sin que exista ningún vehiculo_creado_id).
      const { error: errorPermuta } = p.id
        ? await supabase2.from("venta_permutas").update(filaPermuta).eq("id", p.id)
        : await supabase2.from("venta_permutas").insert(filaPermuta);
      if (errorPermuta) {
        // Sin este chequeo, si el auto SÍ se había cargado al stock
        // (vehiculoCreadoId) pero este insert/update fallaba, quedaba un
        // vehículo huérfano en Stock sin ningún registro de permuta que
        // lo explique -- parecía stock propio comprado normal.
        avisar(`Falló el registro de la permuta${vehiculoCreadoId && !p.id ? " (el auto ya quedó cargado en Stock)" : ""}: ${errorPermuta.message}. Revisalo a mano.`);
      }
    }
  };

  const resolverCliente = async (estadoFinal: string): Promise<{ id: string | null; creadoNuevo: boolean }> => {
    if (clienteId) return { id: clienteId, creadoNuevo: false };
    if (!compradorNombre.trim() || (!compradorTelefono.trim() && !compradorDni.trim())) return { id: null, creadoNuevo: false };
    const filtros: string[] = [];
    if (compradorTelefono.trim()) filtros.push(`telefono.eq.${compradorTelefono.trim()}`);
    if (compradorDni.trim()) filtros.push(`dni_cuit.eq.${compradorDni.trim()}`);
    const { data: existentes } = await supabase2.from("clientes").select("id").or(filtros.join(","));
    if (existentes && existentes.length > 0) return { id: existentes[0].id, creadoNuevo: false };

    const { data: nuevo } = await supabase2.from("clientes").insert({
      nombre: compradorNombre.trim(), telefono: compradorTelefono || null, email: compradorEmail || null, dni_cuit: compradorDni || null,
      origen: normalizarOrigenCliente("Salón"), canal_ingreso: "walk_in", pipeline_stage: estadoFinal === "cerrada" ? "cerrado" : "negociacion", pipeline_stage_manual: true,
      vendedor_id: vendedorId || null, creado_por: miId || null,
    }).select().single();
    return { id: nuevo?.id || null, creadoNuevo: !!nuevo };
  };

  const guardarPagoEfectivo = async (ventaId: string) => {
    const { error } = await supabase2.rpc("registrar_pago_efectivo_venta", {
      p_venta_id: ventaId,
      p_monto_ars: pagoEfectivoArs ? Number(pagoEfectivoArs) : null,
      p_cuenta_ars_id: pagoEfectivoArs ? (pagoEfectivoArsCuentaId || null) : null,
      p_monto_usd: pagoEfectivoUsd ? Number(pagoEfectivoUsd) : null,
      p_cuenta_usd_id: pagoEfectivoUsd ? (pagoEfectivoUsdCuentaId || null) : null,
      p_tipo_cambio: tipoCambio ? Number(tipoCambio) : null,
      p_fecha: fechaCierre,
    });
    if (error) throw error;
  };

  // La venta todavía no tiene expediente_id en este punto (se crea recién al
  // cerrar la venta, vía trigger) -- no se puede usar expediente_documentos
  // directo, por eso se sube DESPUÉS de crear la venta (ya con ventaId) a
  // venta_documentos. Best-effort: si un archivo falla no aborta el resto
  // ni tira la venta ya guardada -- se avisa y queda para subir a mano.
  const subirDocumentosVenta = async (ventaId: string) => {
    const fallidos: string[] = [];
    const subirUno = async (tipo: string, file: File, permutaIndex: number | null) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("carpeta", "ventas");
      const res = await fetch("/api/panel/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) { fallidos.push(tipo); return; }
      const { error } = await supabase2.from("venta_documentos").insert({
        venta_id: ventaId, tipo, permuta_index: permutaIndex, nombre: file.name, url: data.publicUrl, subido_por: miId || null,
      });
      if (error) fallidos.push(tipo);
    };

    for (const [tipo, file] of Object.entries(docsComprador)) {
      if (file) await subirUno(tipo, file, null);
    }
    for (const [permutaIndex, docs] of Object.entries(docsPermutas)) {
      for (const [tipo, file] of Object.entries(docs)) {
        if (file) await subirUno(tipo, file, Number(permutaIndex));
      }
    }
    if (fallidos.length > 0) {
      avisar(`La venta se guardó, pero ${fallidos.length} documento(s) no se pudieron subir. Adjuntalos de nuevo desde el detalle.`);
    }
  };

  const guardarEdicion = async () => {
    // Sin cotización, convertirMonto devuelve 0 y el saldo/cuotas quedan mal sin avisar: se frena el guardado.
    if (faltaTipoCambio) {
      setError("Hay montos en otra moneda y falta el tipo de cambio: cargalo para que el saldo y las cuotas den bien.");
      return;
    }
    if (!precioVenta || !compradorNombre.trim()) {
      setError("Completá al menos el precio de venta y el nombre del comprador.");
      return;
    }
    if (estado !== "borrador" && !vendedorId) {
      setError("Elegí un vendedor -- solo una venta en Borrador puede quedar sin vendedor asignado.");
      return;
    }
    if (pagoEfectivoArs && !pagoEfectivoArsCuentaId) {
      setError("Elegí a qué caja entra el efectivo en ARS.");
      return;
    }
    if (pagoEfectivoUsd && !pagoEfectivoUsdCuentaId) {
      setError("Elegí a qué caja entra el efectivo en USD.");
      return;
    }
    if (transferenciaACobrar && !cajaTransferencia) {
      setError("Elegí la caja de Gestoría donde entra la transferencia.");
      return;
    }
    setGuardando(true);
    setError("");
    try {
      const payload: any = {
        vehiculo_marca: vMarca || null, vehiculo_modelo: vModelo || null, vehiculo_anio: vAnio ? Number(vAnio) : null,
        vehiculo_patente: vPatente || null, vehiculo_color: vColor || null,
        km: km ? Number(km) : null, precio_venta: Number(precioVenta), moneda_venta: monedaVenta,
        vendedor_id: vendedorId || null, fecha_cierre: fechaCierre, tipo_cambio: tipoCambio ? Number(tipoCambio) : null,
        comprador_nombre: compradorNombre.trim(), comprador_telefono: compradorTelefono || null,
        comprador_email: compradorEmail || null, comprador_dni: compradorDni || null,
        comprador_telefono_celular: compradorTelefonoCelular || null, comprador_fecha_nacimiento: compradorFechaNacimiento || null,
        comprador_cuit_cuil: compradorCuitCuil || null, comprador_estado_civil: compradorEstadoCivil || null, comprador_profesion: compradorProfesion || null,
        comprador_calle: compradorCalle || null, comprador_numero: compradorNumero || null, comprador_depto: compradorDepto || null,
        comprador_localidad: compradorLocalidad || null, comprador_codigo_postal: compradorCodigoPostal || null, comprador_provincia: compradorProvincia || null,
        propietario_nombre: vehiculoId ? null : (propietarioNombre || null), propietario_telefono: vehiculoId ? null : (propietarioTelefono || null),
        metodo_pago: metodoPago || null, cuotas_plazo: metodoPago === "Financiado" && cuotasPlazo ? Number(cuotasPlazo) : null,
        monto_financiacion: montoFinanciacion ? Number(montoFinanciacion) : null,
        prenda_banco: metodoPago === "Financiado" ? (prendaBanco || null) : null,
        prenda_monto: metodoPago === "Financiado" && prendaMonto ? Number(prendaMonto) : null,
        prenda_cuota_monto: metodoPago === "Financiado" && prendaCuotaMonto ? Number(prendaCuotaMonto) : null,
        prenda_seguro_monto: metodoPago === "Financiado" && prendaSeguroMonto ? Number(prendaSeguroMonto) : null,
        seguro_contratado: seguroContratado, seguro_compania: seguroContratado ? (seguroCompania || null) : null,
        seguro_importe_mensual: seguroContratado && seguroImporteMensual ? Number(seguroImporteMensual) : null,
        patentamiento_transferencia_monto: patentamientoMonto ? Number(patentamientoMonto) : null,
        responsable_consignacion_id: responsableConsignacion || null,
        gestor_asignado_id: gestorAsignado || null,
        comision_manual: comisionManual, comision_vendedor_pct: Number(comisionVendedorEfectiva), comision_consignacion_pct: Number(comisionConsignacionPct),
        comision_vendedor_tipo: vendedorCompartido ? "porcentaje" : comisionVendedorTipo, comision_vendedor_monto_fijo: !vendedorCompartido && comisionVendedorTipo === "fijo" && comisionMontoFijo ? Number(comisionMontoFijo) : null,
        // Moneda del monto fijo (puede ser distinta a la de la venta): solo se manda con esquema fijo, así las ventas por porcentaje no dependen de esta columna.
        ...(!vendedorCompartido && comisionVendedorTipo === "fijo" ? { comision_vendedor_moneda: comisionMonedaFijo } : {}),
        vendedor_compartido: vendedorCompartido, vendedor_compartido_id: vendedorCompartido ? (companeroId || null) : null,
        vendedor_compartido_pct: vendedorCompartido ? Number(companeroPct) : null,
        extra_cobrado_monto: extraMonto ? Number(extraMonto) : null, extra_cobrado_moneda: extraMoneda, combinar_transferencia_boleto: combinarTransferenciaBoleto,
        entrega_tuerca_seguridad: entregaTuerca, entrega_duplicado_llave: entregaLlave, entrega_manuales: entregaManuales, entrega_cedula: entregaCedula,
        fecha_entrega: fechaEntrega || null, notas: notas || null, comentario_gestoria: comentarioGestoria || null, comentario_finanzas: comentarioFinanzas || null,
        calificacion_pedida: calificacionPedida,
        calificacion_pedida_en: calificacionPedida && !editando.calificacion_pedida ? new Date().toISOString() : (calificacionPedida ? editando.calificacion_pedida_en : null),
      };

      // .single() tiraba "Cannot coerce the result to a single JSON object"
      // sin decir por qué cuando el UPDATE no podía releer la fila (RLS, o
      // un trigger de base de datos abortando la transacción según el
      // estado). maybeSingle() no crashea con eso, y distinguimos el caso
      // de "no se pudo confirmar" del error real de Supabase.
      const { data: venta, error: dbError } = await supabase2.from("ventas").update(payload).eq("id", editando.id).select().maybeSingle();
      if (dbError) throw dbError;
      if (!venta) throw new Error("No se pudo confirmar el guardado (no se pudo releer la venta actualizada). Verificá permisos y volvé a intentar.");

      // El RPC de efectivo revierte el movimiento anterior y crea uno nuevo en
      // CADA llamada. Llamarlo en cada edición (aunque no se haya tocado el
      // efectivo) rehacía el ingreso en Tesorería sin necesidad y, si el mes
      // de esa venta ya estaba cerrado, hacía fallar la edición entera para
      // un no-admin (eliminar_movimiento_caja rechaza meses cerrados) cuando
      // la venta ya se había guardado. Solo se toca la caja si el efectivo cambió.
      const efectivoCambio =
        Number(pagoEfectivoArs || 0) !== Number(editando.pago_efectivo_ars || 0) ||
        Number(pagoEfectivoUsd || 0) !== Number(editando.pago_efectivo_usd || 0) ||
        (!!pagoEfectivoArs && pagoEfectivoArsCuentaId !== (editando.pago_efectivo_ars_cuenta_id || "")) ||
        (!!pagoEfectivoUsd && pagoEfectivoUsdCuentaId !== (editando.pago_efectivo_usd_cuenta_id || ""));
      if (efectivoCambio) await guardarPagoEfectivo(editando.id);
      const transferenciaCambio =
        Number(transferenciaACobrar ? extraMonto : 0) !== Number(editando.extra_cobrado_monto || 0) ||
        (transferenciaACobrar && (extraMoneda !== (editando.extra_cobrado_moneda || "") || cajaTransferencia !== (editando.extra_cobrado_cuenta_id || "")));
      if (transferenciaCambio) await guardarTransferencia(editando.id);
      await guardarPermutas(editando.id, compradorNombre.trim());

      if (Object.values(docsComprador).some(Boolean) || Object.values(docsPermutas).some((d) => Object.values(d).some(Boolean))) {
        await subirDocumentosVenta(editando.id);
      }

      if (recordatoriosNuevos.length > 0) {
        await supabase2.from("venta_recordatorios").insert(
          recordatoriosNuevos.map((r) => ({ venta_id: editando.id, tipo: r.tipo, fecha_vencimiento: r.fecha, notas: r.notas || null, creado_por: miId || null }))
        );
      }

      onCreado(venta);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err?.message ? `No se pudo guardar los cambios: ${err.message}` : "No se pudo guardar los cambios.");
    } finally {
      setGuardando(false);
    }
  };

  const guardar = async (forzarBorrador: boolean) => {
    if (esEdicion) return guardarEdicion();
    if (faltaTipoCambio) {
      setError("Hay montos en otra moneda y falta el tipo de cambio: cargalo para que el saldo y las cuotas den bien.");
      return;
    }
    if (!precioVenta || !compradorNombre.trim()) {
      setError("Completá al menos el precio de venta y el nombre del comprador.");
      return;
    }
    if (!forzarBorrador && !vendedorId) {
      setError("Falta el vendedor que cerró la venta.");
      return;
    }
    if (pagoEfectivoArs && !pagoEfectivoArsCuentaId) {
      setError("Elegí a qué caja entra el efectivo en ARS.");
      return;
    }
    if (pagoEfectivoUsd && !pagoEfectivoUsdCuentaId) {
      setError("Elegí a qué caja entra el efectivo en USD.");
      return;
    }
    if (transferenciaACobrar && !cajaTransferencia) {
      setError("Elegí la caja de Gestoría donde entra la transferencia.");
      return;
    }
    setGuardando(true);
    setError("");
    try {
      const estadoFinal = forzarBorrador ? "borrador" : cargaManual ? "cerrada" : estado;
      const { id: clienteResueltoId, creadoNuevo: clienteCreadoNuevo } = await resolverCliente(estadoFinal);
      // Código para que el comprador siga su operación en /seguimiento — mismo
      // generador que usa NuevaSenaModal, así el cliente usa el mismo tipo de
      // código sin importar si arrancó con una seña o una venta directa.
      const codigoSeguimiento = generarCodigoPublico();

      // Antes esto se armaba con setComentarioFinanzas DESPUÉS de insertar la
      // venta (más abajo, al generar cuotas) -- el "comentario_finanzas" del
      // payload ya viajaba con el valor viejo, así que el aviso para
      // Finanzas nunca quedaba guardado de verdad. Se calcula acá, antes del
      // insert, para que si corresponde quede en el mismo payload.
      const comentarioFinanzasFinal = metodoPago === "Financiado" && cuotasPlazo && Number(cuotasPlazo) > 0 && !puedeGenerarCuotas
        ? `${comentarioFinanzas ? comentarioFinanzas + " — " : ""}Pedirle a Finanzas que genere el plan de cuotas (${cuotasPlazo} cuotas).`
        : comentarioFinanzas;

      const payload: any = {
        estado: estadoFinal, carga_manual: cargaManual, abre_expediente: true, codigo_seguimiento: codigoSeguimiento,
        vehiculo_id: vehiculoId || null, vehiculo_marca: vMarca || null, vehiculo_modelo: vModelo || null,
        vehiculo_anio: vAnio ? Number(vAnio) : null, vehiculo_patente: vPatente || null, vehiculo_color: vColor || null,
        km: km ? Number(km) : null, precio_venta: Number(precioVenta), moneda_venta: monedaVenta,
        vendedor_id: vendedorId || null, fecha_cierre: fechaCierre, tipo_cambio: tipoCambio ? Number(tipoCambio) : null,
        cliente_id: clienteResueltoId, comprador_nombre: compradorNombre.trim(), comprador_telefono: compradorTelefono || null,
        comprador_email: compradorEmail || null, comprador_dni: compradorDni || null,
        comprador_telefono_celular: compradorTelefonoCelular || null, comprador_fecha_nacimiento: compradorFechaNacimiento || null,
        comprador_cuit_cuil: compradorCuitCuil || null, comprador_estado_civil: compradorEstadoCivil || null, comprador_profesion: compradorProfesion || null,
        comprador_calle: compradorCalle || null, comprador_numero: compradorNumero || null, comprador_depto: compradorDepto || null,
        comprador_localidad: compradorLocalidad || null, comprador_codigo_postal: compradorCodigoPostal || null, comprador_provincia: compradorProvincia || null,
        propietario_nombre: vehiculoId ? null : (propietarioNombre || null), propietario_telefono: vehiculoId ? null : (propietarioTelefono || null),
        metodo_pago: metodoPago || null, cuotas_plazo: metodoPago === "Financiado" && cuotasPlazo ? Number(cuotasPlazo) : null,
        monto_financiacion: montoFinanciacion ? Number(montoFinanciacion) : null,
        prenda_banco: metodoPago === "Financiado" ? (prendaBanco || null) : null,
        prenda_monto: metodoPago === "Financiado" && prendaMonto ? Number(prendaMonto) : null,
        prenda_cuota_monto: metodoPago === "Financiado" && prendaCuotaMonto ? Number(prendaCuotaMonto) : null,
        prenda_seguro_monto: metodoPago === "Financiado" && prendaSeguroMonto ? Number(prendaSeguroMonto) : null,
        seguro_contratado: seguroContratado, seguro_compania: seguroContratado ? (seguroCompania || null) : null,
        seguro_importe_mensual: seguroContratado && seguroImporteMensual ? Number(seguroImporteMensual) : null,
        patentamiento_transferencia_monto: patentamientoMonto ? Number(patentamientoMonto) : null,
        responsable_consignacion_id: responsableConsignacion || null,
        gestor_asignado_id: gestorAsignado || null,
        comision_manual: comisionManual, comision_vendedor_pct: Number(comisionVendedorEfectiva), comision_consignacion_pct: Number(comisionConsignacionPct),
        comision_vendedor_tipo: vendedorCompartido ? "porcentaje" : comisionVendedorTipo, comision_vendedor_monto_fijo: !vendedorCompartido && comisionVendedorTipo === "fijo" && comisionMontoFijo ? Number(comisionMontoFijo) : null,
        // Moneda del monto fijo (puede ser distinta a la de la venta): solo se manda con esquema fijo, así las ventas por porcentaje no dependen de esta columna.
        ...(!vendedorCompartido && comisionVendedorTipo === "fijo" ? { comision_vendedor_moneda: comisionMonedaFijo } : {}),
        vendedor_compartido: vendedorCompartido, vendedor_compartido_id: vendedorCompartido ? (companeroId || null) : null,
        vendedor_compartido_pct: vendedorCompartido ? Number(companeroPct) : null,
        extra_cobrado_monto: extraMonto ? Number(extraMonto) : null, extra_cobrado_moneda: extraMoneda, combinar_transferencia_boleto: combinarTransferenciaBoleto,
        entrega_tuerca_seguridad: entregaTuerca, entrega_duplicado_llave: entregaLlave, entrega_manuales: entregaManuales, entrega_cedula: entregaCedula,
        fecha_entrega: fechaEntrega || null, notas: notas || null, comentario_gestoria: comentarioGestoria || null, comentario_finanzas: comentarioFinanzasFinal || null,
        creado_por: miId || null,
      };

      const { data: venta, error: dbError } = await supabase2.from("ventas").insert(payload).select().single();
      if (!dbError && venta && (pagoEfectivoArs || pagoEfectivoUsd)) {
        try { await guardarPagoEfectivo(venta.id); } catch (errEfectivo: any) {
          avisar(`La venta se guardó, pero no se pudo acreditar el efectivo en Finanzas: ${errEfectivo.message}. Cargalo a mano desde la edición de la venta.`);
        }
      }
      if (!dbError && venta && transferenciaACobrar) {
        try { await guardarTransferencia(venta.id); } catch (errTransf) {
          avisar(`La venta se guardó, pero no se pudo acreditar la transferencia en la caja de Gestoría: ${(errTransf as { message?: string })?.message || "error desconocido"}. Cargala desde el expediente.`);
        }
      }
      if (dbError) {
        // Si el cliente se creó recién en resolverCliente(), ya quedó con
        // pipeline_stage="cerrado" aunque la venta nunca se guardó -- lo
        // revierte para no dejar el Kanban mintiendo sobre una venta que
        // no existe.
        if (clienteCreadoNuevo && clienteResueltoId) {
          await supabase2.from("clientes").update({ pipeline_stage: "negociacion" }).eq("id", clienteResueltoId);
        }
        throw dbError;
      }

      if (Object.values(docsComprador).some(Boolean) || Object.values(docsPermutas).some((d) => Object.values(d).some(Boolean))) {
        await subirDocumentosVenta(venta.id);
      }

      if (senas.length > 0) {
        const filas = senas.filter((s) => s.monto).map((s) => ({ venta_id: venta.id, monto: Number(s.monto), moneda: s.moneda, fecha: s.fecha, caja_destino: s.senaOrigenId ? null : (cuentas.find((c) => c.id === s.cajaDestino)?.nombre || null), sena_origen_id: s.senaOrigenId || null }));
        let errorVentaSenas = null;
        if (filas.length > 0) {
          const { error } = await supabase2.from("venta_senas").insert(filas);
          errorVentaSenas = error;
        }

        if (errorVentaSenas) {
          // El mensaje decía "cargala desde la edición de la venta", pero
          // guardarEdicion() no toca venta_senas en ningún lado -- no hay
          // forma real de reintentar el vínculo desde ahí. Hasta que se
          // arme ese flujo, la única salida real es que alguien lo cargue
          // a mano en la base, así que el aviso lo dice honestamente en vez
          // de mandar a un lugar donde no se puede hacer nada.
          avisar(`La venta se guardó, pero no se pudo registrar la seña vinculada: ${errorVentaSenas.message}. El saldo va a quedar mal calculado -- avisale a un encargado para que lo corrija a mano en la base (no se puede reintentar desde la edición de la venta).`);
        } else {
          // Las señas vinculadas (no las tipeadas a mano) se marcan Convertida acá
          // -- antes quedaban huérfanas en el módulo Señas para siempre, sin
          // ninguna referencia a la venta que terminaron generando. Solo se
          // marcan si venta_senas se guardó bien -- si no, la seña queda como
          // estaba para poder reintentar el vínculo.
          // Las señas tipeadas a mano en esta venta (no vinculadas al módulo
          // Señas) nunca pasaron por Tesorería: el saldo del comprador las
          // resta igual, así que si no se registran acá esa plata no figura
          // en ningún lado. Las vinculadas ya ingresaron al cargar la seña.
          for (const s of senas.filter((x) => x.monto && !x.senaOrigenId && x.cajaDestino)) {
            const { error: errorCaja } = await supabase2.rpc("registrar_movimiento_caja", {
              p_tipo: "ingreso", p_monto: Number(s.monto), p_cuenta_id: s.cajaDestino, p_fecha: s.fecha, p_categoria: "Seña",
              p_forma_pago: null, p_vehiculo_id: vehiculoId || null, p_cliente_id: clienteResueltoId, p_venta_id: venta.id,
              p_observaciones: `Seña cargada en la venta — ${vMarca || ""} ${vModelo || ""}`.trim(),
            });
            if (errorCaja) avisar(`La venta se guardó, pero no se pudo registrar la seña de ${s.moneda} ${Number(s.monto).toLocaleString("es-AR")} en Finanzas: ${errorCaja.message}. Cargala a mano en Finanzas.`);
          }

          const idsVinculados = senas.filter((s) => s.senaOrigenId).map((s) => s.senaOrigenId as string);
          if (idsVinculados.length > 0) {
            const { error: errorSenas } = await supabase2.from("senas").update({ estado: "Convertida", etapa_seguimiento: "Convertida" }).in("id", idsVinculados);
            if (errorSenas) avisar(`La venta y la seña se guardaron, pero no se pudo marcar la seña como Convertida: ${errorSenas.message}. Marcala a mano desde Señas.`);
            // El ingreso de la seña se cargó sin venta_id (todavía no había venta). Se vincula
            // acá para que Finanzas, el seguimiento público y los reportes por venta lo vean.
            const { error: errorVinculoCaja } = await supabase2.rpc("vincular_movimientos_sena_venta", { p_venta_id: venta.id, p_sena_ids: idsVinculados, p_desvincular: false });
            if (errorVinculoCaja) console.error("No se pudo vincular el ingreso de la seña a la venta:", errorVinculoCaja);
          }
        }
      }

      // Convertidos a la moneda de la venta antes de sumar -- sumar los
      // montos crudos mezclaba ARS y USD en un solo número si una seña o
      // permuta estaba en una moneda distinta a la de la venta (mismo bug
      // que ya se había corregido en NuevaSenaModal/lib/moneda.ts, acá
      // había quedado sin corregir).
      const totalPermutas = incluirPermuta
        ? totalEnMoneda(permutas.filter((p) => p.valor || p.marca).map((p) => ({ monto: p.valor, moneda: p.moneda as Moneda })), monedaVenta as Moneda, tipoCambio)
        : 0;
      await guardarPermutas(venta.id, compradorNombre.trim());

      if (metodoPago === "Financiado" && cuotasPlazo && Number(cuotasPlazo) > 0) {
        if (!puedeGenerarCuotas) {
          // El aviso para Finanzas ya quedó en comentario_finanzas al armar
          // el payload de arriba -- no hace falta hacer nada más acá.
        } else {
          const totalSenas = totalEnMoneda(senas.map((s) => ({ monto: s.monto, moneda: s.moneda as Moneda })), monedaVenta as Moneda, tipoCambio);
          // Antes el saldo a financiar en cuotas solo restaba señas y
          // permutas -- ignoraba el efectivo ya cobrado (sección "Desglose
          // de forma de pago", que se puede cargar igual con método
          // Financiado, ej. una entrega en efectivo) y el monto que ya puso
          // la financiera (montoFinanciacion) -- las cuotas terminaban
          // sumando de más, cobrándole al cliente por plata que ya había
          // entrado por otro lado.
          const efectivoTotal = totalEnMoneda(
            [{ monto: pagoEfectivoArs, moneda: "ARS" }, { monto: pagoEfectivoUsd, moneda: "USD" }],
            monedaVenta as Moneda, tipoCambio
          );
          const saldo = Math.max(0, Number(precioVenta) - totalSenas - totalPermutas - efectivoTotal - Number(montoFinanciacion || 0));
          // Cuotas de centavos exactos (la última absorbe la diferencia) y vencimientos que no se desbordan en meses cortos
          // (el 31/1 + 1 mes es el 28/2, no el 3/3). Sin saldo no hay plan (antes salían N cuotas de $ 0): lib/panel/cuotas.ts.
          const plan = planDeCuotas(saldo, Number(cuotasPlazo), fechaCierre);
          const filas = plan.map((c) => ({
            venta_id: venta.id, cliente_id: clienteResueltoId, vendedor_id: vendedorId || null, creado_por: miId || null,
            concepto: `Cuota financiación — ${vMarca || ""} ${vModelo || ""}`.trim(), cuota_actual: c.cuota_actual, cuota_total: c.cuota_total,
            moneda: monedaVenta, monto: c.monto, vencimiento: c.vencimiento,
          }));
          // Antes iba a venta_cuotas (tabla muerta, sin estado/pagada ni
          // wiring de cobro/vencimiento). Se une al mismo flujo que Cobros/
          // CuotasTab así la cuota se puede cobrar y el cron de vencimientos
          // la agarra igual que cualquier otra.
          const { error: errorCuotas } = filas.length ? await supabase2.from("cuotas_cobrar_clientes").insert(filas) : { error: null };
          // Lo que puso la financiera lo paga el cliente a la financiera en las mismas cuotas (13/10/2026, Ana Paula): se
          // guarda aparte, en cuotas_financiera, para verlo en Cobros como seguimiento. Monto de referencia, sin interés.
          const planFinanciera = planDeCuotas(Number(montoFinanciacion || 0), Number(cuotasPlazo), fechaCierre);
          if (planFinanciera.length) {
            const { error: errorFinanciera } = await supabase2.from("cuotas_financiera").insert(planFinanciera.map((c) => ({
              venta_id: venta.id, cliente_id: clienteResueltoId, vendedor_id: vendedorId || null, creado_por: miId || null,
              concepto: `Cuota financiera — ${vMarca || ""} ${vModelo || ""}`.trim(), cuota_actual: c.cuota_actual, cuota_total: c.cuota_total,
              moneda: monedaVenta, monto: c.monto, vencimiento: c.vencimiento,
            })));
            if (errorFinanciera) avisar(`La venta se guardó, pero no se pudieron guardar las cuotas de la financiera para seguimiento: ${errorFinanciera.message}`);
          }
          if (errorCuotas) {
            // Sin este chequeo la venta financiada quedaba sin plan de
            // cuotas y nadie se enteraba -- no aparecía en Cobros ni en el
            // cron de vencimientos, como si el cliente no debiera nada.
            avisar(`La venta se guardó, pero no se pudo generar el plan de cuotas: ${errorCuotas.message}. Generalo a mano desde Cobros o avisá a Finanzas.`);
          }
        }
      }

      if (vehiculoId && estadoFinal === "cerrada") {
        const { error: errorVehiculoVendido } = await supabase2.from("vehiculos").update({ estado: "vendido" }).eq("id", vehiculoId);
        if (errorVehiculoVendido) {
          // La venta ya quedó "cerrada" pero el auto sigue figurando
          // "disponible"/"reservado" en Stock -- sin este aviso podía
          // venderse (o mostrarse) dos veces.
          avisar(`La venta se cerró, pero el vehículo no se pudo marcar como vendido en Stock: ${errorVehiculoVendido.message}. Marcalo a mano.`);
        }
      }

      // El expediente (con hitos + alerta al gestor) lo abre solo el trigger
      // abrir_expediente_al_cerrar_venta al insertar/actualizar la venta en
      // estado 'cerrada' — no hace falta insertarlo a mano acá.

      if (miId) {
        crearAlerta(supabase2, miId, `Nueva venta registrada — ${venta.comprador_nombre}`, {
          mensaje: `${venta.vehiculo_marca || ""} ${venta.vehiculo_modelo || ""} · ${venta.moneda_venta} ${Number(venta.precio_venta).toLocaleString("es-AR")}.`,
          link: `/panel/ventas?venta=${venta.id}`, tipo: "venta", prioridad: "novedad", categoriaNotif: "ventas",
        });
      }

      onCreado(venta);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err?.message ? `No se pudo guardar la venta: ${err.message}` : "No se pudo guardar la venta.");
    } finally {
      setGuardando(false);
    }
  };

  const inputClass = "w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#0145F2] text-slate-900 dark:text-white placeholder:text-slate-400 disabled:opacity-50";
  const labelClass = "text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1";
  const seccionClass = "text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-1 mb-2 flex items-center gap-1.5";

  // Índice de pasos (7/10): solo navegación dentro del formulario, no cambia
  // qué se guarda ni cómo.
  const pasos: PasoFormulario[] = [
    // Orden del sistema viejo (Walter, 21/10/2026): datos de la venta y seña, cliente, vehículo, precio y prenda, permuta,
    // observaciones y forma de pago con el remanente.
    { id: "venta", label: "Venta", icono: ClipboardList },
    { id: "comprador", label: "Cliente", icono: UserRound },
    { id: "vehiculo", label: "Vehículo", icono: Car },
    { id: "precio", label: "Precio y prenda", icono: Landmark },
    { id: "permuta", label: "Permuta", icono: Repeat },
    { id: "pago", label: "Forma de pago", icono: Wallet },
    { id: "entrega", label: "Entrega y documentos", icono: PackageCheck },
    ...(esEdicion ? [{ id: "postventa", label: "Post-venta", icono: Bell }] : []),
  ];
  const { cuerpoRef, pasoActivo, nPaso, irAPaso, alScrollear } = usePasosFormulario(pasos, "venta");

  // Resumen de la operación (7/10): solo se muestra, no se guarda. Mismos
  // cálculos que usa guardar() para el saldo de las cuotas (totalEnMoneda de
  // lib/moneda.ts con el tipo de cambio cargado). Solo en el alta: al editar,
  // las señas no se cargan en este formulario y el número engañaría.
  const precioNum = Number(precioVenta) || 0;
  const resumenSenas = totalEnMoneda(senas.map((x) => ({ monto: x.monto, moneda: x.moneda as Moneda })), monedaVenta as Moneda, tipoCambio);
  const resumenPermutas = incluirPermuta ? totalEnMoneda(permutas.filter((x) => x.valor || x.marca).map((x) => ({ monto: x.valor, moneda: x.moneda as Moneda })), monedaVenta as Moneda, tipoCambio) : 0;
  const resumenEfectivo = totalEnMoneda([{ monto: pagoEfectivoArs, moneda: "ARS" }, { monto: pagoEfectivoUsd, moneda: "USD" }], monedaVenta as Moneda, tipoCambio);
  const resumenFinanciera = metodoPago === "Financiado" ? Number(montoFinanciacion || 0) : 0;
  const resumenResta = precioNum - resumenSenas - resumenPermutas - resumenEfectivo - resumenFinanciera;
  const fmtResumen = (n: number) => `${monedaVenta} ${Math.round(n).toLocaleString("es-AR")}`;
  const faltaTipoCambio = faltaCotizacion(
    [
      ...senas.map((x) => ({ monto: x.monto, moneda: x.moneda as Moneda })),
      ...(incluirPermuta ? permutas.map((x) => ({ monto: x.valor, moneda: x.moneda as Moneda })) : []),
      { monto: pagoEfectivoArs, moneda: "ARS" as Moneda }, { monto: pagoEfectivoUsd, moneda: "USD" as Moneda },
    ],
    monedaVenta as Moneda, tipoCambio
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !guardando && onClose()} />
      <div className="relative bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/10 w-full max-w-3xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex justify-between items-start gap-4 px-6 pt-5 pb-3 shrink-0">
          <div className="min-w-0">
          <p className="text-lg font-black text-slate-900 dark:text-white truncate">{esEdicion ? "Editar venta" : "Nueva venta"}{(vMarca || vModelo) && <span className="font-semibold text-slate-400"> · {`${vMarca} ${vModelo}`.trim()}</span>}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 pr-4 mt-0.5">{esEdicion ? "Editando la venta. El estado se cambia desde el detalle, no acá." : "Se crea en estado Activa si hay vehículo del stock asignado, caso contrario Borrador. El estado se cambia después desde el detalle."}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <BarraPasos pasos={pasos} activo={pasoActivo} onIr={irAPaso} />

        <div ref={cuerpoRef} onScroll={alScrollear} className="space-y-4 px-6 py-4 overflow-y-auto overflow-x-hidden flex-1 min-h-0 border-t border-slate-100 dark:border-white/10">
          <TituloPaso id="venta" n={nPaso("venta")} titulo="Datos de la venta" icono={ClipboardList} primero />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Vendedor (cerró la venta) *</label>
                <select
                  value={vendedorId}
                  onChange={(e) => {
                    setVendedorId(e.target.value);
                    // Autocompletar el esquema de comisión propio del vendedor
                    // elegido -- solo en alta nueva, para no pisar lo que ya
                    // quedó congelado en una venta guardada.
                    if (!esEdicion) {
                      const p = vendedores.find((v) => v.id === e.target.value);
                      if (p?.comision_tipo === "fijo") {
                        setComisionVendedorTipo("fijo");
                        setComisionMontoFijo(p.comision_valor != null ? String(p.comision_valor) : "");
                        if (p.comision_moneda) setComisionMonedaFijo(p.comision_moneda);
                      } else {
                        setComisionVendedorTipo("porcentaje");
                        if (p?.comision_tipo === "porcentaje" && p.comision_valor != null) setComisionVendedorPct(String(p.comision_valor));
                      }
                    }
                  }}
                  className={inputClass}
                >
                  <option value="">—</option>
                  {vendedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Fecha de cierre</label>
                <input type="date" value={fechaCierre} onChange={(e) => setFechaCierre(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Estado</label>
                <select value={estado} onChange={(e) => { setEstado(e.target.value); setEstadoTocado(true); }} disabled={cargaManual || esEdicion} className={inputClass}>
                  {cargaManual ? <option value="cerrada">Cerrada</option> : ["borrador", "activa", "reserva", "cerrada", "caida", "cancelada"].map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
                {esEdicion ? (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg px-2.5 py-2 mt-1.5">
                    El estado actual es <strong>{estado.charAt(0).toUpperCase() + estado.slice(1)}</strong>. Para cambiarlo, cerrá este modal y usá el botón "Cambiar status" del detalle — el flow valida las transiciones permitidas y pide motivo cuando corresponde.
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400 mt-1">{cargaManual ? "Carga manual nace Cerrada (paridad v1)" : "Por default según vehículo. Cambialo si la venta arranca en otro estado."}</p>
                )}
              </div>

          </div>

              {esEdicion && (
                <p className="text-[11px] text-slate-400 bg-slate-50 dark:bg-white/5 rounded-lg px-3 py-2">Señas y permutas se gestionan desde el expediente de la venta, no desde acá.</p>
              )}
              {!esEdicion && (
              <div>
                <div className="bg-amber-50/60 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/20 rounded-xl p-3.5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-xs font-bold text-amber-700 dark:text-amber-300">Seña / adelanto ({senas.length})</p>
                      <p className="text-[10px] text-amber-700/70 dark:text-amber-300/60">Cargá cada pago a cuenta con su monto, moneda y fecha, y adjuntá el comprobante. El total se acredita como seña en la liquidación del expediente — lo ven Finanzas y Gestoría.</p>
                    </div>
                    <button type="button" onClick={agregarSeña} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[11px] font-bold shrink-0"><Plus className="w-3.5 h-3.5" /> Agregar seña</button>
                  </div>
                  {senasActivas.length > 0 && (
                    <div className="mb-3">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300 block mb-1">Número de seña</label>
                      <div className="flex gap-2 mb-1">
                        <input value={numeroSena} onChange={(e) => { setNumeroSena(e.target.value); setErrorNumeroSena(""); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); traerSenaPorNumero(); } }} inputMode="numeric" placeholder="Ej: 1234" className="w-32 bg-white dark:bg-white/5 border border-amber-200 dark:border-amber-500/20 rounded-lg px-3 py-2 text-sm" />
                        <button type="button" onClick={traerSenaPorNumero} className="px-3 py-2 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-200 text-xs font-bold">Traer datos</button>
                      </div>
                      {errorNumeroSena && <p className="text-[11px] text-red-600 dark:text-red-400 mb-1">{errorNumeroSena}</p>}
                    </div>
                  )}
                  {senasActivas.length > 0 && (
                    <div className="mb-3">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300 block mb-1">¿Ya cargaste esta seña en el módulo Señas? Vinculala en vez de tipearla de nuevo</label>
                      <select value={senaAVincular} onChange={(e) => vincularSena(e.target.value)} className="w-full bg-white dark:bg-white/5 border border-amber-200 dark:border-amber-500/20 rounded-lg px-2.5 py-2 text-xs outline-none">
                        <option value="">— Elegir seña activa —</option>
                        {senasActivas.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.numero ? `N° ${s.numero} — ` : ""}{s.apellido || s.cliente_nombre}{s.apellido ? `, ${s.nombre}` : ""} — {s.marca} {s.modelo} — {s.sena_ars ? `$ ${Number(s.sena_ars).toLocaleString("es-AR")}` : s.sena_usd ? `USD ${Number(s.sena_usd).toLocaleString("es-AR")}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {senas.length === 0 ? (
                    <p className="text-[11px] text-amber-700/70 dark:text-amber-300/60 text-center py-2">Sin seña registrada. Si el cliente abonó algo a cuenta, agregalo con el botón de arriba.</p>
                  ) : (
                    <div className="space-y-3">
                      {senas.map((s, i) => (
                        <div key={i} className="bg-white dark:bg-white/5 rounded-lg p-3 border border-amber-100 dark:border-amber-500/10 relative">
                          <button type="button" onClick={() => quitarSeña(i)} className="absolute top-2 right-2 text-slate-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
                          {s.senaOrigenId && <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mb-1.5"><Link2 className="w-3 h-3 inline -mt-0.5" /> Vinculada al módulo Señas — se marca Convertida al guardar</p>}
                          <div className="grid grid-cols-2 gap-2 pr-6">
                            <div><label className={labelClass}>Monto</label><div className="flex gap-1"><select value={s.moneda} onChange={(e) => { actualizarSeña(i, "moneda", e.target.value); actualizarSeña(i, "cajaDestino", ""); }} className={`${inputClass} !w-20 shrink-0 py-2`}><option value="USD">USD</option><option value="ARS">ARS</option></select><input type="number" value={s.monto} onChange={(e) => actualizarSeña(i, "monto", e.target.value)} className={`${inputClass} flex-1 min-w-0`} /></div></div>
                            <div><label className={labelClass}>Fecha</label><input type="date" value={s.fecha} onChange={(e) => actualizarSeña(i, "fecha", e.target.value)} className={inputClass} /></div>
                            {s.senaOrigenId ? (
                              <div><label className={labelClass}>Caja destino</label><p className="text-[11px] text-slate-500 dark:text-slate-400 py-2.5">Ya ingresó a Finanzas cuando se cargó la seña.</p></div>
                            ) : (
                              <div>
                                <label className={labelClass}>Caja destino</label>
                                <select value={s.cajaDestino} onChange={(e) => actualizarSeña(i, "cajaDestino", e.target.value)} className={inputClass}>
                                  <option value="">No registrar en Finanzas</option>
                                  {cuentas.filter((c) => c.moneda === s.moneda).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </select>
                              </div>
                            )}
                            <div>
                              <label className={labelClass}>Comprobante</label>
                              <button type="button" disabled title="Todavía no construido" className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-slate-200 dark:border-white/10 text-[11px] font-bold text-amber-500 opacity-60 cursor-not-allowed"><Paperclip className="w-3 h-3" /> Adjuntar</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              )}


          <TituloPaso id="comprador" n={nPaso("comprador")} titulo="Cliente" icono={UserRound} />
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative">
                <label className={labelClass}>Cliente del CRM</label>
                {clienteId ? (
                  <div className="flex items-center justify-between gap-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl px-3 py-2.5">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300 truncate">
                      <Check className="w-3.5 h-3.5 shrink-0" /> {busquedaCliente}
                    </span>
                    <button type="button" onClick={() => elegirCliente(null)} className="shrink-0 text-emerald-600 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-200 text-[11px] font-bold uppercase tracking-widest">
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      className={`${inputClass} pl-9`}
                      placeholder="Buscar por nombre o DNI..."
                      value={busquedaCliente}
                      onChange={(e) => { setBusquedaCliente(e.target.value); setClienteDropdownAbierto(true); }}
                      onFocus={() => setClienteDropdownAbierto(true)}
                      onBlur={() => setTimeout(() => setClienteDropdownAbierto(false), 150)}
                    />
                  </div>
                )}
                {!clienteId && clienteDropdownAbierto && busquedaCliente && (
                  <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl shadow-lg divide-y divide-slate-100 dark:divide-white/10">
                    {clientesFiltrados.slice(0, 20).map((c) => (
                      <button key={c.id} type="button" onMouseDown={() => elegirCliente(c)} className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-800 dark:text-white truncate">{c.nombre} {c.apellido || ""}</span>
                        <span className="text-[11px] text-slate-400 shrink-0">{c.telefono || c.dni_cuit || ""}</span>
                      </button>
                    ))}
                    {leadsEncontrados.map((l) => (
                      <button key={`${l.origen}-${l.id}`} type="button" onMouseDown={() => elegirLead(l)} className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-800 dark:text-white flex items-center gap-1.5 min-w-0 truncate"><Megaphone className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> <span className="truncate">{l.nombre}</span></span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-300 shrink-0">{LEAD_ORIGEN_LABEL[l.origen]}</span>
                      </button>
                    ))}
                    {buscandoCliente ? (
                      <p className="px-3 py-3 text-[13px] text-slate-400 italic flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando...</p>
                    ) : clientesFiltrados.length === 0 && leadsEncontrados.length === 0 && <p className="px-3 py-3 text-[13px] text-slate-400 italic">Sin resultados.</p>}
                  </div>
                )}
              </div>
              <div><label className={labelClass}>Nombre *</label><input value={compradorNombre} onChange={(e) => setCompradorNombre(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Teléfono</label><input value={compradorTelefono} onChange={(e) => setCompradorTelefono(e.target.value)} placeholder="11 5555 5555" className={inputClass} /></div>
              <div><label className={labelClass}>Email</label><input value={compradorEmail} onChange={(e) => setCompradorEmail(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>DNI</label><input value={compradorDni} onChange={(e) => setCompradorDni(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>CUIT/CUIL</label><input value={compradorCuitCuil} onChange={(e) => setCompradorCuitCuil(e.target.value)} placeholder="20-12345678-9" className={inputClass} /></div>
              <div><label className={labelClass}>Fecha de nacimiento</label><input type="date" value={compradorFechaNacimiento} onChange={(e) => setCompradorFechaNacimiento(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Estado civil</label><input value={compradorEstadoCivil} onChange={(e) => setCompradorEstadoCivil(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Profesión</label><input value={compradorProfesion} onChange={(e) => setCompradorProfesion(e.target.value)} className={inputClass} /></div>
            </div>
            {!clienteId && compradorNombre && (compradorTelefono || compradorDni) && <p className="text-[10px] text-indigo-500 mt-1.5">Se engancha solo a un cliente existente por teléfono/DNI, o se crea uno nuevo en Clientes.</p>}

            <p className={seccionClass + " mt-4"}>Domicilio</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div><label className={labelClass}>Calle</label><input value={compradorCalle} onChange={(e) => setCompradorCalle(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Número</label><input value={compradorNumero} onChange={(e) => setCompradorNumero(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Depto</label><input value={compradorDepto} onChange={(e) => setCompradorDepto(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Localidad</label><input value={compradorLocalidad} onChange={(e) => setCompradorLocalidad(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Código postal</label><input value={compradorCodigoPostal} onChange={(e) => setCompradorCodigoPostal(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Provincia</label><input value={compradorProvincia} onChange={(e) => setCompradorProvincia(e.target.value)} className={inputClass} /></div>
            </div>
          </div>

          <TituloPaso id="vehiculo" n={nPaso("vehiculo")} titulo="Vehículo" icono={Car} />
          {!esEdicion && (
            <label className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer ${cargaManual ? "bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30" : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10"}`}>
              <input type="checkbox" checked={cargaManual} onChange={(e) => { setCargaManual(e.target.checked); if (e.target.checked && vehiculoId) elegirVehiculo(""); }} className="w-4 h-4 mt-0.5 accent-[#0145F2]" />
              <span>
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">Carga manual <span className="font-normal text-slate-400">(venta vieja importada desde Excel)</span></span>
                <span className="block text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Para registrar ventas históricas: permite cargar el vehículo a mano (sin ficha en stock) y la venta nace en estado <strong>Cerrada</strong> directamente. El resto del formulario queda igual.</span>
              </span>
            </label>
          )}

          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative">
                <label className={labelClass}>Vehículo</label>
                {vehiculoId ? (
                  <div className="flex items-center justify-between gap-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl px-3 py-2.5">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300 truncate">
                      <Check className="w-3.5 h-3.5 shrink-0" /> {busquedaVehiculo}
                    </span>
                    <button type="button" onClick={() => elegirVehiculo("")} className="shrink-0 text-emerald-600 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-200 text-[11px] font-bold uppercase tracking-widest">
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      className={`${inputClass} pl-9`}
                      placeholder="Buscar marca, modelo, patente..."
                      value={busquedaVehiculo}
                      onChange={(e) => { setBusquedaVehiculo(e.target.value); setVehiculoDropdownAbierto(true); }}
                      onFocus={() => setVehiculoDropdownAbierto(true)}
                      onBlur={() => setTimeout(() => setVehiculoDropdownAbierto(false), 150)}
                    />
                  </div>
                )}
                {!vehiculoId && vehiculoDropdownAbierto && (
                  <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl shadow-lg divide-y divide-slate-100 dark:divide-white/10">
                    {vehiculosFiltrados.slice(0, 20).map((v) => (
                      <button key={v.id} type="button" onMouseDown={() => elegirVehiculo(v.id)} className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-800 dark:text-white truncate">{v.marca} {v.modelo} {v.anio}</span>
                        <span className="text-[11px] text-slate-400 shrink-0">{v.patente || "s/patente"}</span>
                      </button>
                    ))}
                    {vehiculosFiltrados.length === 0 && <p className="px-3 py-3 text-[13px] text-slate-400 italic">Sin resultados.</p>}
                  </div>
                )}
              </div>
              {cargaManual && (
                <div className="sm:col-span-2 bg-amber-50/60 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/20 rounded-xl p-3.5">
                  <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300 mb-2">Carga manual — cargá los datos del auto a mano (no hace falta tener ficha en stock).</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={labelClass}>Marca / Modelo</label><input value={`${vMarca} ${vModelo}`.trim()} onChange={(e) => { const [m, ...r] = e.target.value.split(" "); setVMarca(m || ""); setVModelo(r.join(" ")); }} placeholder="Ej: Volkswagen Vento GLI" className={inputClass} /></div>
                    <div><label className={labelClass}>Año</label><input type="number" value={vAnio} onChange={(e) => setVAnio(e.target.value)} placeholder="2023" className={inputClass} /></div>
                    <div className="col-span-2"><label className={labelClass}>Patente / Dominio</label><input value={vPatente} onChange={(e) => setVPatente(e.target.value)} placeholder="AG235VZ" className={inputClass} /></div>
                  </div>
                </div>
              )}

              <div>
                <label className={labelClass}>Kilometraje del vehículo</label>
                <input type="text" inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value.replace(/\D/g, ""))} placeholder="Ej: 45000" className={inputClass} />
                <p className="text-[10px] text-slate-400 mt-1">Km del auto vendido al momento de la operación.</p>
              </div>
              <div />

            </div>
          </div>

          {!vehiculoId && (
            <div>
              <p className={seccionClass}>Propietario del vehículo</p>
              <p className="text-[10px] text-slate-400 mb-2">Sin vehículo del stock linkeado — cargá los datos del propietario a mano (ventas históricas / vehículo libre).</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelClass}>Nombre</label><input value={propietarioNombre} onChange={(e) => setPropietarioNombre(e.target.value)} placeholder="— s/d —" className={inputClass} /></div>
                <div><label className={labelClass}>Teléfono</label><input value={propietarioTelefono} onChange={(e) => setPropietarioTelefono(e.target.value)} placeholder="— s/d —" className={inputClass} /></div>
              </div>
            </div>
          )}

          <TituloPaso id="precio" n={nPaso("precio")} titulo="Precio y prenda" icono={Landmark} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Precio de Venta (al comprador) *</label>
                <div className="flex gap-2">
                  <select value={monedaVenta} onChange={(e) => setMonedaVenta(e.target.value)} className={`${inputClass} !w-24 shrink-0`}><option value="USD">USD</option><option value="ARS">ARS</option></select>
                  <input type="text" inputMode="numeric" value={precioVenta} onChange={(e) => setPrecioVenta(e.target.value.replace(/\D/g, ""))} className={`${inputClass} flex-1 min-w-0`} />
                </div>
              </div>
          </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Método de pago</label>
                  <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)} className={inputClass}>
                    <option value="">—</option><option>Contado</option><option>Financiado</option><option>Leasing</option><option>Permuta</option><option>Criptomonedas</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Cuotas (plazo)</label>
                  <input type="number" value={cuotasPlazo} onChange={(e) => setCuotasPlazo(e.target.value)} disabled={metodoPago !== "Financiado"} placeholder="Ej. 12" className={inputClass} />
                  <p className="text-[10px] text-slate-400 mt-1">Solo si el método de pago es Financiado</p>
                </div>
                {metodoPago === "Financiado" && (
                  <div className="col-span-2">
                    <label className={labelClass}>Monto financiado por la financiera</label>
                    <input type="number" value={montoFinanciacion} onChange={(e) => setMontoFinanciacion(e.target.value)} className={inputClass} />
                    {!puedeGenerarCuotas && <p className="text-[10px] text-amber-600 mt-1">Tu rol no puede generar el plan de cuotas — quedará un aviso para Finanzas.</p>}
                  </div>
                )}
              </div>

              {metodoPago === "Financiado" && (
                <div>
                  <p className={seccionClass}>Datos de la prenda</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="col-span-2"><label className={labelClass}>Banco de la prenda</label>{bancosPrenda.length > 0 ? (
                      <select value={prendaBanco} onChange={(e) => setPrendaBanco(e.target.value)} className={inputClass}>
                        <option value="">Elegí el banco</option>
                        {prendaBanco && !bancosPrenda.some((b) => b.nombre === prendaBanco) && <option value={prendaBanco}>{prendaBanco}</option>}
                        {bancosPrenda.map((b) => <option key={b.id} value={b.nombre}>{b.nombre}</option>)}
                      </select>
                    ) : <input value={prendaBanco} onChange={(e) => setPrendaBanco(e.target.value)} className={inputClass} />}</div>
                    <div><label className={labelClass}>Prenda ($)</label><input type="number" value={prendaMonto} onChange={(e) => setPrendaMonto(e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Cuota de prenda ($)</label><input type="number" value={prendaCuotaMonto} onChange={(e) => setPrendaCuotaMonto(e.target.value)} className={inputClass} /></div>
                    <div className="col-span-2 sm:col-span-1"><label className={labelClass}>Seguro de prenda ($)</label><input type="number" value={prendaSeguroMonto} onChange={(e) => setPrendaSeguroMonto(e.target.value)} className={inputClass} /></div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">La cantidad de cuotas es la misma de "Cuotas (plazo)" de arriba.</p>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className={seccionClass + " mt-0 mb-0"}>¿Contrata seguro?</p>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"><input type="checkbox" checked={seguroContratado} onChange={(e) => setSeguroContratado(e.target.checked)} className="w-4 h-4 accent-[#0145F2]" /> Sí</label>
                </div>
                {seguroContratado && (
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={labelClass}>Compañía</label><input value={seguroCompania} onChange={(e) => setSeguroCompania(e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Importe mensual</label><input type="number" value={seguroImporteMensual} onChange={(e) => setSeguroImporteMensual(e.target.value)} className={inputClass} /></div>
                  </div>
                )}
              </div>

              <div>
                <p className={seccionClass}>Transferencia / patentamiento</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {([["aparte", "Aparte"], ["incluido", "Incluida en el precio"], ["cliente", "La hace el cliente"]] as const).map(([m, label]) => (
                    <button key={m} type="button" onClick={() => elegirModoTransferencia(m)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${modoTransferencia === m ? "bg-[#0145F2] text-white border-[#0145F2]" : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300"}`}>{label}</button>
                  ))}
                </div>
                {modoTransferencia !== "cliente" && (
                  <div className="max-w-xs">
                    <label className={labelClass}>Monto de la transferencia</label>
                    <div className="flex gap-1"><select value={extraMoneda} onChange={(e) => setExtraMoneda(e.target.value)} aria-label="Moneda de la transferencia" className={`${inputClass} !w-20 shrink-0`}><option value="USD">USD</option><option value="ARS">ARS</option></select><input type="number" value={extraMonto} onChange={(e) => setExtraMonto(e.target.value)} className={`${inputClass} flex-1 min-w-0`} /></div>
                    <label className={`${labelClass} mt-2`}>Caja donde entra (Gestoría) *</label>
                    <select value={cajaTransferencia} onChange={(e) => setExtraCuentaId(e.target.value)} className={inputClass}>
                      <option value="">— elegir —</option>
                      {cajasTransferencia(extraMoneda).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                    {!cuentas.some((c) => c.moneda === extraMoneda && /gestor/i.test(c.nombre || "")) && <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">No hay una caja de Gestoría en {extraMoneda}: creala en Finanzas.</p>}
                  </div>
                )}
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">{modoTransferencia === "aparte" ? "En el boleto se suma aparte del precio del auto. Se cobra aparte del efectivo y entra a la caja de Gestoría." : modoTransferencia === "incluido" ? "El boleto muestra un solo precio (auto + transferencia). En efectivo cargá solo lo del auto: la transferencia entra a la caja de Gestoría y la ganancia del auto se calcula sin ella." : "No se cobra. El boleto dice \"Transferencia a cargo del cliente\"."}</p>
              </div>

              <TituloPaso id="permuta" n={nPaso("permuta")} titulo="Permuta" icono={Repeat} />
              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Autos que el comprador entrega en parte de pago.</p>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"><input type="checkbox" checked={incluirPermuta} onChange={(e) => togglePermuta(e.target.checked)} className="w-4 h-4 accent-[#0145F2]" /> Incluir vehículo en permuta</label>
                </div>
                {!incluirPermuta ? (
                  <p className="text-[11px] text-slate-400 bg-slate-50 dark:bg-white/5 rounded-lg px-3 py-2">Sin permuta. Activá el toggle si el comprador entrega un auto en parte de pago.</p>
                ) : (
                  <div className="space-y-3">
                    {permutas.map((p, i) => (
                      <div key={i} className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-3.5 relative">
                        {i > 0 && <p className="text-xs font-bold text-indigo-600 dark:text-indigo-300 mb-2">Permuta #{i + 1}</p>}
                        {i > 0 && <button type="button" onClick={() => quitarPermuta(i)} className="absolute top-3 right-3 text-slate-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                          <div><label className={labelClass}>{i === 0 ? "Valor de la permuta" : "Valor de la toma"}</label><div className="flex gap-1"><select value={p.moneda} onChange={(e) => actualizarPermuta(i, "moneda", e.target.value)} className={`${inputClass} !w-20 shrink-0`}><option value="USD">USD</option><option value="ARS">ARS</option></select><input type="number" value={p.valor} onChange={(e) => actualizarPermuta(i, "valor", e.target.value)} className={`${inputClass} flex-1 min-w-0`} /></div></div>
                          <div><label className={labelClass}>Precio de publicación</label><input type="number" value={p.precioPublicacion} onChange={(e) => actualizarPermuta(i, "precioPublicacion", e.target.value)} placeholder="A cuánto se va a publicar" className={inputClass} /></div>
                          <div><label className={labelClass}>Marca</label><input value={p.marca} onChange={(e) => actualizarPermuta(i, "marca", e.target.value)} className={inputClass} /></div>
                          <div><label className={labelClass}>Modelo</label><input value={p.modelo} onChange={(e) => actualizarPermuta(i, "modelo", e.target.value)} className={inputClass} /></div>
                          <div><label className={labelClass}>Año</label><input type="number" value={p.anio} onChange={(e) => actualizarPermuta(i, "anio", e.target.value)} className={inputClass} /></div>
                          <div><label className={labelClass}>Kilómetros</label><input type="number" value={p.km} onChange={(e) => actualizarPermuta(i, "km", e.target.value)} className={inputClass} /></div>
                          <div><label className={labelClass}>Patente</label><input value={p.patente} onChange={(e) => actualizarPermuta(i, "patente", e.target.value)} className={inputClass} /></div>
                          <div><label className={labelClass}>Color</label><input value={p.color} onChange={(e) => actualizarPermuta(i, "color", e.target.value)} className={inputClass} /></div>
                          <div><label className={labelClass}>Estado general</label><select value={p.condicion} onChange={(e) => actualizarPermuta(i, "condicion", e.target.value)} className={inputClass}>{CONDICIONES_PERMUTA.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
                          <div><label className={labelClass}>Segmento</label><select value={p.segmento} onChange={(e) => actualizarPermuta(i, "segmento", e.target.value)} className={inputClass}><option value="">— Sin especificar —</option>{SEGMENTOS.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
                          <div><label className={labelClass}>Tipo (nota interna, no se guarda en Stock)</label><input value={p.tipo} onChange={(e) => actualizarPermuta(i, "tipo", e.target.value)} placeholder="Ej: Sedan 5p" className={inputClass} /></div>
                          <div><label className={labelClass}>Combustible</label><select value={p.combustible} onChange={(e) => actualizarPermuta(i, "combustible", e.target.value)} className={inputClass}><option value="">— Sin especificar —</option>{COMBUSTIBLES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
                          <div><label className={labelClass}>Marca motor</label><input value={p.marcaMotor} onChange={(e) => actualizarPermuta(i, "marcaMotor", e.target.value)} className={inputClass} /></div>
                          <div><label className={labelClass}>Nº motor</label><input value={p.numeroMotor} onChange={(e) => actualizarPermuta(i, "numeroMotor", e.target.value)} className={inputClass} /></div>
                          <div><label className={labelClass}>Marca chasis</label><input value={p.marcaChasis} onChange={(e) => actualizarPermuta(i, "marcaChasis", e.target.value)} className={inputClass} /></div>
                          <div><label className={labelClass}>Nº chasis</label><input value={p.numeroChasis} onChange={(e) => actualizarPermuta(i, "numeroChasis", e.target.value)} className={inputClass} /></div>
                          <div><label className={labelClass}>Radicado — localidad</label><input value={p.radicadoLocalidad} onChange={(e) => actualizarPermuta(i, "radicadoLocalidad", e.target.value)} className={inputClass} /></div>
                          <div><label className={labelClass}>Radicado — provincia</label><input value={p.radicadoProvincia} onChange={(e) => actualizarPermuta(i, "radicadoProvincia", e.target.value)} className={inputClass} /></div>
                          <div><label className={labelClass}>Tasado en</label><input value={p.tasadoEn} onChange={(e) => actualizarPermuta(i, "tasadoEn", e.target.value)} placeholder="Ej: Casa Central" className={inputClass} /></div>
                        </div>
                        <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 mt-3 mb-1.5">Cédula Verde del vehículo de permuta</p>
                        <div className="grid grid-cols-2 gap-2">
                          {[["Cédula Verde Frente", "cedula_verde_frente"], ["Cédula Verde Dorso", "cedula_verde_dorso"]].map(([label, tipo]) => (
                            <label key={tipo} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-slate-200 dark:border-white/10 text-[11px] font-semibold text-slate-500 dark:text-slate-400 cursor-pointer truncate px-1">
                              {docsPermutas[i]?.[tipo] ? `✓ ${docsPermutas[i][tipo]!.name}` : `Adjuntar ${label}`}
                              <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setDocsPermutas((prev) => ({ ...prev, [i]: { ...prev[i], [tipo]: e.target.files?.[0] || null } }))} />
                            </label>
                          ))}
                        </div>
                        <label className={`flex items-center gap-2.5 mt-3 px-3 py-2 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 ${p.vehiculoCreadoId ? "opacity-70" : "cursor-pointer"}`}>
                          <input type="checkbox" checked={p.cargarAlStock} disabled={!!p.vehiculoCreadoId} onChange={(e) => actualizarPermuta(i, "cargarAlStock", e.target.checked)} className="w-4 h-4 accent-[#0145F2]" />
                          <span className="flex-1">
                            <span className="block text-xs font-bold text-slate-700 dark:text-slate-200">Cargar este vehículo al Stock {i === 0 ? "automáticamente" : ""}</span>
                            {p.vehiculoCreadoId ? (
                              <span className="block text-[10px] text-emerald-600 dark:text-emerald-400">Ya está cargado en Stock -- los cambios de arriba se van a actualizar en esa ficha al guardar.</span>
                            ) : i === 0 && (
                              <span className="block text-[10px] text-slate-400">Al guardar la venta, el vehículo de permuta se crea en Stock con status Disponible y los datos cargados arriba.</span>
                            )}
                          </span>
                        </label>
                        {p.cargarAlStock && <input value={p.duenoNombre} onChange={(e) => actualizarPermuta(i, "duenoNombre", e.target.value)} placeholder={`Dueño: ${compradorNombre || "..."}`} className={`${inputClass} mt-2`} />}
                      </div>
                    ))}
                    <button type="button" onClick={agregarPermuta} className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-300"><Plus className="w-3.5 h-3.5" /> Agregar otra permuta</button>
                  </div>
                )}
              </div>

          <div>
            <label className={labelClass}>Notas generales</label>
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} placeholder="Notas de la operación visibles para todos en el expediente. Quedan como primera entrada de la bitácora." className={`${inputClass} resize-none`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelClass}>Comentario para gestoría</label><textarea value={comentarioGestoria} onChange={(e) => setComentarioGestoria(e.target.value)} rows={2} placeholder="Transferencia, documentación, condiciones especiales..." className={`${inputClass} resize-none`} /></div>
            <div><label className={labelClass}>Comentario para finanzas</label><textarea value={comentarioFinanzas} onChange={(e) => setComentarioFinanzas(e.target.value)} rows={2} placeholder="Forma de pago al propietario, plazos, retenciones..." className={`${inputClass} resize-none`} /></div>
          </div>

          <TituloPaso id="pago" n={nPaso("pago")} titulo="Forma de pago" icono={Wallet} />
              <div>
                <p className={seccionClass}>Desglose de forma de pago</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div><label className={labelClass}>En efectivo $ (ARS)</label><input type="number" value={pagoEfectivoArs} onChange={(e) => setPagoEfectivoArs(e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>En efectivo u$s</label><input type="number" value={pagoEfectivoUsd} onChange={(e) => setPagoEfectivoUsd(e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>Tipo de cambio</label><input type="number" value={tipoCambio} onChange={(e) => setTipoCambio(e.target.value)} className={inputClass} /></div>
                </div>
                {(!!pagoEfectivoArs || !!pagoEfectivoUsd) && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    {!!pagoEfectivoArs && (
                      <div>
                        <label className={labelClass}>Caja destino (ARS) *</label>
                        <select value={pagoEfectivoArsCuentaId} onChange={(e) => setPagoEfectivoArsCuentaId(e.target.value)} className={inputClass}>
                          <option value="">— elegir —</option>
                          {cuentas.filter((c) => c.moneda === "ARS").map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                      </div>
                    )}
                    {!!pagoEfectivoUsd && (
                      <div>
                        <label className={labelClass}>Caja destino (USD) *</label>
                        <select value={pagoEfectivoUsdCuentaId} onChange={(e) => setPagoEfectivoUsdCuentaId(e.target.value)} className={inputClass}>
                          <option value="">— elegir —</option>
                          {cuentas.filter((c) => c.moneda === "USD").map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className={`rounded-xl border px-4 py-3 text-xs ${ventaCubierta(cuentaVenta.remanente) ? "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10" : "border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10"}`}>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-600 dark:text-slate-300">
                  <span>Total <strong>{fmtVenta(cuentaVenta.total)}</strong></span>
                  <span>Saldo a abonar <strong>{fmtVenta(cuentaVenta.saldo)}</strong></span>
                  {cuentaVenta.enCuotas > 0 && <span>En cuotas <strong>{fmtVenta(cuentaVenta.enCuotas)}</strong></span>}
                </div>
                <p className={`mt-1 text-sm font-bold ${ventaCubierta(cuentaVenta.remanente) ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>
                  Remanente {fmtVenta(cuentaVenta.remanente)}{ventaCubierta(cuentaVenta.remanente) ? " · listo para imprimir el boleto" : cuentaVenta.remanente > 0 ? " · falta cubrir; el boleto no se imprime hasta que dé $ 0" : " · se cargó de más; revisá los montos"}
                </p>
              </div>

              <TituloPaso id="entrega" n={nPaso("entrega")} titulo="Entrega y documentos" icono={PackageCheck} />
              <div>
                <p className={seccionClass}>Items que se entregan con el vehículo</p>
                <p className="text-[10px] text-slate-400 mb-2">Marcá los que correspondan al cargar la operación. Sirve para el checklist de entrega y como conformidad para el comprador.</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[["Tuerca de seguridad", entregaTuerca, setEntregaTuerca, "si corresponde"], ["Duplicado de llave", entregaLlave, setEntregaLlave, ""], ["Manuales", entregaManuales, setEntregaManuales, ""], ["Cédula", entregaCedula, setEntregaCedula, ""]].map(([label, val, setter, hint]: any) => (
                    <label key={label} className="flex flex-col items-start gap-1 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 cursor-pointer">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200"><input type="checkbox" checked={val} onChange={(e) => setter(e.target.checked)} className="w-3.5 h-3.5 accent-[#0145F2]" /> {label}</span>
                      {hint && <span className="text-[9px] text-slate-400 ml-5">{hint}</span>}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className={seccionClass}>Documentos para el expediente</p>
                <p className="text-[10px] text-slate-400 mb-2">Podés adjuntar los archivos ahora o subirlos después desde el expediente. Máx. 15 MB por archivo.</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[["DNI Frente", "dni_frente"], ["DNI Dorso", "dni_dorso"], ["Cédula Verde Frente", "cedula_verde_frente"], ["Cédula Verde Dorso", "cedula_verde_dorso"]].map(([label, tipo]) => (
                    <div key={tipo} className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border border-dashed border-slate-200 dark:border-white/10 text-center">
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">{label}</span>
                      <label className="text-[10px] font-bold text-[#0145F2] cursor-pointer truncate max-w-full px-1">
                        {docsComprador[tipo] ? `✓ ${docsComprador[tipo]!.name}` : "Adjuntar"}
                        <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setDocsComprador((prev) => ({ ...prev, [tipo]: e.target.files?.[0] || null }))} />
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelClass}>Fecha de entrega</label>
                <input type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} className={inputClass} />
              </div>

          {esEdicion && (
            <>
              <TituloPaso id="postventa" n={nPaso("postventa")} titulo="Post-venta" icono={Bell} />
              <div>
                <p className={seccionClass}><Bell className="w-3 h-3 inline -mt-0.5" /> Recordatorios post-venta</p>
                {recordatorios.length === 0 && recordatoriosNuevos.length === 0 ? (
                  <div className="text-center py-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10">
                    <Bell className="w-5 h-5 mx-auto text-slate-300 dark:text-slate-600" />
                    <p className="text-xs text-slate-400 mt-1">Sin recordatorios para esta venta.</p>
                    <button type="button" onClick={generarRecordatoriosAutomaticos} className="mt-2 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 text-xs font-bold">Generar recordatorios automáticos</button>
                  </div>
                ) : (
                  <div className="space-y-1.5 mb-2">
                    {recordatorios.map((r) => (
                      <div key={r.id} className="flex items-center justify-between bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-lg px-3 py-2">
                        <span className="text-xs text-slate-700 dark:text-slate-200">{TIPOS_RECORDATORIO.find((t) => t.value === r.tipo)?.label || r.tipo}</span>
                        <span className="text-[10px] text-slate-400">{fmtFechaLocal(r.fecha_vencimiento)}</span>
                      </div>
                    ))}
                    {recordatoriosNuevos.map((r, i) => (
                      <div key={i} className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-lg px-3 py-2">
                        <span className="text-xs text-indigo-700 dark:text-indigo-300">{TIPOS_RECORDATORIO.find((t) => t.value === r.tipo)?.label || r.tipo} <span className="text-[10px] text-indigo-400">(sin guardar)</span></span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-indigo-400">{fmtFechaLocal(r.fecha)}</span>
                          <button type="button" onClick={() => quitarRecordatorioNuevo(i)} className="text-indigo-300 hover:text-rose-500"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl p-3 mt-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Agregar recordatorio</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className={labelClass}>Tipo</label>
                      <select value={rTipo} onChange={(e) => setRTipo(e.target.value)} className={inputClass}>
                        {TIPOS_RECORDATORIO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Fecha</label>
                      <input type="date" value={rFecha} onChange={(e) => setRFecha(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Notas (opcional)</label>
                      <input value={rNotas} onChange={(e) => setRNotas(e.target.value)} placeholder="Aclaración..." className={inputClass} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <button type="button" onClick={agregarRecordatorio} disabled={!rFecha} className="px-3 py-1.5 rounded-lg bg-[#0145F2] hover:bg-[#0138c9] text-white text-xs font-bold disabled:opacity-50">+ Agregar</button>
                    {(recordatorios.length > 0 || recordatoriosNuevos.length > 0) && <button type="button" onClick={generarRecordatoriosAutomaticos} className="text-xs font-bold text-indigo-600 dark:text-indigo-300">Generar recordatorios automáticos</button>}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5">Los cambios en recordatorios se guardan al apretar "Guardar cambios".</p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className={seccionClass}><Star className="w-3 h-3 inline -mt-0.5" /> Calificación del cliente</p>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${calificacionPedida ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-slate-100 dark:bg-white/10 text-slate-500"}`}>{calificacionPedida ? "Pedida" : "Sin pedir aún"}</span>
                </div>
                <label className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 cursor-pointer">
                  <input type="checkbox" checked={calificacionPedida} onChange={(e) => setCalificacionPedida(e.target.checked)} className="w-4 h-4 mt-0.5 accent-rose-600" />
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400">Se le pidió calificación al cliente (google review / encuesta NPS / formulario interno).</span>
                </label>
              </div>
            </>
          )}

          {error && <p className="text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-500/10 rounded-lg px-3 py-2">{error}</p>}
        </div>

        {!esEdicion && precioNum > 0 && (
          <div className="flex flex-wrap items-end gap-x-5 gap-y-2 px-6 py-2.5 border-t border-slate-100 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.02] shrink-0">
            {([["Precio", precioNum], ["Señas", resumenSenas], ["Permuta", resumenPermutas], ["Efectivo", resumenEfectivo], ["Financiera", resumenFinanciera]] as [string, number][])
              .filter(([l, v]) => l === "Precio" || v > 0)
              .map(([l, v]) => (
                <div key={l}>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{l}</p>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">{l === "Precio" ? "" : "− "}{fmtResumen(v)}</p>
                </div>
              ))}
            <div className="ml-auto text-right">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{resumenResta < 0 ? "Pagado de más" : metodoPago === "Financiado" && Number(cuotasPlazo) > 0 ? `Saldo en ${cuotasPlazo} cuotas` : "Resta cobrar"}</p>
              <p className={`text-sm font-black whitespace-nowrap ${resumenResta < 0 ? "text-rose-600 dark:text-rose-400" : resumenResta === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-white"}`}>{fmtResumen(Math.abs(resumenResta))}</p>
            </div>
            {faltaTipoCambio && <p className="w-full text-[10px] text-amber-700 dark:text-amber-300">Hay montos en otra moneda: cargá el tipo de cambio en “Desglose de forma de pago” para que el resumen los cuente.</p>}
          </div>
        )}

        <div className="flex gap-2 p-6 pt-3 border-t border-slate-100 dark:border-white/10 shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-semibold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 rounded-xl">Cancelar</button>
          {!esEdicion && !cargaManual && <button type="button" onClick={() => guardar(true)} disabled={guardando} className="flex-1 py-2.5 flex items-center justify-center gap-2 text-sm font-semibold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 rounded-xl disabled:opacity-50"><Save className="w-4 h-4" /> Guardar borrador</button>}
          <button type="button" onClick={() => guardar(false)} disabled={guardando} className="flex-1 py-2.5 flex items-center justify-center gap-2 text-sm font-bold bg-[#0145F2] hover:bg-[#0138c9] text-white rounded-xl disabled:opacity-50">
            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> {esEdicion ? "Guardar cambios" : "Crear venta"}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// Los títulos de esta pantalla usan el prefijo "venta" (los ids de DOM que ya
// tenía), así los 7 usos de arriba quedan iguales.
function TituloPaso(props: Omit<Parameters<typeof TituloPasoBase>[0], "prefijo">) {
  return <TituloPasoBase prefijo="venta" {...props} />;
}
