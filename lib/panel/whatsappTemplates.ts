import { supabaseEmpresa as supabaseAdmin } from "@/lib/empresa/db";
import { decrypt } from "@/lib/crypto";
import { createMessageTemplate, deleteMessageTemplate, listMessageTemplates, sendTemplateMessage, MetaApiError } from "@/lib/meta/client";
import { countVariables, esPlantillaDeEjemploMeta, renderBody, validateBodyVariables } from "@/lib/panel/variablesPlantilla";
import { registrarError } from "@/lib/panel/logger";

// Puerto del patrón de plantillas de Vocero CRM (src/server/whatsapp/templates.ts)
// a Supabase2 -- resuelve el mismo caso: enviar cuando la ventana de 24h de
// WhatsApp está vencida y Meta rechaza texto libre.


export class TemplateError extends Error {
  code: "not_connected" | "invalid" | "not_found" | "meta_error";
  constructor(code: TemplateError["code"], message: string) {
    super(message);
    this.name = "TemplateError";
    this.code = code;
  }
}

// Los datos {{1}}, {{2}}… se validan y completan en lib/panel/variablesPlantilla.ts (hasta 4 desde el 19/10/2026).

async function getConfig() {
  const { data } = await supabaseAdmin.from("whatsapp_configuracion").select("*").maybeSingle();
  return data;
}

export async function crearPlantilla(input: { nombre: string; idioma: string; categoria: string; cuerpo: string; ejemplos?: string[] }) {
  const errorVariable = validateBodyVariables(input.cuerpo);
  if (errorVariable) throw new TemplateError("invalid", errorVariable);

  const config = await getConfig();
  if (!config?.listo || !config.waba_id || !config.token_cifrado) {
    throw new TemplateError("not_connected", "Falta configurar WhatsApp o el WABA ID (Configuración → WhatsApp).");
  }

  const nombre = input.nombre.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  if (!nombre) throw new TemplateError("invalid", "Nombre de plantilla inválido");

  const cantidad = countVariables(input.cuerpo);
  // Ejemplos para la revisión de Meta: los de la plantilla sugerida, o genéricos.
  const ejemplos = Array.from({ length: cantidad }, (_, i) => input.ejemplos?.[i]?.trim() || ["Juan", "Ford Ranger 2022", "lunes 20 a las 11", "la seña"][i] || "dato");
  const token = decrypt(config.token_cifrado, config.token_iv, config.token_tag);

  let waTemplateId: string | null = null;
  try {
    const res = await createMessageTemplate(config.waba_id, token, {
      name: nombre,
      language: input.idioma,
      category: input.categoria,
      body: input.cuerpo,
      ejemplos,
    });
    waTemplateId = res.id ?? null;
  } catch (err) {
    if (err instanceof MetaApiError) throw new TemplateError("meta_error", err.message);
    throw err;
  }

  const { data, error } = await supabaseAdmin
    .from("whatsapp_templates")
    .upsert(
      { nombre, idioma: input.idioma, categoria: input.categoria, cuerpo: input.cuerpo, estado: "pending", wa_template_id: waTemplateId, motivo_rechazo: null, updated_at: new Date().toISOString() },
      { onConflict: "nombre,idioma" }
    )
    .select()
    .single();
  if (error || !data) throw new TemplateError("meta_error", "No se pudo guardar la plantilla localmente");
  return data;
}

function mapearEstadoMeta(status: string | undefined): "approved" | "rejected" | "pending" | null {
  const s = (status ?? "").toUpperCase();
  if (s === "APPROVED") return "approved";
  if (s === "REJECTED") return "rejected";
  if (s === "PENDING" || s === "IN_APPEAL" || s === "PENDING_DELETION") return "pending";
  return null;
}

