"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase2 } from "@/lib/supabase/client";
import { SEXOS_CLIENTE, faltaEnClienteSena } from "@/lib/panel/datosClienteSena";
import { notificarEncargados } from "@/lib/panel/notificaciones";
import { generarCodigoPublico } from "@/lib/generarCodigoPublico";
import { Wallet, Save, Upload, Loader2, X, UserRound, Banknote, Landmark, ClipboardList } from "lucide-react";
import { usePasosFormulario, BarraPasos, TituloPaso as TituloPasoBase, type PasoFormulario } from "@/components/panel/formulario/PasosFormulario";
import ClienteBuscador, { ClienteSeleccionado } from "@/components/panel/ClienteBuscador";
import VehiculoSelector, { VehiculoDatos } from "@/components/panel/VehiculoSelector";
import ConfirmarPrecioModal from "@/components/panel/ConfirmarPrecioModal";
import { simboloMoneda, type Moneda } from "@/lib/moneda";
import { calcularSaldoSena, faltaCotizacionSena, type DatosSaldoSena } from "@/lib/panel/saldoSena";
import { confirmar, avisar } from "@/components/panel/Dialogos";
import { hoyLocalISO } from "@/lib/panel/fechas";
import { formularioDesdeSena } from "@/lib/panel/formularioSena";
import SelectorWeb from "@/components/ui/SelectorWeb";

const inputClass = "w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#0145F2] focus:bg-white dark:focus:bg-white/10 transition-colors text-slate-900 dark:text-white placeholder:text-slate-400";
const labelClass = "text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1";

export interface SenaPrefill {
  nombre: string; telefono: string; vehiculoId: string | null;
}

/** Cliente de una seña ya guardada: el de la lista si está; si no, los datos que quedaron en la seña. */
function clienteDeSena(s: any, clientes: any[]): ClienteSeleccionado | null {
  const deLista = s.cliente_id ? clientes.find((c) => c.id === s.cliente_id) : null;
  if (deLista) return deLista;
  if (!s.cliente_id) return null;
  return {
    id: s.cliente_id, nombre: s.nombre || s.cliente_nombre || "", apellido: s.apellido ?? null, dni_cuit: s.dni ?? null, cuit_cuil: s.cuit_cuil ?? null,
    telefono: s.telefono_celular ?? null, telefono_linea: s.telefono_linea ?? null, email: s.correo_electronico ?? null, calle: s.calle ?? null,
    numero_calle: s.numero_calle ?? null, depto: s.depto ?? null, localidad: s.localidad ?? null, codigo_postal: s.codigo_postal ?? null,
    provincia: s.provincia ?? null, estado_civil: s.estado_civil ?? null, profesion: s.profesion ?? null, fecha_nacimiento: s.fecha_nacimiento ?? null, sexo: null,
  };
}

/** Auto de una seña ya guardada, con los datos que quedaron en la seña. */
function vehiculoDeSena(s: any): VehiculoDatos {
  const t = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  return {
    vehiculo_id: s.vehiculo_id ?? null, dominio: t(s.dominio), segmento: t(s.segmento), marca: t(s.marca), modelo: t(s.modelo), tipo: t(s.tipo),
    marca_motor: t(s.marca_motor), numero_motor: t(s.numero_motor), marca_chasis: t(s.marca_chasis), numero_chasis: t(s.numero_chasis),
    modelo_anio: t(s.modelo_anio), color: t(s.color), kilometros: "", combustible: "", transmision: "", traccion: "",
    precio_publicado_ars: null, precio_publicado_usd: null, precio_venta: null, moneda_venta: null,
  } as VehiculoDatos;
}

