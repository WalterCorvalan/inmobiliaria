/* eslint-disable @typescript-eslint/no-explicit-any -- base de mentira del modo demo: imita la forma libre de las respuestas de Supabase */
// Cliente de la base de mentira del MODO DEMO, con los datos de ejemplo del rubro (lib/demo/datos.ts).
import { BaseFalsa } from "./supabaseFalso";
import { crearDatosDemo, EMPRESA_DEMO, USUARIO_DEMO } from "./datos";

type Fila = Record<string, any>;

function rpcDemo(nombre: string, args: any, t: Record<string, Fila[]>): any {
  switch (nombre) {
    case "mi_empresa_id": return EMPRESA_DEMO;
    case "soy_dueno": return true;
    case "rate_limit_check": return true;
    case "leads_ultima_direccion": {
      const tabla = `${args?.p_canal}_mensajes`;
      const ultimo: Record<string, Fila> = {};
      for (const m of t[tabla] || []) if (!ultimo[m.conversacion_id] || ultimo[m.conversacion_id].created_at < m.created_at) ultimo[m.conversacion_id] = m;
      return Object.values(ultimo).map((m) => ({ conversacion_id: m.conversacion_id, direccion: m.direccion }));
    }
    case "visitas_horarios_ocupados": return [];
    case "proximo_vendedor_ronda": return (t.perfiles || [])[1]?.id ?? null;
    default: return null;
  }
}

/** Cliente nuevo con los datos de ejemplo limpios. */
export function crearClienteDemo(): any {
  return new BaseFalsa({ empresaId: EMPRESA_DEMO, usuario: { id: USUARIO_DEMO, email: "demo@demo.com", nombre: "Mariana Paz" }, datos: crearDatosDemo, rpc: rpcDemo });
}