// Pull de estados -- igual que Vocero, es la vía universal porque el webhook
// de message_template_status_update no está cableado en v2 todavía.
//
// Además de actualizar el estado de las que ya tenemos, IMPORTA las
// plantillas que ya existen aprobadas en el WABA de Meta pero que nunca se
// crearon localmente (ej: quedaron cargadas de Vocero/otro sistema, o se
// crearon a mano desde el Administrador de Meta) -- si no, quedaban
// aprobadas del lado de Meta pero invisibles/inutilizables desde acá.
export async function sincronizarPlantillas(): Promise<{ actualizadas: number; importadas: number }> {
  const config = await getConfig();
  if (!config?.waba_id || !config.token_cifrado) {
    throw new TemplateError("not_connected", "Falta configurar WhatsApp o el WABA ID.");
  }
  const token = decrypt(config.token_cifrado, config.token_iv, config.token_tag);

  let remoto;
  try {
    remoto = await listMessageTemplates(config.waba_id, token);
  } catch (err) {
    if (err instanceof MetaApiError) throw new TemplateError("meta_error", err.message);
    throw err;
  }

  const { data: locales } = await supabaseAdmin.from("whatsapp_templates").select("*");
  let actualizadas = 0;
  let importadas = 0;
  for (const r of remoto.data ?? []) {
    const estado = mapearEstadoMeta(r.status);
    if (!estado) continue;
    const match = (locales ?? []).find(
      (t) => (r.id && t.wa_template_id === r.id) || (t.nombre === r.name && t.idioma === r.language)
    );
    if (match) {
      if (match.estado === estado) continue;
      await supabaseAdmin
        .from("whatsapp_templates")
        .update({ estado, motivo_rechazo: r.rejected_reason ?? null, wa_template_id: match.wa_template_id ?? r.id ?? null, updated_at: new Date().toISOString() })
        .eq("id", match.id);
      actualizadas += 1;
      continue;
    }

    // No existe localmente -- la importamos con el cuerpo real que devuelve
    // Meta (componente BODY) para que quede lista para usar/enviar.
    if (!r.name || !r.language) continue;
    if (esPlantillaDeEjemploMeta(r.name)) continue; // ejemplos de Meta: no se traen (ver variablesPlantilla.ts)
    const cuerpo = r.components?.find((c) => c.type === "BODY")?.text?.trim();
    if (!cuerpo) continue;
    await supabaseAdmin.from("whatsapp_templates").insert({
      nombre: r.name,
      idioma: r.language,
      categoria: r.category ?? "UTILITY",
      cuerpo,
      estado,
      wa_template_id: r.id ?? null,
      motivo_rechazo: r.rejected_reason ?? null,
    });
    importadas += 1;
  }
  return { actualizadas, importadas };
}

export async function enviarPlantilla(input: { conversacionId: string; templateId: string; variable?: string; variables?: string[] }) {
  const { data: template } = await supabaseAdmin.from("whatsapp_templates").select("*").eq("id", input.templateId).maybeSingle();
  if (!template) throw new TemplateError("not_found", "Plantilla no encontrada");
  if (template.estado !== "approved") throw new TemplateError("invalid", "Solo se pueden enviar plantillas aprobadas");

  const cantidad = countVariables(template.cuerpo);
  const valores = (input.variables ?? (input.variable !== undefined ? [input.variable] : [])).map((v) => v.trim());
  const falta = Array.from({ length: cantidad }, (_, i) => i).find((i) => !valores[i]);
  if (falta !== undefined) throw new TemplateError("invalid", `Falta completar el dato {{${falta + 1}}}`);

  const { data: conversacion } = await supabaseAdmin
    .from("whatsapp_conversaciones")
    .select("id, whatsapp_contactos(telefono)")
    .eq("id", input.conversacionId)
    .single();
  const telefono = (conversacion?.whatsapp_contactos as any)?.telefono;
  if (!telefono) throw new TemplateError("not_found", "Conversación o teléfono no encontrado");

  const config = await getConfig();
  if (!config?.listo || !config.token_cifrado) throw new TemplateError("not_connected", "WhatsApp no está configurado");
  const token = decrypt(config.token_cifrado, config.token_iv, config.token_tag);

  const { data: mensaje } = await supabaseAdmin
    .from("whatsapp_mensajes")
    .insert({ conversacion_id: input.conversacionId, direccion: "out", tipo: "template", texto: renderBody(template.cuerpo, valores), status: "pending", ai_generado: false })
    .select("id")
    .single();
  if (!mensaje) throw new TemplateError("meta_error", "No se pudo guardar el mensaje");

  try {
    const resultado = await sendTemplateMessage(config.phone_number_id, token, telefono, template.nombre, template.idioma, valores.slice(0, cantidad));
    await supabaseAdmin.from("whatsapp_mensajes").update({ status: "sent", wa_message_id: resultado.messages?.[0]?.id }).eq("id", mensaje.id);
    await supabaseAdmin.from("whatsapp_conversaciones").update({ last_message_at: new Date().toISOString() }).eq("id", input.conversacionId);
  } catch (err: any) {
    registrarError("panelV2/whatsappTemplates:enviar", err, { conversacionId: input.conversacionId, mensajeId: mensaje.id });
    await supabaseAdmin.from("whatsapp_mensajes").update({ status: "failed" }).eq("id", mensaje.id);
    throw new TemplateError("meta_error", err?.message ?? "Error enviando la plantilla");
  }

  return { mensajeId: mensaje.id };
}

