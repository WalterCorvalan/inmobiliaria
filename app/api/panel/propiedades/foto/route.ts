import { NextResponse } from "next/server";
import { conEmpresaDeSesion } from "@/lib/empresa/sesion";
import { empresaActual } from "@/lib/empresa/db";
import { firmarSubidaR2, r2Configurado, urlPublicaR2 } from "@/lib/storage/r2";
import { TIPOS_FOTO } from "@/lib/propiedades";

// Da una dirección firmada para que el navegador suba UNA foto de una propiedad directo a R2.
// La foto queda en una carpeta de la empresa de quien la sube (propiedades/<empresa>/...), con un nombre que no se repite.
// Solo imágenes JPG, PNG o WebP.

async function POST_(request: Request) {
  if (!r2Configurado()) {
    return NextResponse.json({ error: "El almacenamiento de fotos todavía no está configurado (faltan las variables R2_* en Vercel)." }, { status: 503 });
  }
  const body = await request.json().catch(() => ({}));
  const contentType = String(body?.contentType ?? "");
  const extension = TIPOS_FOTO[contentType];
  if (!extension) return NextResponse.json({ error: "Solo se aceptan fotos JPG, PNG o WebP." }, { status: 400 });

  const key = `propiedades/${empresaActual()}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
  const uploadUrl = await firmarSubidaR2(key, contentType);
  return NextResponse.json({ uploadUrl, publicUrl: urlPublicaR2(key), key });
}

export const POST = conEmpresaDeSesion(POST_);
