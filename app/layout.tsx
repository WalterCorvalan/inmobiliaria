import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google"; // <-- Nueva fuente
import "./globals.css";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import MetaPixel from "@/components/MetaPixel";
import MicrosoftClarity from "@/components/MicrosoftClarity";
import DialogosHost from "@/components/panel/Dialogos";
import { SCRIPT_INTRO_VISTO } from "@/lib/introLoader";
import MedicionClics from "@/components/MedicionClics";
import MovimientoDiferido from "@/components/MovimientoDiferido";

// Cargamos Plus Jakarta Sans una sola vez para TODO el proyecto
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["300", "400", "500", "600", "700", "800"], // Sin peso 900 porque esta fuente es más gruesa por defecto
});

// ================= METADATA SEO OPTIMIZADA =================
export const metadata: Metadata = {
  metadataBase: new URL("https://www.pfaffencars.com"),
  title: "Pfaffen Cars | Concesionaria de 0KM y Usados en Zona Norte",
  description:
    "Comprá o vendé tu auto de forma fácil y segura. Amplio catálogo de 0KM y usados seleccionados de alta gama (Toyota, Volkswagen, BMW, Audi). Sucursales en Casa Central y Don Torcuato.",
  keywords: [
    "pfaffen",
    "fafen",
    "pfaffen cars",
    "pfaffen autos",
    "pfaffenautos",
    "fafen autos",
    "fafencar",
    "agencia pfaffen",
    "comprar auto 0km",
    "vender mi auto usado",
    "comprar auto usado buenos aires",
    "cotizar auto online",
    "venta de autos usados",
    "concesionaria zona norte",
    "concesionaria casa central",
    "autos usados don torcuato",
    "agencia de autos gran buenos aires",
    "concesionaria oficial",
    "mejor que kavak",
    "alternativa a kavak",
    "vender auto rapido",
    "autos alta gama buenos aires",
    "comprar suv usada",
    "camionetas 4x4 usadas",
    "toyota",
    "volkswagen",
    "bmw",
    "audi",
    "mercedes benz",
    "ford",
    "rely",
    "karry",
    "concesionario oficial rely",
    "concesionario oficial karry",
  ],
  authors: [{ name: "Pfaffen Cars" }],
  creator: "Pfaffen Cars",
  publisher: "Pfaffen Cars",
  robots: {
    index: true,
    follow: true,
  },
  // Código de verificación de Google Search Console (Configuración >
  // Verificación de la propiedad > etiqueta HTML, ahí Google te da el
  // string que va en el content). Solo se renderiza si está cargada la env
  // var -- mismo criterio que GA/Meta Pixel/Clarity, no rompe nada sin ella.
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
  openGraph: {
    title: "Pfaffen Cars | Concesionaria de 0KM y Usados en Zona Norte",
    description:
      "Comprá o vendé tu auto de forma fácil y segura. Amplio catálogo de 0KM y usados seleccionados de alta gama.",
    url: "https://www.pfaffencars.com",
    siteName: "Pfaffen Cars",
    // Imagen de la vista previa al compartir el link (WhatsApp, Facebook, LinkedIn): el isotipo de
    // Pfaffen Automotores, cuadrado de 1200×1200 en JPG liviano (88 KB). Antes usaba logo.png (el
    // nombre en negro sobre fondo transparente, 668×173), que las redes recortaban sobre blanco.
    // No usar .webp acá: WhatsApp y Facebook no lo leen bien.
    images: [
      {
        url: "https://www.pfaffencars.com/og-pfaffen.jpg",
        width: 1200,
        height: 1200,
        type: "image/jpeg",
        alt: "Pfaffen Automotores",
      },
    ],
    locale: "es_AR",
    type: "website",
  },
  twitter: {
    card: "summary", // imagen cuadrada: con "summary_large_image" X la recortaría
    title: "Pfaffen Cars | Concesionaria de 0KM y Usados en Zona Norte",
    description:
      "Comprá o vendé tu auto de forma fácil y segura. Amplio catálogo de 0KM y usados seleccionados de alta gama.",
    images: ["https://www.pfaffencars.com/og-pfaffen.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AutoDealer",
    name: "Pfaffen Cars",
    alternateName: "Pfaffen Autos",
    image: "https://www.pfaffencars.com/logo.png",
    "@id": "https://www.pfaffencars.com",
    url: "https://www.pfaffencars.com",
    telephone: "+5491121907000",
    priceRange: "$$$",
    logo: "https://www.pfaffencars.com/logo.png",
    sameAs: [
      "https://www.instagram.com/pfaffen.cars/",
      "https://www.facebook.com/PfaffenAutos",
      "https://www.tiktok.com/@pfaffencars.com",
    ],
    areaServed: [
      "Zona Norte, Buenos Aires",
      "Casa Central, Malvinas Argentinas",
      "Don Torcuato, Tigre"
    ],
    description:
      "Concesionaria de autos 0KM y usados seleccionados de alta gama en Buenos Aires.",
  };

  return (
    // Inyectamos la variable de la NUEVA fuente
    <html lang="es" className={jakarta.variable} suppressHydrationWarning>
      <head>
        {/* Antes de dibujar: si el loader de la portada ya se vio en esta visita, o si ya se aceptaron las cookies, no se muestran (lib/introLoader.ts). */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_INTRO_VISTO }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="font-sans bg-background text-foreground antialiased flex flex-col min-h-screen">
        <GoogleAnalytics />
        <MetaPixel />
        <MicrosoftClarity />
        <MedicionClics />
        <MovimientoDiferido>
          {children}
          <DialogosHost />
        </MovimientoDiferido>
      </body>
    </html>
  );
}
