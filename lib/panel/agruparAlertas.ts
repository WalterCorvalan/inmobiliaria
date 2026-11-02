// Ambas vistas de alertas (AlertasClient.tsx, NotificationBell.tsx) tipaban
// un campo "contador" para mostrar "x3" cuando la misma alerta se repite
// (ej: el mismo cliente sin contactar avisado varias veces), pero nada lo
// calculaba -- la tabla alertas no tiene esa columna y crearAlerta() inserta
// una fila nueva por cada aviso, sin agrupar. El badge nunca aparecía.
//
// Esto agrupa client-side por (tipo + titulo) -- alertas ya vienen
// ordenadas por created_at desc, así que la primera ocurrencia de cada
// grupo es la más reciente y queda como representante visible.

export interface AlertaBase {
  id: string;
  tipo: string;
  prioridad: string;
  titulo: string;
  mensaje: string | null;
  link: string | null;
  leida: boolean;
  created_at: string;
}

export type AlertaAgrupada<T extends AlertaBase> = T & { contador: number; idsGrupo: string[] };

export function agruparAlertas<T extends AlertaBase>(alertas: T[]): AlertaAgrupada<T>[] {
  const mapa = new Map<string, AlertaAgrupada<T>>();
  const orden: string[] = [];
  for (const a of alertas) {
    const clave = `${a.tipo}::${a.titulo}`;
    const existente = mapa.get(clave);
    if (existente) {
      existente.contador += 1;
      existente.idsGrupo.push(a.id);
      if (!a.leida) existente.leida = false; // el grupo queda "sin leer" si cualquiera de las repetidas lo está
    } else {
      mapa.set(clave, { ...a, contador: 1, idsGrupo: [a.id] });
      orden.push(clave);
    }
  }
  return orden.map((k) => mapa.get(k)!);
}
