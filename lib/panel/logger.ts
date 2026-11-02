import { createClient } from "@supabase/supabase-js";
import { empresaActualOpcional } from "@/lib/empresa/db";

// Mismo patrón que lib/logger.ts (v1), apuntando a nova. Best-effort: si el
// insert falla no rompe el flujo que lo llamó.
const supabaseLogs = createClient(
  process.env.NEXT_PUBLIC_SUPABASE2_URL!,
  process.env.SUPABASE2_SERVICE_ROLE_KEY!
);

// Devuelve la promesa del guardado: la mayoría la ignora (best-effort), pero
// un webhook que corta con return justo después conviene que la espere, si no
// Vercel congela la función antes de que el log llegue a la base.
export function registrarError(origen: string, error: unknown, contexto?: Record<string, unknown>): Promise<void> {
  console.error(`[${origen}]`, error);

  // Los errores de Supabase/PostgREST son objetos planos con .message
  // (PostgrestError), no instancias de Error -- "instanceof Error" da falso
  // y String(error) tira "[object Object]", perdiendo el motivo real. Se
  // busca .message en cualquier objeto, no solo en Error de verdad.
  const mensaje = error instanceof Error
    ? error.message
    : (error && typeof error === "object" && "message" in error && typeof (error as any).message === "string")
    ? (error as any).message
    : String(error);
  const detalle = {
    ...(contexto || {}),
    stack: error instanceof Error ? error.stack : undefined,
    codigoPostgres: error && typeof error === "object" && "code" in error ? (error as any).code : undefined,
    hint: error && typeof error === "object" && "hint" in error ? (error as any).hint : undefined,
  };

  return Promise.resolve(
    supabaseLogs
      .from("logs_errores")
      .insert({ origen, mensaje: mensaje.slice(0, 2000), detalle, empresa_id: empresaActualOpcional() })
      .then(({ error: insertError }) => {
        if (insertError) console.error("[logger] no se pudo guardar el log:", insertError.message);
      }),
  );
}
