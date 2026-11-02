import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { rateLimit, ipDesdeRequest } from "@/lib/rateLimit";
import { enviarPlantilla, TemplateError } from "@/lib/panel/whatsappTemplates";
import { z } from "zod";

const EnviarSchema = z.object({
  conversacionId: z.string().uuid(),
  templateId: z.string().uuid(),
  variable: z.string().trim().max(200).optional(),
  variables: z.array(z.string().trim().max(200)).max(4).optional(),
});

export async function POST(request: Request) {
  const limite = await rateLimit(ipDesdeRequest(request), { limite: 30, ventanaMs: 60 * 1000, proyecto: "v2" });
  if (!limite.ok) return NextResponse.json({ error: "Demasiados mensajes. Esperá un momento." }, { status: 429 });

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE2_URL!,
    process.env.NEXT_PUBLIC_SUPABASE2_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const parsed = EnviarSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });

  try {
    const resultado = await enviarPlantilla(parsed.data);
    return NextResponse.json({ ok: true, ...resultado });
  } catch (err) {
    if (err instanceof TemplateError) {
      return NextResponse.json({ error: err.message }, { status: err.code === "not_found" ? 404 : err.code === "not_connected" ? 409 : 422 });
    }
    return NextResponse.json({ error: "Error enviando la plantilla." }, { status: 500 });
  }
}
