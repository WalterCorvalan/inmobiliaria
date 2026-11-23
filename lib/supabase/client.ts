import { createBrowserClient } from "@supabase/ssr";
import { esModoDemo } from "@/lib/demo/modo";
import { crearClienteDemo } from "@/lib/demo/cliente";

// Cliente de la base de datos de panel-v2 — proyecto Supabase aparte del de
// panel-v1 (lib/supabase/client.ts). No comparten datos ni sesión: el nombre
// de cookie de auth lo deriva @supabase/ssr de la URL del proyecto, así que
// al ser distintas, no chocan entre sí sin necesidad de configurar nada extra.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE2_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE2_PUBLISHABLE_KEY!;

// En el MODO DEMO (sin base conectada) el panel usa la base de mentira con datos de ejemplo (lib/demo/).
const demo = esModoDemo();
const crearReal = () => createBrowserClient(supabaseUrl, supabaseAnonKey);
type Cliente = ReturnType<typeof crearReal>;
export const supabase2: Cliente = demo ? (crearClienteDemo() as Cliente) : crearReal();

export function createClient(): Cliente {
  if (demo) return supabase2;
  return crearReal();
}
