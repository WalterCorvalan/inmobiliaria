/* eslint-disable @typescript-eslint/no-explicit-any -- base de mentira del modo demo: imita la forma libre de las respuestas de Supabase */
// Respuestas de las rutas /api del panel en el MODO DEMO: no se conecta a Meta ni a ninguna base. Lo que el panel pide
// para mostrar (configuración de canales, plantillas) sale de los datos de ejemplo; lo que "manda" o "guarda" responde
// que salió bien, sin hacer nada de verdad.
import { NextResponse, type NextRequest } from "next/server";
import { crearDatosDemo } from "./datos";

const NO_CONECTA = "En la demo no se conecta con Meta. Cuando tengas tu cuenta, este botón queda andando.";

export async function respuestaApiDemo(req: NextRequest): Promise<NextResponse> {
  const ruta = req.nextUrl.pathname;
  const metodo = req.method;
  if (ruta.startsWith("/api/cron/") || ruta.includes("/webhooks/")) return NextResponse.json({ ok: true, demo: true });
  const t = crearDatosDemo();

  if (metodo === "GET") {
    if (ruta.endsWith("/branding")) {
      const c = t.configuracion_empresa[0];
      return NextResponse.json({ nombre: c.branding_nombre, logoUrl: null, color: c.branding_color_primario });
    }
    const canal = ruta.match(/^\/api\/panel\/(whatsapp|instagram|messenger)\/configuracion$/)?.[1];
    if (canal) return NextResponse.json({ config: t[`${canal}_configuracion`][0], tokenCargado: true, secretos: { appSecret: true, metaAppSecret: true } });
    if (ruta.endsWith("/whatsapp/templates")) return NextResponse.json({ templates: t.whatsapp_templates });
    if (ruta.endsWith("/whatsapp/estado")) return NextResponse.json({ error: NO_CONECTA }, { status: 400 });
    return NextResponse.json({ ok: true, demo: true });
  }

  let cuerpo: any = {};
  try { cuerpo = await req.json(); } catch { /* sin cuerpo */ }
  if (/\/(registrar|verificar-numero|sync|oauth-callback|importar|backfill-usernames)$/.test(ruta)) return NextResponse.json({ error: NO_CONECTA }, { status: 400 });
  if (ruta.endsWith("/equipo")) {
    return NextResponse.json({ ok: true, perfil: { id: crypto.randomUUID(), nombre: String(cuerpo?.nombre || "Nuevo asesor").slice(0, 80), roles: cuerpo?.roles || ["ventas"], activo: true, sucursal_id: cuerpo?.sucursal_id || null, usuario: cuerpo?.usuario || null, whatsapp: cuerpo?.whatsapp || null } });
  }
  if (ruta.endsWith("/login-usuario")) return NextResponse.json({ email: "demo@demo.com" });
  if (ruta.endsWith("/whatsapp/templates")) return NextResponse.json({ ok: true, template: { id: crypto.randomUUID(), estado: "pending", ...cuerpo } });
  if (ruta.endsWith("/rodi/mensaje")) return NextResponse.json({ ok: true, demo: true });
  return NextResponse.json({ ok: true, demo: true });
}
