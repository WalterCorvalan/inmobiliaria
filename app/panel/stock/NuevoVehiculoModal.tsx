"use client";

import { useEffect, useRef, useState } from "react";
import { ORIGENES_VEHICULO } from "@/lib/panel/origenesVehiculo";
import { supabase2 } from "@/lib/supabase/client";
import { X, Loader2, Maximize2, ScanLine, ClipboardPaste, ImagePlus, Upload, CheckCircle2, AlertTriangle, Camera, Car, Banknote, MapPin, UserRound, Wrench, Megaphone } from "lucide-react";
import { usePasosFormulario, BarraPasos, TituloPaso as TituloPasoBase, type PasoFormulario } from "@/components/panel/formulario/PasosFormulario";
import { crearAlerta } from "@/lib/panel/alertas";
import { esDeOtraSucursal, puedeTenerAutosAsignados, vendedoresAsignables } from "@/lib/panel/vendedoresAsignables";
import { Compartido } from "@/components/ui/movimiento";

export const MARCAS = ["Toyota", "Volkswagen", "Ford", "Chevrolet", "Renault", "Peugeot", "Fiat", "Honda", "Hyundai", "Nissan", "Jeep", "Citroën", "BMW", "Mercedes-Benz", "Audi", "Otra"];
const CATEGORIAS = ["Auto", "Pickup/Camioneta", "SUV", "Utilitario", "Moto", "Camión", "Camioneta", "Casa Rodante", "Ómnibus | Van"];
export const SEGMENTOS = [
  "Buses", "Cabriolet", "Coupe", "Familiar", "Monovolumen", "Otro", "Pickup", "Rural 5 Puertas",
  "Sedan 3p", "Sedan 4p", "Sedan 5p", "Todo Terreno | SUV", "Utilitarios", "Van | Mini-Van",
];
// vehiculos.combustible tiene un CHECK en la base -- exportado para que
// NuevaVentaModal.tsx (permutas) use el mismo listado en vez de un <input>
// de texto libre, mismo bug que ya se corrigió para "tipo" (ver
// ventas/ARCHITECTURE.md, 30/9).
export const COMBUSTIBLES = ["Nafta", "Diésel", "Gasoil", "GNC", "Híbrido", "Eléctrico"];
const PUERTAS = [2, 3, 4, 5];
const PLAZAS = [2, 3, 4, 5, 6, 7, 8, 9];
const ORIGENES = ORIGENES_VEHICULO;
const PROVINCIAS = [
  "Buenos Aires", "CABA", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes", "Entre Ríos", "Formosa", "Jujuy",
  "La Pampa", "La Rioja", "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz",
  "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán",
];
const ESTADOS = [
  { value: "disponible", label: "Disponible" },
  // Cargado pero sin mostrar en la web, el bot, MercadoLibre ni el catálogo de Meta hasta pasarlo a Disponible
  // (Walter, 27/10/2026: para dejar un auto cargado mientras faltan fotos o datos).
  { value: "en_preparacion", label: "En preparación" },
  { value: "señado", label: "Señado" },
  { value: "vendido", label: "Vendido" },
];

interface Perfil { id: string; nombre: string; sucursal_id?: string | null; roles?: string[] }
interface Cliente { id: string; nombre: string; telefono: string | null; dni_cuit: string | null }
interface Sucursal { id: string; nombre: string }

interface Props {
  perfiles: Perfil[];
  clientes: Cliente[];
  sucursales: Sucursal[];
  miId: string;
  editando?: any;
  soloFotos?: boolean;
  soyAdmin?: boolean;
  /** Solo en edición: abre la ficha completa del vehículo (entre Cancelar y Guardar). */
  onAbrirFicha?: () => void;
  onClose: () => void;
  onCreado: (v: any) => void;
}

