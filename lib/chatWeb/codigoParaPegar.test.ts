import { describe, it, expect } from "vitest";
import { codigoParaPegar, slugValido } from "./codigoParaPegar";

describe("código del chat para pegar en la web", () => {
  it("valida el identificador de la empresa", () => {
    expect(slugValido("propiedades-del-sur")).toBe(true);
    expect(slugValido("Propiedades")).toBe(false);
    expect(slugValido("a\"><script>")).toBe(false);
  });
  it("arma la etiqueta con el origen, la empresa y el color", () => {
    expect(codigoParaPegar({ origen: "https://crm.ejemplo.com/", empresa: "sur", color: "#B4532A" }))
      .toBe('<script src="https://crm.ejemplo.com/chat-web.js" data-empresa="sur" data-color="#B4532A" defer></script>');
    expect(codigoParaPegar({ origen: "https://x.com", empresa: "sur", color: "rojo" })).not.toContain("data-color");
  });
});
