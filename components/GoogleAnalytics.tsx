import Script from "next/script";
import { CONDICION_SITIO_PUBLICO, scriptDiferido } from "@/lib/medicionSoloSitio";

// Solo se monta si hay measurement ID configurado — así en local (sin la env
// var) no manda nada a GA y no rompe el desarrollo. En el panel no arranca y el archivo de Google se baja diferido
// (lib/medicionSoloSitio.ts).
export default function GoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!gaId) return null;

  const cargar = `var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id=${gaId}';document.head.appendChild(s);`;
  return (
    <Script id="ga4-init" strategy="afterInteractive">
      {`
        if (${CONDICION_SITIO_PUBLICO}) {
          window.dataLayer = window.dataLayer || [];
          window.gtag = function(){dataLayer.push(arguments);};
          gtag('js', new Date());
          gtag('config', '${gaId}');
          ${scriptDiferido(cargar, 1500)}
        }
      `}
    </Script>
  );
}
