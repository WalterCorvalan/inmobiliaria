import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEmpresa as supabaseAdmin, empresaActual } from "@/lib/empresa/db";
import { crearPlantilla, eliminarPlantilla, TemplateError } from "@/lib/panel/whatsappTemplates";
import { z } from "zod";
import { conEmpresaDeSesion } from "@/lib/empresa/sesion";

const CrearSchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  idioma: z.string().trim().min(2).max(10).default("es_AR"),
  categoria: z.enum(["UTILITY", "MARKETING"]).default("UTILITY"),
  cuerpo: z.string().trim().min(1).max(1024),
  ejemplos: z.array(z.string().trim().max(100)).max(4).optional(),
});


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

async function GET_() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { data, error } = await supabaseAdmin.from("whatsapp_templates").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data });
}

async function POST_(request: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const parsed = CrearSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });

  try {
    const template = await crearPlantilla(parsed.data);
    return NextResponse.json({ ok: true, template });
  } catch (err) {
    if (err instanceof TemplateError) {
      return NextResponse.json({ error: err.message }, { status: err.code === "not_connected" ? 409 : 422 });
    }
    return NextResponse.json({ error: "Error creando la plantilla." }, { status: 500 });
  }
}

// Borrar una plantilla (en Meta y en el panel). Solo admin o director, como crear.
async function DELETE_(request: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  try {
    await eliminarPlantilla(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof TemplateError) return NextResponse.json({ error: err.message }, { status: err.code === "not_found" ? 404 : 422 });
    return NextResponse.json({ error: "Error borrando la plantilla." }, { status: 500 });
  }
}

export const GET = conEmpresaDeSesion(GET_);
export const POST = conEmpresaDeSesion(POST_);
export const DELETE = conEmpresaDeSesion(DELETE_);
