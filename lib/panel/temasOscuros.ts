// Colores del modo oscuro a elección (Walter, 21/10/2026). El oscuro toma el tema que cada
// persona elige en Mi Perfil (perfiles.tema_oscuro). Cada tema es un juego de colores que app/panel-tema-oscuro.css
// aplica a todo el panel con las clases "tema-oscuro" + "tema-<id>" en <body> (PanelLayoutClient.tsx).
// "negro" es el oscuro de siempre: no lleva clases. Las paletas salen de coolors.co/palettes/trending; las tarjetas se
// ajustaron para que se lea bien sobre cada fondo.

export const TEMAS_OSCUROS = [
  { id: "negro", nombre: "Negro (el de siempre)", fondo: "#0a0a0a", tarjeta: "#141414", acento: "#0145F2" },
  { id: "gris", nombre: "Gris", fondo: "#495057", tarjeta: "#3d444b", acento: "#0145F2" },
  { id: "azul_marino", nombre: "Azul marino", fondo: "#0b1733", tarjeta: "#13234a", acento: "#0145F2" },
  { id: "noche_oro", nombre: "Noche y oro", fondo: "#000814", tarjeta: "#001D3D", acento: "#FFC300" },
  { id: "oceano", nombre: "Océano", fondo: "#003049", tarjeta: "#0A4060", acento: "#669BBC" },
  // Softcars oscuro (Walter, 26/10/2026, reemplaza a "Bordó"): el Softcars de noche.
  { id: "softcars_oscuro", nombre: "Softcars oscuro", fondo: "#1E2430", tarjeta: "#3A4A6B", acento: "#F08A8A" },
  { id: "petroleo", nombre: "Petróleo", fondo: "#04151F", tarjeta: "#183A37", acento: "#C44900" },
  { id: "bosque", nombre: "Bosque", fondo: "#344E41", tarjeta: "#3A5A40", acento: "#A3B18A" },
] as const;

export type TemaOscuro = (typeof TEMAS_OSCUROS)[number]["id"];
export const IDS_TEMAS_OSCUROS = TEMAS_OSCUROS.map((t) => t.id) as [TemaOscuro, ...TemaOscuro[]];

/** El que no eligió nada (o tiene un valor viejo, como "softcars") ve el negro de siempre (Walter, 27/10/2026). */
export const TEMA_OSCURO_POR_DEFECTO: TemaOscuro = "negro";

/** Modo claro: Softcars clásico para todos (Walter, 27/10/2026; antes era un color más del modo oscuro). Colores en
 *  app/panel-tema-oscuro.css (.tema-softcars). */
export const CLASE_MODO_CLARO = "tema-softcars";

export function temaOscuroValido(v: string | null | undefined): TemaOscuro {
  return TEMAS_OSCUROS.some((t) => t.id === v) ? (v as TemaOscuro) : TEMA_OSCURO_POR_DEFECTO;
}

/** Clases que van en <body>: ninguna para el negro de siempre. */
export function clasesTemaOscuro(tema: TemaOscuro): string[] {
  return tema === "negro" ? [] : ["tema-oscuro", `tema-${tema.replace("_", "-")}`];
}

/** Clases del contenedor del panel con el modo oscuro prendido. */
export function clasesModoOscuro(tema: TemaOscuro): string {
  return ["dark", ...clasesTemaOscuro(tema)].join(" ");
}

/** Aviso entre Mi Perfil y el panel para cambiar el color al instante, sin recargar. */
export const EVENTO_TEMA_OSCURO = "pfaffen:tema-oscuro";
