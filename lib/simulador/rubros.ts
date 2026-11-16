// Rubros que tiene la demo en este proyecto. Al copiar el simulador a otro proyecto (dental-bot, automotora) se cambia
// solo esta lista y el archivo de datos del rubro.
import { DEMO_INMOBILIARIA } from "./inmobiliaria";
import type { RubroDemo } from "./tipos";

export const RUBROS_DEMO: Record<string, RubroDemo> = { inmobiliaria: DEMO_INMOBILIARIA };
export const RUBRO_POR_DEFECTO = "inmobiliaria";

export function rubroDemo(slug: string | null | undefined): RubroDemo {
  return RUBROS_DEMO[slug ?? ""] ?? RUBROS_DEMO[RUBRO_POR_DEFECTO];
}
