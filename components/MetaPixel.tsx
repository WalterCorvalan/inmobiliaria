import Script from "next/script";
import { CONDICION_SITIO_PUBLICO, scriptDiferido } from "@/lib/medicionSoloSitio";

// Solo se monta si hay pixel ID configurado — mismo criterio que
// GoogleAnalytics.tsx, así en local (sin la env var) no manda nada a Meta. En el panel no arranca, y el archivo de
// Meta se baja diferido: la cola fbq guarda el PageView y los eventos hasta que llega (lib/medicionSoloSitio.ts).
export default function MetaPixel() {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  if (!pixelId) return null;

  const cargar = "var t=document.createElement('script');t.async=!0;t.src='https://connect.facebook.net/en_US/fbevents.js';document.head.appendChild(t);";

  return (
    <>
      <Script id="meta-pixel-init" strategy="afterInteractive">
        {`
          if (${CONDICION_SITIO_PUBLICO}) {
          !function(f){if(f.fbq)return;var n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];}(window);
          fbq('init', '${pixelId}');
          fbq('track', 'PageView');
          ${scriptDiferido(cargar, 3000)}
          }
        `}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
