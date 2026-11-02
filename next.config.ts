import type { NextConfig } from "next";

// Política de contenido: solo en producción (en desarrollo Next necesita 'unsafe-eval' para recargar en caliente).
// Se permiten los orígenes que usa la app: Supabase (datos y tiempo real) y el almacenamiento de fotos y audios.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.r2.dev https://*.r2.cloudflarestorage.com",
  "media-src 'self' https://*.r2.dev https://*.r2.cloudflarestorage.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.r2.cloudflarestorage.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
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
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      { protocol: "https", hostname: "*.r2.dev" }, // Cloudflare R2 (dominio público por defecto)
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
    ],
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