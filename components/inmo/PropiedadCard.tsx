import FotoPropiedad from "./FotoPropiedad";
import { ESTADO_LABEL, OPERACION_LABEL, TIPO_LABEL, especificaciones, formatearPrecio, ubicacion, type Propiedad } from "@/lib/propiedades/propiedades";

/** Tarjeta de una propiedad: tipo y estado arriba, foto, nombre, dirección, datos cortos y precio. */
export default function PropiedadCard({ propiedad: p, onAbrir }: { propiedad: Propiedad; onAbrir?: (p: Propiedad) => void }) {
  const precio = formatearPrecio(p);
  const datos = especificaciones(p);
  return (
    <button type="button" className="im-card" onClick={() => onAbrir?.(p)} aria-label={`${p.titulo}, ${ESTADO_LABEL[p.estado]}`}>
      <div className="im-card-h">
        <span>{TIPO_LABEL[p.tipo]}</span>
        <span className="im-estado"><i className={`im-dot ${p.estado}`} />{ESTADO_LABEL[p.estado]}</span>
      </div>
      <FotoPropiedad propiedad={p}><span className="im-op">{OPERACION_LABEL[p.operacion]}</span></FotoPropiedad>
      <div>
        <b className="t">{p.titulo}</b>
        {ubicacion(p) && <div className="addr">{ubicacion(p)}</div>}
      </div>
      {datos.length > 0 && (
        <div className="im-specs">
          {datos.map((d, i) => (
            <span key={d} style={{ display: "contents" }}>{i > 0 && <i>•</i>}<span>{d}</span></span>
          ))}
        </div>
      )}
      <div className="im-card-f">
        <div className="im-price">{precio.monto}{precio.sufijo && <> <small>{precio.sufijo}</small></>}</div>
        {p.codigo && <span className="im-cod">{p.codigo}</span>}
      </div>
    </button>
  );
}
