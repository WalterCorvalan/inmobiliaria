// Analytics, el Pixel de Meta y Clarity miden solo el sitio público, nunca el panel (pedido de Walter del 16/10/2026):
// el equipo entra al panel todos los días y esas visitas se contaban como si fueran clientes en la web.
//
// Los tres se montan en app/layout.tsx, que es el mismo para el sitio y el panel, y el servidor no sabe en qué ruta
// está ese layout (ver AGENTS.md: no decidir qué dibujar con usePathname). Por eso cada script se fija la ruta en el
// navegador antes de arrancar: si la página abrió en /panel, no carga nada. El panel no tiene enlaces al sitio que
// naveguen sin recargar, así que una pestaña que abrió en el panel tampoco empieza a medir después.

export function seMideEnRuta(ruta: string): boolean {
  return !(ruta === "/panel" || ruta.startsWith("/panel/"));
}

/** La misma condición, como JavaScript para los scripts en línea. */
export const CONDICION_SITIO_PUBLICO = `!(location.pathname === "/panel" || location.pathname.indexOf("/panel/") === 0)`;

// Carga diferida (17/10/2026, Walter: "que no haya tirones"). Lighthouse en celular mostraba que los tres scripts
// frenaban la página entre 1,3 y 1,6 s apenas abría (Facebook ~750 ms, Google ~300 ms, Clarity 250 a 650 ms). Ahora
// cada uno deja armada al instante su cola (gtag, fbq, clarity: cualquier evento que llegue antes se guarda y sale
// después) y el archivo pesado se baja cuando la página ya cargó y el navegador está libre, o antes si la persona toca
// algo. Desplazarse NO dispara la carga: justo ahí es donde un script pesado se nota como tirón.
// `demoraMs` escalona los tres para que no corran juntos.
export function scriptDiferido(cargar: string, demoraMs: number): string {
  return `(function(){var hecho=false;function ir(){if(hecho)return;hecho=true;${cargar}}
["pointerdown","keydown"].forEach(function(e){addEventListener(e,ir,{once:true,passive:true});});
function libre(){setTimeout(function(){(window.requestIdleCallback||function(f){setTimeout(f,1);})(ir,{timeout:4000});},${demoraMs});}
if(document.readyState==="complete")libre();else addEventListener("load",libre,{once:true});})();`;
}
