import { describe, expect, it } from "vitest";
import { CATEGORIAS_NOTIF, categoriaDeTipo, nivelDeAlerta } from "./nivelesAlertas";

describe("niveles de las alertas", () => {
  it("cada tipo conocido cae en su categoría, y los de los canales en Leads", () => {
    expect(categoriaDeTipo("visita_nueva")).toBe("leads");
    expect(categoriaDeTipo("whatsapp_mensaje_entrante")).toBe("mensajes");
    expect(categoriaDeTipo("handoff_instagram")).toBe("leads");
    expect(categoriaDeTipo("expediente_demorado")).toBe("expedientes");
    expect(categoriaDeTipo("pedido_sin_novedades")).toBe("pedidos_wishlist");
    expect(categoriaDeTipo("reclamo_asignado")).toBe("reclamos");
    expect(categoriaDeTipo("algo_desconocido")).toBeNull();
  });

  it("con los tipos reales de la base (13/10/2026): el lead asignado y la derivación van a Leads, cada mensaje a Mensajes", () => {
    expect(categoriaDeTipo("lead_asignado")).toBe("leads");
    expect(categoriaDeTipo("lead_sin_asignar")).toBe("leads");
    expect(categoriaDeTipo("handoff_chat")).toBe("leads");
    expect(categoriaDeTipo("whatsapp_handoff")).toBe("leads");
    expect(categoriaDeTipo("nuevo_mensaje_chat")).toBe("mensajes");
    expect(categoriaDeTipo("rodi_nuevo_mensaje")).toBe("mensajes");
    expect(categoriaDeTipo("lead_respondido")).toBeNull();
    expect(categoriaDeTipo("presupuesto_abierto")).toBe("cotizaciones");
    expect(categoriaDeTipo("lead_convertido")).toBe("ventas");
  });

  it("el nivel elegido para la categoría manda sobre el propio de la alerta", () => {
    expect(nivelDeAlerta({ tipo: "visita_nueva", prioridad: "media" }, { leads: "alta" })).toBe("alta");
    expect(nivelDeAlerta({ tipo: "cheque_vencido", prioridad: "alta" }, { finanzas: "baja" })).toBe("baja");
    expect(nivelDeAlerta({ tipo: "x", prioridad: "media", categoria: "ventas" }, { ventas: "alta" })).toBe("alta");
  });

  it("'Por defecto' (sin elegir) deja el nivel propio", () => {
    expect(nivelDeAlerta({ tipo: "visita_nueva", prioridad: "media" }, {})).toBe("media");
    expect(nivelDeAlerta({ tipo: "algo", prioridad: null }, null)).toBe("novedad");
  });

  it("la lista de categorías es la misma que se puede apagar en Mi perfil", () => {
    expect(new Set(CATEGORIAS_NOTIF.map((c) => c.key)).size).toBe(CATEGORIAS_NOTIF.length);
    // 22 desde el 14/10/2026: se sacó "Suscripción de la agencia" (venía del sistema viejo, acá no existe; Walter).
    // 23 desde el 27/10/2026: se sumó "Seguimientos vencidos".
    expect(CATEGORIAS_NOTIF).toHaveLength(23);
  });
});

describe("notificaciones por rol (27/10/2026)", () => {
  it("el vendedor no ve Comisiones, Finanzas, Fraude ni Gerente IA, y sí Seguimientos", async () => {
    const { categoriasParaRoles } = await import("./nivelesAlertas");
    const claves = categoriasParaRoles(["ventas"]).map((c) => c.key);
    for (const k of ["comisiones", "finanzas", "fraude", "gerente_ia", "gestoria", "expedientes"]) expect(claves).not.toContain(k);
    for (const k of ["leads", "mensajes", "seguimientos", "ventas", "cotizaciones"]) expect(claves).toContain(k);
  });

  it("admin y director ven todas; un rol desconocido también", async () => {
    const { categoriasParaRoles } = await import("./nivelesAlertas");
    expect(categoriasParaRoles(["admin", "ventas"])).toHaveLength(CATEGORIAS_NOTIF.length);
    expect(categoriasParaRoles(["otro"])).toHaveLength(CATEGORIAS_NOTIF.length);
  });

  it("varios roles suman", async () => {
    const { categoriasParaRoles } = await import("./nivelesAlertas");
    const claves = categoriasParaRoles(["ventas", "finanzas"]).map((c) => c.key);
    expect(claves).toContain("leads");
    expect(claves).toContain("finanzas");
  });

  it("seguimientos vencidos y objetivo cumplido ya tienen categoría", () => {
    expect(categoriaDeTipo("tarea_lead_vencida")).toBe("seguimientos");
    expect(categoriaDeTipo("objetivo_cumplido")).toBe("logros");
  });

  it("una alerta de una categoría apagada se esconde", async () => {
    const { alertaApagada } = await import("./nivelesAlertas");
    expect(alertaApagada("nuevo_mensaje_chat", ["mensajes"])).toBe(true);
    expect(alertaApagada("nuevo_mensaje_chat", ["leads"])).toBe(false);
    expect(alertaApagada("resumen_diario_empresa", ["leads"])).toBe(false);
  });
});
