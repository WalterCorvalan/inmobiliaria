import { describe, expect, it } from "vitest";
import { etiquetaAdjunto, extensionDeArchivo, resolverAdjuntoMeta } from "./adjuntosMeta";

describe("adjuntos de Instagram y Messenger", () => {
  it("un PDF se guarda con su link en vez de perderse", () => {
    const r = resolverAdjuntoMeta({ attachments: [{ type: "file", payload: { url: "https://cdn.fbsbx.com/v/t59/presupuesto.pdf?x=1" } }] });
    expect(r).toEqual({ texto: "📄 Envió un archivo", tipo: "text", mediaUrl: "https://cdn.fbsbx.com/v/t59/presupuesto.pdf?x=1", esArchivo: true });
  });
  it("foto, audio y publicación compartida siguen igual", () => {
    expect(resolverAdjuntoMeta({ attachments: [{ type: "image", payload: { url: "u" } }] }).tipo).toBe("image");
    expect(resolverAdjuntoMeta({ attachments: [{ type: "audio", payload: { url: "u" } }] }).texto).toBe("🎤 Audio");
    expect(resolverAdjuntoMeta({ attachments: [{ type: "share", payload: { url: "https://www.instagram.com/p/x" } }] }).esArchivo).toBe(false);
    expect(resolverAdjuntoMeta({ text: "hola" }).texto).toBe("hola");
  });
  it("un tipo que no conocemos con link se guarda como archivo, y se anota el tipo", () => {
    const r = resolverAdjuntoMeta({ attachments: [{ type: "otro_tipo", payload: { url: "https://lookaside.fbsbx.com/x" } }] });
    expect(r).toMatchObject({ texto: "📄 Envió un archivo", mediaUrl: "https://lookaside.fbsbx.com/x", esArchivo: true, desconocido: "otro_tipo" });
    expect(resolverAdjuntoMeta({ attachments: [{ type: "otro_tipo" }] })).toMatchObject({ esArchivo: false });
    expect(resolverAdjuntoMeta({ attachments: [{ type: "otro_tipo" }] }).texto).toMatch(/app/);
  });
  it("una tarjeta de contacto muestra el teléfono", () => {
    expect(resolverAdjuntoMeta({ attachments: [{ type: "contact", payload: { phone_number: "011 5516-9140" } }] }).texto).toBe("📞 Compartió un teléfono: 011 5516-9140");
    expect(resolverAdjuntoMeta({ attachments: [{ type: "template", title: "Número de teléfono 011 5516-9140", payload: { url: "https://lookaside.fbsbx.com/12345678901234567" } }] }).texto).toBe("📞 Compartió un teléfono: 011 5516-9140");
  });
  it("lo que Meta no entrega se dice claro", () => {
    expect(resolverAdjuntoMeta({ is_unsupported: true, attachments: [{ type: "x" }] }).texto).toMatch(/app/);
    expect(resolverAdjuntoMeta({ attachments: [{ type: "unsupported_type" }] }).texto).toMatch(/app/);
    expect(resolverAdjuntoMeta({ attachments: [{ type: "sticker", payload: { url: "u" } }] }).tipo).toBe("image");
  });
  it("extensión y texto del link", () => {
    expect(extensionDeArchivo("application/pdf", "https://x/y")).toBe("pdf");
    expect(extensionDeArchivo(null, "https://x/archivo.docx?a=1")).toBe("docx");
    expect(etiquetaAdjunto("https://r2.dev/instagram/archivo/1.pdf")).toBe("Abrir PDF");
    expect(etiquetaAdjunto("https://www.instagram.com/reel/abc")).toBe("Ver publicación compartida");
    expect(etiquetaAdjunto("https://r2.dev/whatsapp/document/1.xlsx", "document")).toBe("Abrir planilla");
  });
});
