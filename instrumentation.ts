import type { Instrumentation } from "next";
import { registrarError } from "@/lib/panel/logger";

// Hook nativo de Next.js (no depende de Sentry ni de nada externo) — captura
// errores de Server Components/Route Handlers/Server Actions que no fueron
// atrapados por un try/catch propio, y los guarda en logs_errores.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const mensaje = err instanceof Error ? err.message : String(err);
  registrarError("panel-v2/servidor", err instanceof Error ? err : new Error(mensaje), {
    path: request.path,
    method: request.method,
    routeType: context.routeType,
    routePath: context.routePath,
  });
};
