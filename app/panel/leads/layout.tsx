import type { ReactNode } from "react";
import RefrescoEnVivo from "@/components/panel/RefrescoEnVivo";

// Tiempo real de las pestañas de Tareas (ver components/panel/RefrescoEnVivo.tsx). Los leads se escuchan en
// LeadsUnificadosClient.tsx con escucharTablas.
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <RefrescoEnVivo tablas={["tareas_lead"]} />
    </>
  );
}
