// Acceso a la base desde el servidor, siempre atado a UNA empresa.
//
// El servidor (webhooks, tareas automáticas, rutas de envío) usa la clave de servicio, que se salta la seguridad por
// fila de la base. Para que una consulta olvidada no lea ni escriba datos de otra empresa, todo pasa por acá:
//   - `dentroDeEmpresa(id, fn)` fija la empresa del pedido (cada pedido tiene la suya, aunque corran a la vez);
//   - `supabaseEmpresa` es el cliente de servicio atado a esa empresa: cada consulta a una tabla de empresa agrega sola
//     el filtro `empresa_id`, y cada alta lleva el `empresa_id`;
//   - sin empresa fijada, consultar una tabla de empresa FALLA (no devuelve todo).
// Un test (`lib/empresa/db.test.ts`) y el de aislamiento de las migraciones mantienen esta lista al día.
import { AsyncLocalStorage } from "node:async_hooks";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Tablas con empresa_id (todas las de las migraciones menos empresas, superadmins y soporte_accesos).
export const TABLAS_DE_EMPRESA: ReadonlySet<string> = new Set([
  "alertas", "chats_vistos", "clientes", "configuracion_empresa", "disponibilidad_vendedor", "espacio_notif_prefs", "eventos_lead",
  "instagram_automatizaciones_comentarios", "instagram_configuracion", "instagram_contactos", "instagram_conversaciones", "instagram_mensajes",
  "lead_ronda_turnos", "leads_manuales", "logs_errores", "messenger_configuracion", "messenger_contactos", "messenger_conversaciones",
  "messenger_mensajes", "motivos_cierre", "perfiles", "push_subscriptions", "rodi_conversaciones", "rodi_mensajes", "sucursales", "tareas_lead",
  "uso_ia_anthropic", "visitas", "whatsapp_configuracion", "whatsapp_contactos", "whatsapp_conversaciones", "whatsapp_memoria", "whatsapp_mensajes",
  "whatsapp_plantillas", "whatsapp_templates",
]);

// Funciones de la base que reciben la empresa como parámetro (p_empresa_id): se completa sola.
export const FUNCIONES_CON_EMPRESA: ReadonlySet<string> = new Set([
  "asignacion_auto_en_tabla", "leads_ultima_direccion", "visitas_horarios_ocupados", "proximo_vendedor_ronda",
]);

type Metodo = (...args: unknown[]) => unknown;
type Fila = Record<string, unknown>;

let base: SupabaseClient | null = null;
/** Cliente de servicio SIN atar a una empresa. Solo para buscar la empresa (por token, slug o sesión) y para recorrer todas. */
export function clienteServicio(): SupabaseClient {
  if (!base) base = createClient(process.env.NEXT_PUBLIC_SUPABASE2_URL!, process.env.SUPABASE2_SERVICE_ROLE_KEY!);
  return base;
}

const ZONA_POR_DEFECTO = "America/Argentina/Buenos_Aires";
const almacen = new AsyncLocalStorage<{ empresaId: string; zona: string }>();

/** Corre `fn` con la empresa fijada: todo lo que haga con `supabaseEmpresa` queda acotado a ella. */
export function dentroDeEmpresa<T>(empresaId: string, fn: () => T, zona?: string | null): T {
  if (!empresaId) throw new Error("dentroDeEmpresa: falta la empresa");
  return almacen.run({ empresaId, zona: zona || ZONA_POR_DEFECTO }, fn);
}

/** Zona horaria de la empresa del pedido (por defecto Argentina). Todo horario se calcula con esta, nunca con la del servidor. */
export function zonaActual(): string {
  return almacen.getStore()?.zona ?? ZONA_POR_DEFECTO;
}

/** Empresa del pedido en curso, o null si no hay (por ejemplo en un registro de errores general). */
export function empresaActualOpcional(): string | null {
  return almacen.getStore()?.empresaId ?? null;
}

export function empresaActual(): string {
  const id = empresaActualOpcional();
  if (!id) throw new Error("Consulta sin empresa: falta dentroDeEmpresa(...)");
  return id;
}

