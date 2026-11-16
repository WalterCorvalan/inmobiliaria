import type { Metadata } from "next";
import DemoClient from "./DemoClient";
import { NEGOCIOS_DEMO, rubroDemo } from "@/lib/simulador/rubros";
import { CANALES_DEMO, rubroPublico, type CanalDemo } from "@/lib/simulador/tipos";

// Demo pública sin login: /demo?negocio=...&canal=whatsapp. Datos ficticios, nada conectado a Meta ni a la base.
export const metadata: Metadata = { title: "Demo", robots: { index: false, follow: false } };

export default async function DemoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const canal = (CANALES_DEMO as readonly string[]).includes(String(sp.canal)) ? (sp.canal as CanalDemo) : "whatsapp";
  const slug = typeof sp.negocio === "string" ? sp.negocio : null;
  const negocios = NEGOCIOS_DEMO.map((n) => ({ slug: n.slug, nombre: n.nombreNegocio }));
  return <DemoClient key={slug ?? ""} rubro={rubroPublico(rubroDemo(slug))} canalInicial={canal} negocios={negocios} />;
}
