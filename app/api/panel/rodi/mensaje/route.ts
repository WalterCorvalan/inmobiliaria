import { asignacionPorAuto, autoDeLaCharla } from "@/lib/panel/asignacionPorAuto";
import { NextResponse, after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { generarRespuestaAgenteV2, dividirRespuestaEnMensajes } from "@/lib/ai/agenteV2";
import { menuBienvenidaV2 } from "@/lib/ai/promptsV2";
import { isAiConfiguredV2 } from "@/lib/ai/indexV2";
import { rateLimit, ipDesdeRequest } from "@/lib/rateLimit";
import { registrarError } from "@/lib/panel/logger";
import { OrigenWebSchema, columnasDeOrigen, type OrigenWeb } from "@/lib/panel/origenWeb";
import { notificarEncargados, notificarPersona } from "@/lib/panel/notificaciones";
import { resolverFechaVisitaConControl } from "@/lib/fechas";
import { NOMBRE_ASISTENTE_WEB } from "@/lib/asistenteWeb";
import { cargarConsignacionDesdeChat } from "@/lib/panel/consignacionDesdeChat";
import { cargarPedidoDesdeChat } from "@/lib/panel/pedidoDesdeChat";
import { completarVisitaRepetida } from "@/lib/panel/visitaRepetida";
import { cookiesPixel, enviarEventoMeta, type ContextoPedido } from "@/lib/conversionesMeta";
import { guardarPedidoDelBot } from "@/lib/panel/pedidoDelBot";

// Endpoint público (sin sesión — lo llama el widget del sitio, un visitante
// anónimo) que procesa un mensaje de Rodi. Identidad = sessionId generado
// por el frontend del widget (uuid en localStorage), no hay teléfono.

// Un pedido de compra/permuta busca el precio de mercado en segundo plano (13-40 s, lib/panel/pedidoDesdeChat.ts).
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE2_URL!,
  process.env.SUPABASE2_SERVICE_ROLE_KEY!
);

const MensajeSchema = z.object({
  sessionId: z.string().min(8).max(200),
  texto: z.string().trim().min(1).max(2000),
  origenPagina: z.string().max(300).optional(),
  nombre: z.string().max(200).optional(),
  telefono: z.string().max(50).optional(),
  email: z.string().email().max(200).optional(),
}).extend(OrigenWebSchema.shape);

export async function POST(request: Request) {
  const limite = await rateLimit(ipDesdeRequest(request), { limite: 20, ventanaMs: 60 * 1000, proyecto: "v2" });
  if (!limite.ok) {
    return NextResponse.json({ error: "Demasiados mensajes. Esperá un momento." }, { status: 429 });
  }

  const parsed = MensajeSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }
  const { sessionId, texto, origenPagina, nombre, telefono, email } = parsed.data;
  const origenWeb: OrigenWeb = parsed.data;
  // Datos del pedido para la API de conversiones de Meta (docs/marketing/medicion.md).
  const contextoMeta: Omit<ContextoPedido, "eventId"> = {
    ip: ipDesdeRequest(request),
    userAgent: request.headers.get("user-agent"),
    ...cookiesPixel(request.headers.get("cookie")),
    url: origenPagina ? new URL(origenPagina, request.url).toString() : null,
  };

  // Endpoint público del widget del sitio -- si algo revienta acá (red, IA,
  // supabase) antes no quedaba registro en ningún lado salvo los logs de
  // Vercel, invisibles desde el panel. Try/catch + registrarError para que
  // aparezca en Errores del sistema como cualquier otro canal.
  try {
    return await procesarMensaje({ sessionId, texto, origenPagina, nombre, telefono, email, origenWeb, contextoMeta });
  } catch (err) {
    registrarError("api/panel/rodi/mensaje", err, { sessionId });
    return NextResponse.json({ replies: ["¡Hola! Gracias por escribirnos a Pfaffen Cars. En breve te contacta uno de nuestros asesores. 🚗"], handoff: false });
  }
}

