import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ConfiguracionInstagramClient from "./ConfiguracionInstagramClient";

export default async function ConfiguracionInstagramPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/panel/login");

  const { data: perfil } = await supabase.from("perfiles").select("roles").eq("id", user.id).maybeSingle();
  if (!perfil?.roles?.some((r: string) => r === "admin" || r === "director")) {
    return <div className="p-6 text-sm text-slate-500">Solo Admin puede ver la Configuración.</div>;
  }

  return <ConfiguracionInstagramClient />;
}
