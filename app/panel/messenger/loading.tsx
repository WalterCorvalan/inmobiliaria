import { PanelSkeletonTabla } from "@/components/panel/PanelSkeleton";

// Esqueleto inmediato al entrar al módulo (antes caía en el del Dashboard, que no se parece a esta pantalla).
export default function Loading() {
  return <PanelSkeletonTabla />;
}
