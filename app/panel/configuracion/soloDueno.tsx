import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Las pantallas de Configuración son solo del dueño. Devuelve su id, o null si no es dueño (la pantalla muestra el aviso). */
export async function duenoOSalir(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/panel/login");
  const { data: perfil } = await supabase.from("perfiles").select("roles").eq("id", user.id).maybeSingle();
  return perfil?.roles?.some((r: string) => r === "admin" || r === "director") ? user.id : null;
}

export function AvisoSoloDueno() {
  return <div className="im-page"><div className="im-vacio"><h3>Solo el dueño puede ver la Configuración</h3><p>Pedile al dueño de la cuenta que haga este cambio.</p></div></div>;
}
