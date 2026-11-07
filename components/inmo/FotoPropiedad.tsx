import { fotoPortada, type Propiedad } from "@/lib/propiedades/propiedades";

// Paletas (cielo, tejado/detalle, pared, sombra) para la ilustración que se muestra mientras la propiedad no tiene fotos.
const PALETAS = [
  ["#f6d8b8", "#c9674a", "#efe3d2", "#6b4a38"], ["#e6e2c4", "#7a8a4d", "#f3ead8", "#5a4636"], ["#d7e3ea", "#c48a5a", "#f1e7d8", "#4d5560"], ["#f3d9c0", "#a8553a", "#e9e0cf", "#68503f"],
  ["#e8e0d2", "#8a9a68", "#f4ecdd", "#5b4a3c"], ["#d9e6e2", "#b86b4a", "#efe6d3", "#6a5645"], ["#ecd9b9", "#8b5a3c", "#f2e9da", "#4a4038"], ["#dfe5d0", "#c07a52", "#f3eadb", "#5d4a3b"],
];

function semilla(texto: string): number {
  let h = 0;
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) >>> 0;
  return h;
}

/** Ilustración de una casa o un edificio, siempre la misma para la misma propiedad. */
export function IlustracionPropiedad({ id, titulo }: { id: string; titulo: string }) {
  const h = semilla(id);
  const c = PALETAS[h % PALETAS.length];
  const estilo = (h >> 3) % 4;
  const g = `g-${id}`;
  const ventana = (x: number, y: number, w: number, a: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width={w} height={a} rx="3" fill="#fffaf0" opacity=".9" />
      <rect x={x} y={y + a / 2 - 1} width={w} height="2" fill={c[3]} opacity=".35" />
    </g>
  );
  return (
    <svg viewBox="0 0 400 300" role="img" aria-label={`Ilustración de ${titulo}`} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c[0]} /><stop offset="1" stopColor={c[2]} /></linearGradient>
      </defs>
      <rect width="400" height="300" fill={`url(#${g})`} />
      <rect y="236" width="400" height="64" fill={c[1]} opacity=".28" />
      <circle cx="352" cy="190" r="34" fill={c[1]} opacity=".75" />
      <rect x="348" y="205" width="8" height="40" fill={c[3]} opacity=".7" />
      {estilo === 0 && (<><rect x="80" y="96" width="210" height="144" fill="#fbf4e8" /><rect x="80" y="86" width="210" height="14" fill={c[3]} />{ventana(100, 120, 50, 50)}{ventana(170, 120, 50, 50)}{ventana(240, 120, 34, 50)}<rect x="150" y="190" width="40" height="50" fill={c[1]} /></>)}
      {estilo === 1 && (<><rect x="70" y="120" width="230" height="120" fill="#fbf4e8" /><polygon points="55,124 185,50 315,124" fill={c[1]} />{ventana(92, 148, 44, 44)}{ventana(236, 148, 44, 44)}<rect x="164" y="170" width="42" height="70" rx="3" fill={c[3]} /></>)}
      {estilo === 2 && (<><rect x="100" y="60" width="150" height="180" fill="#fbf4e8" /><rect x="92" y="54" width="166" height="10" fill={c[3]} />{ventana(116, 84, 36, 32)}{ventana(198, 84, 36, 32)}{ventana(116, 136, 36, 32)}{ventana(198, 136, 36, 32)}<rect x="158" y="196" width="34" height="44" fill={c[1]} /></>)}
      {estilo === 3 && (<><rect x="60" y="130" width="250" height="110" fill="#fbf4e8" /><rect x="60" y="116" width="250" height="18" fill={c[3]} /><rect x="120" y="76" width="130" height="44" fill="#fbf4e8" /><rect x="112" y="70" width="146" height="10" fill={c[3]} />{ventana(76, 156, 48, 40)}{ventana(150, 156, 48, 40)}{ventana(224, 156, 70, 40)}{ventana(138, 90, 36, 22)}{ventana(196, 90, 36, 22)}</>)}
    </svg>
  );
}

/** La foto de portada de la propiedad; si todavía no tiene, la ilustración con el cartel "Sin foto". */
export default function FotoPropiedad({ propiedad, children }: { propiedad: Pick<Propiedad, "id" | "titulo" | "propiedad_fotos">; children?: React.ReactNode }) {
  const url = fotoPortada(propiedad);
  return (
    <div className="im-photo">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={propiedad.titulo} loading="lazy" />
      ) : (
        <>
          <IlustracionPropiedad id={propiedad.id} titulo={propiedad.titulo} />
          <span className="im-sinfoto">Sin foto</span>
        </>
      )}
      {children}
    </div>
  );
}
