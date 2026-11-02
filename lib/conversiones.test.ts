import { describe, expect, it } from "vitest";
import { armarEvento, type EventoWeb, type FormularioConsulta } from "./conversiones";
import { armarEventoCapi, cookiesPixel, datosPersonaMeta, sha256 } from "./conversionesMeta";

// Tabla de eventos acordada en docs/marketing/medicion.md (15/10/2026).
describe("armarEvento: cada acción de la web con su nombre en Analytics y en Meta", () => {
  it("tocar WhatsApp es una consulta: contacto_whatsapp en Analytics y Contact en Meta (Pixel y servidor)", () => {
    const e = armarEvento({ tipo: "whatsapp", ubicacion: "/catalogo/rely-r8" });
    expect(e.ga).toEqual({ nombre: "contacto_whatsapp", params: { ubicacion: "/catalogo/rely-r8" } });
    expect(e.meta).toMatchObject({ nombre: "Contact", desde: "ambos" });
    expect(e.esConsulta).toBe(true);
  });

  it("tocar un teléfono es una consulta: contacto_llamada y Contact", () => {
    const e = armarEvento({ tipo: "llamada", ubicacion: "/sucursales/casa-central" });
    expect(e.ga.nombre).toBe("contacto_llamada");
    expect(e.meta).toMatchObject({ nombre: "Contact", desde: "ambos" });
    expect(e.esConsulta).toBe(true);
  });

  it("un formulario guardado es generate_lead con el nombre del formulario, y Lead en Meta", () => {
    const formularios: FormularioConsulta[] = ["cotizar_usado", "vender_auto", "consignar", "financiacion", "simulador_financiacion", "agendar_visita", "visita_auto", "consulta_favoritos", "reserva_landing", "busqueda_sin_resultados", "avisame_outlet"];
    for (const formulario of formularios) {
      const e = armarEvento({ tipo: "formulario", formulario });
      expect(e.ga).toEqual({ nombre: "generate_lead", params: { formulario } });
      expect(e.meta).toMatchObject({ nombre: "Lead", desde: "ambos", params: { content_name: formulario } });
      expect(e.esConsulta).toBe(true);
    }
  });

  it("un formulario sobre un auto lleva el auto, con el mismo ID que el catálogo de Meta", () => {
    const e = armarEvento({ tipo: "formulario", formulario: "visita_auto", auto: { id: "abc", marca: "Rely", modelo: "R8" } });
    expect(e.ga.params).toEqual({ formulario: "visita_auto", auto_id: "abc", marca: "Rely", modelo: "R8" });
    expect(e.meta?.params).toMatchObject({ content_ids: ["abc"], content_type: "vehicle" });
  });

  it("Rodi cuenta en Analytics desde el navegador y en Meta solo desde el servidor", () => {
    const e = armarEvento({ tipo: "rodi" });
    expect(e.ga).toEqual({ nombre: "generate_lead", params: { formulario: "rodi" } });
    expect(e.meta).toMatchObject({ nombre: "Lead", desde: "servidor" });
  });

  it("el pedido del taller se mide aparte y no va a Meta ni cuenta como consulta de autos", () => {
    const e = armarEvento({ tipo: "taller" });
    expect(e.ga.nombre).toBe("solicitud_taller");
    expect(e.meta).toBeNull();
    expect(e.esConsulta).toBe(false);
  });

  it("abrir la ficha de un auto es view_item y ViewContent, solo para remarketing", () => {
    const e = armarEvento({ tipo: "ver_auto", auto: { id: "abc", marca: "Rely", modelo: "R8", anio: 2026, precio: 60100000, moneda: "ARS" } });
    expect(e.ga).toEqual({ nombre: "view_item", params: { value: 60100000, currency: "ARS", items: [{ item_id: "abc", item_name: "Rely R8 2026", item_brand: "Rely" }] } });
    expect(e.meta).toMatchObject({ nombre: "ViewContent", desde: "navegador", params: { content_ids: ["abc"], content_type: "vehicle", value: 60100000, currency: "ARS" } });
    expect(e.esConsulta).toBe(false);
  });

  it("buscar en el catálogo es search y Search, solo para remarketing", () => {
    const e = armarEvento({ tipo: "busqueda", termino: "hilux" });
    expect(e.ga).toEqual({ nombre: "search", params: { search_term: "hilux" } });
    expect(e.meta).toMatchObject({ nombre: "Search", desde: "navegador", params: { search_string: "hilux" } });
    expect(e.esConsulta).toBe(false);
  });
});

describe("API de conversiones de Meta", () => {
  it("cifra el mail en minúsculas y el teléfono con el código de país, como pide Meta", () => {
    const datos = datosPersonaMeta({ email: "  Juan@Mail.com ", telefono: "011 15 3756-4398" });
    expect(datos.em).toEqual([sha256("juan@mail.com")]);
    expect(datos.ph).toEqual([sha256("5491137564398")]);
    expect(datos.em?.[0]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("sin datos de contacto no manda nada personal", () => {
    expect(datosPersonaMeta(null)).toEqual({});
    expect(datosPersonaMeta({ email: "sin-arroba", telefono: "12" })).toEqual({});
  });

  it("arma el evento con el mismo event_id que el Pixel, para que Meta lo cuente una sola vez", () => {
    const dato = armarEventoCapi({ tipo: "formulario", formulario: "cotizar_usado" }, {
      eventId: "evt-123456", url: "https://www.pfaffencars.com/cotizador", ip: "1.2.3.4", userAgent: "Prueba", fbp: "fb.1.1.1", fbc: null, contacto: { telefono: "1121907000" }, ahora: 1760000000,
    });
    expect(dato).toEqual({
      event_name: "Lead",
      event_time: 1760000000,
      event_id: "evt-123456",
      action_source: "website",
      event_source_url: "https://www.pfaffencars.com/cotizador",
      user_data: { ph: [sha256("5491121907000")], client_ip_address: "1.2.3.4", client_user_agent: "Prueba", fbp: "fb.1.1.1" },
      custom_data: { content_name: "cotizar_usado" },
    });
  });

  it("lo que es solo del Pixel (ver un auto, buscar) no se manda desde el servidor", () => {
    const ctx = { eventId: "evt-123456", url: null, ip: null, userAgent: null };
    expect(armarEventoCapi({ tipo: "ver_auto", auto: { id: "abc" } }, ctx)).toBeNull();
    expect(armarEventoCapi({ tipo: "busqueda", termino: "x" }, ctx)).toBeNull();
    expect(armarEventoCapi({ tipo: "taller" } as EventoWeb, ctx)).toBeNull();
  });

  it("lee las cookies del Pixel", () => {
    expect(cookiesPixel("a=1; _fbp=fb.1.123.456; _fbc=fb.1.789.abc")).toEqual({ fbp: "fb.1.123.456", fbc: "fb.1.789.abc" });
    expect(cookiesPixel(null)).toEqual({ fbp: null, fbc: null });
  });
});
