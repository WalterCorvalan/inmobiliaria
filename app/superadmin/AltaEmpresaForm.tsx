"use client";

import { useActionState } from "react";
import { crearEmpresa, type ResultadoAlta } from "./acciones";

export default function AltaEmpresaForm() {
  const [estado, accion, enviando] = useActionState<ResultadoAlta | null, FormData>(crearEmpresa, null);
  return (
    <form className="im-box" action={accion}>
      <div className="im-box-h"><h2>Nueva inmobiliaria</h2></div>
      <div className="im-modal-b">
        <div className="im-field"><label htmlFor="sa-nombre">Nombre *</label><input id="sa-nombre" name="nombre" className="im-input" required /></div>
        <div className="im-field"><label htmlFor="sa-slug">Identificador (opcional)</label><input id="sa-slug" name="slug" className="im-input" placeholder="propiedades-del-sur" /></div>
        <div className="im-field"><label htmlFor="sa-dn">Nombre del dueño *</label><input id="sa-dn" name="duenoNombre" className="im-input" required /></div>
        <div className="im-field"><label htmlFor="sa-de">Email del dueño *</label><input id="sa-de" name="duenoEmail" type="email" className="im-input" required /></div>
        {estado && !estado.ok && <div className="im-error" role="alert">{estado.error}</div>}
        {estado?.ok && (
          <div className="im-note full" role="status">
            Listo. El dueño entra en <code>/panel/login</code> con <strong>{estado.email}</strong> y la clave <code>{estado.clave}</code> (no se vuelve a mostrar). Su chat web: <code>/chat/{estado.slug}</code>.
          </div>
        )}
      </div>
      <div className="im-modal-f"><button type="submit" className="im-btn primary" disabled={enviando}>{enviando ? "Creando..." : "Crear inmobiliaria"}</button></div>
    </form>
  );
}
