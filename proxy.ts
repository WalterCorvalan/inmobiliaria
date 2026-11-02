import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

function esRutaPanel(pathname: string) {
  return pathname === '/panel' || pathname.startsWith('/panel/');
}

async function proxyPanel(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let response = NextResponse.next({ request });

  // Sin env vars todavía (proyecto Supabase nuevo no creado) — dejamos pasar
  // sin chequear sesión en vez de romper con una excepción en cada request.
  if (!process.env.NEXT_PUBLIC_SUPABASE2_URL || !process.env.NEXT_PUBLIC_SUPABASE2_PUBLISHABLE_KEY) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE2_URL!,
    process.env.NEXT_PUBLIC_SUPABASE2_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getClaims verifica la firma de la sesión en el propio servidor (el proyecto usa claves de firma asimétricas), sin ir a
  // Supabase en cada pedido. Las páginas igual validan al usuario con getUser antes de leer datos sensibles.
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;

  if (!user && pathname !== '/panel/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/panel/login';
    return NextResponse.redirect(url);
  }

  if (user && pathname === '/panel/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/panel';
    return NextResponse.redirect(url);
  }

  return response;
}

export async function proxy(request: NextRequest) {
  if (esRutaPanel(request.nextUrl.pathname)) {
    return proxyPanel(request);
  }
  return NextResponse.next({ request });
}

// Solo el panel necesita el chequeo de sesión: la web pública no pasa por el proxy (antes corría en cada página pública
// sin hacer nada, y sumaba una vuelta en cada visita).
export const config = {
  matcher: ["/panel", "/panel/:path*"],
};
