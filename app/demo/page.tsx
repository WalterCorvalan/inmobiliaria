import type { Metadata } from "next";
import DemoClient from "./DemoClient";
import { rubroDemo } from "@/lib/simulador/rubros";
import { CANALES_DEMO, rubroPublico, type CanalDemo } from "@/lib/simulador/tipos";

// Demo pública sin login: /demo?rubro=inmobiliaria&canal=whatsapp. Datos ficticios, nada conectado a Meta ni a la base.
export const metadata: Metadata = { title: "Demo", robots: { index: false, follow: false } };

export default async function DemoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const canal = (CANALES_DEMO as readonly string[]).includes(String(sp.canal)) ? (sp.canal as CanalDemo) : "whatsapp";
  return <DemoClient rubro={rubroPublico(rubroDemo(typeof sp.rubro === "string" ? sp.rubro : null))} canalInicial={canal} />;
}