export default function NuevoVehiculoModal({ perfiles, clientes, sucursales, miId, editando, soloFotos = false, soyAdmin = false, onAbrirFicha, onClose, onCreado }: Props) {
  // Un "editando" sin id es un prefill para alta nueva (ej: desde
  // Consignaciones, precarga propietario/marca pero crea un vehículo nuevo)
  // -- no confundir con edición real de un vehículo existente.
  const esEdicion = !!editando?.id;
  // "Vendedor asignado", "Consignado por" y "Publicado por": pueden los que tienen rol ventas o encargado, aunque
  // tengan otros roles (pedido de Walter 9/10/2026: permitir por rol, no bloquear gestoría; Gabriel es encargado y
  // gestoría). Se deja a quien ya estaba cargado para que el selector muestre el valor actual.
  const vendedores = vendedoresAsignables(perfiles, editando?.vendedor_asignado_id);
  const consignadores = vendedoresAsignables(perfiles, editando?.consignado_por);
  const publicadores = perfiles.filter((p) => puedeTenerAutosAsignados(p.roles) || (!!editando?.publicado_por && p.nombre === editando.publicado_por));
  const [categoria, setCategoria] = useState(editando?.categoria || "Auto");
  const [marca, setMarca] = useState(editando?.marca || "");
  const [modelo, setModelo] = useState(editando?.modelo || "");
  const [anio, setAnio] = useState(editando?.anio ? String(editando.anio) : String(new Date().getFullYear()));
  const [patente, setPatente] = useState(editando?.patente || "");
  const [color, setColor] = useState(editando?.color || "");
  // Kilómetros vacíos = no se sabe (no es 0 km). Un 0 cargado sí es 0 km (lib/vehiculos.ts, esCeroKm).
  const [km, setKm] = useState(editando?.km != null ? String(editando.km) : "");
  const [precioVenta, setPrecioVenta] = useState(editando?.precio_venta ? String(editando.precio_venta) : "");
  const [monedaVenta, setMonedaVenta] = useState(editando?.moneda_venta || "USD");
  const [precioCompra, setPrecioCompra] = useState(editando?.precio_compra ? String(editando.precio_compra) : "");
  const [monedaCompra, setMonedaCompra] = useState(editando?.moneda_compra || "USD");
  const [facturado, setFacturado] = useState(editando?.facturado || false);
  const [facturaImporte, setFacturaImporte] = useState(editando?.factura_importe ? String(editando.factura_importe) : "");
  const [facturaNumero, setFacturaNumero] = useState(editando?.factura_numero || "");
  const [facturaEmisor, setFacturaEmisor] = useState(editando?.factura_emisor || "");
  const [facturaArchivoUrl, setFacturaArchivoUrl] = useState(editando?.factura_archivo_url || "");
  const [subiendoFactura, setSubiendoFactura] = useState(false);
  const [estadoInicial, setEstadoInicial] = useState(editando?.estado || "disponible");
  const [ubicacion, setUbicacion] = useState(editando?.ubicacion || "");
  const [provincia, setProvincia] = useState(editando?.provincia || "");
  const [duenosAnteriores, setDuenosAnteriores] = useState(editando?.["dueños_anteriores"] ? String(editando["dueños_anteriores"]) : "1");
  const [propioAgencia, setPropioAgencia] = useState(editando?.propio_agencia || false);
  const [propietarioNombre, setPropietarioNombre] = useState(editando?.propietario_nombre || "");
  const [propietarioDni, setPropietarioDni] = useState(editando?.propietario_dni || "");
  const [clienteVinculadoId, setClienteVinculadoId] = useState(editando?.cliente_vinculado_id || "");
  const [propietarioTelefono, setPropietarioTelefono] = useState(editando?.propietario_telefono || "");
  const [propietarioEmail, setPropietarioEmail] = useState(editando?.propietario_email || "");
  const [consignadoPor, setConsignadoPor] = useState(editando?.consignado_por || "");
  const [combustible, setCombustible] = useState(editando?.combustible || "");
  const [transmision, setTransmision] = useState(editando?.transmision || "");
  const [carroceria, setCarroceria] = useState(editando?.carroceria || "");
  const [puertas, setPuertas] = useState(editando?.puertas ? String(editando.puertas) : "");
  const [origen, setOrigen] = useState(editando?.origen || "");
  const [motorCilindrada, setMotorCilindrada] = useState(editando?.motor_cilindrada || "");
  const [version, setVersion] = useState(editando?.version || "");
  const [manuales, setManuales] = useState(editando?.manuales || false);
  const [duplicadoLlaves, setDuplicadoLlaves] = useState(editando?.duplicado_llaves || false);
  const [serviciosOficiales, setServiciosOficiales] = useState(editando?.servicios_oficiales || false);
  const [publicadoMl, setPublicadoMl] = useState(editando?.publicado_ml || false);
  const [publicadoPor, setPublicadoPor] = useState(editando?.publicado_por || "");
  const [linkMl, setLinkMl] = useState(editando?.link_ml || "");
  const [mlError, setMlError] = useState<string | null>(editando?.ml_publicar_error || null);
  const [publicandoMl, setPublicandoMl] = useState(false);

  const publicarEnML = async () => {
    if (!editando?.id) return;
    setPublicandoMl(true);
    setMlError(null);
    try {
      const res = await fetch("/api/panel/ml/publicar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehiculoId: editando.id }),
      });
      const data = await res.json();
      if (!res.ok) { setMlError(data.error || "No se pudo publicar."); return; }
      setPublicadoMl(true);
      if (data.permalink) setLinkMl(data.permalink);
    } catch {
      setMlError("Error de red publicando en MercadoLibre.");
    } finally {
      setPublicandoMl(false);
    }
  };
  const [notas, setNotas] = useState(editando?.notas || "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  // Escaneo de la cédula verde (14/10/2026): la foto la lee la IA en /api/panel/ocr-cedula y completa lo que encuentre.
  const inputCedulaRef = useRef<HTMLInputElement>(null);
  const [leyendoCedula, setLeyendoCedula] = useState(false);
  const [avisoCedula, setAvisoCedula] = useState<{ ok: boolean; texto: string } | null>(null);
  // Arranca apagado (14/10/2026): lo prende un administrador en Configuración → Empresa → IA. Sin la columna (SQL sin
  // correr) queda apagado.
  const [cedulaActiva, setCedulaActiva] = useState(false);
  useEffect(() => {
    let vivo = true;
    supabase2.from("configuracion_empresa").select("ocr_cedula_activo").eq("id", true).maybeSingle()
      .then(({ data }) => { if (vivo) setCedulaActiva(!!data?.ocr_cedula_activo); });
    return () => { vivo = false; };
  }, []);

  const [fotos, setFotos] = useState<string[]>(editando?.fotos || []);
  const [subiendoFotos, setSubiendoFotos] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const subirFotos = async (files: FileList) => {
    setSubiendoFotos(true);
    try {
      const subidas: string[] = [];
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("carpeta", "vehiculos");
        const res = await fetch("/api/panel/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error subiendo la imagen");
        subidas.push(data.publicUrl);
      }
      setFotos((prev) => [...prev, ...subidas]);
    } catch (err: any) {
      setError(err?.message || "No se pudieron subir una o más fotos.");
    } finally {
      setSubiendoFotos(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const subirFactura = async (file: File) => {
    setSubiendoFactura(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("carpeta", "vehiculos");
      const res = await fetch("/api/panel/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error subiendo la factura");
      setFacturaArchivoUrl(data.publicUrl);
    } catch (err: any) {
      setError(err?.message || "No se pudo subir la factura.");
    } finally {
      setSubiendoFactura(false);
    }
  };

  const quitarFoto = (url: string) => setFotos((prev) => prev.filter((f) => f !== url));

  // Reordenar fotos tipo MercadoLibre: arrastrar un thumbnail reordena en
  // vivo (la primera foto sigue siendo la portada del catálogo/listado, ver
  // nota debajo de la grilla). dragOverIndex es solo visual (línea de
  // "soltar acá"), el reorden real pasa en dragOver para que se sienta
  // fluido mientras se arrastra, no recién al soltar.
  const [fotoArrastrada, setFotoArrastrada] = useState<number | null>(null);
  const [fotoSobre, setFotoSobre] = useState<number | null>(null);

  const moverFoto = (desde: number, hasta: number) => {
    if (desde === hasta) return;
    setFotos((prev) => {
      const copia = [...prev];
      const [movida] = copia.splice(desde, 1);
      copia.splice(hasta, 0, movida);
      return copia;
    });
  };

  const hacerPortada = (index: number) => moverFoto(index, 0);

  // Técnicos (sumados a v2 — v1 los tenía)
  const [segmento, setSegmento] = useState(editando?.segmento || "");
  const [traccion, setTraccion] = useState(editando?.traccion || "");
  const [potenciaCv, setPotenciaCv] = useState(editando?.potencia_cv ? String(editando.potencia_cv) : "");
  const [cantidadPlazas, setCantidadPlazas] = useState(editando?.cantidad_plazas ? String(editando.cantidad_plazas) : "");
  const [numeroMotor, setNumeroMotor] = useState(editando?.numero_motor || "");
  const [marcaMotor, setMarcaMotor] = useState(editando?.marca_motor || "");
  const [numeroChasis, setNumeroChasis] = useState(editando?.numero_chasis || "");
  const [marcaChasis, setMarcaChasis] = useState(editando?.marca_chasis || "");
  const [radicadoLocalidad, setRadicadoLocalidad] = useState(editando?.radicado_localidad || "");
  const [radicadoProvincia, setRadicadoProvincia] = useState(editando?.radicado_provincia || "");

  // Gestión comercial
  const [stockFisico, setStockFisico] = useState(editando?.stock_fisico ?? true);
  const [destacado, setDestacado] = useState(editando?.destacado || false);
  const [fechaCompra, setFechaCompra] = useState(editando?.fecha_compra || "");
  const [importePatenteAnual, setImportePatenteAnual] = useState(editando?.importe_patente_anual ? String(editando.importe_patente_anual) : "");
  const [sucursalId, setSucursalId] = useState(editando?.sucursal_id || "");
  const [vendedorAsignadoId, setVendedorAsignadoId] = useState(editando?.vendedor_asignado_id || "");

  // Proveedor / dueño anterior — datos extra (nombre/teléfono/email ya
  // estaban arriba, esto suma lo que faltaba de v1)
  const [propietarioApellido, setPropietarioApellido] = useState(editando?.propietario_apellido || "");
  const [propietarioFechaNacimiento, setPropietarioFechaNacimiento] = useState(editando?.propietario_fecha_nacimiento || "");
  const [propietarioCuitCuil, setPropietarioCuitCuil] = useState(editando?.propietario_cuit_cuil || "");
  const [propietarioCalle, setPropietarioCalle] = useState(editando?.propietario_calle || "");

  const leerCedula = async (archivo: File | undefined) => {
    if (!archivo) return;
    setLeyendoCedula(true);
    setAvisoCedula(null);
    try {
      const datos = new FormData();
      datos.append("file", archivo);
      const res = await fetch("/api/panel/ocr-cedula", { method: "POST", body: datos });
      const c = await res.json().catch(() => null);
      if (!res.ok || !c) { setAvisoCedula({ ok: false, texto: c?.error || "No se pudo leer la cédula. Probá de nuevo." }); return; }
      // Solo se cargan los datos que se leyeron; lo que vino en null no pisa lo que ya estaba escrito.
      const enLista = (m: string | null) => (m ? MARCAS.find((x) => x.toLowerCase() === m.toLowerCase()) || "" : "");
      let n = 0;
      const poner = (v: string | null | undefined, set: (x: string) => void) => { if (v) { set(v); n++; } };
      poner(c.patente, setPatente);
      poner(c.marca, setMarca);
      poner(c.modelo, setModelo);
      poner(c.anio ? String(c.anio) : null, setAnio);
      poner(c.numeroMotor, setNumeroMotor);
      poner(enLista(c.marcaMotor), setMarcaMotor);
      poner(c.numeroChasis, setNumeroChasis);
      poner(enLista(c.marcaChasis), setMarcaChasis);
      poner(c.localidad, setRadicadoLocalidad);
      if (!propioAgencia) {
        poner(c.titularNombre, setPropietarioNombre);
        poner(c.titularApellido, setPropietarioApellido);
        if (c.titularDocumento?.length === 11) poner(c.titularDocumento, setPropietarioCuitCuil);
        else poner(c.titularDocumento, setPropietarioDni);
      }
      setAvisoCedula({ ok: true, texto: `Se completaron ${n} datos de la cédula. Revisalos antes de guardar.` });
    } catch {
      setAvisoCedula({ ok: false, texto: "No se pudo leer la cédula. Probá de nuevo." });
    } finally {
      setLeyendoCedula(false);
      if (inputCedulaRef.current) inputCedulaRef.current.value = "";
    }
  };
  const [propietarioNumero, setPropietarioNumero] = useState(editando?.propietario_numero || "");
  const [propietarioDepto, setPropietarioDepto] = useState(editando?.propietario_depto || "");
  const [propietarioLocalidad, setPropietarioLocalidad] = useState(editando?.propietario_localidad || "");
  const [propietarioCodigoPostal, setPropietarioCodigoPostal] = useState(editando?.propietario_codigo_postal || "");
  const [propietarioProvincia, setPropietarioProvincia] = useState(editando?.propietario_provincia || "");
  const [propietarioTelefonoCelular, setPropietarioTelefonoCelular] = useState(editando?.propietario_telefono_celular || "");

  // Compromiso de compra: si el auto se paga en cuotas al proveedor, arma
  // solo las filas en cuotas_pagar_agencia (Finanzas → Cuotas a pagar) en
  // vez de tener que cargarlas de nuevo a mano ahí -- mismo generador de
  // vencimientos que usa CuotasTab.tsx para "Compromiso de compra (auto)".
  // Solo al crear (no en edición, para no duplicar el plan en cada guardado).
  const [compradoEnCuotas, setCompradoEnCuotas] = useState(false);
  const [ccMontoCuota, setCcMontoCuota] = useState("");
  const [ccMoneda, setCcMoneda] = useState("USD");
  const [ccCantidad, setCcCantidad] = useState("1");
  const [ccFrecuencia, setCcFrecuencia] = useState("Mensual");
  const [ccPrimerVencimiento, setCcPrimerVencimiento] = useState(new Date().toISOString().slice(0, 10));

  // Titulares (dueños que figuran en el título, N dinámico, con % de
  // propiedad) — separado del proveedor/propietario de arriba.
  const [titulares, setTitulares] = useState<{ nombre: string; porcentaje: string; cuit_cuil: string }[]>([]);

  useEffect(() => {
    if (!editando?.id) return;
    supabase2.from("vehiculo_titulares").select("*").eq("vehiculo_id", editando.id).order("orden").then(({ data }) => {
      if (data) setTitulares(data.map((t: any) => ({ nombre: t.nombre || "", porcentaje: t.porcentaje != null ? String(t.porcentaje) : "", cuit_cuil: t.cuit_cuil || "" })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editando?.id]);

  // Cuántas conversaciones de WhatsApp llegaron con este auto como
  // "vehículo de interés" -- se vincula solo cuando el mensaje entrante
  // trae el link de la publicación en MercadoLibre (ver webhook de
  // WhatsApp), o a mano desde el detalle del lead.
  const [consultasWa, setConsultasWa] = useState<number | null>(null);
  useEffect(() => {
    if (!editando?.id) { setConsultasWa(null); return; }
    supabase2.from("whatsapp_conversaciones").select("id", { count: "exact", head: true }).eq("vehiculo_id", editando.id).then(({ count }) => {
      setConsultasWa(count ?? 0);
    });
  }, [editando?.id]);

  // Vendedor sin "vehiculos.editar_completo" solo puede tocar fotos --
  // ni valida el resto de los campos obligatorios (no los va a tocar) ni
  // manda el payload completo, así ni un intento manual de re-habilitar
  // inputs por devtools termina pisando specs/precio/datos legales.
  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (soloFotos && esEdicion) {
      setGuardando(true);
      setError("");
      try {
        const { data, error: dbError } = await supabase2.from("vehiculos").update({ fotos, actualizado_por: miId || null }).eq("id", editando.id).select("*, sucursal:sucursal_id ( nombre )").single();
        if (dbError) throw dbError;
        onCreado(data);
        onClose();
      } catch (err) {
        console.error(err);
        setError("No se pudieron guardar las fotos.");
      } finally {
        setGuardando(false);
      }
      return;
    }
    if (!marca.trim() || !modelo.trim() || !anio || !patente.trim() || !color.trim() || !precioVenta) {
      setError("Completá marca, modelo, año, patente, color y precio de venta.");
      return;
    }
    if (vendedorAsignadoId && esDeOtraSucursal(perfiles.find((p) => p.id === vendedorAsignadoId), sucursalId)) {
      setError("El vendedor asignado es de otra sucursal: elegí a alguien de la sucursal del auto.");
      return;
    }
    setGuardando(true);
    setError("");
    try {
      const payload = {
        categoria, marca: marca.trim(), modelo: modelo.trim(), anio: Number(anio), patente: patente.trim().toUpperCase(),
        origen: origen || null, color: color.trim(), km: km.trim() === "" ? null : Number(km), precio_venta: Number(precioVenta), moneda_venta: monedaVenta,
        // Solo admin ve/edita el costo interno -- si no es admin, ni
        // mandamos estas dos claves (así un update no pisa con null el
        // precio de compra real que ya tenía cargado un auto).
        ...(soyAdmin ? { precio_compra: precioCompra ? Number(precioCompra) : null, moneda_compra: monedaCompra } : {}),
        facturado,
        factura_importe: facturado && facturaImporte ? Number(facturaImporte) : null,
        factura_numero: facturado ? (facturaNumero || null) : null,
        factura_emisor: facturado ? (facturaEmisor || null) : null,
        factura_archivo_url: facturado ? (facturaArchivoUrl || null) : null,
        ubicacion: ubicacion || null, provincia: provincia || null, estado: estadoInicial, "dueños_anteriores": duenosAnteriores ? Number(duenosAnteriores) : null,
        propio_agencia: propioAgencia,
        propietario_nombre: propioAgencia ? null : (propietarioNombre || null),
        propietario_dni: propioAgencia ? null : (propietarioDni || null),
        cliente_vinculado_id: clienteVinculadoId || null,
        propietario_telefono: propioAgencia ? null : (propietarioTelefono || null),
        propietario_email: propioAgencia ? null : (propietarioEmail || null),
        consignado_por: consignadoPor || null,
        combustible: combustible || null, transmision: transmision || null, carroceria: carroceria || null,
        puertas: puertas ? Number(puertas) : null, motor_cilindrada: motorCilindrada || null, version: version || null,
        manuales, duplicado_llaves: duplicadoLlaves, servicios_oficiales: serviciosOficiales,
        publicado_ml: publicadoMl, publicado_por: publicadoPor || null, link_ml: linkMl || null,
        notas: notas || null, fotos,
        segmento: segmento || null, traccion: traccion || null,
        potencia_cv: potenciaCv ? Number(potenciaCv) : null, cantidad_plazas: cantidadPlazas ? Number(cantidadPlazas) : null,
        numero_motor: numeroMotor || null, marca_motor: marcaMotor || null,
        numero_chasis: numeroChasis || null, marca_chasis: marcaChasis || null,
        radicado_localidad: radicadoLocalidad || null, radicado_provincia: radicadoProvincia || null,
        stock_fisico: stockFisico, destacado, fecha_compra: fechaCompra || null,
        importe_patente_anual: importePatenteAnual ? Number(importePatenteAnual) : null,
        sucursal_id: sucursalId || null,
        vendedor_asignado_id: vendedorAsignadoId || null,
        // El catálogo público y el simulador de financiación leen SOLO estos
        // dos campos, nunca precio_venta directo -- siempre se publica el
        // mismo precio de venta interno, sin override manual.
        precio_publicado_ars: monedaVenta === "ARS" ? Number(precioVenta) : null,
        precio_publicado_usd: monedaVenta === "USD" ? Number(precioVenta) : null,
        propietario_apellido: propioAgencia ? null : (propietarioApellido || null),
        propietario_fecha_nacimiento: propioAgencia ? null : (propietarioFechaNacimiento || null),
        propietario_cuit_cuil: propioAgencia ? null : (propietarioCuitCuil || null),
        propietario_calle: propioAgencia ? null : (propietarioCalle || null),
        propietario_numero: propioAgencia ? null : (propietarioNumero || null),
        propietario_depto: propioAgencia ? null : (propietarioDepto || null),
        propietario_localidad: propioAgencia ? null : (propietarioLocalidad || null),
        propietario_codigo_postal: propioAgencia ? null : (propietarioCodigoPostal || null),
        propietario_provincia: propioAgencia ? null : (propietarioProvincia || null),
        propietario_telefono_celular: propioAgencia ? null : (propietarioTelefonoCelular || null),
        actualizado_por: miId || null,
      };
      const { data, error: dbError } = esEdicion
        ? await supabase2.from("vehiculos").update(payload).eq("id", editando.id).select("*, sucursal:sucursal_id ( nombre )").single()
        : await supabase2.from("vehiculos").insert({ ...payload, creado_por: miId || null }).select("*, sucursal:sucursal_id ( nombre )").single();
      if (dbError) throw dbError;

      await supabase2.from("vehiculo_titulares").delete().eq("vehiculo_id", data.id);
      const titularesConDatos = titulares.filter((t) => t.nombre.trim() || t.cuit_cuil.trim());
      if (titularesConDatos.length > 0) {
        await supabase2.from("vehiculo_titulares").insert(
          titularesConDatos.map((t, i) => ({
            vehiculo_id: data.id, orden: i, nombre: t.nombre.trim() || null,
            porcentaje: t.porcentaje ? Number(t.porcentaje) : null, cuit_cuil: t.cuit_cuil.trim() || null,
          }))
        );
      }

      // Compromiso de compra: mismo generador de vencimientos que
      // crearCuotaPagar() en CuotasTab.tsx (FREQ_DIAS por frecuencia).
      if (!esEdicion && compradoEnCuotas && ccMontoCuota) {
        const FREQ_DIAS: Record<string, number> = { Mensual: 30, Bimestral: 60, Anual: 365 };
        const acreedor = [propietarioNombre, propietarioApellido].filter(Boolean).join(" ").trim() || "Proveedor sin nombre cargado";
        const n = Number(ccCantidad) || 1;
        const filasCompromiso = Array.from({ length: n }, (_, i) => {
          const v = new Date(ccPrimerVencimiento + "T00:00:00");
          v.setDate(v.getDate() + FREQ_DIAS[ccFrecuencia] * i);
          return {
            acreedor, tipo_deuda: "auto_cuotas", concepto: `${data.marca} ${data.modelo} ${data.anio} — compromiso de compra`,
            vehiculo_id: data.id, moneda: ccMoneda, monto: Number(ccMontoCuota), vencimiento: v.toISOString().slice(0, 10),
            cuota_actual: i + 1, cuota_total: n, creado_por: miId || null,
          };
        });
        const { error: errorCompromiso } = await supabase2.from("cuotas_pagar_agencia").insert(filasCompromiso);
        if (errorCompromiso) console.error("[NuevoVehiculoModal] No se pudo crear el compromiso de compra:", errorCompromiso);
      }

      if (!esEdicion && miId) {
        crearAlerta(supabase2, miId, `Nuevo vehículo en stock — ${data.marca} ${data.modelo} ${data.anio}`, {
          mensaje: `Ingresó hoy. Estado: ${ESTADOS.find((e) => e.value === data.estado)?.label || data.estado}. Precio: ${data.moneda_venta} ${Number(data.precio_venta).toLocaleString("es-AR")}.`,
          link: "/panel/stock", tipo: "vehiculo", prioridad: "novedad", categoriaNotif: "stock",
        });
      }
      onCreado(data);
      onClose();
    } catch (err: any) {
      console.error(err);
      const codigo = err?.code;
      if (codigo === "23505") setError("No se pudo guardar: la patente ya está registrada en otro vehículo.");
      else setError(err?.message ? `No se pudo guardar el vehículo: ${err.message}` : "No se pudo guardar el vehículo.");
    } finally {
      setGuardando(false);
    }
  };

  const inputClass = "w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#0145F2] text-slate-900 dark:text-white placeholder:text-slate-400";
  const labelClass = "text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1";
  const seccionClass = "text-[11px] font-black uppercase tracking-widest text-slate-400 mt-1 mb-2";

  // Índice de pasos: solo navegación dentro del formulario (ver
  // components/panel/formulario/PasosFormulario.tsx), no cambia qué se guarda.
  // Con "solo fotos" (sin permiso de edición completa) hay un único paso y no se muestra la barra.
  const pasos: PasoFormulario[] = soloFotos ? [{ id: "fotos", label: "Fotos", icono: Camera }] : [
    { id: "fotos", label: "Fotos", icono: Camera },
    { id: "identidad", label: "Identidad", icono: Car },
    { id: "precio", label: "Precio y estado", icono: Banknote },
    { id: "ubicacion", label: "Ubicación y gestión", icono: MapPin },
    { id: "propietario", label: "Propietario", icono: UserRound },
    { id: "ficha", label: "Ficha técnica", icono: Wrench },
    { id: "publicacion", label: "Publicación", icono: Megaphone },
  ];
  const { cuerpoRef, pasoActivo, nPaso, irAPaso, alScrollear } = usePasosFormulario<HTMLFormElement>(pasos, "vehiculo");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !guardando && onClose()} />
      <div className="relative bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/10 w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex justify-between items-start px-6 pt-6 pb-3 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{esEdicion ? "Editar vehículo" : "Nuevo vehículo"}</h3>
            {esEdicion && editando?.marca && <Compartido destino como="p" id={`nombre-vehiculo-${editando.id}`} className="text-sm font-bold text-slate-900 dark:text-white">{editando.marca} {editando.modelo}</Compartido>}
            <p className="text-xs text-slate-500 dark:text-slate-400">Datos básicos del vehículo. Con una foto de la cédula verde se completan patente, marca, modelo, motor, chasis y titular.</p>
            {esEdicion && editando?.updated_at && (
              <p className="text-[10px] text-slate-400 mt-1">
                Última actualización: {new Date(editando.updated_at).toLocaleDateString("es-AR")} {new Date(editando.updated_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                {editando.actualizado_por && ` · ${perfiles.find((p) => p.id === editando.actualizado_por)?.nombre || "—"}`}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!soloFotos && <BarraPasos pasos={pasos} activo={pasoActivo} onIr={irAPaso} />}

        <form ref={cuerpoRef} onScroll={alScrollear} onSubmit={guardar} className="space-y-4 px-6 py-4 flex-1 min-h-0 overflow-y-auto overflow-x-hidden border-t border-slate-100 dark:border-white/10">
          {!soloFotos && (
            <div>
              <input ref={inputCedulaRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => leerCedula(e.target.files?.[0])} />
              <button type="button" onClick={() => inputCedulaRef.current?.click()} disabled={leyendoCedula || !cedulaActiva} className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-500/20 disabled:opacity-60">
                {leyendoCedula ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />} {leyendoCedula ? "Leyendo la cédula…" : "Escanear cédula verde (opcional)"}
              </button>
              {!cedulaActiva && <p className="text-[11px] text-slate-400 mt-1.5">Apagado. Lo prende un administrador en Configuración → Empresa → IA.</p>}
              {avisoCedula && <p className={`text-[11px] mt-1.5 ${avisoCedula.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{avisoCedula.texto}</p>}
            </div>
          )}

          {soloFotos && (
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2">
              {marca} {modelo} {anio} · {patente || "s/patente"} — solo podés actualizar las fotos de este vehículo.
            </p>
          )}

          <div>
            <TituloPaso id="fotos" n={nPaso("fotos")} titulo="Fotos" icono={Camera} primero />
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {fotos.map((url, index) => (
                <div
                  key={url}
                  draggable
                  onDragStart={() => setFotoArrastrada(index)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setFotoSobre(index);
                    if (fotoArrastrada === null || fotoArrastrada === index) return;
                    moverFoto(fotoArrastrada, index);
                    setFotoArrastrada(index);
                  }}
                  onDragEnd={() => {
                    setFotoArrastrada(null);
                    setFotoSobre(null);
                  }}
                  className={`relative aspect-square rounded-lg overflow-hidden border group cursor-grab active:cursor-grabbing transition-colors ${
                    fotoSobre === index && fotoArrastrada !== index
                      ? "border-[#0145F2] border-2"
                      : "border-slate-200 dark:border-white/10"
                  } ${fotoArrastrada === index ? "opacity-40" : ""}`}
                >
                  <img src={url} alt="" draggable={false} className="w-full h-full object-cover pointer-events-none" />
                  {index === 0 ? (
                    <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md bg-[#0145F2] text-white text-[9px] font-bold uppercase tracking-wide">
                      Portada
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => hacerPortada(index)}
                      title="Usar como portada"
                      className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[9px] font-bold uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Hacer portada
                    </button>
                  )}
                  <button type="button" onClick={() => quitarFoto(url)} className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <label className={`aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${subiendoFotos ? "opacity-60 pointer-events-none" : "hover:bg-slate-50 dark:hover:bg-white/5"} border-slate-300 dark:border-white/20`}>
                {subiendoFotos ? <Loader2 className="w-5 h-5 text-slate-400 animate-spin" /> : <ImagePlus className="w-5 h-5 text-slate-400" />}
                <span className="text-[10px] font-semibold text-slate-400">{subiendoFotos ? "Subiendo..." : "Agregar"}</span>
                <input ref={fileRef} type="file" accept="image/*" multiple disabled={subiendoFotos} className="hidden" onChange={(e) => e.target.files?.length && subirFotos(e.target.files)} />
              </label>
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5">Arrastrá una foto para cambiar el orden, o pasá el mouse y tocá &quot;Hacer portada&quot; — la primera es la que se usa como miniatura en el listado y en el catálogo.</p>
          </div>

          {soloFotos ? (
            <>
              {error && <p className="text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-500/10 rounded-lg px-3 py-2">{error}</p>}
              {/* Celular (Walter, 19/10/2026: quedaban apretados): "Abrir ficha completa" arriba a todo el ancho y Cancelar/Guardar
              abajo. Desde sm, los tres en una fila iguales y en el orden de antes (Cancelar, ficha, Guardar). */}
          <div className="pt-4 sm:pt-3 border-t border-slate-100 dark:border-white/10 flex flex-col sm:flex-row gap-2.5 sm:gap-3">
                {esEdicion && onAbrirFicha && <button type="button" onClick={onAbrirFicha} disabled={guardando} className="h-11 sm:h-auto sm:py-2.5 px-4 sm:flex-1 sm:order-2 flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold bg-white dark:bg-white/5 border border-[#0145F2]/40 text-[#0145F2] dark:text-[#5b8dff] hover:bg-[#0145F2]/5 rounded-xl transition-colors disabled:opacity-50"><Maximize2 className="w-4 h-4" /> Abrir ficha completa</button>}
                <div className="flex gap-2.5 sm:contents">
                <button type="button" onClick={onClose} className="h-11 sm:h-auto sm:py-2.5 flex-1 sm:order-1 px-4 whitespace-nowrap text-sm font-semibold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 rounded-xl transition-colors">Cancelar</button>
                <button type="submit" disabled={guardando} className="h-11 sm:h-auto sm:py-2.5 flex-[1.4] sm:flex-1 sm:order-3 px-4 whitespace-nowrap flex items-center justify-center gap-2 text-sm font-bold bg-[#0145F2] hover:bg-[#0138c9] text-white rounded-xl transition-colors disabled:opacity-50">
                  {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar fotos"}
                </button>
                </div>
              </div>
            </>
          ) : (
          <>
          <div>
            <TituloPaso id="identidad" n={nPaso("identidad")} titulo="Identidad" icono={Car} />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Tipo de vehículo</label>
                <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={inputClass}>
                  {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Marca <span className="text-rose-500">*</span></label>
                <input list="marcas-vehiculo" value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Ej: Toyota, BMW" className={inputClass} />
                <datalist id="marcas-vehiculo">{MARCAS.map((m) => <option key={m} value={m} />)}</datalist>
              </div>
              <div>
                <label className={labelClass}>Modelo <span className="text-rose-500">*</span></label>
                <input value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Ej: Hilux SRX 4x4" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Año <span className="text-rose-500">*</span></label>
                <input type="number" value={anio} onChange={(e) => setAnio(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Patente / VIN <span className="text-rose-500">*</span></label>
                <input value={patente} onChange={(e) => setPatente(e.target.value)} placeholder="AB123CD" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Color <span className="text-rose-500">*</span></label>
                <input value={color} onChange={(e) => setColor(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Origen</label>
                <select value={origen} onChange={(e) => setOrigen(e.target.value)} className={inputClass}>
                  <option value="">— Sin especificar —</option>
                  {ORIGENES.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div>
            <TituloPaso id="precio" n={nPaso("precio")} titulo="Precio y estado" icono={Banknote} />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Kilómetros <span className="font-normal text-slate-400">(0 = 0 km · vacío si no se sabe)</span></label>
                <input type="text" inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value.replace(/\D/g, ""))} placeholder="147000" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Precio de venta <span className="text-rose-500">*</span></label>
                <input type="text" inputMode="numeric" value={precioVenta} onChange={(e) => setPrecioVenta(e.target.value.replace(/\D/g, ""))} placeholder="15000000" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Moneda venta</label>
                <select value={monedaVenta} onChange={(e) => setMonedaVenta(e.target.value)} className={inputClass}>
                  <option value="USD">USD</option><option value="ARS">ARS</option>
                </select>
              </div>
              {soyAdmin && (
                <>
                  <div>
                    <label className={labelClass}>Precio compra (opcional)</label>
                    <input type="text" inputMode="numeric" value={precioCompra} onChange={(e) => setPrecioCompra(e.target.value.replace(/\D/g, ""))} placeholder="12000000" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Moneda compra</label>
                    <select value={monedaCompra} onChange={(e) => setMonedaCompra(e.target.value)} className={inputClass}>
                      <option value="USD">USD</option><option value="ARS">ARS</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            <div className="mt-3">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={facturado} onChange={(e) => setFacturado(e.target.checked)} className="w-4 h-4 accent-[#0145F2]" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">¿Está facturado?</span>
              </label>
              {facturado && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                  <div>
                    <label className={labelClass}>Importe de factura</label>
                    <input type="text" inputMode="numeric" value={facturaImporte} onChange={(e) => setFacturaImporte(e.target.value.replace(/\D/g, ""))} placeholder="12000000" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>N° de factura</label>
                    <input type="text" value={facturaNumero} onChange={(e) => setFacturaNumero(e.target.value)} placeholder="0001-00012345" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Quién factura</label>
                    <input type="text" value={facturaEmisor} onChange={(e) => setFacturaEmisor(e.target.value)} placeholder="Nombre o razón social" className={inputClass} />
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <label className={labelClass}>Archivo de la factura</label>
                    <div className="flex items-center gap-2">
                      <label className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold border border-slate-200 dark:border-white/10 rounded-lg cursor-pointer ${subiendoFactura ? "opacity-60 pointer-events-none" : ""}`}>
                        {subiendoFactura ? "Subiendo..." : "Adjuntar archivo"}
                        <input type="file" accept="image/*,.pdf" disabled={subiendoFactura} className="hidden" onChange={(e) => e.target.files?.[0] && subirFactura(e.target.files[0])} />
                      </label>
                      {facturaArchivoUrl && <a href={facturaArchivoUrl} target="_blank" rel="noreferrer" className="text-xs text-[#0145F2] hover:underline">Ver archivo</a>}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
              <div>
                <label className={labelClass}>{esEdicion ? "Estado" : "Estado inicial"}</label>
                {/* "Señado" y "Vendido" los pone SOLO el flujo real (Señas /
                    Ventas) -- si se pudiera pisar acá a mano, quedaría un
                    vehículo marcado vendido/señado sin ninguna seña o venta
                    real detrás (o viceversa: la seña/venta sigue viva pero
                    el auto vuelve a aparecer disponible en el catálogo). */}
                {esEdicion && (estadoInicial === "señado" || estadoInicial === "vendido" || estadoInicial === "fuera_de_venta") ? (
                  <>
                    <input value={estadoInicial === "fuera_de_venta" ? "Fuera de venta" : ESTADOS.find((s) => s.value === estadoInicial)?.label || estadoInicial} disabled className={`${inputClass} opacity-60 cursor-not-allowed`} />
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">{estadoInicial === "fuera_de_venta" ? "Para ofrecerlo de nuevo usá “Volver a la venta” en la ficha del auto (también reactiva MercadoLibre)." : <>Lo pone el módulo de {estadoInicial === "señado" ? "Señas" : "Ventas"} — para liberarlo, cancelá o revertí la operación ahí, no lo cambies acá.</>}</p>
                  </>
                ) : (
                  <>
                  <select value={estadoInicial} onChange={(e) => setEstadoInicial(e.target.value)} className={inputClass}>
                    {ESTADOS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  {estadoInicial === "en_preparacion" && <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">No se muestra en la web hasta que lo pases a Disponible.</p>}
                  </>
                )}
              </div>
            </div>
          </div>

          <div>
            <TituloPaso id="ubicacion" n={nPaso("ubicacion")} titulo="Ubicación y dueños" icono={MapPin} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Ubicación</label>
                <input value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Provincia</label>
                <select value={provincia} onChange={(e) => setProvincia(e.target.value)} className={inputClass}>
                  <option value="">— Sin especificar —</option>
                  {PROVINCIAS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Dueños anteriores</label>
                <input type="number" value={duenosAnteriores} onChange={(e) => setDuenosAnteriores(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Sucursal</label>
                <select value={sucursalId} onChange={(e) => setSucursalId(e.target.value)} className={inputClass}>
                  <option value="">— Sin asignar —</option>
                  {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Vendedor asignado</label>
                <select value={vendedorAsignadoId} onChange={(e) => setVendedorAsignadoId(e.target.value)} className={inputClass}>
                  <option value="">— Sin asignar —</option>
                  {vendedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}{sucursalId && p.sucursal_id && p.sucursal_id !== sucursalId ? " (otra sucursal)" : ""}</option>)}
                </select>
                {vendedorAsignadoId && sucursalId && (() => {
                  const elegido = perfiles.find((p) => p.id === vendedorAsignadoId);
                  return elegido?.sucursal_id && elegido.sucursal_id !== sucursalId ? (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-1">Esta persona es de otra sucursal: no se puede asignar.</p>
                  ) : null;
                })()}
              </div>
            </div>
          </div>

          <div>
            <p className={seccionClass}>Gestión comercial</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className={labelClass}>Stock físico</label>
                <select value={stockFisico ? "Si" : "No"} onChange={(e) => setStockFisico(e.target.value === "Si")} className={inputClass}><option value="Si">Sí</option><option value="No">No</option></select>
              </div>
              <div>
                <label className={labelClass}>Destacado</label>
                <select value={destacado ? "Si" : "No"} onChange={(e) => setDestacado(e.target.value === "Si")} className={inputClass}><option value="No">No</option><option value="Si">Sí</option></select>
              </div>
              <div>
                <label className={labelClass}>Fecha de compra</label>
                <input type="date" value={fechaCompra} onChange={(e) => setFechaCompra(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Patente anual</label>
                <input type="number" value={importePatenteAnual} onChange={(e) => setImportePatenteAnual(e.target.value)} className={inputClass} />
              </div>
            </div>
          </div>

          <div>
            <TituloPaso id="propietario" n={nPaso("propietario")} titulo="Propietario" icono={UserRound} />
            <label className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 cursor-pointer mb-3">
              <input type="checkbox" checked={propioAgencia} onChange={(e) => setPropioAgencia(e.target.checked)} className="w-4 h-4 mt-0.5 accent-[#0145F2]" />
              <span>
                <span className="block text-xs font-bold text-slate-700 dark:text-slate-200">Vehículo propio de la agencia</span>
                <span className="block text-[10px] text-slate-400">El auto es de la agencia, no consignado por un tercero. El "Precio de compra" se usa como costo para calcular el margen al venderlo.</span>
              </span>
            </label>
            {!propioAgencia && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Nombre</label>
                  <input value={propietarioNombre} onChange={(e) => setPropietarioNombre(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>D.N.I.</label>
                  <input value={propietarioDni} onChange={(e) => setPropietarioDni(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Cliente vinculado</label>
                  <select value={clienteVinculadoId} onChange={(e) => setClienteVinculadoId(e.target.value)} className={inputClass}>
                    <option value="">— Sin vincular —</option>
                    {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.telefono ? ` · ${c.telefono}` : ""}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Teléfono</label>
                  <input value={propietarioTelefono} onChange={(e) => setPropietarioTelefono(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Email</label>
                  <input value={propietarioEmail} onChange={(e) => setPropietarioEmail(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Consignado por</label>
                  <select value={consignadoPor} onChange={(e) => setConsignadoPor(e.target.value)} className={inputClass}>
                    <option value="">— Sin asignar —</option>
                    {consignadores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">Vendedor responsable de la consignación</p>
                </div>
              </div>
            )}
            {!propioAgencia && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <div>
                  <label className={labelClass}>Apellido</label>
                  <input value={propietarioApellido} onChange={(e) => setPropietarioApellido(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Fecha de nacimiento</label>
                  <input type="date" value={propietarioFechaNacimiento} onChange={(e) => setPropietarioFechaNacimiento(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>CUIT/CUIL</label>
                  <input value={propietarioCuitCuil} onChange={(e) => setPropietarioCuitCuil(e.target.value)} placeholder="20-12345678-9" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Celular</label>
                  <input value={propietarioTelefonoCelular} onChange={(e) => setPropietarioTelefonoCelular(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Calle</label>
                  <input value={propietarioCalle} onChange={(e) => setPropietarioCalle(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Número</label>
                  <input value={propietarioNumero} onChange={(e) => setPropietarioNumero(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Depto</label>
                  <input value={propietarioDepto} onChange={(e) => setPropietarioDepto(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Localidad</label>
                  <input value={propietarioLocalidad} onChange={(e) => setPropietarioLocalidad(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Código postal</label>
                  <input value={propietarioCodigoPostal} onChange={(e) => setPropietarioCodigoPostal(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Provincia</label>
                  <input value={propietarioProvincia} onChange={(e) => setPropietarioProvincia(e.target.value)} className={inputClass} />
                </div>
              </div>
            )}
          </div>

          {!esEdicion && !propioAgencia && (
            <div>
              <p className={seccionClass}>Compromiso de compra</p>
              <label className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 cursor-pointer mb-3">
                <input type="checkbox" checked={compradoEnCuotas} onChange={(e) => setCompradoEnCuotas(e.target.checked)} className="w-4 h-4 mt-0.5 accent-[#0145F2]" />
                <span>
                  <span className="block text-xs font-bold text-slate-700 dark:text-slate-200">Se le paga al proveedor en cuotas</span>
                  <span className="block text-[10px] text-slate-400">Genera el plan de pago automáticamente en Finanzas → Cuotas a pagar, con el acreedor y el auto ya vinculados.</span>
                </span>
              </label>
              {compradoEnCuotas && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelClass}>Importe de cada cuota</label>
                    <input type="text" inputMode="numeric" value={ccMontoCuota} onChange={(e) => setCcMontoCuota(e.target.value.replace(/\D/g, ""))} placeholder="2500" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Moneda</label>
                    <select value={ccMoneda} onChange={(e) => setCcMoneda(e.target.value)} className={inputClass}><option value="USD">USD</option><option value="ARS">ARS</option></select>
                  </div>
                  <div>
                    <label className={labelClass}>Cantidad de cuotas</label>
                    <input type="number" value={ccCantidad} onChange={(e) => setCcCantidad(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Frecuencia</label>
                    <select value={ccFrecuencia} onChange={(e) => setCcFrecuencia(e.target.value)} className={inputClass}><option>Mensual</option><option>Bimestral</option><option>Anual</option></select>
                  </div>
                  <div className="col-span-2">
                    <label className={labelClass}>Primer vencimiento</label>
                    <input type="date" value={ccPrimerVencimiento} onChange={(e) => setCcPrimerVencimiento(e.target.value)} className={inputClass} />
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className={seccionClass + " mt-0 mb-0"}>Titulares</p>
              <button
                type="button"
                onClick={() => setTitulares((prev) => [...prev, { nombre: "", porcentaje: "", cuit_cuil: "" }])}
                className="text-[11px] font-bold text-[#0145F2] dark:text-sky-300 hover:text-[#0138c9] dark:hover:text-sky-200"
              >
                + Agregar titular
              </button>
            </div>
            <div className="space-y-2">
              {titulares.map((t, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_auto] gap-2 items-end bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-3">
                  <div>
                    <label className={labelClass}>{`Titular #${i + 1}`}</label>
                    <input
                      value={t.nombre}
                      onChange={(e) => setTitulares((prev) => prev.map((x, idx) => (idx === i ? { ...x, nombre: e.target.value } : x)))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Porcet. (%)</label>
                    <input
                      type="number"
                      value={t.porcentaje}
                      onChange={(e) => setTitulares((prev) => prev.map((x, idx) => (idx === i ? { ...x, porcentaje: e.target.value } : x)))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Cuit/Cuil</label>
                    <input
                      value={t.cuit_cuil}
                      onChange={(e) => setTitulares((prev) => prev.map((x, idx) => (idx === i ? { ...x, cuit_cuil: e.target.value } : x)))}
                      className={inputClass}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setTitulares((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-rose-500 hover:text-[#0145F2] p-2.5"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {titulares.length === 0 && (
                <p className="text-[12px] text-slate-400 dark:text-slate-500 italic">Sin titulares cargados.</p>
              )}
            </div>
          </div>

          <TituloPaso id="ficha" n={nPaso("ficha")} titulo="Ficha técnica y documentos" icono={Wrench} />
          <div>
            <div className="flex items-center justify-between">
              <p className={seccionClass}>Ficha técnica</p>
              <button type="button" disabled title="Requiere el link de MercadoLibre y scraping — todavía no construido" className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-1 opacity-60 cursor-not-allowed">
                <ClipboardPaste className="w-3.5 h-3.5" /> Traer ficha de ML
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Combustible</label>
                <select value={combustible} onChange={(e) => setCombustible(e.target.value)} className={inputClass}>
                  <option value="">— Sin especificar —</option>
                  {COMBUSTIBLES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Transmisión</label>
                <select value={transmision} onChange={(e) => setTransmision(e.target.value)} className={inputClass}>
                  <option value="">— Sin especificar —</option>
                  <option>Manual</option><option>Automática</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Carrocería</label>
                <select value={carroceria} onChange={(e) => setCarroceria(e.target.value)} className={inputClass}>
                  <option value="">— Sin especificar —</option>
                  <option>Sedán</option><option>Hatchback</option><option>SUV</option><option>Pick-Up</option><option>Coupé</option><option>Furgón</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Puertas</label>
                <select value={puertas} onChange={(e) => setPuertas(e.target.value)} className={inputClass}>
                  <option value="">— Sin especificar —</option>
                  {PUERTAS.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Motor / cilindrada</label>
                <input value={motorCilindrada} onChange={(e) => setMotorCilindrada(e.target.value)} placeholder="Ej: 2.0 Turbo" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Versión</label>
                <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="Ej: Titanium" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Segmento</label>
                <select value={segmento} onChange={(e) => setSegmento(e.target.value)} className={inputClass}>
                  <option value="">— Sin especificar —</option>
                  {SEGMENTOS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Tracción</label>
                <select value={traccion} onChange={(e) => setTraccion(e.target.value)} className={inputClass}>
                  <option value="">— Sin especificar —</option>
                  <option>4x2</option><option>4x4</option><option>AWD</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Potencia (CV)</label>
                <input type="number" value={potenciaCv} onChange={(e) => setPotenciaCv(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Cantidad de plazas</label>
                <select value={cantidadPlazas} onChange={(e) => setCantidadPlazas(e.target.value)} className={inputClass}>
                  <option value="">— Sin especificar —</option>
                  {PLAZAS.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div>
            <p className={seccionClass}>Motor, chasis y radicación</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Nº motor</label>
                <input value={numeroMotor} onChange={(e) => setNumeroMotor(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Marca motor</label>
                <select value={marcaMotor} onChange={(e) => setMarcaMotor(e.target.value)} className={inputClass}>
                  <option value="">— Sin especificar —</option>
                  {MARCAS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Nº chasis</label>
                <input value={numeroChasis} onChange={(e) => setNumeroChasis(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Marca chasis</label>
                <select value={marcaChasis} onChange={(e) => setMarcaChasis(e.target.value)} className={inputClass}>
                  <option value="">— Sin especificar —</option>
                  {MARCAS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Radicado — localidad</label>
                <input value={radicadoLocalidad} onChange={(e) => setRadicadoLocalidad(e.target.value)} className={inputClass} />
              </div>
            </div>
          </div>

          <div>
            <p className={seccionClass}>Documentación</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Manuales</label>
                <select value={manuales ? "Si" : "No"} onChange={(e) => setManuales(e.target.value === "Si")} className={inputClass}><option value="No">No</option><option value="Si">Sí</option></select>
              </div>
              <div>
                <label className={labelClass}>Duplicado de llaves</label>
                <select value={duplicadoLlaves ? "Si" : "No"} onChange={(e) => setDuplicadoLlaves(e.target.value === "Si")} className={inputClass}><option value="No">No</option><option value="Si">Sí</option></select>
              </div>
              <div>
                <label className={labelClass}>Servicios oficiales</label>
                <select value={serviciosOficiales ? "Si" : "No"} onChange={(e) => setServiciosOficiales(e.target.value === "Si")} className={inputClass}><option value="No">No</option><option value="Si">Sí</option></select>
              </div>
            </div>
          </div>

          <div>
            <TituloPaso id="publicacion" n={nPaso("publicacion")} titulo="Publicación" icono={Megaphone} />
            {editando?.id && (
              <div className="mb-3 flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={publicarEnML}
                  disabled={publicandoMl}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                >
                  {publicandoMl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : publicadoMl ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
                  {publicadoMl ? "Volver a publicar en MercadoLibre" : "Publicar en MercadoLibre"}
                </button>
                {mlError && <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-600"><AlertTriangle className="w-3.5 h-3.5" /> {mlError}</span>}
                {consultasWa != null && consultasWa > 0 && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 rounded-full px-2.5 py-1">
                    💬 {consultasWa} consulta{consultasWa === 1 ? "" : "s"} por WhatsApp
                  </span>
                )}
              </div>
            )}
            {!editando?.id && (
              <p className="text-[11px] text-slate-400 mb-3">Guardá el vehículo primero para poder publicarlo en MercadoLibre.</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>¿Publicado en MercadoLibre?</label>
                <select value={publicadoMl ? "Si" : "No"} onChange={(e) => setPublicadoMl(e.target.value === "Si")} className={inputClass}><option value="No">No</option><option value="Si">Sí</option></select>
              </div>
              <div>
                <label className={labelClass}>Publicado por</label>
                <select value={publicadoPor} onChange={(e) => setPublicadoPor(e.target.value)} className={inputClass}>
                  <option value="">Sin especificar</option>
                  {publicadores.map((p) => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Link de MercadoLibre</label>
                <input value={linkMl} onChange={(e) => setLinkMl(e.target.value)} placeholder="https://articulo.mercadolibre.com.ar/..." className={inputClass} />
              </div>
            </div>
          </div>

          <div>
            <label className={labelClass}>Notas</label>
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} className={`${inputClass} resize-none`} />
          </div>

          {error && <p className="text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-500/10 rounded-lg px-3 py-2">{error}</p>}

          {/* Celular (Walter, 19/10/2026: quedaban apretados): "Abrir ficha completa" arriba a todo el ancho y Cancelar/Guardar
              abajo. Desde sm, los tres en una fila iguales y en el orden de antes (Cancelar, ficha, Guardar). */}
          <div className="pt-4 sm:pt-3 border-t border-slate-100 dark:border-white/10 flex flex-col sm:flex-row gap-2.5 sm:gap-3">
                        {esEdicion && onAbrirFicha && <button type="button" onClick={onAbrirFicha} disabled={guardando} className="h-11 sm:h-auto sm:py-2.5 px-4 sm:flex-1 sm:order-2 flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold bg-white dark:bg-white/5 border border-[#0145F2]/40 text-[#0145F2] dark:text-[#5b8dff] hover:bg-[#0145F2]/5 rounded-xl transition-colors disabled:opacity-50"><Maximize2 className="w-4 h-4" /> Abrir ficha completa</button>}
                <div className="flex gap-2.5 sm:contents">
                <button type="button" onClick={onClose} className="h-11 sm:h-auto sm:py-2.5 flex-1 sm:order-1 px-4 whitespace-nowrap text-sm font-semibold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 rounded-xl transition-colors">Cancelar</button>
            <button type="submit" disabled={guardando} className="h-11 sm:h-auto sm:py-2.5 flex-[1.4] sm:flex-1 sm:order-3 px-4 whitespace-nowrap flex items-center justify-center gap-2 text-sm font-bold bg-[#0145F2] hover:bg-[#0138c9] text-white rounded-xl transition-colors disabled:opacity-50">
              {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : esEdicion ? "Guardar cambios" : "Dar de alta"}
            </button>
            </div>
          </div>
          </>
          )}
        </form>
      </div>
    </div>
  );
}

// Prefijo "vehiculo" para los ids de DOM de los títulos de sección.
function TituloPaso(props: Omit<Parameters<typeof TituloPasoBase>[0], "prefijo">) {
  return <TituloPasoBase prefijo="vehiculo" {...props} />;
}
