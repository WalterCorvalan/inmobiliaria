import type { Metadata } from "next";
import { notFound } from "next/navigation";
import FloatingChatbot from "@/components/FloatingChatbot";
import { baseConfigurada, dentroDeEmpresa, empresaPorSlug, supabaseEmpresa } from "@/lib/empresa/db";
import { slugValido } from "@/lib/chatWeb/codigoParaPegar";

// Chat de la web de UNA inmobiliaria, para mostrar dentro de su sitio (lo abre public/chat-web.js en un iframe).
// La empresa sale del identificador público (slug) de la dirección; una empresa suspendida o inexistente da 404.
export const metadata: Metadata = { title: "Chat", robots: { index: false, follow: false } };

export default async function ChatEmpresaPage({ params }: { params: Promise<{ empresa: string }> }) {
  const { empresa } = await params;
  if (!slugValido(empresa)) notFound();
  let nombre: string | null = null;
  if (baseConfigurada()) {
    const empresaId = await empresaPorSlug(empresa);
    if (!empresaId) notFound();
    const { data: cfg } = await dentroDeEmpresa(empresaId, () => supabaseEmpresa.from("configuracion_empresa").select("branding_nombre").maybeSingle());
    nombre = cfg?.branding_nombre ?? null;
  }
  return <FloatingChatbot empresa={empresa} embebido nombreNegocio={nombre} />;
}
