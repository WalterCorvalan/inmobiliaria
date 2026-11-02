import { createClient } from "@supabase/supabase-js";

// Rate limiter respaldado en Postgres (tabla + función `rate_limit_check` en
// migraciones/sql_rate_limit_durable.sql). El conteo por IP vive en la base,
// compartido por todas las instancias serverless — antes era un Map en
// memoria de proceso, que en un deploy multi-instancia no frenaba nada en
// serio (cada instancia arrancaba su propio contador en cero).
//
// Si la migración todavía no corrió en algún ambiente (o la DB no responde),
// se cae a un límite en memoria por proceso como red de contención mínima
// en vez de dejar el endpoint totalmente abierto.
const fallbackEnMemoria = new Map<string, { count: number; resetAt: number }>();

function rateLimitFallback(
  key: string,
  { limite, ventanaMs }: { limite: number; ventanaMs: number },
): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const ahora = Date.now();
  const entry = fallbackEnMemoria.get(key);

  if (!entry || ahora > entry.resetAt) {
    fallbackEnMemoria.set(key, { count: 1, resetAt: ahora + ventanaMs });
    return { ok: true };
  }
  if (entry.count >= limite) {
    return { ok: false, retryAfterSeconds: Math.ceil((entry.resetAt - ahora) / 1000) };
  }
  entry.count += 1;
  return { ok: true };
}

type Proyecto = "principal" | "v2";

function clienteAdmin(proyecto: Proyecto) {
  const url = proyecto === "v2" ? process.env.NEXT_PUBLIC_SUPABASE2_URL : process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = proyecto === "v2" ? process.env.SUPABASE2_SERVICE_ROLE_KEY : process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function rateLimit(
  ip: string | null,
  { limite, ventanaMs, proyecto = "principal" }: { limite: number; ventanaMs: number; proyecto?: Proyecto },
): Promise<{ ok: true } | { ok: false; retryAfterSeconds: number }> {
  const key = ip || "desconocida";

  const admin = clienteAdmin(proyecto);
  if (!admin) return rateLimitFallback(key, { limite, ventanaMs });

  const { data, error } = await admin
    .rpc("rate_limit_check", { p_clave: `${proyecto}:${key}`, p_limite: limite, p_ventana_ms: ventanaMs })
    .maybeSingle<{ ok: boolean; retry_after_seconds: number }>();

  if (error || !data) {
    // No rompemos el endpoint si la tabla/función todavía no existe en este
    // ambiente o la DB tuvo un hiccup — mejor un límite más débil que ninguno.
    return rateLimitFallback(key, { limite, ventanaMs });
  }

  if (!data.ok) return { ok: false, retryAfterSeconds: data.retry_after_seconds };
  return { ok: true };
}

export function ipDesdeRequest(req: Request): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}
