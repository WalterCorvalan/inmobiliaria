// Hora y día de la lista de charlas de las bandejas (WhatsApp, Instagram y Messenger), en hora de Argentina.
// El servidor (Node) y el navegador escriben "05:46 a. m." con espacios invisibles distintos: esa diferencia hacía que
// React tirara lo que mandó el servidor y redibujara toda la bandeja al abrirla (17/11/2026). Acá se pasan a espacios
// comunes, así los dos escriben exactamente lo mismo y se ve igual que antes.
const ZONA = "America/Argentina/Buenos_Aires";

const espaciosComunes = (texto: string) => texto.replace(/[   ]/g, " ");

/** Hora de un mensaje: "05:46 a. m.". */
export function horaMensaje(fecha: string | number | Date): string {
  return espaciosComunes(new Date(fecha).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: ZONA }));
}

/** Como en WhatsApp: hoy la hora, ayer "Ayer", esta semana el día ("Lunes"), más viejo la fecha ("10/11/26"). */
export function etiquetaUltimoMensaje(fecha: string | number | Date, ahora: number = Date.now()): string {
  const diaAR = (ms: number) => new Date(ms).toLocaleDateString("sv-SE", { timeZone: ZONA });
  const ms = new Date(fecha).getTime();
  const difDias = Math.round((Date.parse(diaAR(ahora)) - Date.parse(diaAR(ms))) / 86400000);
  if (difDias <= 0) return horaMensaje(ms);
  if (difDias === 1) return "Ayer";
  if (difDias < 7) {
    const d = new Date(ms).toLocaleDateString("es-AR", { weekday: "long", timeZone: ZONA });
    return d.charAt(0).toUpperCase() + d.slice(1);
  }
  return espaciosComunes(new Date(ms).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: ZONA }));
}
