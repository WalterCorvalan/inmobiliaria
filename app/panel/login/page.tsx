"use client";

import { useEffect, useState } from "react";
import { supabase2 } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2, Lock, User } from "lucide-react";

// Login propio de panel-v2 — Auth vive en el proyecto Supabase nuevo, separado
// del de panel-v1 (app/(auth)/login), así que no puede reusar esa sesión.
//
// Login por "usuario" (pedido del 29/9): Supabase Auth sigue autenticando
// por email como siempre, sin tocar ninguna cuenta existente -- acá solo se
// le pide al empleado un alias corto ("Fede") y, si lo que escribió no es
// directamente un email, se resuelve a su email real vía
// /api/panel/login-usuario (perfiles.usuario, ver migraciones/
// sql_perfiles_usuario.sql) antes de llamar a signInWithPassword. Si alguien
// todavía prefiere tipear su email de siempre, también funciona -- no hay
// forma de que este cambio deje a nadie sin poder entrar.
export default function LoginPageV2() {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  // Nombre, logo y color de la empresa (Configuración > Empresa > Branding). Sin nada cargado queda Pfaffen Cars.
  const [marca, setMarca] = useState<{ nombre: string | null; logoUrl: string | null; color: string | null }>({ nombre: null, logoUrl: null, color: null });
  useEffect(() => { fetch("/api/panel/branding").then((r) => r.json()).then(setMarca).catch(() => {}); }, []);
  const nombreEmpresa = marca.nombre || "Pfaffen Cars";
  const colorMarca = marca.color || "#0145F2";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    let email = usuario.trim();
    if (!email.includes("@")) {
      try {
        const res = await fetch("/api/panel/login-usuario", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ usuario: email }),
        });
        const data = await res.json();
        if (!res.ok || !data.email) {
          setError("Usuario o contraseña incorrectos.");
          setLoading(false);
          return;
        }
        email = data.email;
      } catch {
        setError("No se pudo conectar. Probá de nuevo.");
        setLoading(false);
        return;
      }
    }

    const { data, error: authError } = await supabase2.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !data.user) {
      setError("Usuario o contraseña incorrectos.");
      setLoading(false);
      return;
    }

    // El toggle "Inactivo" de Configuración → Usuarios (UsuariosClient.tsx)
    // solo marcaba perfiles.activo=false -- nada lo chequeaba acá, así que
    // un empleado dado de baja seguía pudiendo loguearse y usar todo el
    // panel con sus credenciales de Supabase Auth intactas.
    const { data: perfil } = await supabase2.from("perfiles").select("activo").eq("id", data.user.id).maybeSingle();
    if (perfil?.activo === false) {
      await supabase2.auth.signOut();
      setError("Tu cuenta está desactivada. Contactá a un administrador.");
      setLoading(false);
      return;
    }

    router.push("/panel");
    router.refresh();
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-slate-50 dark:bg-[#0a0a0f] px-4 py-8 sm:py-12">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg mb-4 overflow-hidden">
            <img src="/pfaffen-automotores-icono.webp" alt={nombreEmpresa} className="w-full h-full object-cover" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{nombreEmpresa}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Ingresá al panel</p>
        </div>

        <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm p-6 sm:p-7">
          <form className="space-y-4" onSubmit={handleLogin} noValidate>
            <div>
              <label htmlFor="usuario" className="text-xs font-semibold text-slate-600 dark:text-slate-300">Usuario</label>
              <div className="relative mt-1.5">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  id="usuario"
                  type="text"
                  autoComplete="username"
                  required
                  autoFocus
                  inputMode="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="Tu nombre de usuario"
                  className="w-full pl-10 pr-3.5 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-base text-slate-900 dark:text-white outline-none transition-colors focus:border-[#0145F2] focus:bg-white dark:focus:bg-white/[0.07] placeholder:text-slate-400"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="text-xs font-semibold text-slate-600 dark:text-slate-300">Contraseña</label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-base text-slate-900 dark:text-white outline-none transition-colors focus:border-[#0145F2] focus:bg-white dark:focus:bg-white/[0.07] placeholder:text-slate-400"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="text-rose-700 dark:text-rose-300 text-xs font-medium text-center bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 py-2.5 px-3 rounded-xl">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{ backgroundColor: colorMarca }}
              className="w-full flex items-center justify-center gap-2 py-3.5 sm:py-3 rounded-xl text-[15px] sm:text-sm font-bold text-white hover:brightness-90 active:brightness-75 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? "Ingresando..." : "Iniciar sesión"}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-slate-400 dark:text-slate-600 mt-6">
          {nombreEmpresa} — Panel interno
        </p>
      </div>
    </div>
  );
}
