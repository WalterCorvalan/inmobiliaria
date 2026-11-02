import type { NextConfig } from "next";
import { REDIRECCIONES_SITIO_VIEJO } from "./lib/redireccionesSitioViejo";

// Solo en producción: en dev, Turbopack necesita 'unsafe-eval' para el HMR y
// no vale la pena pelear con eso en local. Dominios: Google Maps (iframe
// embed de sucursales), R2/Wikimedia/Unsplash (imágenes, mismos hosts que
// ya están en images.remotePatterns abajo), Google Analytics, Meta Pixel
// (connect.facebook.net + noscript img de facebook.com/tr) y Microsoft
// Clarity (script propio + subdominios de envío de datos, variables por
// sesión). Google Analytics con Google Ads vinculado manda datos también a doubleclick.net y a google.com (y
// google.com.ar), y Clarity carga su código desde scripts.clarity.ms: por eso los comodines (15/10/2026, plan de
// docs/marketing/medicion.md). El Pixel de Meta manda cada evento con un formulario oculto dentro de un marco hacia
// www.facebook.com/tr: sin ese dominio en form-action y frame-src, Meta no recibía nada (visto en producción el 15/10).
// Recorte de fotos con fondo de estudio (/panel/stock/fondo, 6/10):
// el modelo se baja de Hugging Face y onnxruntime trae su WebAssembly desde
// jsDelivr, por eso connect-src/script-src los incluyen junto con
// wasm-unsafe-eval (WebAssembly) y worker-src (corre en un Worker).
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net https://www.googletagmanager.com https://*.googletagmanager.com https://connect.facebook.net https://www.clarity.ms https://*.clarity.ms",
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "img-src 'self' data: blob: https://*.b-cdn.net https://upload.wikimedia.org https://images.unsplash.com https://*.r2.dev https://*.r2.cloudflarestorage.com https://www.facebook.com https://*.google-analytics.com https://*.googletagmanager.com https://*.g.doubleclick.net https://*.google.com https://*.google.com.ar https://*.clarity.ms https://c.bing.com",
  "media-src 'self' https://*.r2.dev https://*.r2.cloudflarestorage.com",
  "font-src 'self' data: https://cdn.jsdelivr.net",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://*.g.doubleclick.net https://*.google.com https://*.google.com.ar https://www.facebook.com https://www.clarity.ms https://*.clarity.ms https://huggingface.co https://*.huggingface.co https://*.hf.co https://cdn.jsdelivr.net https://*.r2.cloudflarestorage.com",
  "worker-src 'self' blob:",
  "frame-src https://www.google.com https://maps.google.com https://td.doubleclick.net https://www.facebook.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://www.facebook.com",
  "frame-ancestors 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // No anunciar con qué está hecho el sitio (cabecera X-Powered-By).
  poweredByHeader: false,
  // El navegador recuerda por unos segundos las pantallas del panel ya visitadas: ir y volver entre módulos es instantáneo
  // en vez de pedir todo de nuevo. Corto a propósito (15 s): pasado ese tiempo, o al recargar, se piden datos frescos.
  experimental: {
    staleTimes: { dynamic: 15 },
  },
  allowedDevOrigins: ['192.168.2.*', '192.168.2.111', '*.devtunnels.ms', '*.brs.devtunnels.ms', '*.trycloudflare.com'],
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      { protocol: "https", hostname: "*.b-cdn.net" }, // URLs viejas en la DB (zone de Bunny borrada, dominio queda para no romper next/image)
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "images.unsplash.com" }, // <-- Dominio agregado
      { protocol: "https", hostname: "*.r2.dev" }, // Cloudflare R2 (dominio público por defecto)
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
    ],
  },
  // "Tu catálogo" pasó a ser el showroom virtual (/showroom: el cliente elige sucursal y recorre el salón). Las direcciones
  // viejas redirigen ahí. Temporales (307) mientras el showroom se termina, para poder cambiarlas sin que queden recordadas.
  async redirects() {
    return [
      { source: "/tu-catalogo", destination: "/showroom", permanent: false },
      // Tesorería se eliminó el 21/10/2026: sus cuentas están en Finanzas → Cuentas.
      { source: "/panel/tesoreria/:path*", destination: "/panel/finanzas", permanent: false },
      { source: "/panel/tesoreria", destination: "/panel/finanzas", permanent: false },
      { source: "/showroom-test/:sucursal", destination: "/showroom/:sucursal", permanent: false },
      // Páginas del sitio viejo (pfaffenautos.com.ar), que el servidor viejo manda acá: 301 a su equivalente.
      ...REDIRECCIONES_SITIO_VIEJO.map((r) => ({ ...r, permanent: true })),
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Content-Security-Policy", value: CSP }]
            : []),
        ],
      },
      // Íconos del menú del panel (29/10/2026): el navegador los guarda una semana en vez de pedirlos en cada página.
      // Si se cambia un ícono, puede tardar hasta una semana en verse nuevo: conviene cambiarle el nombre al archivo.
      {
        source: "/icons/panel/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800" }],
      },
    ];
  },
};

export default nextConfig;