async function procesarMensaje({ sessionId, texto, origenPagina, nombre, telefono, email, origenWeb, contextoMeta }: {
  sessionId: string; texto: string; origenPagina?: string; nombre?: string; telefono?: string; email?: string; origenWeb?: OrigenWeb;
  contextoMeta: Omit<ContextoPedido, "eventId">;
}) {
  let { data: conversacion } = await supabase.from("rodi_conversaciones").select("*").eq("session_id", sessionId).maybeSingle();
  const teniaTelefono = !!conversacion?.telefono_contacto;

  if (!conversacion) {
    const { data: nueva, error } = await supabase
      .from("rodi_conversaciones")
      .insert({ session_id: sessionId, canal_origen: "Rodi", origen_pagina: origenPagina || null, nombre_contacto: nombre || null, telefono_contacto: telefono || null, email_contacto: email || null })
      .select("*")
      .single();
    if (error || !nueva) {
      // Antes este error no quedaba registrado en ningún lado: Rodi no guardaba ninguna conversación
      // (rodi_conversaciones vacía) y nadie se enteraba. Ahora aparece en Errores del sistema.
      registrarError("api/panel/rodi/mensaje:crear-conversacion", error ?? new Error("insert sin fila"), { sessionId, origenPagina });
      return NextResponse.json({ error: "No se pudo iniciar la conversación." }, { status: 500 });
    }
    conversacion = nueva;
    // Origen de la web (canal y campaña) en un update aparte: en esta tabla canal_origen ya es "Rodi", el canal de
    // entrada va en canal_entrada (migraciones/sql_origen_web_formularios.sql). Si la migración no corrió, sigue igual.
    const columnasOrigen = columnasDeOrigen(origenWeb, "canal_entrada");
    if (columnasOrigen) {
      const { error: errOrigen } = await supabase.from("rodi_conversaciones").update(columnasOrigen).eq("id", nueva.id);
      if (errOrigen) registrarError("origen-web:rodi_conversaciones", errOrigen, { id: nueva.id });
    }
  } else {
    const patch: Record<string, unknown> = {};
    if (nombre && !conversacion.nombre_contacto) patch.nombre_contacto = nombre;
    if (telefono && !conversacion.telefono_contacto) patch.telefono_contacto = telefono;
    if (email && !conversacion.email_contacto) patch.email_contacto = email;
    if (Object.keys(patch).length > 0) await supabase.from("rodi_conversaciones").update(patch).eq("id", conversacion.id);
  }

  await supabase.from("rodi_mensajes").insert({ conversacion_id: conversacion.id, direccion: "in", texto });
  await supabase.from("rodi_conversaciones").update({
    last_message_at: new Date().toISOString(),
    unread_count: (conversacion.unread_count ?? 0) + 1,
  }).eq("id", conversacion.id);

  if (conversacion.ai_habilitada === false) {
    // Se reactiva sola 6hs después de haberse pausado (handoff, mensaje
    // manual de un vendedor, o apagado a mano) -- si el visitante vuelve
    // más tarde, arranca de nuevo con el bot en vez de quedar en silencio
    // para siempre. Se resuelve acá mismo, sin depender de un cron.
    const SEIS_HORAS_MS = 6 * 60 * 60 * 1000;
    const pausadaHaceMs = conversacion.ai_pausada_en ? Date.now() - new Date(conversacion.ai_pausada_en).getTime() : null;
    if (pausadaHaceMs !== null && pausadaHaceMs >= SEIS_HORAS_MS) {
      await supabase.from("rodi_conversaciones").update({ ai_habilitada: true, ai_pausada_en: null, handoff_at: null, handoff_reason: null, handoff_resumen: null }).eq("id", conversacion.id);
      conversacion = { ...conversacion, ai_habilitada: true };
    } else {
      return NextResponse.json({ replies: [], handoff: true });
    }
  }

  if (!isAiConfiguredV2()) {
    return NextResponse.json({ replies: [], handoff: false });
  }

  // Mismo fix que WhatsApp: ascending+limit traía los primeros 20 mensajes
  // de toda la charla en vez de los últimos 20 -- en una charla larga el bot
  // nunca veía lo hablado después del mensaje 20.
  const { data: mensajesDesc } = await supabase.from("rodi_mensajes").select("direccion, texto").eq("conversacion_id", conversacion.id).order("created_at", { ascending: false }).limit(20);
  const mensajesPrevios = mensajesDesc ? [...mensajesDesc].reverse() : mensajesDesc;
  const historial = (mensajesPrevios ?? []).map((m) => ({ role: (m.direccion === "in" ? "user" : "assistant") as "user" | "assistant", content: m.texto }));

  // Ahorro de tokens a propósito: Rodi y el buscador del home tienen que ser
  // austeros con la IA (a diferencia de WhatsApp, el canal donde sí se
  // justifica el costo) -- un "hola" como primer mensaje de la charla no
  // necesita razonar nada, es el mismo menú fijo que ya devuelve el prompt
  // (menuBienvenidaV2) para ese caso. Server-side, sin IA: no es "la IA
  // contestó rápido", es un mensaje predeterminado de chat como cualquier
  // otro. Solo aplica al PRIMER mensaje de la charla (historial.length===1,
  // esta misma línea que se acaba de insertar) -- un "hola" en medio de una
  // conversación ya en curso sí pasa por el agente normal.
  const esPrimerMensaje = historial.length === 1;
  const esSaludoSimple = /^(hola+|holis|buenas|hey|buen[oa]s?\s*(d[ií]as?|tardes|noches)?|qu[ée]\s*tal|hello|hi)[\s!¡.,?¿]*$/i.test(texto.trim());
  if (esPrimerMensaje && esSaludoSimple) {
    const saludo = menuBienvenidaV2();
    await supabase.from("rodi_mensajes").insert({ conversacion_id: conversacion.id, direccion: "out", texto: saludo, ai_generado: false });
    return NextResponse.json({ replies: [saludo], handoff: false });
  }

  const result = await generarRespuestaAgenteV2(historial, "panel-v2/rodi", NOMBRE_ASISTENTE_WEB, conversacion.vehiculo_id ?? null);

  if (!result.ok) {
    registrarError("api/panel/rodi/mensaje:agente", result.error, { conversacionId: conversacion.id });
    return NextResponse.json({ replies: ["¡Hola! Gracias por escribirnos a Pfaffen Cars. En breve te contacta uno de nuestros asesores. 🚗"], handoff: false });
  }

  const { reply, handoff, pausar_sin_notificar, calificacion, resumen_handoff, datos_detectados } = result.data;
  const { pedidoStock, vehiculoFocoId } = result;
  const autoCharla = autoDeLaCharla(vehiculoFocoId, result.data.intencion);
  const partes = dividirRespuestaEnMensajes(reply);

  for (const parte of partes) {
    await supabase.from("rodi_mensajes").insert({ conversacion_id: conversacion.id, direccion: "out", texto: parte, ai_generado: true });
  }
  const patchCalificacion: Record<string, unknown> = { calificacion };
  if (autoCharla !== undefined) patchCalificacion.vehiculo_id = autoCharla;

  // Pedido del 29/9: mismo criterio que WhatsApp/Instagram/Messenger -- todo
  // 0km en foco va siempre a Gabriel (Casa Central), y si el auto en foco
  // tiene vendedor responsable en Stock distinto del que ya tiene la
  // charla, se reasigna (pisa lo que hubiera resuelto la ronda por
  // sucursal del handoff más abajo). Cada reasignación queda anotada en
  // Eventos del lead y avisa al nuevo vendedor.
  const registrarEventoAsignacionRodi = (descripcion: string) =>
    supabase.from("eventos_lead").insert({ rodi_conversacion_id: conversacion.id, tipo: "asignacion", descripcion }).then(({ error }) => {
      if (error) registrarError("rodi:evento-asignacion", error, { conversacionId: conversacion.id });
    });
  let vendedorAsignadoAhora: string | null = null;

  // A quién va el lead: a quien tiene el auto (o a Gabriel si es consignación), salvo que lo hayan pasado a mano
  // (Walter, 21/10/2026; reglas en lib/panel/asignacionPorAuto.ts). Reemplaza "todo 0 km a Gabriel".
  const porAuto = await asignacionPorAuto(supabase, { fk: "rodi_conversacion_id", conversacionId: conversacion.id, vehiculoId: autoCharla ?? null, intencion: result.data.intencion, vendedorActual: conversacion.vendedor_id ?? null });
  if (porAuto) {
    patchCalificacion.vendedor_id = porAuto.vendedorId;
    patchCalificacion.estado_lead = "asignado";
    conversacion.vendedor_id = porAuto.vendedorId;
    vendedorAsignadoAhora = porAuto.vendedorId;
    registrarEventoAsignacionRodi(porAuto.descripcion);
  }

  await supabase.from("rodi_conversaciones").update(patchCalificacion).eq("id", conversacion.id);

  if (vendedorAsignadoAhora) {
    notificarPersona(supabase, vendedorAsignadoAhora, "whatsapp_venta_zona", "Un cliente te consultó por Paffy (chat del sitio) por un auto que tenés asignado — se te asignó automáticamente.", `/panel/rodi?conversacion=${conversacion.id}`, { categoriaNotif: "leads", modulo: "leads" }).catch((err) => console.error("[rodi] error notificando asignación:", err));
  }

  // Nombre/email/teléfono que el cliente vaya dando durante la charla se
  // guardan apenas se detectan, sin esperar al handoff — así quedan aunque
  // la charla se corte antes de derivar a un vendedor (antes solo se
  // guardaban si venían en el body inicial del widget, nunca lo que la IA
  // extraía del texto de la conversación).
  if (datos_detectados?.nombre || datos_detectados?.email || datos_detectados?.telefono || datos_detectados?.cuil) {
    const patch: Record<string, unknown> = {};
    if (datos_detectados.nombre && !conversacion.nombre_contacto) patch.nombre_contacto = datos_detectados.nombre;
    if (datos_detectados.email && !conversacion.email_contacto) patch.email_contacto = datos_detectados.email;
    if (datos_detectados.telefono && !conversacion.telefono_contacto) patch.telefono_contacto = datos_detectados.telefono;
    if (datos_detectados.cuil) patch.cuil = datos_detectados.cuil;
    if (Object.keys(patch).length > 0) {
      const { error: errorPatch } = await supabase.from("rodi_conversaciones").update(patch).eq("id", conversacion.id);
      if (errorPatch) registrarError("api/panel/rodi/mensaje:patch-contacto", errorPatch, { conversacionId: conversacion.id });
    }
  }

  // Sin stock que coincida: mismo criterio que WhatsApp -- registrar el
  // pedido con lo que se sabe, para avisar apenas entre algo que coincida.
  if (pedidoStock?.marca) {
    const telefonoOEmail = datos_detectados?.telefono || conversacion.telefono_contacto || datos_detectados?.email || conversacion.email_contacto;
    if (telefonoOEmail) {
      const { data: convVendedor } = await supabase.from("rodi_conversaciones").select("vendedor_id").eq("id", conversacion.id).single();
      // "nombre_cliente" es NOT NULL en "pedidos" -- fallback para no perder
      // el pedido si todavía no tenemos el nombre. "marca" también es NOT
      // NULL, pero esa la exige el prompt antes de completar pedido_stock
      // (ver regla SIN STOCK QUE COINCIDA) -- no se rellena con un fallback
      // acá porque un pedido con marca inventada no sirve para nada.
      await guardarPedidoDelBot(supabase, {
        telefono: datos_detectados?.telefono || conversacion.telefono_contacto || null,
        nombre_cliente: datos_detectados?.nombre || conversacion.nombre_contacto || "Visitante de Paffy",
        marca: pedidoStock.marca, modelo: pedidoStock.modelo,
        presupuesto_max: pedidoStock.presupuesto_max, moneda: pedidoStock.moneda || "ARS",
        puertas: pedidoStock.puertas,
        vendedor_id: convVendedor?.vendedor_id ?? null,
        // "pedidos.origen" tiene un check constraint que solo permite
        // whatsapp/web/manual/instagram -- "Rodi" (el nombre del bot del
        // sitio) no es un valor válido, rompía el insert. Rodi ES el chat de
        // la web, así que el origen real es "web".
        origen: "web",
      }, "api/panel/rodi/mensaje:crear-pedido");
    }
  }
  // Conversión para Meta y Analytics: la primera vez que Rodi consigue un teléfono, o un pedido de hablar con una
  // persona cuando todavía no había teléfono. Una sola vez por conversación: si ya tenía teléfono o ya se había
  // derivado a un vendedor, ya se contó (docs/marketing/medicion.md).
  const telefonoConsulta = telefono || datos_detectados?.telefono || null;
  const consultaNueva = !teniaTelefono && !conversacion.handoff_at && (!!telefonoConsulta || (!!handoff && !pausar_sin_notificar));
  if (consultaNueva) {
    const contacto = { telefono: telefonoConsulta, email: email || datos_detectados?.email || conversacion.email_contacto || null };
    after(() => enviarEventoMeta({ tipo: "rodi" }, { ...contextoMeta, eventId: crypto.randomUUID(), contacto }));
  }

  if (handoff) {
    // CLIENTE OFENSIVO -- mismo criterio que WhatsApp: se pausa, pero no se
    // asigna vendedor ni se notifica a nadie, se enfría sola. handoff_reason
    // distinto para que el trigger de la base (trg_rodi_handoff, notifica en
    // CUALQUIER handoff normal) lo pueda excluir -- ver migración
    // sql_lookup_trigger_rodi_handoff.sql.
    await supabase.from("rodi_conversaciones").update({
      handoff_at: new Date().toISOString(), handoff_reason: pausar_sin_notificar ? "cliente_ofensivo" : "cliente_pidio_humano", ai_habilitada: false, ai_pausada_en: new Date().toISOString(),
      handoff_resumen: resumen_handoff || null,
    }).eq("id", conversacion.id);

    if (pausar_sin_notificar) return NextResponse.json({ replies: partes, handoff });

    const linkNoti = `/panel/rodi?conversacion=${conversacion.id}`;
    const mensajeNoti = resumen_handoff || "Cliente de Paffy ofrece su auto";
    let vendedorAsignado: string | null = conversacion.vendedor_id ?? null;

    // Venta/consignación/permuta: mismo criterio que WhatsApp -- si todavía
    // no hay vendedor, asignar por ronda de la sucursal elegida en vez de
    // avisar en bloque a todos los encargados sin ningún criterio.
    let sucursalElegida: { id: string; nombre: string } | null = null;
    if (datos_detectados?.zona) {
      const { data } = await supabase.from("sucursales").select("id, nombre").eq("slug", datos_detectados.zona).maybeSingle();
      sucursalElegida = data;
    }
    if (!vendedorAsignado && sucursalElegida) {
      const { data: nuevoVendedorId } = await supabase.rpc("asignar_vendedor_ronda_rodi_por_sucursal", { p_sucursal_id: sucursalElegida.id });
      if (nuevoVendedorId) {
        vendedorAsignado = nuevoVendedorId;
        await supabase.from("rodi_conversaciones").update({ vendedor_id: nuevoVendedorId, estado_lead: "asignado" }).eq("id", conversacion.id);
      }
    }

    // Ojo: el handoff "normal" (compra) ya lo notifica trg_rodi_handoff en
    // la base -- acá solo se manda aviso de más cuando SÍ hay zona (venta/
    // consignación/permuta), que es un caso nuevo que ese trigger no conoce.
    if (sucursalElegida) {
      if (vendedorAsignado) {
        notificarPersona(supabase, vendedorAsignado, "rodi_venta_zona", mensajeNoti, linkNoti, { categoriaNotif: "leads", modulo: "leads" }).catch((err) => console.error("[rodi] error notificando handoff:", err));
      } else {
        notificarEncargados(supabase, mensajeNoti, linkNoti, "rodi_venta_zona", sucursalElegida.id, "alta", { categoriaNotif: "leads", modulo: "leads" }).catch((err) => console.error("[rodi] error notificando zona:", err));
      }
    }

    // Quiere dejar su auto en consignación: se carga sola en Consignaciones → Pendientes (lib/panel/consignacionDesdeChat.ts).
    await cargarConsignacionDesdeChat(supabase, {
      canal: "rodi", conversacionId: conversacion.id, intencion: result.data.intencion, datos: datos_detectados,
      nombre: datos_detectados?.nombre || conversacion.nombre_contacto || "Visitante de Paffy",
      telefono: datos_detectados?.telefono || conversacion.telefono_contacto,
      email: datos_detectados?.email || conversacion.email_contacto,
      vendedorId: vendedorAsignado, sucursalId: sucursalElegida?.id,
    });
    await cargarPedidoDesdeChat(supabase, {
      canal: "rodi", conversacionId: conversacion.id, intencion: result.data.intencion, datos: datos_detectados,
      nombre: datos_detectados?.nombre || conversacion.nombre_contacto || "Visitante de Paffy",
      telefono: datos_detectados?.telefono || conversacion.telefono_contacto,
      email: datos_detectados?.email || conversacion.email_contacto,
      vendedorId: vendedorAsignado, sucursalNombre: sucursalElegida?.nombre,
    });

    // Día/horario confirmado: agenda visita real.
    if (datos_detectados?.dia_visita && datos_detectados?.horario_visita) {
      const nombreCliente = datos_detectados?.nombre || conversacion.nombre_contacto || "Visitante de Paffy";
      const telefonoCliente = datos_detectados?.telefono || conversacion.telefono_contacto || "sin dato";
      const { fecha: fechaVisita, dudosa: fechaDudosa } = resolverFechaVisitaConControl(datos_detectados.dia_visita);
      const sucursalVisita = sucursalElegida?.nombre || "Sin especificar";
      // Mismo chequeo que los formularios públicos (AgendarVisitaForm.tsx /
      // AgendarCitaForm.tsx) -- acá el bot no puede reofrecerle otro horario
      // al cliente en el momento, así que la visita se crea igual (mejor
      // tener el lead con un conflicto que perderlo) pero se avisa al
      // vendedor/encargados para que reagenden una de las dos a mano.
      // Si ya pidió visita ese día por otro lado, no se repite: se completa esa (lib/panel/visitaRepetida.ts).
      const visitaYaCargada = await completarVisitaRepetida(supabase, {
        telefono: telefonoCliente, fecha: fechaVisita,
        vehiculo_marca: datos_detectados?.vehiculo_propio?.marca || null, vehiculo_modelo: datos_detectados?.vehiculo_propio?.modelo || null,
      });
      const { data: ocupados } = visitaYaCargada ? { data: [] } : await supabase.rpc("visitas_horarios_ocupados", { p_sucursal: sucursalVisita, p_fecha: fechaVisita });
      const hayConflicto = (ocupados || []).some((o: { horario_visita: string }) => o.horario_visita === datos_detectados.horario_visita);

      const { error: errorVisita } = visitaYaCargada ? { error: null } : await supabase.from("visitas").insert({
        vehiculo_marca: datos_detectados?.vehiculo_propio?.marca || null,
        vehiculo_modelo: datos_detectados?.vehiculo_propio?.modelo || null,
        nombre_cliente: nombreCliente,
        telefono_cliente: telefonoCliente,
        fecha_visita: fechaVisita,
        horario_visita: datos_detectados.horario_visita,
        sucursal: sucursalVisita,
        estado: "Pendiente",
        vendedor_id: vendedorAsignado,
      });
      if (errorVisita) registrarError("api/panel/rodi/mensaje:crear-visita", errorVisita);
      else if (fechaDudosa && !visitaYaCargada) {
        const mensajeFecha = `📅 ${nombreCliente} agendó por el chat del sitio "${datos_detectados.dia_visita}", pero ese día de la semana no coincide con el número. Quedó el ${fechaVisita}: confirmar la fecha con el cliente.`;
        if (vendedorAsignado) notificarPersona(supabase, vendedorAsignado, "rodi_venta_zona", mensajeFecha, "/panel/visitas", { modulo: "visitas" }).catch((err) => console.error("[rodi] error avisando fecha dudosa:", err));
        else notificarEncargados(supabase, mensajeFecha, "/panel/visitas", "rodi_venta_zona", sucursalElegida?.id, "alta", { modulo: "visitas" }).catch((err) => console.error("[rodi] error avisando fecha dudosa:", err));
      }
      if (!errorVisita && hayConflicto) {
        const mensajeConflicto = `⚠️ ${nombreCliente} agendó por Paffy a las ${datos_detectados.horario_visita} el ${fechaVisita} en ${sucursalVisita}, pero ese horario ya estaba ocupado. Reagendar una de las dos.`;
        if (vendedorAsignado) notificarPersona(supabase, vendedorAsignado, "rodi_venta_zona", mensajeConflicto, "/panel/visitas", { modulo: "visitas" }).catch((err) => console.error("[rodi] error notificando conflicto de visita:", err));
        else notificarEncargados(supabase, mensajeConflicto, "/panel/visitas", "rodi_venta_zona", sucursalElegida?.id, "alta", { modulo: "visitas" }).catch((err) => console.error("[rodi] error notificando conflicto de visita:", err));
      }
    }
  }

  return NextResponse.json({ replies: partes, handoff, ...(consultaNueva ? { consulta: true } : {}) });
}
