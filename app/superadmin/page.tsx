import type { Metadata } from "next";
import Link from "next/link";
import { clienteServicio } from "@/lib/empresa/db";
import { clienteDeSesion } from "@/lib/empresa/sesion";
import { cambiarEstadoEmpresa } from "./acciones";
import AltaEmpresaForm from "./AltaEmpresaForm";

// Panel del equipo de la plataforma: alta de inmobiliarias (sin SQL), suspender y reactivar. Solo para quien está en
// la tabla superadmins (se agrega a mano en Supabase: insert into superadmins (user_id) values ('<id del usuario>')).
export const metadata: Metadata = { title: "Superadmin", robots: { index: false, follow: false } };

export default async function SuperadminPage() {
  const sesion = await clienteDeSesion();
  const { data: { user } } = await sesion.auth.getUser();
  const db = clienteServicio();
  const { data: esSuper } = user ? await db.from("superadmins").select("user_id").eq("user_id", user.id).maybeSingle() : { data: null };
  if (!user || !esSuper) {
    return <div className="panel-v2-root im-page"><div className="im-vacio"><h3>Solo para el equipo de la plataforma</h3><p>Entrá primero con tu usuario en <Link href="/panel/login">/panel/login</Link>.</p></div></div>;
  }

  const [{ data: empresas }, { data: perfiles }] = await Promise.all([
    db.from("empresas").select("id, nombre, slug, estado, created_at").order("created_at", { ascending: false }),
    db.from("perfiles").select("empresa_id, activo"),
  ]);
  const usuarios = (id: string) => (perfiles ?? []).filter((p) => p.empresa_id === id && p.activo).length;

  return (
    <div className="panel-v2-root im-page" style={{ maxWidth: 960, margin: "0 auto", padding: 16 }}>
      <div className="im-head"><div><h1>Superadmin</h1><p>Inmobiliarias de la plataforma.</p></div></div>
      <AltaEmpresaForm />
      <div className="im-box">
        <div className="im-box-h"><h2>Empresas</h2><span className="im-note">{empresas?.length ?? 0}</span></div>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
          {(empresas ?? []).map((e) => (
            <li key={e.id} className="im-card" style={{ padding: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 240px" }}>
                <strong>{e.nombre}</strong>
                <div className="im-note">{e.slug} · {usuarios(e.id)} usuarios · alta {new Date(e.created_at).toLocaleDateString("es-AR")}</div>
              </div>
              <span className="im-note">{e.estado === "activa" ? "Activa" : "Suspendida"}</span>
              <form action={cambiarEstadoEmpresa}>
                <input type="hidden" name="id" value={e.id} />
                <input type="hidden" name="estado" value={e.estado === "activa" ? "suspendida" : "activa"} />
                <button type="submit" className="im-btn">{e.estado === "activa" ? "Suspender" : "Reactivar"}</button>
              </form>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
