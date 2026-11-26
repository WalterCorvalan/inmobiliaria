// Ícono en color del menú, de Inicio y de los títulos de las fichas (los dibujos de public/icons/panel, los mismos del
// panel completo de Pfaffen). Se usa con `src` (una imagen cualquiera) o con `nombre` (uno de public/icons/panel, tipado
// para que un ícono que no existe falle al compilar). Son archivos chicos y fijos: con <img> alcanza.
export type NombreIconoPanel =
  | "alertas"
  | "autorizaciones"
  | "ayuda"
  | "calendario"
  | "categorias-empleados"
  | "clientes"
  | "cobros"
  | "comisiones"
  | "configuracion"
  | "contenido-sitio"
  | "convenio"
  | "consignaciones"
  | "correos"
  | "cotizaciones"
  | "dashboard"
  | "dormidos"
  | "errores"
  | "expedientes"
  | "facturacion"
  | "financiaciones"
  | "finanzas"
  | "gestoria"
  | "infracciones"
  | "instagram"
  | "leads"
  | "liquidaciones"
  | "liquidador-sueldos"
  | "marketing"
  | "mensajes"
  | "mi-dia"
  | "messenger"
  | "mi-espacio"
  | "mi-perfil"
  | "mis-ventas"
  | "nps"
  | "oportunidades"
  | "papelera"
  | "pedidos"
  | "peritajes"
  | "postulaciones"
  | "postventa"
  | "reclamos"
  | "recontactos"
  | "registro-cambios"
  | "reportes"
  | "rodi"
  | "senas"
  | "service"
  | "stock"
  | "sugerencias"
  | "taller"
  | "tareas-leads"
  | "telefonos"
  | "tesoreria"
  | "ventas"
  | "visitas"
  | "whatsapp";

const MEDIDAS = { xs: "w-3.5 h-3.5", sm: "w-4 h-4", md: "w-5 h-5", lg: "w-6 h-6", xl: "w-9 h-9" } as const;

export default function IconoPanel({ src, nombre, medida, className = "", alt = "" }: { src?: string; nombre?: NombreIconoPanel; medida?: keyof typeof MEDIDAS; className?: string; alt?: string }) {
  const url = src ?? `/icons/panel/${nombre}.png`;
  const tamano = medida ? `${MEDIDAS[medida]} shrink-0 ` : nombre && !className ? `${MEDIDAS.sm} shrink-0 ` : "";
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} aria-hidden={alt ? undefined : true} className={`${tamano}object-contain ${className}`} />;
}
