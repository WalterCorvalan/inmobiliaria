import { describe, expect, it } from "vitest";
import { parsearResumen, renglonesCortos } from "./parsearResumen";

const informe = [
  "📥 Consultas de los últimos 7 días: 32 (+88% vs la semana anterior). Instagram 15 · WhatsApp 13 · Messenger 4",
  "🛒 Ventas cerradas en los últimos 7 días: 0",
  "🎯 Qué canal termina en venta (90 días): Salón 1 de 6 · Instagram 0 de 32",
  '🔎 Lo más buscado en el catálogo (15 días): "sedan" 21 · "pickup" 20. Sin resultados: "hilux", "hibrido"',
  "💸 Anuncios: no hay gasto cargado esta semana (se completa solo cuando estén conectadas las cuentas de anuncios, o a mano en Marketing → Pautas).",
  "💡 Sugerencias:",
  "• Hay 10 consultas sin atender: responderlas primero.",
  "• Revisar el seguimiento.",
  "👀 Para revisar afuera del panel:",
  "• Search Console: mirá Rendimiento.",
].join("\n");

describe("parsearResumen", () => {
  const s = parsearResumen(informe);

  it("separa título, dato principal y canales", () => {
    expect(s[0]).toMatchObject({ emoji: "📥", titulo: "Consultas de los últimos 7 días", principal: "32 (+88% vs la semana anterior)", chips: ["Instagram 15", "WhatsApp 13", "Messenger 4"], detalle: null });
    expect(s[1]).toMatchObject({ titulo: "Ventas cerradas en los últimos 7 días", principal: "0", chips: [] });
    expect(s[2]).toMatchObject({ principal: "", chips: ["Salón 1 de 6", "Instagram 0 de 32"] });
  });

  it("las búsquedas quedan como chips y lo que sigue al punto como detalle", () => {
    expect(s[3]).toMatchObject({ chips: ['"sedan" 21', '"pickup" 20'], detalle: 'Sin resultados: "hilux", "hibrido"' });
  });

  it("no corta un texto largo sin punto seguido", () => {
    expect(s[4].principal.startsWith("no hay gasto cargado")).toBe(true);
    expect(s[4].detalle).toBeNull();
  });

  it("los renglones con • van como lista de la sección de arriba", () => {
    expect(s[5]).toMatchObject({ titulo: "Sugerencias", principal: "" });
    expect(s[5].items).toEqual([
      { titulo: "Hay 10 consultas sin atender", texto: "responderlas primero." },
      { titulo: null, texto: "Revisar el seguimiento." },
    ]);
    expect(s[6].items).toEqual([{ titulo: "Search Console", texto: "mirá Rendimiento." }]);
    expect(s).toHaveLength(7);
  });

  it("la versión corta muestra los primeros datos y cuántos quedan", () => {
    const { renglones, restantes } = renglonesCortos(s, 2);
    expect(renglones).toEqual(["📥 Consultas de los últimos 7 días: 32 (+88% vs la semana anterior)", "🛒 Ventas cerradas en los últimos 7 días: 0"]);
    expect(restantes).toBe(5);
  });
});
