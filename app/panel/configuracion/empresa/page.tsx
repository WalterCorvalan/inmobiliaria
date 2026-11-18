import { duenoOSalir, AvisoSoloDueno } from "../soloDueno";
import ConfiguracionEmpresaClient from "./ConfiguracionEmpresaClient";

export default async function ConfiguracionEmpresaPage() {
  if (!(await duenoOSalir())) return <AvisoSoloDueno />;
  return <ConfiguracionEmpresaClient />;
}
