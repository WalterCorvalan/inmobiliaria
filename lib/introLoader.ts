// Loader de entrada de la portada (components/IntroLoader.tsx): se muestra una vez por visita.
export const CLAVE_INTRO_VISTO = "pfaffen_intro_visto";
// Aviso de cookies (components/CookieBanner.tsx): una vez aceptado no vuelve a aparecer.
export const CLAVE_COOKIES_ACEPTADAS = "pfaffen_cookies_ok";

// Corre en el <head> (app/layout.tsx) mientras el navegador lee el HTML, ANTES de dibujar nada: si el loader ya se
// vio en esta visita, o si la página no es la portada, marca <html data-intro-visto> y el CSS lo esconde (ver
// .intro-loader en app/globals.css). Así no hay ni un cuadro del loader en la segunda página, ni un cuadro de la
// página antes del loader en la primera. La ruta se mira acá, en el navegador, y no en el servidor: en Vercel la
// portada se arma con la ruta "/index" (ver components/IntroLoader.tsx).
// Lo mismo con el aviso de cookies ya aceptado (<html data-cookies-ok>, ver .aviso-cookies).
export const SCRIPT_INTRO_VISTO =
  `try{if(location.pathname!=="/"||sessionStorage.getItem("${CLAVE_INTRO_VISTO}"))document.documentElement.setAttribute("data-intro-visto","")}catch(e){}` +
  `try{if(localStorage.getItem("${CLAVE_COOKIES_ACEPTADAS}"))document.documentElement.setAttribute("data-cookies-ok","")}catch(e){}`;

// Recorrido completo de la animación de entrada. Va pegado al loader en el HTML (components/IntroLoader.tsx) y corre
// mientras el navegador lee la página, sin esperar al resto del JavaScript.
//
// Problema que resuelve (Walter, 11/10/2026: "empieza desde la mitad"). Medido en un celular lento emulado:
// - Las animaciones de CSS empiezan a contar cuando el navegador calcula los estilos, no cuando dibuja: el primer
//   cuadro salía con la luz ya 200 a 300 ms adentro de sus 700 ms.
// - La salida la decidía React, que en una conexión lenta tarda varios segundos en cargar: el loader quedaba quieto
//   y la salida se perdía entre los tirones de esa carga.
//
// Ahora: cuando el logo terminó de cargar y el navegador ya dibujó un cuadro, marca <html data-intro-anda> (el CSS
// anima la entrada solo con esa marca). A los DURACION_INTRO_MS marca <html data-intro-sale> (el CSS abre los
// paneles) y SALIDA_INTRO_MS después marca <html data-intro-visto> (el CSS lo esconde) y avisa con el evento
// EVENTO_INTRO_FIN para que el componente lo saque del documento. Si el logo no carga en 1,5 s arranca igual.
// Con la pestaña en segundo plano espera: la animación se ve entera cuando la persona vuelve.
export const DURACION_INTRO_MS = 1500;
export const SALIDA_INTRO_MS = 500;
export const EVENTO_INTRO_FIN = "intro-fin";
export const SCRIPT_INTRO_ARRANQUE =
  `(function(){var d=document,h=d.documentElement,l=d.currentScript&&d.currentScript.previousElementSibling;` +
  `if(!l||h.hasAttribute("data-intro-visto"))return;try{sessionStorage.setItem("${CLAVE_INTRO_VISTO}","1")}catch(e){}` +
  `var i=l.querySelector("img"),y=0;function a(){if(y)return;y=1;requestAnimationFrame(function(){requestAnimationFrame(function(){` +
  `h.setAttribute("data-intro-anda","");setTimeout(function(){h.setAttribute("data-intro-sale","");` +
  `setTimeout(function(){h.setAttribute("data-intro-visto","");window.dispatchEvent(new Event("${EVENTO_INTRO_FIN}"))},${SALIDA_INTRO_MS})},${DURACION_INTRO_MS})})})}` +
  `if(i&&!i.complete){i.addEventListener("load",a,{once:true});i.addEventListener("error",a,{once:true});setTimeout(a,1500)}else a()})()`;
