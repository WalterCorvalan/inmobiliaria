// Simulador de canales (demo sin Meta). Pieza compartida con dental-bot y automotora: la pantalla y la conexión con el bot
// son iguales en los tres; lo único propio de cada rubro es su configuración (RubroDemo). Diseño en dental-bot
// docs/simulador.md. Todo lo de esta carpeta es ficticio y no toca la base.
import type { SucursalInfo } from "@/lib/ai/promptsV2";

export const CANALES_DEMO = ["whatsapp", "instagram", "messenger"] as const;
export type CanalDemo = (typeof CANALES_DEMO)[number];

export type MensajeDemo = { role: "user" | "assistant"; content: string };

export type Calificacion = "caliente" | "tibio" | "frio";

/** Lo que el bot fue juntando en la charla (mismos campos que datos_detectados del agente real). */
export type DatosLead = {
  nombre?: string | null; email?: string | null; telefono?: string | null; interes?: string | null;
  presupuesto?: string | null; plazo?: string | null; zona?: string | null; dia_visita?: string | null; horario_visita?: string | null;
};

export type EstadoLeadDemo = "nuevo" | "asignado" | "calificando" | "convertido" | "perdido";

export type LeadDemo = {
  id: string;
  nombre: string;
  canal: CanalDemo;
  estado: EstadoLeadDemo;
  calificacion: Calificacion;
  asesor: string | null;
  /** Texto corto de cuándo escribió ("hace 2 h", "ayer"). Ficticio. */
  hace: string;
  /** Resumen escrito a mano, con el formato del resumen real (lib/panel/formatoResumen.ts). En la demo no se llama a la IA. */
  resumen: string;
  charla: MensajeDemo[];
};

export type RubroDemo = {
  slug: string;
  nombreNegocio: string;
  nombreBot: string;
  /** Cómo habla el bot de este negocio (cada empresa tiene el suyo). Sin valor: amable, profesional, claro y breve. */
  tono?: string;
  descripcion: string;
  /** Respuestas fijas del negocio (horarios, requisitos, catálogo de ejemplo), igual que la memoria del bot real. */
  conocimiento: { categoria: string; respuesta: string }[];
  sucursales: SucursalInfo[];
  asesores: string[];
  leads: LeadDemo[];
  /** Mensajes de ejemplo que se ofrecen como botones para arrancar la charla. */
  sugerencias: string[];
  /** Qué es "lo que busca" en este rubro, para el resumen armado con plantilla ("propiedad", "auto"). */
  queBusca: string;
};

/** Lo que viaja al navegador: sin el conocimiento ni las instrucciones del bot. */
export type RubroPublico = Pick<RubroDemo, "slug" | "nombreNegocio" | "nombreBot" | "asesores" | "leads" | "sugerencias" | "queBusca"> & {
  sucursales: { nombre: string; slug?: string | null }[];
};

export function rubroPublico(r: RubroDemo): RubroPublico {
  return {
    slug: r.slug, nombreNegocio: r.nombreNegocio, nombreBot: r.nombreBot, asesores: r.asesores, leads: r.leads,
    sugerencias: r.sugerencias, queBusca: r.queBusca, sucursales: r.sucursales.map((s) => ({ nombre: s.nombre, slug: s.slug })),
  };
}
