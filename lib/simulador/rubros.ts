// Negocios de ejemplo que tiene la demo en este proyecto (/demo?negocio=...). Al copiar el simulador a otro proyecto
// (dental-bot, automotora) se cambia solo esta lista y el archivo de datos del rubro.
import { DEMO_INMOBILIARIA, DEMO_INMOBILIARIA_2 } from "./inmobiliaria";
import type { RubroDemo } from "./tipos";

export const NEGOCIOS_DEMO: RubroDemo[] = [DEMO_INMOBILIARIA, DEMO_INMOBILIARIA_2];

export function rubroDemo(slug: string | null | undefined): RubroDemo {
  return NEGOCIOS_DEMO.find((n) => n.slug === slug) ?? NEGOCIOS_DEMO[0];
}
