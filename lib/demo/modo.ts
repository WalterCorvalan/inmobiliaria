// MODO DEMO: el panel se abre sin usuario ni base, con datos de ejemplo (lib/demo/). Se prende solo cuando el sitio se
// publica sin base conectada (sin NEXT_PUBLIC_SUPABASE2_URL), o a mano con NEXT_PUBLIC_MODO_DEMO=1. Cuando Walter conecte
// la base real, se apaga solo.
export function esModoDemo(): boolean {
  return process.env.NEXT_PUBLIC_MODO_DEMO === "1" || !process.env.NEXT_PUBLIC_SUPABASE2_URL;
}