// Walter, 20/10/2026: editar una seña abre este mismo formulario (antes "Editar seña" era otro, con la mitad de los
// campos). Con `editar` se cargan los datos de esa seña y al guardar se corrige la misma fila. No se cambian desde acá
// el auto (habría que liberar uno y señar otro) ni la cuenta donde entró la plata (ese cobro ya está en la caja).
export default function NuevaSenaModal({
  clientes, vehiculos, vendedores, sucursales, cuentas, initial, onClose, editar, onGuardado,
}: { clientes: any[]; vehiculos: any[]; vendedores: any[]; sucursales: any[]; cuentas: any[]; initial?: SenaPrefill | null; onClose: () => void;
  editar?: any; onGuardado?: (s: any) => void }) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const esEdicion = !!editar;
  const [ini] = useState(() => (editar ? formularioDesdeSena(editar) : null));

  const [cliente, setClienteElegido] = useState<ClienteSeleccionado | null>(() => (editar ? clienteDeSena(editar, clientes) : null));
  // Obligatorios para la seña (19/10/2026): se completan acá si la ficha del cliente no los tiene, y se guardan en la ficha.
  const [fechaNacCliente, setFechaNacCliente] = useState(() => (editar ? (cliente?.fecha_nacimiento?.slice(0, 10) || ini?.fechaNacimiento || "") : ""));
  const [sexoCliente, setSexoCliente] = useState(() => (editar ? cliente?.sexo || "" : ""));
  const setCliente = (c: ClienteSeleccionado | null) => {
    setClienteElegido(c);
    setFechaNacCliente(c?.fecha_nacimiento?.slice(0, 10) || "");
    setSexoCliente(c?.sexo || "");
  };
  const [vehiculo, setVehiculo] = useState<VehiculoDatos | null>(() => (editar ? vehiculoDeSena(editar) : null));

  // Precarga desde un lead (botón "Seña" en LeadDetailModal.tsx) -- el
  // nombre/teléfono se le pasan a ClienteBuscador como punto de partida
  // para un cliente nuevo, y si el lead tenía un auto de interés puntual
  // (y sigue disponible) se selecciona directo.
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
  const [sucursalId, setSucursalId] = useState(ini?.sucursalId ?? "");
  const [vendedorId, setVendedorId] = useState(ini?.vendedorId ?? "");
  // Venta, seña y efectivo: un solo monto y su moneda (Walter, 19/10/2026). Las columnas _ars/_usd de la base siguen
  // igual y se derivan de acá, así el resto (recibo, venta, Tesorería) no cambia.
  const [ventaValor, setVentaValor] = useState(ini?.ventaValor ?? "");
  const [monedaVenta, setMonedaVenta] = useState<Moneda>(ini?.monedaVenta ?? "ARS");
  const [senaValor, setSenaValor] = useState(ini?.senaValor ?? "");
  const [monedaSena, setMonedaSena] = useState<Moneda>(ini?.monedaSena ?? "ARS");
  const ventaArs = monedaVenta === "ARS" ? ventaValor : "";
  const ventaUsd = monedaVenta === "USD" ? ventaValor : "";
  const senaArs = monedaSena === "ARS" ? senaValor : "";
  const senaUsd = monedaSena === "USD" ? senaValor : "";
  const [tipoCambio, setTipoCambio] = useState(ini?.tipoCambio ?? "");
  const [patentTransf, setPatentTransf] = useState(ini?.patentValor ?? "");
  const [monedaPatent, setMonedaPatent] = useState<Moneda>(ini?.monedaPatent ?? "ARS");
  const [patentIncluido, setPatentIncluido] = useState(ini?.patentIncluido ?? false);
  const [observaciones, setObservaciones] = useState(ini?.observaciones ?? "");
  const [mostrarModalPrecio, setMostrarModalPrecio] = useState(false);
  const [miId, setMiId] = useState<string | null>(null);

  const [cuentaId, setCuentaId] = useState("");
  const [comprobanteUrl, setComprobanteUrl] = useState("");
  const [subiendoComprobante, setSubiendoComprobante] = useState(false);
  const cuentaSeleccionada = cuentas.find((c) => c.id === cuentaId);

  // Seña ($) y Seña (US$) son mutuamente excluyentes (uno deshabilita al
  // otro más abajo) -- antes el select de cuenta mostraba TODAS sin
  // filtrar, así que se podía elegir una cuenta USD habiendo cargado la
  // seña en ARS (o al revés): el cálculo de abajo (montoMovimiento) leía el
  // campo de la moneda de la cuenta, que quedaba vacío, y el ingreso se
  // saltaba en silencio -- la seña se cobraba de verdad pero nunca entraba
  // a Tesorería, sin ningún aviso. Ahora el desplegable solo ofrece cuentas
  // de la misma moneda que la seña cargada.
  const monedaSenaElegida: "ARS" | "USD" | null = senaArs ? "ARS" : senaUsd ? "USD" : null;
  const cuentasParaSena = monedaSenaElegida ? cuentas.filter((c) => c.moneda === monedaSenaElegida) : cuentas;

  // Si el usuario cambia de moneda de seña después de haber elegido una
  // cuenta (ej: tenía cargado US$ con una cuenta USD, y borra ese campo
  // para cargar $ en su lugar), la cuenta vieja deja de aparecer en el
  // desplegable filtrado pero seguía quedando seleccionada en el estado --
  // se resetea para no arrastrar una cuenta de la moneda equivocada.
  useEffect(() => {
    if (cuentaId && !cuentasParaSena.some((c) => c.id === cuentaId)) setCuentaId("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monedaSenaElegida]);

  const subirComprobante = async (file: File) => {
    setSubiendoComprobante(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("carpeta", "comprobantes");
      const res = await fetch("/api/panel/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo subir el comprobante.");
      setComprobanteUrl(data.publicUrl);
    } catch {
      avisar("No se pudo subir el comprobante.");
    } finally {
      setSubiendoComprobante(false);
    }
  };

  const [efectivoValor, setEfectivoValor] = useState(ini?.efectivoValor ?? "");
  const [monedaEfectivo, setMonedaEfectivo] = useState<Moneda>(ini?.monedaEfectivo ?? "ARS");
  const efectivoArs = monedaEfectivo === "ARS" ? efectivoValor : "";
  const efectivoUsd = monedaEfectivo === "USD" ? efectivoValor : "";
  const [recibePermuta, setRecibePermuta] = useState(ini?.recibePermuta ?? false);
  // Secciones opcionales: se abren solo si se tildan (al destildar se borran sus datos para no guardarlos).
  const [hayPrenda, setHayPrenda] = useState(ini?.hayPrenda ?? false);
  const [contrataSeguro, setContrataSeguro] = useState(ini?.contrataSeguro ?? false);
  const [pagaEnCuotas, setPagaEnCuotas] = useState(ini?.pagaEnCuotas ?? false);
  const [vehiculoPermuta, setVehiculoPermuta] = useState<VehiculoDatos | null>(null);
  const [permutaTasadoArs, setPermutaTasadoArs] = useState(ini?.permutaTasado ?? "");
  const [fechaPrimeraCuotaRemanente, setFechaPrimeraCuotaRemanente] = useState(ini?.fechaPrimeraCuota ?? "");
  const [cantCuotasRemanente, setCantCuotasRemanente] = useState(ini?.cantCuotas ?? "");
  const [cuotaRemanenteArs, setCuotaRemanenteArs] = useState(ini?.cuotaRemanente ?? "");

  const [bancoPrenda, setBancoPrenda] = useState(ini?.bancoPrenda ?? "");
  const [prendaMonto, setPrendaMonto] = useState(ini?.prendaMonto ?? ""); // real: lo que paga el banco y entra a la caja
  const [prendaExtra, setPrendaExtra] = useState(ini?.prendaExtra ?? false);
  const [prendaBoleto, setPrendaBoleto] = useState(ini?.prendaBoleto ?? ""); // solo para el boleto, si se marcó "Valor prenda extra"
  // Bancos de la prenda (Configuración → Empresa). Si la tabla todavía no existe, queda el texto libre de antes.
  const [bancosPrenda, setBancosPrenda] = useState<{ id: string; nombre: string }[] | null>(null);
  useEffect(() => {
    supabase2.from("bancos_prenda").select("id, nombre").eq("activo", true).order("nombre").then(({ data, error }) => setBancosPrenda(error ? null : data ?? []));
  }, []);
  const [cuotasPrenda, setCuotasPrenda] = useState(ini?.cuotasPrenda ?? "");
  const [cuotaPrendaArs, setCuotaPrendaArs] = useState(ini?.cuotaPrenda ?? "");
  const [seguroPrendaArs, setSeguroPrendaArs] = useState(ini?.seguroPrenda ?? "");

  const [seguroCompania, setSeguroCompania] = useState(ini?.seguroCompania ?? "");
  const [seguroImporte, setSeguroImporte] = useState(ini?.seguroImporte ?? "");

  // La venta puede pactarse en ARS o en USD (son campos excluyentes); todo lo
  // demás (seña, efectivo, prenda, patentamiento, permuta) se carga en su
  // propia moneda y hay que convertirlo a la moneda de la venta antes de
  // restarlo — sumar campos "_ars" únicamente dejaba en $0 cualquier pago
  // hecho en la moneda que no coincidía con la de la venta.
  const datosSaldo: DatosSaldoSena = {
    venta: ventaValor, monedaVenta, sena: { monto: senaValor, moneda: monedaSena }, tipoCambio,
    patentamiento: { monto: patentTransf, moneda: monedaPatent }, patentamientoIncluido: patentIncluido,
    prendaReal: prendaMonto, prendaBoleto: prendaExtra ? prendaBoleto : null,
    efectivo: [{ monto: efectivoValor, moneda: monedaEfectivo }], permutaTasado: permutaTasadoArs,
  };
  const { saldo: saldoCalculado, remanente: remanenteCalculado } = calcularSaldoSena(datosSaldo);
  const faltaTipoCambio = faltaCotizacionSena(datosSaldo);

  useEffect(() => {
    supabase2.auth.getUser().then(({ data }) => setMiId(data.user?.id || null));
  }, []);

  const vendedoresSinYo = vendedores.filter((v) => v.id !== miId && (v.roles?.includes("ventas") || v.roles?.includes("encargado")));

  useEffect(() => {
    if (esEdicion || !vehiculo?.vehiculo_id) return;
    // Limpia ambas antes de autocompletar -- si no, cambiar de un vehículo
    // en ARS a uno en USD (o viceversa) dejaba el valor viejo pisado en el
    // campo que ya no corresponde, violando "venta_ars/venta_usd mutuamente
    // excluyentes" (ver ARCHITECTURE.md) sin ninguna señal visual.
    setVentaValor("");
    // Mismo fallback que Presupuestos: "precio publicado" casi nunca se
    // carga, la mayoría del stock solo tiene precio_venta.
    if (vehiculo.precio_publicado_ars) { setVentaValor(String(vehiculo.precio_publicado_ars)); setMonedaVenta("ARS"); }
    else if (vehiculo.precio_publicado_usd) { setVentaValor(String(vehiculo.precio_publicado_usd)); setMonedaVenta("USD"); }
    else if (vehiculo.precio_venta) { setVentaValor(String(vehiculo.precio_venta)); setMonedaVenta(vehiculo.moneda_venta === "USD" ? "USD" : "ARS"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehiculo?.vehiculo_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliente) return void avisar("Elegí o cargá un cliente.");
    const faltaCliente = faltaEnClienteSena({ fechaNacimiento: fechaNacCliente, sexo: sexoCliente }, new Date().toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" }));
    if (faltaCliente) return void avisar(faltaCliente);
    if (!vehiculo || !vehiculo.marca || !vehiculo.modelo) return void avisar("Elegí o cargá el vehículo.");
    if (!sucursalId) return void avisar("Elegí la sucursal.");
    if (prendaExtra && !Number(prendaBoleto)) return void avisar("Marcaste \"Valor prenda extra\": cargá el valor de la prenda para el boleto.");
    if (faltaTipoCambio) return void avisar("Cargá el tipo de cambio: hay montos en una moneda distinta a la de la venta.");
    // Sin cuenta destino la seña queda en el módulo pero no entra a Tesorería
    // -- la venta que la use después la va a restar del saldo igual.
    if (esEdicion) return void guardarEdicion();
    if (!cuentaId && !(await confirmar({ titulo: "Sin cuenta destino", mensaje: "No elegiste cuenta destino: esta seña NO va a figurar como ingreso en Finanzas/Finanzas. ¿Guardar igual?", textoConfirmar: "Guardar igual" }))) return;
    setMostrarModalPrecio(true);
  };

  // Lo que se guarda igual al crear y al editar la seña (cliente, montos, prenda, seguro, cuotas).
  const datosSena = (yo: string | undefined) => ({
    sucursal_id: sucursalId,
    vendedor_id: vendedorId || yo,
    cliente_id: cliente?.id,
    cliente_nombre: `${cliente?.apellido || ""} ${cliente?.nombre || ""}`.trim(),
    dni: cliente?.dni_cuit,
    fecha_nacimiento: fechaNacCliente || null,
    apellido: cliente?.apellido,
    nombre: cliente?.nombre,
    calle: cliente?.calle,
    numero_calle: cliente?.numero_calle,
    depto: cliente?.depto,
    localidad: cliente?.localidad,
    codigo_postal: cliente?.codigo_postal,
    provincia: cliente?.provincia,
    telefono_linea: cliente?.telefono_linea,
    telefono_celular: cliente?.telefono,
    correo_electronico: cliente?.email,
    cuit_cuil: cliente?.cuit_cuil,
    estado_civil: cliente?.estado_civil,
    profesion: cliente?.profesion,
    venta_ars: ventaArs ? Number(ventaArs) : null,
    venta_usd: ventaUsd ? Number(ventaUsd) : null,
    sena_ars: senaArs ? Number(senaArs) : null,
    sena_usd: senaUsd ? Number(senaUsd) : null,
    monto: senaArs ? Number(senaArs) : (senaUsd ? Number(senaUsd) : null),
    moneda: senaUsd && !senaArs ? "USD" : "ARS",
    tipo_cambio: tipoCambio ? Number(tipoCambio) : null,
    patentamiento_transferencia_ars: patentTransf && monedaPatent === "ARS" ? Number(patentTransf) : null,
    patentamiento_transferencia_usd: patentTransf && monedaPatent === "USD" ? Number(patentTransf) : null,
    patentamiento_incluido: patentIncluido,
    banco_prenda: bancoPrenda || null,
    prenda_monto: prendaMonto ? Number(prendaMonto) : null,
    prenda_monto_boleto: prendaExtra && prendaBoleto ? Number(prendaBoleto) : null,
    cant_cuotas_prenda: cuotasPrenda ? Number(cuotasPrenda) : null,
    cuota_prenda_ars: cuotaPrendaArs ? Number(cuotaPrendaArs) : null,
    seguro_prenda_ars: seguroPrendaArs ? Number(seguroPrendaArs) : null,
    saldo_abonar_ars: saldoCalculado,
    seguro_compania: seguroCompania || null,
    seguro_importe_mensual: seguroImporte ? Number(seguroImporte) : null,
    notas: observaciones || null,
    efectivo_ars: efectivoArs ? Number(efectivoArs) : null,
    efectivo_usd: efectivoUsd ? Number(efectivoUsd) : null,
    permuta_vehiculo_id: recibePermuta ? vehiculoPermuta?.vehiculo_id || (esEdicion ? editar.permuta_vehiculo_id ?? null : null) : null,
    permuta_tasado_ars: recibePermuta && permutaTasadoArs ? Number(permutaTasadoArs) : null,
    remanente_ars: remanenteCalculado,
    fecha_primera_cuota_remanente: fechaPrimeraCuotaRemanente || null,
    cant_cuotas_remanente: cantCuotasRemanente ? Number(cantCuotasRemanente) : null,
    cuota_remanente_ars: cuotaRemanenteArs ? Number(cuotaRemanenteArs) : null,
  });
  const datosVehiculoSena = () => ({
    vehiculo_id: vehiculo?.vehiculo_id,
    dominio: vehiculo?.dominio,
    segmento: vehiculo?.segmento,
    marca: vehiculo?.marca,
    modelo: vehiculo?.modelo,
    tipo: vehiculo?.tipo,
    marca_motor: vehiculo?.marca_motor,
    numero_motor: vehiculo?.numero_motor,
    marca_chasis: vehiculo?.marca_chasis,
    numero_chasis: vehiculo?.numero_chasis,
    modelo_anio: vehiculo?.modelo_anio ? Number(vehiculo.modelo_anio) : null,
    color: vehiculo?.color,
  });

  const completarFichaCliente = async () => {
    if (!cliente) return;
    if (fechaNacCliente !== (cliente.fecha_nacimiento?.slice(0, 10) || "") || sexoCliente !== (cliente.sexo || "")) {
      const { error: errCliente } = await supabase2.from("clientes").update({ fecha_nacimiento: fechaNacCliente, sexo: sexoCliente }).eq("id", cliente.id);
      if (errCliente) console.error("[seña] no se pudo completar la ficha del cliente:", errCliente.message);
    }
  };

  // Editar: corrige la misma seña. El auto, la cuenta y el estado no se tocan; queda anotado en historial_cambios.
  const guardarEdicion = async () => {
    setGuardando(true);
    try {
      const { data: { user } } = await supabase2.auth.getUser();
      await completarFichaCliente();
      const { data, error } = await supabase2.from("senas").update(datosSena(editar.vendedor_id || user?.id)).eq("id", editar.id)
        .select("*, perfiles:vendedor_id ( nombre ), sucursales:sucursal_id ( nombre )").single();
      if (error) throw error;
      onGuardado?.(data);
      onClose();
    } catch (err: any) {
      avisar(`No se pudo guardar el cambio: ${err?.message || "error desconocido"}.`);
    } finally {
      setGuardando(false);
    }
  };

  const guardarSena = async (precioConfirmado: boolean) => {
    if (!cliente || !vehiculo) return;
    setMostrarModalPrecio(false);
    setGuardando(true);
    try {
      const { data: { user } } = await supabase2.auth.getUser();
      await completarFichaCliente();
      // El número lo asigna la base (secuencia real, sin condición de
      // carrera) — antes se calculaba acá con select max(numero)+1, y dos
      // señas creadas cerca en el tiempo podían terminar con el mismo número.
      const codigoSeguimiento = generarCodigoPublico();

      const { data, error } = await supabase2.from("senas").insert({
        codigo_seguimiento: codigoSeguimiento,
        etapa_seguimiento: "Activa",
        fecha: hoyLocalISO(),
        estado: "Activa",
        ...datosVehiculoSena(),
        ...datosSena(user?.id),
        precio_confirmado: precioConfirmado,
        cuenta_id: cuentaId || null,
        comprobante_url: comprobanteUrl || null,
      }).select("id, numero").single();

      if (error) throw error;

      if (vehiculo.vehiculo_id) {
        const { error: errRes } = await supabase2.from("vehiculos").update({ estado: "señado" }).eq("id", vehiculo.vehiculo_id);
        if (errRes) avisar("La seña se guardó, pero no se pudo marcar el auto como Señado. Avisá a un encargado.");
      }

      if (!precioConfirmado) {
        // ventaArs/ventaUsd son mutuamente excluyentes -- armar el texto
        // solo con ventaArs mostraba "$0" cuando la venta estaba pactada en
        // USD, justo en el aviso pensado para que un encargado revise un
        // precio sospechoso.
        const precioTextoAviso = Number(ventaUsd) > 0 ? `US$ ${Number(ventaUsd).toLocaleString("en-US")}` : `$${(Number(ventaArs) || 0).toLocaleString("es-AR")}`;
        await notificarEncargados(
          supabase2,
          `${cliente.nombre} ${cliente.apellido || ""} — Seña N° ${data.numero}: el vendedor no confirmó el precio (${precioTextoAviso}). Verificalo.`,
          `/panel/senas/imprimir/${data.id}`,
          "precio_a_confirmar",
          sucursalId,
          "media",
          { modulo: "senas" }
        );
      }

      if (cuentaId) {
        const montoMovimiento = cuentaSeleccionada?.moneda === "USD" ? Number(senaUsd) || 0 : Number(senaArs) || 0;
        if (montoMovimiento === 0) {
          // Red de seguridad -- el select ya filtra por moneda (ver
          // cuentasParaSena), así que esto no debería poder pasar, pero si
          // pasa igual (ej: la seña se borró justo antes de guardar) mejor
          // avisar fuerte que dejarlo pasar en silencio como plata cobrada
          // que nunca entró a Tesorería.
          avisar(`La seña se guardó, pero no se registró el cobro en Finanzas: la cuenta elegida es en ${cuentaSeleccionada?.moneda} y no cargaste un monto en esa moneda. Cargalo a mano.`);
        } else {
          // Antes esto insertaba directo en movimientos_caja: quedaba en
          // estado "pendiente" por default de columna y no había forma de
          // aprobarlo en ningún lado de panel — plata cobrada de verdad
          // que desaparecía para siempre de Finanzas. Ahora pasa por el RPC
          // (mismo motor que usa Finanzas), que la deja "aprobada" al toque
          // por ser un ingreso, y solo después completamos los campos
          // descriptivos que el RPC no conoce.
          const { data: movId, error: errorMov } = await supabase2.rpc("registrar_movimiento_caja", {
            p_tipo: "ingreso", p_monto: montoMovimiento, p_cuenta_id: cuentaId, p_fecha: hoyLocalISO(),
            p_categoria: "Seña", p_forma_pago: "Transferencia", p_vehiculo_id: vehiculo.vehiculo_id || null, p_cliente_id: cliente.id,
            p_venta_id: null, p_observaciones: `Seña N° ${data.numero} — ${vehiculo.marca} ${vehiculo.modelo}`,
          });
          if (errorMov) {
            avisar("La seña se guardó, pero no se pudo registrar el cobro en Finanzas. Cargalo a mano.");
          } else {
            // Vía RPC (security definer): un UPDATE directo a movimientos_caja lo
            // rechaza RLS para vendedores (solo admin/encargado/finanzas) y lo
            // hacía en silencio -- el movimiento nunca quedaba vinculado a la seña.
            const { error: errorDatos } = await supabase2.rpc("completar_movimiento_caja", {
              p_movimiento_id: movId, p_sena_id: data.id, p_sucursal_id: sucursalId || null, p_cuit_dni: cliente.dni_cuit || null,
              p_telefono: cliente.telefono || null, p_patente: vehiculo.dominio || null, p_vendedor_id: vendedorId || user?.id || null,
              p_comprobante_url: comprobanteUrl || null,
            });
            if (errorDatos) {
              // El ingreso YA quedó registrado en Finanzas (el RPC de arriba
              // no falló) -- lo único que no se pudo completar es el vínculo
              // "sena_id" y los datos descriptivos. Sin avisar, EstadoSenaSelector
              // (que busca el movimiento por sena_id para poder revertirlo si
              // la seña se pierde) no lo iba a encontrar nunca.
              avisar(`La seña se guardó y el ingreso quedó registrado en Finanzas, pero no se pudo vincularlo a esta seña (${errorDatos.message}). Si más adelante se pierde, no se va a poder revertir el ingreso automáticamente -- avisá a Finanzas.`);
            }
          }
        }
      }

      onClose();
      router.push(`/panel/senas/imprimir/${data.id}`);
    } catch (err: any) {
      console.error(err);
      avisar(`Error al guardar la seña: ${err?.message || "error desconocido"}.`);
    } finally {
      setGuardando(false);
    }
  };

  // Índice de pasos: solo navegación dentro del formulario (ver
  // components/panel/formulario/PasosFormulario.tsx), no cambia qué se guarda.
  // Walter, 20/10/2026: mismo estilo que Cotizaciones; 4 pasos en vez de 7, sin recuadros con el título repetido, y
  // prenda, seguro y cuotas se abren solo si se tildan.
  const pasos: PasoFormulario[] = [
    { id: "cliente", label: "Cliente y auto", icono: UserRound },
    { id: "precio", label: "Precio y pago", icono: Banknote },
    { id: "financiacion", label: "Prenda y seguro", icono: Landmark },
    { id: "resumen", label: "Resumen", icono: ClipboardList },
  ];
  const { cuerpoRef, pasoActivo, nPaso, irAPaso, alScrollear } = usePasosFormulario(pasos, "sena");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !guardando && onClose()} />
      <div className="relative bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/10 w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex justify-between items-start p-6 pb-3 shrink-0">
          <div className="pr-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><Wallet className="w-5 h-5 text-[#0145F2]" /> {esEdicion ? `Editar seña${editar.numero ? ` N° ${editar.numero}` : ""}` : "Nueva seña"}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{esEdicion ? "Corregí lo que haga falta. Queda anotado quién lo cambió." : "Al guardar, el auto queda señado y se abre el recibo para imprimir o compartir."}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <BarraPasos pasos={pasos} activo={pasoActivo} onIr={irAPaso} />

        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div ref={cuerpoRef} onScroll={alScrollear} className="space-y-6 px-6 py-4 overflow-y-auto overflow-x-hidden flex-1 min-h-0 border-t border-slate-100 dark:border-white/10">
          <div>
            <TituloPaso id="cliente" n={nPaso("cliente")} titulo="Cliente y auto" icono={UserRound} primero />
            <div className="space-y-3 mt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Sucursal *</label>
                  <div className="w-full"><SelectorWeb valor={sucursalId} onCambio={setSucursalId} claseBoton={inputClass} opciones={[{ valor: "", etiqueta: "Seleccionar..." }, ...sucursales.map((s) => ({ valor: s.id, etiqueta: s.nombre }))]} /></div>
                </div>
                <div>
                  <label className={labelClass}>Vendedor</label>
                  <div className="w-full"><SelectorWeb valor={vendedorId} etiquetaActual={vendedorId === miId ? "Vos (usuario actual)" : vendedores.find((v) => v.id === vendedorId)?.nombre} onCambio={setVendedorId} claseBoton={inputClass} opciones={[{ valor: "", etiqueta: "Vos (usuario actual)" }, ...vendedoresSinYo.map((v) => ({ valor: v.id, etiqueta: v.nombre }))]} /></div>
                </div>
              </div>
              <div>
                <label className={labelClass}>Cliente *</label>
                <ClienteBuscador clientes={clientes} seleccionado={cliente} onSeleccionar={setCliente} prefillNuevo={initial ? { nombre: initial.nombre, telefono: initial.telefono } : null} />
              </div>
              {cliente && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={labelClass}>Fecha de nacimiento *</label><input type="date" className={inputClass} value={fechaNacCliente} onChange={(e) => setFechaNacCliente(e.target.value)} /></div>
                  <div><label className={labelClass}>Sexo *</label>
                    <div className="w-full"><SelectorWeb valor={sexoCliente} onCambio={setSexoCliente} claseBoton={inputClass} opciones={[{ valor: "", etiqueta: "Elegí" }, ...SEXOS_CLIENTE.map((s) => ({ valor: s, etiqueta: s }))]} /></div>
                  </div>
                </div>
              )}
              <div>
                <label className={labelClass}>Vehículo *</label>
                {esEdicion ? (
                  <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-2.5">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{[vehiculo?.marca, vehiculo?.modelo, vehiculo?.modelo_anio].filter(Boolean).join(" ")}{vehiculo?.dominio ? ` · ${vehiculo.dominio}` : ""}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">El auto no se cambia desde acá: si es otro, anulá esta seña y cargá una nueva.</p>
                  </div>
                ) : (
                  <VehiculoSelector vehiculos={vehiculos} datos={vehiculo} onCambiar={setVehiculo} persistirManual sucursalId={sucursalId} />
                )}
              </div>
            </div>
          </div>

          <div>
            <TituloPaso id="precio" n={nPaso("precio")} titulo="Precio y pago" icono={Banknote} />
            <div className="space-y-3 mt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <CampoMonto label="Precio de venta *" valor={ventaValor} onValor={setVentaValor} moneda={monedaVenta} onMoneda={setMonedaVenta} />
                <CampoMonto label="Seña *" valor={senaValor} onValor={setSenaValor} moneda={monedaSena} onMoneda={setMonedaSena} />
                <CampoMonto label="En efectivo" valor={efectivoValor} onValor={setEfectivoValor} moneda={monedaEfectivo} onMoneda={setMonedaEfectivo} />
                <div>
                  <CampoMonto label="Patentamiento / transferencia" valor={patentTransf} onValor={setPatentTransf} moneda={monedaPatent} onMoneda={setMonedaPatent} />
                  <label className="flex items-center gap-2 mt-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={patentIncluido} onChange={(e) => setPatentIncluido(e.target.checked)} className="w-4 h-4 accent-[#0145F2]" />
                    Incluido en el precio de venta
                  </label>
                </div>
              </div>
              {/* Siempre a la vista (Walter, 20/10/2026): con el rediseño solo aparecía con montos en pesos y en dólares, y en
                  una operación toda en dólares no había dónde cargar el dólar del día. Es obligatorio si se mezclan monedas. */}
              <div className="sm:max-w-[50%]">
                <label className={labelClass}>Tipo de cambio (pesos por dólar){faltaTipoCambio ? " *" : ""}</label>
                <input type="text" inputMode="decimal" className={inputClass} value={tipoCambio} onChange={(e) => setTipoCambio(e.target.value.replace(",", ".").replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1"))} placeholder="Ej: 1450" />
                <p className={`text-[10px] mt-1 ${faltaTipoCambio ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-slate-400"}`}>
                  {faltaTipoCambio ? "Obligatorio: hay montos en pesos y en dólares; con esto se pasa todo a la moneda de la venta." : "El dólar del día de la operación. Queda guardado en la seña."}
                </p>
              </div>

              <Tilde activo={recibePermuta} onCambio={(v) => { setRecibePermuta(v); if (!v) { setVehiculoPermuta(null); setPermutaTasadoArs(""); } }} texto="Recibe un auto en permuta" />
              {recibePermuta && (
                <div className="pl-4 border-l-2 border-slate-200 dark:border-white/10 space-y-3">
                  <VehiculoSelector vehiculos={[]} datos={vehiculoPermuta} onCambiar={setVehiculoPermuta} persistirManual soloManual sucursalId={sucursalId} origen="Permuta" />
                  <div className="sm:max-w-[50%]"><label className={labelClass}>Tasado en ($)</label><input type="text" inputMode="numeric" className={inputClass} value={permutaTasadoArs} onChange={(e) => setPermutaTasadoArs(e.target.value.replace(/\D/g, ""))} placeholder="0" /></div>
                </div>
              )}

              {esEdicion ? (
                <p className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-lg px-3 py-2">
                  El cobro de la seña ya quedó registrado como estaba. Si cambiaste el monto de la seña, corregí también el movimiento en Finanzas.
                </p>
              ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Cuenta donde entra la seña</label>
                  <div className="w-full"><SelectorWeb valor={cuentaId} onCambio={setCuentaId} claseBoton={inputClass} opciones={[{ valor: "", etiqueta: "No registrar en Finanzas" }, ...cuentasParaSena.map((c) => ({ valor: c.id, etiqueta: `${c.nombre} (${c.moneda})` }))]} /></div>
                  <p className="text-[10px] text-slate-400 mt-1">{monedaSenaElegida ? "Si elegís una cuenta, el cobro entra al toque en Finanzas." : "Cargá la seña en $ o US$ para ver las cuentas de esa moneda."}</p>
                </div>
                {cuentaId && (
                  <div>
                    <label className={labelClass}>Comprobante</label>
                    <label className="flex items-center gap-2 bg-slate-50 dark:bg-white/5 border border-dashed border-slate-300 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                      {subiendoComprobante ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : <Upload className="w-4 h-4 text-slate-400" />}
                      <span className="text-slate-500 dark:text-slate-400 truncate">{comprobanteUrl ? "Comprobante cargado ✓" : subiendoComprobante ? "Subiendo..." : "Subir comprobante"}</span>
                      <input type="file" accept="image/*,.pdf" className="hidden" disabled={subiendoComprobante} onChange={(e) => e.target.files?.[0] && subirComprobante(e.target.files[0])} />
                    </label>
                  </div>
                )}
              </div>
              )}

              <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 dark:bg-white/5 px-4 py-3">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Remanente</span>
                <strong className="text-base font-black text-slate-900 dark:text-white">{simboloMoneda(monedaVenta)} {remanenteCalculado.toLocaleString("es-AR")}</strong>
              </div>
              {remanenteCalculado > 0 && (
                <>
                  <Tilde activo={pagaEnCuotas} onCambio={(v) => { setPagaEnCuotas(v); if (!v) { setFechaPrimeraCuotaRemanente(""); setCantCuotasRemanente(""); setCuotaRemanenteArs(""); } }} texto="Paga el remanente en cuotas" />
                  {pagaEnCuotas && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pl-4 border-l-2 border-slate-200 dark:border-white/10">
                      <div><label className={labelClass}>Fecha 1ª cuota</label><input type="date" className={inputClass} value={fechaPrimeraCuotaRemanente} onChange={(e) => setFechaPrimeraCuotaRemanente(e.target.value)} /></div>
                      <div><label className={labelClass}>Cantidad de cuotas</label><input type="number" className={inputClass} value={cantCuotasRemanente} onChange={(e) => setCantCuotasRemanente(e.target.value)} placeholder="0" /></div>
                      <div><label className={labelClass}>Cuota ($)</label><input type="text" inputMode="numeric" className={inputClass} value={cuotaRemanenteArs} onChange={(e) => setCuotaRemanenteArs(e.target.value.replace(/\D/g, ""))} placeholder="0" /></div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div>
            <TituloPaso id="financiacion" n={nPaso("financiacion")} titulo="Prenda y seguro" icono={Landmark} />
            <div className="space-y-3 mt-3">
              <Tilde activo={hayPrenda} onCambio={(v) => { setHayPrenda(v); if (!v) { setBancoPrenda(""); setCuotasPrenda(""); setCuotaPrendaArs(""); setSeguroPrendaArs(""); setPrendaMonto(""); setPrendaExtra(false); setPrendaBoleto(""); } }} texto="Hay prenda" />
              {hayPrenda && (
                <div className="space-y-3 pl-4 border-l-2 border-slate-200 dark:border-white/10">
                  <div>
                    <label className={labelClass}>Banco de la prenda</label>
                    {bancosPrenda && bancosPrenda.length > 0 ? (
                      <div className="w-full"><SelectorWeb valor={bancoPrenda} onCambio={setBancoPrenda} claseBoton={inputClass} opciones={[{ valor: "", etiqueta: "Elegí el banco" }, ...bancosPrenda.map((b) => ({ valor: b.nombre, etiqueta: b.nombre }))]} /></div>
                    ) : (
                      <input className={inputClass} placeholder="Banco de la prenda" value={bancoPrenda} onChange={(e) => setBancoPrenda(e.target.value)} />
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Monto real de la prenda ($)</label>
                      <input type="text" inputMode="numeric" className={inputClass} placeholder="0" value={prendaMonto} onChange={(e) => setPrendaMonto(e.target.value.replace(/\D/g, ""))} />
                      <p className="text-[10px] text-slate-400 mt-1">Lo que paga el banco: es lo que entra a la caja.</p>
                    </div>
                    <div><label className={labelClass}>Cantidad de cuotas</label><input type="number" className={inputClass} placeholder="0" value={cuotasPrenda} onChange={(e) => setCuotasPrenda(e.target.value)} /></div>
                    <div><label className={labelClass}>Cuota de la prenda ($)</label><input type="text" inputMode="numeric" className={inputClass} placeholder="0" value={cuotaPrendaArs} onChange={(e) => setCuotaPrendaArs(e.target.value.replace(/\D/g, ""))} /></div>
                    <div><label className={labelClass}>Seguro de la prenda ($)</label><input type="text" inputMode="numeric" className={inputClass} placeholder="0" value={seguroPrendaArs} onChange={(e) => setSeguroPrendaArs(e.target.value.replace(/\D/g, ""))} /></div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={prendaExtra} onChange={(e) => { setPrendaExtra(e.target.checked); if (!e.target.checked) setPrendaBoleto(""); }} className="w-4 h-4 accent-[#0145F2]" />
                    Valor prenda extra
                  </label>
                  {prendaExtra && (
                    <div className="pl-4 border-l-2 border-amber-300 dark:border-amber-500/40 sm:max-w-[60%]">
                      <label className={labelClass}>Valor de la prenda para el cliente / boleto ($)</label>
                      <input type="text" inputMode="numeric" className={inputClass} placeholder="0" value={prendaBoleto} onChange={(e) => setPrendaBoleto(e.target.value.replace(/\D/g, ""))} />
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">Solo para el boleto: el cliente ve este monto. La caja usa el real.</p>
                    </div>
                  )}
                </div>
              )}

              <Tilde activo={contrataSeguro} onCambio={(v) => { setContrataSeguro(v); if (!v) { setSeguroCompania(""); setSeguroImporte(""); } }} texto="Contrata seguro" />
              {contrataSeguro && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-4 border-l-2 border-slate-200 dark:border-white/10">
                  <div><label className={labelClass}>Compañía</label><input className={inputClass} value={seguroCompania} onChange={(e) => setSeguroCompania(e.target.value)} /></div>
                  <div><label className={labelClass}>Importe mensual ($)</label><input type="text" inputMode="numeric" className={inputClass} placeholder="0" value={seguroImporte} onChange={(e) => setSeguroImporte(e.target.value.replace(/\D/g, ""))} /></div>
                </div>
              )}
            </div>
          </div>

          <div>
            <TituloPaso id="resumen" n={nPaso("resumen")} titulo="Resumen" icono={ClipboardList} />
            <div className="space-y-3 mt-3">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-[#0145F2]/20 bg-[#0145F2]/5 dark:bg-[#0145F2]/10 px-4 py-3">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Saldo a abonar</span>
                <strong className="text-xl font-black text-slate-900 dark:text-white">{simboloMoneda(monedaVenta)} {saldoCalculado.toLocaleString("es-AR")}</strong>
              </div>
              {faltaTipoCambio && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">Hay montos en una moneda distinta a la de la venta ({monedaVenta}). Cargá el tipo de cambio para que el saldo sea correcto.</p>
              )}
              <div>
                <label className={labelClass}>Observaciones</label>
                <textarea className={inputClass} rows={3} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 p-6 pt-3 border-t border-slate-100 dark:border-white/10 shrink-0">
          <button type="button" onClick={onClose} disabled={guardando} className="px-4 py-2.5 text-sm font-semibold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 rounded-xl disabled:opacity-50">Cancelar</button>
          <button type="submit" disabled={guardando} className="flex-1 py-2.5 flex items-center justify-center gap-2 text-sm font-bold bg-[#0145F2] hover:bg-[#0138c9] text-white rounded-xl disabled:opacity-50">
            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {guardando ? "Guardando..." : esEdicion ? "Guardar cambios" : "Guardar seña"}
          </button>
        </div>
        </form>
      </div>

      {mostrarModalPrecio && (
        <ConfirmarPrecioModal
          precioTexto={`Venta ${Number(ventaUsd) > 0 ? `US$ ${Number(ventaUsd).toLocaleString("en-US")}` : `$ ${(Number(ventaArs) || 0).toLocaleString("es-AR")}`}${Number(senaUsd) > 0 ? ` · Seña US$ ${Number(senaUsd).toLocaleString("en-US")}` : senaArs ? ` · Seña $ ${Number(senaArs).toLocaleString("es-AR")}` : ""}`}
          onConfirmar={() => guardarSena(true)}
          onNoSeguro={() => guardarSena(false)}
          onCancelar={() => setMostrarModalPrecio(false)}
        />
      )}
    </div>
  );
}

// Prefijo "sena" para los ids de DOM de los títulos de sección.
function TituloPaso(props: Omit<Parameters<typeof TituloPasoBase>[0], "prefijo">) {
  return <TituloPasoBase prefijo="sena" {...props} />;
}

/** Un monto con su moneda al lado (venta, seña, efectivo). */
function CampoMonto({ label, valor, onValor, moneda, onMoneda }: { label: string; valor: string; onValor: (v: string) => void; moneda: Moneda; onMoneda: (m: Moneda) => void }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex gap-2">
        <div className="flex shrink-0 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden" role="group" aria-label={`Moneda de ${label.toLowerCase()}`}>
          {(["ARS", "USD"] as const).map((m) => (
            <button key={m} type="button" onClick={() => onMoneda(m)} aria-pressed={moneda === m}
              className={`px-3 text-sm font-black transition-colors ${moneda === m ? (m === "USD" ? "bg-emerald-600 text-white" : "bg-[#0145F2] text-white") : "bg-white dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/10"}`}>
              {simboloMoneda(m)}
            </button>
          ))}
        </div>
        <input type="text" inputMode="numeric" className={inputClass} value={valor} onChange={(e) => onValor(e.target.value.replace(/\D/g, ""))} placeholder="0" />
      </div>
    </div>
  );
}

/** Tilde que abre una parte opcional del formulario (permuta, cuotas, prenda, seguro). */
function Tilde({ activo, onCambio, texto }: { activo: boolean; onCambio: (v: boolean) => void; texto: string }) {
  return (
    <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer w-fit">
      <input type="checkbox" checked={activo} onChange={(e) => onCambio(e.target.checked)} className="w-4 h-4 accent-[#0145F2]" />
      {texto}
    </label>
  );
}
