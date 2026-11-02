import Script from "next/script";
import { CONDICION_SITIO_PUBLICO, scriptDiferido } from "@/lib/medicionSoloSitio";

// Solo se monta si hay project ID configurado — mismo criterio que
// GoogleAnalytics.tsx, así en local (sin la env var) no manda nada a Clarity. En el panel no arranca y el archivo de
// Clarity se baja diferido, último de los tres (lib/medicionSoloSitio.ts).
export default function MicrosoftClarity() {
  const clarityId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
  if (!clarityId) return null;

  const cargar = `var t=document.createElement('script');t.async=1;t.src='https://www.clarity.ms/tag/${clarityId}';document.head.appendChild(t);`;
  return (
    <Script id="ms-clarity-init" strategy="afterInteractive">
      {`
        if (${CONDICION_SITIO_PUBLICO}) {
          window.clarity = window.clarity || function(){(window.clarity.q = window.clarity.q || []).push(arguments);};
          ${scriptDiferido(cargar, 4500)}
        }
      `}
    </Script>
  );
}
