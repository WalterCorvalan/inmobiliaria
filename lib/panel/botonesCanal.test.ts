import { describe, expect, it } from "vitest";
import { COLOR_BOTON_CANAL, linkConversacionDelLead } from "./botonesCanal";

describe("Ir a la conversación desde un lead", () => {
  it("lleva al chat del canal de donde vino, abriendo esa conversación", () => {
    expect(linkConversacionDelLead("instagram", "abc")).toBe("/panel/instagram?conversacion=abc");
    expect(linkConversacionDelLead("whatsapp", "1")).toBe("/panel/whatsapp?conversacion=1");
    expect(linkConversacionDelLead("rodi", "x")).toBe("/panel/rodi?conversacion=x");
  });

  it("un lead cargado a mano no tiene chat", () => {
    expect(linkConversacionDelLead("manual", "1")).toBeNull();
  });

  it("cada canal tiene su color", () => {
    expect(COLOR_BOTON_CANAL.whatsapp).toContain("#25D366");
    expect(COLOR_BOTON_CANAL.instagram).toContain("pink");
    expect(COLOR_BOTON_CANAL.messenger).toContain("#0084FF");
    expect(COLOR_BOTON_CANAL.rodi).toContain("#0145F2");
  });
});