/** Ata un cliente de Supabase a una empresa (fija o tomada del pedido en curso en cada consulta). */
export function acotarAEmpresa(cliente: SupabaseClient, empresa: string | (() => string)): SupabaseClient {
  const id = () => (typeof empresa === "function" ? empresa() : empresa);
  return new Proxy(cliente, {
    get(destino, prop, receptor) {
      if (prop === "from") {
        return (tabla: string) => {
          const constructor = destino.from(tabla);
          if (!TABLAS_DE_EMPRESA.has(tabla)) return constructor;
          const e = id();
          const conEmpresa = (v: unknown) => (Array.isArray(v) ? v.map((x) => ({ ...(x as Fila), empresa_id: e })) : { ...(v as Fila), empresa_id: e });
          return new Proxy(constructor, {
            get(qb, metodo) {
              const original = Reflect.get(qb, metodo, qb) as Metodo;
              if (typeof original !== "function") return original;
              const llamar = (...a: unknown[]) => original.apply(qb, a) as { eq: (c: string, v: string) => unknown };
              if (metodo === "select" || metodo === "delete") return (...a: unknown[]) => llamar(...a).eq("empresa_id", e);
              if (metodo === "update") return (v: unknown, ...a: unknown[]) => llamar(v, ...a).eq("empresa_id", e);
              if (metodo === "insert" || metodo === "upsert") return (v: unknown, ...a: unknown[]) => llamar(conEmpresa(v), ...a);
              return original.bind(qb);
            },
          });
        };
      }
      if (prop === "rpc") {
        return (funcion: string, args?: Fila, ...resto: unknown[]) => {
          const params = FUNCIONES_CON_EMPRESA.has(funcion) ? { ...(args ?? {}), p_empresa_id: id() } : args;
          return (destino.rpc as unknown as Metodo).call(destino, funcion, params, ...resto);
        };
      }
      const valor = Reflect.get(destino, prop, receptor);
      return typeof valor === "function" ? (valor as Metodo).bind(destino) : valor;
    },
  });
}

/** Cliente de servicio atado a la empresa del pedido en curso (ver dentroDeEmpresa). Se usa igual que un cliente común. */
export const supabaseEmpresa: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_t, prop) {
    const empresaId = empresaActual(); // falla antes de tocar la base si el pedido no tiene empresa
    const atado = acotarAEmpresa(clienteServicio(), empresaId) as unknown as Record<string | symbol, unknown>;
    const valor = atado[prop];
    return typeof valor === "function" ? (valor as Metodo).bind(atado) : valor;
  },
});

export type EmpresaActiva = { id: string; nombre: string; slug: string; zona_horaria: string };

/** Empresas activas (las suspendidas no corren tareas ni reciben mensajes). */
export async function empresasActivas(): Promise<EmpresaActiva[]> {
  const { data, error } = await clienteServicio().from("empresas").select("id, nombre, slug, zona_horaria").eq("estado", "activa");
  if (error) throw error;
  return (data ?? []) as EmpresaActiva[];
}

/** Para tareas automáticas: corre `trabajo` una vez por empresa activa, cada una en su contexto. Un error en una no frena a las demás. */
export async function paraCadaEmpresa<T>(trabajo: (empresa: EmpresaActiva) => Promise<T>): Promise<{ empresa: string; resultado?: T; error?: string }[]> {
  const salida: { empresa: string; resultado?: T; error?: string }[] = [];
  for (const empresa of await empresasActivas()) {
    try {
      salida.push({ empresa: empresa.slug, resultado: await dentroDeEmpresa(empresa.id, () => trabajo(empresa), empresa.zona_horaria) });
    } catch (err) {
      console.error(`[paraCadaEmpresa] ${empresa.slug}`, err);
      salida.push({ empresa: empresa.slug, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return salida;
}

export type CanalConfig = "whatsapp" | "instagram" | "messenger";
const CONFIG_POR_CANAL: Record<CanalConfig, { tabla: string; columnaToken: string }> = {
  whatsapp: { tabla: "whatsapp_configuracion", columnaToken: "webhook_verify_token" },
  instagram: { tabla: "instagram_configuracion", columnaToken: "webhook_verify_token" },
  messenger: { tabla: "messenger_configuracion", columnaToken: "verify_token" },
};

/** La dirección del webhook lleva el verify token de la empresa: de ahí sale de quién es cada mensaje. Null si no existe o está suspendida. */
export async function empresaPorTokenDeWebhook(canal: CanalConfig, token: string): Promise<{ id: string; zona: string } | null> {
  if (!token || token.length < 16) return null;
  const { tabla, columnaToken } = CONFIG_POR_CANAL[canal];
  const c = clienteServicio();
  const { data } = await c.from(tabla).select("empresa_id").eq(columnaToken, token).maybeSingle();
  const empresaId = (data as { empresa_id?: string } | null)?.empresa_id;
  if (!empresaId) return null;
  const { data: e } = await c.from("empresas").select("estado, zona_horaria").eq("id", empresaId).maybeSingle();
  const fila = e as { estado?: string; zona_horaria?: string } | null;
  return fila?.estado === "activa" ? { id: empresaId, zona: fila.zona_horaria || ZONA_POR_DEFECTO } : null;
}

/** Empresa a partir de su identificador público (slug), para el chat de la web, que no tiene sesión. Null si no existe o está suspendida. */
export async function empresaPorSlug(slug: string): Promise<string | null> {
  if (!slug || slug.length > 80) return null;
  const { data } = await clienteServicio().from("empresas").select("id").eq("slug", slug).eq("estado", "activa").maybeSingle();
  return (data as { id?: string } | null)?.id ?? null;
}