/** Borra la plantilla en Meta y en el panel (Configuración → WhatsApp → Plantillas, solo admin). */
export async function eliminarPlantilla(id: string) {
  const { data: template } = await supabaseAdmin.from("whatsapp_templates").select("id, nombre").eq("id", id).maybeSingle();
  if (!template) throw new TemplateError("not_found", "Plantilla no encontrada");
  const config = await getConfig();
  if (!config?.waba_id || !config.token_cifrado) throw new TemplateError("not_connected", "Falta configurar WhatsApp o el WABA ID.");
  const token = decrypt(config.token_cifrado, config.token_iv, config.token_tag);
  // Las de ejemplo de Meta no se pueden borrar allá: se sacan solo del panel.
  if (esPlantillaDeEjemploMeta(template.nombre)) {
    await supabaseAdmin.from("whatsapp_templates").delete().eq("nombre", template.nombre);
    return;
  }
  try {
    await deleteMessageTemplate(config.waba_id, token, template.nombre);
  } catch (err) {
    // Si en Meta no existe (subcódigo 2593002: quedó de otro sistema o nunca se creó allá), igual se saca del panel.
    if (!(err instanceof MetaApiError) || !/2593002|does not exist|no existe|not found/i.test(err.message)) {
      if (err instanceof MetaApiError) throw new TemplateError("meta_error", err.message);
      throw err;
    }
  }
  await supabaseAdmin.from("whatsapp_templates").delete().eq("nombre", template.nombre);
}

/**
 * Manda una plantilla aprobada a un teléfono, sin necesitar una charla abierta (mensajes automáticos a clientes:
 * cumpleaños y fin de pago, lib/panel/mensajesAutomaticos.ts). Si el cliente ya tiene charla de WhatsApp, el mensaje
 * queda guardado ahí para que el vendedor lo vea.
 */
export async function enviarPlantillaATelefono(input: { telefono: string; nombrePlantilla: string; variables: string[] }) {
  const { data: template } = await supabaseAdmin.from("whatsapp_templates").select("*").eq("nombre", input.nombrePlantilla).eq("estado", "approved").maybeSingle();
  if (!template) throw new TemplateError("not_found", `La plantilla ${input.nombrePlantilla} no está aprobada por Meta`);
  const config = await getConfig();
  if (!config?.listo || !config.token_cifrado) throw new TemplateError("not_connected", "WhatsApp no está configurado");
  const token = decrypt(config.token_cifrado, config.token_iv, config.token_tag);
  const valores = input.variables.slice(0, countVariables(template.cuerpo)).map((v) => v.trim());

  const resultado = await sendTemplateMessage(config.phone_number_id, token, input.telefono, template.nombre, template.idioma, valores);
  const waId: string | null = resultado.messages?.[0]?.id ?? null;

  // Guardarlo en la charla del cliente si existe (mismo número, con o sin el 9).
  const { data: contacto } = await supabaseAdmin.from("whatsapp_contactos").select("id").like("telefono", `%${input.telefono.slice(-10)}`).limit(1).maybeSingle();
  if (contacto) {
    const { data: conv } = await supabaseAdmin.from("whatsapp_conversaciones").select("id").eq("contacto_id", contacto.id).order("last_message_at", { ascending: false }).limit(1).maybeSingle();
    if (conv) {
      await supabaseAdmin.from("whatsapp_mensajes").insert({ conversacion_id: conv.id, direccion: "out", tipo: "template", texto: renderBody(template.cuerpo, valores), status: "sent", wa_message_id: waId, ai_generado: false });
    }
  }
  return { waId };
}
