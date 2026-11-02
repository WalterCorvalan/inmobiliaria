import { createBrowserClient } from "@supabase/ssr";

// Cliente de la base de datos de panel-v2 — proyecto Supabase aparte del de
// panel-v1 (lib/supabase/client.ts). No comparten datos ni sesión: el nombre
// de cookie de auth lo deriva @supabase/ssr de la URL del proyecto, así que
// al ser distintas, no chocan entre sí sin necesidad de configurar nada extra.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE2_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE2_PUBLISHABLE_KEY!;

export const supabase2 = createBrowserClient(supabaseUrl, supabaseAnonKey);

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
