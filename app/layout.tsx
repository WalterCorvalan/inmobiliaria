import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import DialogosHost from "@/components/panel/Dialogos";
import MovimientoDiferido from "@/components/MovimientoDiferido";

// Cargamos Plus Jakarta Sans una sola vez para TODO el proyecto
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["300", "400", "500", "600", "700", "800"],
});

// El producto es un panel privado: no se indexa. El nombre visible de cada empresa sale de su configuración de marca.
export const metadata: Metadata = {
  title: "Inmobiliaria CRM",
  description: "Leads y mensajes de WhatsApp, Instagram, Messenger y el chat de la web en un solo lugar.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={jakarta.variable} suppressHydrationWarning>
      <body className="font-sans bg-background text-foreground antialiased flex flex-col min-h-screen">
        <MovimientoDiferido>
          {children}
          <DialogosHost />
        </MovimientoDiferido>
      </body>
    </html>
  );
}
