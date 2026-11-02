import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { sincronizarPlantillas, TemplateError } from "@/lib/panel/whatsappTemplates";
import { conEmpresaDeSesion } from "@/lib/empresa/sesion";

async function requireAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE2_URL!,
    process.env.NEXT_PUBLIC_SUPABASE2_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: perfil } = await supabase.from("perfiles").select("roles").eq("id", user.id).maybeSingle();
  if (!perfil?.roles?.some((r: string) => r === "admin" || r === "director")) return null;
  return user;
}

async function POST_() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  try {
    const { actualizadas, importadas } = await sincronizarPlantillas();
    return NextResponse.json({ ok: true, actualizadas, importadas });
  } catch (err) {
    if (err instanceof TemplateError) {
      return NextResponse.json({ error: err.message }, { status: err.code === "not_connected" ? 409 : 422 });
    }
    return NextResponse.json({ error: "Error sincronizando plantillas." }, { status: 500 });
  }
}

export const POST = conEmpresaDeSesion(POST_);
