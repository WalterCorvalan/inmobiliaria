/* eslint-disable @typescript-eslint/no-explicit-any -- base de mentira del modo demo: imita la forma libre de las respuestas de Supabase */
// Datos de ejemplo del MODO DEMO que son iguales en inmobiliaria y automotora: equipo, oficinas, canales, leads con sus
// charlas, tareas, avisos y uso de IA. Lo propio de cada rubro (propiedades, vehículos, visitas) llega en `RubroDatosDemo`
// desde lib/demo/datos.ts. Todo es inventado. Las fechas se calculan al momento, para que siempre parezcan de hoy.

type Fila = Record<string, any>;

export const EMPRESA_DEMO = "d0000000-0000-4000-8000-000000000001";
export const USUARIO_DEMO = "d0000000-0000-4000-8000-0000000000a1";

/** Id fijo y legible: mismo valor en el servidor y en el navegador, así los links entre pantallas funcionan. */
export const idFijo = (grupo: number, n: number) => `d0000000-0000-4000-8${String(grupo).padStart(3, "0")}-${String(n).padStart(12, "0")}`;

export const haceMin = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
export const enDias = (dias: number, hora = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  d.setHours(hora, 0, 0, 0);
  return d;
};
export const fechaISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export type LeadEjemplo = {
  nombre: string;
  canal: "whatsapp" | "instagram" | "messenger" | "rodi" | "manual";
  telefono?: string;
  usuario?: string; // Instagram
  calificacion: "caliente" | "tibio" | "frio" | null;
  pipeline: "sin_contactar" | "contactado" | "visita" | "negociacion" | "cerrado" | "perdido";
  estado: "nuevo" | "asignado" | "calificando" | "convertido" | "perdido";
  vendedor: number | null; // índice en el equipo
  oficina: number; // índice en oficinas
  haceMin: number;
  resumen?: string;
  notas?: string;
  sinLeer?: number;
  botActivo?: boolean;
  origenAds?: string;
  charla: { de: "cliente" | "bot" | "asesor"; texto: string }[];
};

export type RubroDatosDemo = {
  negocio: { nombre: string; color: string; domicilio: string; telefono: string; email: string; web: string; instagram: string; bot: string; descripcion: string };
  equipo: { nombre: string; roles: string[]; usuario: string; whatsapp: string }[];
  oficinas: { nombre: string; direccion: string; encargado: string; horario: string; slug: string }[];
  motivosCierre: string[];
  memoria: { categoria: string; palabras: string[]; respuesta: string }[];
  leads: LeadEjemplo[];
  tareas: { lead: number; tipo: string; titulo: string; enDias: number; hora: number; completada?: boolean }[];
  /** Tablas propias del rubro (propiedades, vehículos, visitas...), ya armadas con los ids de los datos comunes. */
  extras: (ctx: { equipoIds: string[]; oficinaIds: string[]; leads: { id: string; canal: string; nombre: string; telefono: string }[] }) => Record<string, Fila[]>;
};

