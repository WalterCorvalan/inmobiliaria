import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

// Server client de la DB de panel-v2 — mismo patrón que lib/supabase/server.ts
// pero apuntando al proyecto Supabase nuevo (env vars NEXT_PUBLIC_SUPABASE2_*).
async function crearCliente() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE2_URL!,
    process.env.NEXT_PUBLIC_SUPABASE2_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Components no pueden modificar cookies durante el render.
          }
        },
      },
    }
  );
}

// Una sola consulta de "quién es" por pedido (27/10/2026, velocidad del panel). El layout del panel y la página llaman
// cada uno a auth.getUser(), y cada llamada era un viaje hasta Supabase: con cache() de React, dentro del mismo dibujo
// en el servidor la segunda reusa la respuesta de la primera. Sigue siendo getUser (Supabase valida la sesión), no se
// cambió a algo menos seguro. Fuera de un dibujo (rutas de API) cache() no guarda nada y cada llamada consulta como antes.
const usuarioDelPedido = cache(async () => (await crearCliente()).auth.getUser());

export async function createClient() {
  const cliente = await crearCliente();
  const getUserOriginal = cliente.auth.getUser.bind(cliente.auth);
  cliente.auth.getUser = ((jwt?: string) => (jwt ? getUserOriginal(jwt) : usuarioDelPedido())) as typeof cliente.auth.getUser;
  return cliente;
}
