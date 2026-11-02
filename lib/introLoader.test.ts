import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { DURACION_INTRO_MS, EVENTO_INTRO_FIN, SALIDA_INTRO_MS, SCRIPT_INTRO_ARRANQUE, SCRIPT_INTRO_VISTO } from "./introLoader";

// Regresión del error de React #418 en la portada publicada (11/10/2026). En Vercel la portada se arma en el
// servidor con la ruta "/index" y en el navegador es "/": si el loader decide dibujarse con la ruta que da Next, el
// HTML del servidor y el primer dibujo del navegador no coinciden y React redibuja toda la página.
it("el loader de la portada no decide su primer dibujo con la ruta del servidor", () => {
  const fuente = readFileSync("components/IntroLoader.tsx", "utf8");
  // Se mira el import: el archivo explica el problema en un comentario y ahí sí nombra al hook.
  expect(fuente).not.toMatch(/from "next\/navigation"/);
});

it("el script del <head> esconde el loader fuera de la portada, mirando la ruta en el navegador", () => {
  expect(SCRIPT_INTRO_VISTO).toContain('location.pathname!=="/"');
  expect(SCRIPT_INTRO_VISTO).toContain("data-intro-visto");
});

// Walter, 11/10/2026: la animación de entrada a veces se veía "desde la mitad". Empezaba a contar con los estilos y
// no con el primer dibujo, y la salida dependía de que cargara todo el JavaScript. Ahora la maneja entera un script
// pegado al loader: arranca cuando ya hay un cuadro dibujado y el logo cargó, y sale sola.
it("la entrada y la salida del loader esperan las marcas que pone su script, no a React", () => {
  const css = readFileSync("app/globals.css", "utf8");
  expect(css).toContain("html[data-intro-anda] .intro-marca { animation: intro-marca-entra");
  expect(css).toContain("html[data-intro-anda] .intro-luz { animation: intro-luz-cruza");
  expect(css).toContain("html[data-intro-sale] .intro-panel-arriba { animation: intro-panel-sube");
  expect(css).not.toMatch(/^\.intro-(marca|linea|luz) \{ animation:/m);
  expect(css).not.toContain(".intro-saliendo");
  const loader = readFileSync("components/IntroLoader.tsx", "utf8");
  expect(loader).toContain("__html: SCRIPT_INTRO_ARRANQUE");
  expect(loader).not.toContain("performance.now()");
  expect(loader).not.toContain("sessionStorage");
});

it("el script del loader arranca tras dos cuadros, sale solo y avisa al terminar", () => {
  expect(SCRIPT_INTRO_ARRANQUE).toContain("requestAnimationFrame(function(){requestAnimationFrame(");
  expect(SCRIPT_INTRO_ARRANQUE).toContain('hasAttribute("data-intro-visto"))return');
  expect(SCRIPT_INTRO_ARRANQUE).toContain('setAttribute("data-intro-anda","")');
  expect(SCRIPT_INTRO_ARRANQUE).toContain('setAttribute("data-intro-sale","")');
  expect(SCRIPT_INTRO_ARRANQUE).toContain(`new Event("${EVENTO_INTRO_FIN}"))},${SALIDA_INTRO_MS})},${DURACION_INTRO_MS})`);
  expect(() => new Function(SCRIPT_INTRO_ARRANQUE)).not.toThrow();
});