export function armarDatosDemo(r: RubroDatosDemo): Record<string, Fila[]> {
  const E = EMPRESA_DEMO;
  const equipoIds = r.equipo.map((_, i) => (i === 0 ? USUARIO_DEMO : idFijo(1, i)));
  const oficinaIds = r.oficinas.map((_, i) => idFijo(2, i + 1));

  const t: Record<string, Fila[]> = {
    empresas: [{ id: E, nombre: r.negocio.nombre, slug: "demo", estado: "activa", zona_horaria: "America/Argentina/Buenos_Aires", created_at: haceMin(60 * 24 * 90) }],
    superadmins: [],
    perfiles: r.equipo.map((p, i) => ({
      id: equipoIds[i], empresa_id: E, nombre: p.nombre, roles: p.roles, activo: true, created_at: haceMin(60 * 24 * 80), sucursal_id: oficinaIds[i % oficinaIds.length],
      whatsapp: p.whatsapp, foto_url: null, usuario: p.usuario, orden_ronda: i, tema_oscuro: "negro", modo_oscuro: null, email: `${p.usuario}@demo.com`,
    })),
    sucursales: r.oficinas.map((o, i) => ({
      id: oficinaIds[i], empresa_id: E, nombre: o.nombre, created_at: haceMin(60 * 24 * 90), direccion: o.direccion, telefono_encargado: "11 5555-0" + (100 + i), google_maps_url: null,
      encargado_nombre: o.encargado, slug: o.slug, imagen_url: null, horario_texto: o.horario, horario_dia_desde: 1, horario_dia_hasta: 6, horario_hora_desde: 9, horario_hora_hasta: 19, latitude: null, longitude: null,
    })),
    configuracion_empresa: [{
      empresa_id: E, updated_at: haceMin(60 * 24), branding_nombre: r.negocio.nombre, branding_logo_url: null, branding_color_primario: r.negocio.color, branding_domicilio: r.negocio.domicilio,
      branding_telefono: r.negocio.telefono, branding_email: r.negocio.email, branding_web: r.negocio.web, redes_whatsapp: r.negocio.telefono, redes_instagram: r.negocio.instagram, redes_facebook: r.negocio.instagram,
      asignacion_leads_ronda: true, asignacion_auto_canales: ["whatsapp", "instagram", "messenger", "rodi"], alertas_niveles: { leads: "alta" }, ia_saldo_inicial_usd: 20, ia_saldo_desde: haceMin(60 * 24 * 20),
      ia_alerta_saldo_usd: 5, ia_alerta_enviada_en: null, ia_credito_comprado_usd: 20, ia_credito_comprado_el: fechaISO(enDias(-20)), bot_descripcion: r.negocio.descripcion, modo_comision: "ninguna",
    }],
    whatsapp_configuracion: [{ empresa_id: E, proveedor: "meta", phone_number_id: "demo", waba_id: "demo", listo: true, updated_at: haceMin(60 * 24 * 10), bot_nombre: r.negocio.bot, horario_inicio: 8, horario_fin: 22, tono: "cercano", token_cifrado: null, app_id: "demo" }],
    instagram_configuracion: [{ empresa_id: E, ig_user_id: "demo", listo: true, updated_at: haceMin(60 * 24 * 10), token_vence_en: enDias(45).toISOString(), palabra_clave_comentario: "INFO", mensaje_comentario: "¡Hola! Te mandé los datos por mensaje privado 📩", tono: "cercano", app_id: "demo" }],
    messenger_configuracion: [{ empresa_id: E, page_id: "demo", listo: true, updated_at: haceMin(60 * 24 * 10), tono: "cercano", app_id: "demo" }],
    motivos_cierre: r.motivosCierre.map((nombre, i) => ({ id: idFijo(3, i + 1), empresa_id: E, nombre, created_at: haceMin(60 * 24 * 60) })),
    disponibilidad_vendedor: equipoIds.map((id, i) => ({ vendedor_id: id, empresa_id: E, estado: i === r.equipo.length - 1 ? "vacaciones" : "disponible", desde: null, hasta: null, recibir_leads: i !== r.equipo.length - 1, actualizado_por: USUARIO_DEMO, updated_at: haceMin(600) })),
    lead_ronda_turnos: equipoIds.map((id, i) => ({ vendedor_id: id, empresa_id: E, ultima_asignacion: haceMin(30 * (i + 1)) })),
    push_subscriptions: [], espacio_notif_prefs: [], logs_errores: [], chats_vistos: [], whatsapp_plantillas: [],
    whatsapp_memoria: r.memoria.map((m, i) => ({ id: idFijo(4, i + 1), empresa_id: E, categoria: m.categoria, palabras_clave: m.palabras, respuesta: m.respuesta, activo: true, orden: i, created_at: haceMin(60 * 24 * 30), updated_at: haceMin(60 * 24 * 5) })),
    whatsapp_templates: [
      { id: idFijo(5, 1), empresa_id: E, nombre: "seguimiento_consulta", idioma: "es_AR", categoria: "MARKETING", cuerpo: "Hola {{1}}, ¿pudiste ver lo que te mandamos? Si querés coordinamos una visita sin compromiso.", estado: "approved", created_at: haceMin(60 * 24 * 20), updated_at: haceMin(60 * 24 * 19) },
      { id: idFijo(5, 2), empresa_id: E, nombre: "recordatorio_visita", idioma: "es_AR", categoria: "UTILITY", cuerpo: "Hola {{1}}, te recordamos tu visita de mañana a las {{2}}. ¡Te esperamos!", estado: "approved", created_at: haceMin(60 * 24 * 20), updated_at: haceMin(60 * 24 * 19) },
      { id: idFijo(5, 3), empresa_id: E, nombre: "promo_fin_de_mes", idioma: "es_AR", categoria: "MARKETING", cuerpo: "Hola {{1}}, este mes tenemos novedades que te pueden interesar. ¿Te paso opciones?", estado: "pending", created_at: haceMin(60 * 5), updated_at: haceMin(60 * 5) },
    ],
    instagram_automatizaciones_comentarios: [
      { id: idFijo(6, 1), empresa_id: E, palabras_clave: ["info", "precio", "precio?"], respuesta_dm: "¡Hola! Gracias por comentar. Te paso todos los datos por acá 👇", respuesta_publica: "¡Te escribimos por privado! 📩", activo: true, orden: 0, created_at: haceMin(60 * 24 * 15) },
    ],
    clientes: [], whatsapp_contactos: [], whatsapp_conversaciones: [], whatsapp_mensajes: [], instagram_contactos: [], instagram_conversaciones: [], instagram_mensajes: [],
    messenger_contactos: [], messenger_conversaciones: [], messenger_mensajes: [], rodi_conversaciones: [], rodi_mensajes: [], leads_manuales: [], eventos_lead: [], tareas_lead: [], alertas: [], uso_ia_anthropic: [],
  };

  const leadsCtx: { id: string; canal: string; nombre: string; telefono: string }[] = [];
  r.leads.forEach((l, i) => {
    const n = i + 1;
    const conv = idFijo(10, n), contacto = idFijo(11, n), cliente = idFijo(12, n);
    const tel = l.telefono || `54911${String(40000000 + n * 1234567).slice(0, 8)}`;
    const vendedor = l.vendedor == null ? null : equipoIds[l.vendedor];
    const ultimo = haceMin(l.haceMin);
    const derivada = !!l.resumen && l.vendedor != null;
    leadsCtx.push({ id: conv, canal: l.canal, nombre: l.nombre, telefono: tel });
    t.clientes.push({
      id: cliente, empresa_id: E, nombre: l.nombre.split(" ")[0], apellido: l.nombre.split(" ").slice(1).join(" ") || null, tipo: "Regular", telefono: tel, email: null,
      origen: l.canal === "whatsapp" ? "WhatsApp" : l.canal === "instagram" ? "Instagram" : l.canal === "messenger" ? "Messenger" : l.canal === "rodi" ? "Web" : "Oficina",
      canal_ingreso: l.canal === "manual" ? "walk_in" : "lead_digital", vendedor_id: vendedor, pipeline_stage: l.pipeline, pipeline_stage_manual: false, importado_excel: false, estado_relacion: l.pipeline === "cerrado" ? "cliente" : "lead",
      no_contactar: false, reasignacion_tope_alertada: false, created_at: haceMin(l.haceMin + 60 * 24), updated_at: ultimo, ultimo_contacto: ultimo, observaciones: l.notas || null, deleted_at: null,
    });
    const comun = {
      id: conv, empresa_id: E, vendedor_id: vendedor, cliente_id: cliente, calificacion: l.calificacion, notas: l.notas || null, unread_count: l.sinLeer ?? 0, ai_habilitada: l.botActivo ?? !derivada,
      handoff_at: derivada ? haceMin(l.haceMin + 5) : null, handoff_reason: derivada ? "El cliente quiere avanzar" : null, handoff_resumen: l.resumen || null, last_message_at: ultimo, estado_lead: l.estado,
      canal_origen: l.canal, origen_ads: l.origenAds || null, sucursal_id: oficinaIds[l.oficina], es_basura: false, prospeccion: null, lector_leido_hasta: null, asistencia_solicitada: false, asistencia_nota: null,
      asistencia_para: null, asistencia_atendida: false, motivo_cierre_id: l.pipeline === "perdido" ? idFijo(3, 1) : null, domicilio: null, created_at: haceMin(l.haceMin + 60 * 24), updated_at: ultimo,
      vehiculo_id: null, archivada: false,
    };
    const mensajes = (tabla: string, extra: (m: { de: string }, j: number) => Fila = () => ({})) => {
      const total = l.charla.length;
      l.charla.forEach((m, j) => t[tabla].push({
        id: idFijo(13, n * 100 + j), empresa_id: E, conversacion_id: conv, direccion: m.de === "cliente" ? "in" : "out", texto: m.texto, ai_generado: m.de === "bot",
        created_at: haceMin(l.haceMin + (total - 1 - j) * 3), ...extra(m, j),
      }));
    };
    const ultimoEntrante = [...l.charla].reverse().findIndex((m) => m.de === "cliente");
    const lastInbound = haceMin(l.haceMin + Math.max(0, ultimoEntrante) * 3);

    if (l.canal === "whatsapp") {
      t.whatsapp_contactos.push({ id: contacto, empresa_id: E, telefono: tel, nombre_perfil: l.nombre, cliente_id: cliente, created_at: comun.created_at, updated_at: ultimo, email: null, cuil: null });
      t.whatsapp_conversaciones.push({ ...comun, contacto_id: contacto, estado_pipeline: l.pipeline, last_inbound_at: lastInbound, aviso_caliente_sin_atender_enviado: false, aviso_nudge_enviado: false });
      mensajes("whatsapp_mensajes", () => ({ tipo: "text", status: "read", wa_message_id: null, media_url: null }));
    } else if (l.canal === "instagram") {
      t.instagram_contactos.push({ id: contacto, empresa_id: E, ig_user_id: `ig${n}`, username: l.usuario || l.nombre.toLowerCase().replace(/\s+/g, "."), nombre_perfil: l.nombre, cliente_id: cliente, telefono: null, email: null, cuil: null, created_at: comun.created_at, updated_at: ultimo });
      t.instagram_conversaciones.push({ ...comun, contacto_id: contacto, estado_pipeline: l.pipeline, last_inbound_at: lastInbound, aviso_caliente_sin_atender_enviado: false, aviso_nudge_enviado: false });
      mensajes("instagram_mensajes", () => ({ tipo: "text", status: "read", ig_message_id: null, media_url: null, reaccion: null, leido_at: ultimo, editado: false }));
    } else if (l.canal === "messenger") {
      t.messenger_contactos.push({ id: contacto, empresa_id: E, psid: `psid${n}`, nombre_perfil: l.nombre, telefono: null, email: null, cuil: null, created_at: comun.created_at, cliente_id: cliente });
      t.messenger_conversaciones.push({ ...comun, contacto_id: contacto, estado_pipeline: l.pipeline, last_inbound_at: lastInbound, aviso_caliente_sin_atender_enviado: false, aviso_nudge_enviado: false });
      mensajes("messenger_mensajes", () => ({ tipo: "text", status: "read", messenger_message_id: null, media_url: null, leido_at: ultimo }));
    } else if (l.canal === "rodi") {
      t.rodi_conversaciones.push({ ...comun, session_id: `web-${n}`, nombre_contacto: l.nombre, telefono_contacto: tel, email_contacto: null, origen_pagina: "/", ai_pausada_en: null, canal_entrada: "web", utm_source: l.origenAds ? "google" : null, utm_medium: l.origenAds ? "cpc" : null, utm_campaign: l.origenAds || null, cuil: null, estado_pipeline: l.pipeline });
      mensajes("rodi_mensajes");
    } else {
      t.leads_manuales.push({ ...comun, nombre: l.nombre, telefono: tel, email: null, creado_por: USUARIO_DEMO, estado_pipeline: l.pipeline });
    }

    const col = l.canal === "manual" ? "leads_manuales_id" : `${l.canal}_conversacion_id`;
    t.eventos_lead.push({ id: idFijo(14, n * 10 + 1), empresa_id: E, [col]: conv, tipo: "creado", descripcion: `Entró por ${l.canal === "rodi" ? "el chat de la web" : l.canal === "manual" ? "la oficina" : l.canal}`, creado_por: null, created_at: haceMin(l.haceMin + 60 * 24) });
    if (vendedor) t.eventos_lead.push({ id: idFijo(14, n * 10 + 2), empresa_id: E, [col]: conv, tipo: "asignado", descripcion: `Asignado a ${r.equipo[l.vendedor!].nombre}`, creado_por: null, created_at: haceMin(l.haceMin + 30) });
  });

  r.tareas.forEach((ta, i) => {
    const l = r.leads[ta.lead];
    const col = l.canal === "manual" ? "leads_manuales_id" : `${l.canal}_conversacion_id`;
    t.tareas_lead.push({ id: idFijo(15, i + 1), empresa_id: E, [col]: idFijo(10, ta.lead + 1), tipo: ta.tipo, titulo: ta.titulo, fecha_vencimiento: enDias(ta.enDias, ta.hora).toISOString(), completada: !!ta.completada, resultado: null, creado_por: USUARIO_DEMO, created_at: haceMin(60 * 5), aviso_vencida_enviado: false });
  });

  const calientes = r.leads.map((l, i) => ({ l, i })).filter(({ l }) => l.calificacion === "caliente").slice(0, 3);
  calientes.forEach(({ l, i }, k) => {
    const ruta = l.canal === "rodi" ? "rodi" : l.canal === "manual" ? "leads" : l.canal;
    t.alertas.push({ id: idFijo(16, k + 1), empresa_id: E, destinatario_id: USUARIO_DEMO, tipo: "lead_caliente", prioridad: k === 0 ? "alta" : "media", titulo: `Lead caliente: ${l.nombre}`, mensaje: l.resumen?.split("\n")[0] || "Quiere avanzar", link: `/panel/${ruta}?id=${idFijo(10, i + 1)}`, leida: k > 0, created_at: haceMin(l.haceMin), contador: 1, push_enviado: true, whatsapp_enviado: false, push_repeticiones: 0 });
  });

  for (let d = 0; d < 20; d++) {
    for (const origen of ["whatsapp", "instagram", "messenger", "web"]) {
      const veces = (d * 7 + origen.length) % 5 + 2;
      for (let k = 0; k < veces; k++) t.uso_ia_anthropic.push({ id: idFijo(17, d * 100 + origen.length * 10 + k), empresa_id: E, origen, input_tokens: 2400 + k * 130, output_tokens: 180 + k * 20, modelo: "claude-haiku", busquedas_web: 0, cache_escritura_tokens: 0, cache_lectura_tokens: 1800, created_at: haceMin(60 * 24 * d + 60 * k) });
    }
  }

  Object.assign(t, r.extras({ equipoIds, oficinaIds, leads: leadsCtx }));
  return t;
}
