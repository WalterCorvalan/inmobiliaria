// Formato de salida de la IA: siempre el mismo, para cualquier empresa y cualquier canal.
export const SCHEMA_SALIDA = `Respondé SIEMPRE en este formato JSON exacto, sin texto fuera del JSON:
{
  "reply": "tu respuesta al cliente (si querés mandar varias burbujas, separalas con |||)",
  "handoff": false,
  "pausar_sin_notificar": false o true — SOLO true en el caso CLIENTE OFENSIVO (ver regla), junto con "handoff": true. En cualquier otro caso omitilo o dejalo false,
  "resumen_handoff": null o string — SOLO si "handoff" es true (ver regla DERIVAR). Si "handoff" es false, siempre null,
  "intencion": null o "CONSULTA" | "VISITA" | "NEGOCIAR" | "HABLAR_CON_ASESOR" | "OTRA_CONSULTA" — la intención de ESTE momento de la charla,
  "calificacion": null o "caliente" | "tibio" | "frio",
  "datos_detectados": {
    "nombre": null o string,
    "email": null o string,
    "telefono": null o string,
    "interes": null o string — qué busca o qué necesita, con las palabras del cliente,
    "presupuesto": null o string — lo que dijo que puede o quiere pagar, con moneda si la dijo,
    "plazo": null o string — para cuándo lo necesita,
    "zona": null o string — identificador (slug) de la sucursal elegida, tal como figura en la lista de SUCURSALES,
    "dia_visita": null o string — fecha puntual confirmada (ej: "lunes 14"), no solo el día de la semana,
    "horario_visita": null o string — horario confirmado dentro del horario de la sucursal
  }
}`;
