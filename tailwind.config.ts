// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        // Nueva Paleta Marketplace Luminosa
        primary: "#0145F2",    // Azul principal de marca (Botones, links, acentos) — antes #0ea5e9, no coincidía con el uso real
        secondary: "#26bae0",  // Turquesa/Cian (Botones de acción gigantes)
        navy: "#0f293e",       // Azul oscuro profundo (Títulos, textos fuertes y bloques oscuros)
        background: "#f8fafc", // Fondo general (Gris ultra claro para que las tarjetas blancas destaquen)
        foreground: "#0f172a", // Texto de lectura (Casi negro)
        card: "#ffffff",       // Blanco puro para tarjetas
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Anton', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;