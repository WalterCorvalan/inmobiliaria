import { supabaseEmpresa as supabase, paraCadaEmpresa } from "@/lib/empresa/db";
import { crearAlerta } from "@/lib/panel/alertas";
import { registrarError } from "@/lib/panel/logger";
import { enviarPush, pushConfigurado } from "@/lib/push";
import { categoriaDeTipo } from "@/lib/panel/nivelesAlertas";
import {
  CANALES_CHAT, TIPOS_DE_CHARLA, TIPO_SIN_CONTESTAR,
  chatDelLink, contestado, corresponderAvisoSinContestar, esperaDesde, nombreDelCliente, tocaRepetir,
} from "@/lib/panel/clienteSinContestar";

// Avisos urgentes de los chats (Walter, 22/10/2026; reglas en lib/panel/clienteSinContestar.ts). Cada 15 minutos
// (pg_cron, migraciones/sql_avisos_urgentes.sql):
//  1. "No le contestaste a {cliente}" a las 2 horas, en los cuatro canales, solo a quien tiene asignado al cliente.
//  2. Los avisos de nivel alto sin leer vuelven a sonar en el celular (sin sumar nada a la campanita). Al encargado
//     no se le avisa (Walter, 30/10/2026).


const horaAr = (fecha: Date) => fecha.toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

async function ultimosMensajes(tabla: string, conversacionId: string) {
  const { data } = await supabase.from(tabla).select("direccion, ai_generado, created_at")
    .eq("conversacion_id", conversacionId).order("created_at", { ascending: false }).limit(40);
  return data || [];
}

async function avisarSinContestar(ahora: Date): Promise<number> {
  let creados = 0;
  const desde = new Date(ahora.getTime() - 7 * 24 * 3_600_000).toISOString();
  for (const c of CANALES_CHAT) {
    try {
      const { data, error } = await supabase.from(c.tabla).select(`id, vendedor_id, ai_habilitada, handoff_at, ${c.contacto}`)
        .not("vendedor_id", "is", null).gte("last_message_at", desde).order("last_message_at", { ascending: false }).limit(300);
      if (error) throw error;
      // Las columnas del contacto cambian por canal: el tipo no se puede deducir del texto del select.
      const convs = (data || []) as unknown as ({ id: string; vendedor_id: string; ai_habilitada: boolean | null; handoff_at: string | null } & Record<string, unknown>)[];
      for (const conv of convs) {
        const espera = esperaDesde(conv, await ultimosMensajes(c.mensajes, conv.id));
        if (!espera || !corresponderAvisoSinContestar(espera, ahora)) continue;
        const link = `${c.ruta}?conversacion=${conv.id}`;
        // Uno solo por espera: si el cliente vuelve a esperar después de una respuesta, es otro aviso.
        const { data: ya } = await supabase.from("alertas").select("id").eq("destinatario_id", conv.vendedor_id)
          .eq("tipo", TIPO_SIN_CONTESTAR).eq("link", link).gte("created_at", espera.toISOString()).limit(1);
        if (ya?.length) continue;
        await crearAlerta(supabase, conv.vendedor_id as string, `No le contestaste a ${nombreDelCliente(c.canal, conv)}`, {
          mensaje: `Te escribió a las ${horaAr(espera)} y todavía nadie le respondió.`,
          link,
          tipo: TIPO_SIN_CONTESTAR,
          prioridad: "alta",
          modulo: "leads",
          categoriaNotif: "leads",
        });
        creados++;
      }
    } catch (err) {
      registrarError("cron/avisos-urgentes:sin-contestar", err, { canal: c.canal });
    }
  }
  return creados;
}

// El aviso de un chat ya no hace falta si el destinatario abrió ese chat después del aviso o si le contestaron.
async function chatResuelto(alerta: { destinatario_id: string; link: string | null; created_at: string }): Promise<boolean> {
  const chat = chatDelLink(alerta.link);
  if (!chat) return false;
  const canal = CANALES_CHAT.find((c) => c.canal === chat.canal)!;
  const { data: visto } = await supabase.from("chats_vistos").select("visto_at").eq("canal", chat.canal)
    .eq("conversacion_id", chat.conversacionId).eq("perfil_id", alerta.destinatario_id).maybeSingle();
  if (visto && new Date(visto.visto_at) >= new Date(alerta.created_at)) return true;
  return contestado(await ultimosMensajes(canal.mensajes, chat.conversacionId));
}

async function repetirAvisos(ahora: Date): Promise<number> {
  let repetidos = 0;
  const { data: alertas, error } = await supabase.from("alertas")
    .select("id, destinatario_id, titulo, mensaje, link, tipo, created_at, push_repeticiones, push_ultimo_at")
    .eq("prioridad", "alta").eq("leida", false).eq("push_enviado", true)
    .gte("created_at", new Date(ahora.getTime() - 24 * 3_600_000).toISOString())
    .order("created_at", { ascending: true }).limit(200);
  if (error) {
    registrarError("cron/avisos-urgentes:repetir", error);
    return repetidos;
  }
  const pendientes = (alertas || []).filter((a) => tocaRepetir(a, ahora));
  if (!pendientes.length) return repetidos;

  const ids = [...new Set(pendientes.map((a) => a.destinatario_id))];
  const [{ data: subs }, { data: prefs }] = await Promise.all([
    supabase.from("push_subscriptions").select("id, perfil_id, endpoint, p256dh, auth").in("perfil_id", ids),
    supabase.from("espacio_notif_prefs").select("perfil_id, desactivadas").in("perfil_id", ids),
  ]);
  const apagadas = new Map((prefs || []).map((p) => [p.perfil_id, new Set<string>(p.desactivadas || [])]));
  const idsExpiradas: string[] = [];

  for (const alerta of pendientes) {
    try {
      const paso = (alerta.push_repeticiones ?? 0) + 1;
      if (TIPOS_DE_CHARLA.includes(alerta.tipo) && (await chatResuelto(alerta))) {
        // Ya abrieron el chat o le contestaron: no suena más.
        await supabase.from("alertas").update({ push_repeticiones: 99 }).eq("id", alerta.id);
        continue;
      }
      const categoria = categoriaDeTipo(alerta.tipo);
      if (pushConfigurado() && !(categoria && apagadas.get(alerta.destinatario_id)?.has(categoria))) {
        // Mismo link = misma etiqueta en el celular: reemplaza la notificación anterior y vuelve a sonar (public/sw-push.js).
        for (const sub of (subs || []).filter((s) => s.perfil_id === alerta.destinatario_id)) {
          const r = await enviarPush(sub, { titulo: alerta.titulo, mensaje: alerta.mensaje, link: alerta.link, alertaId: alerta.id });
          if (r.ok) repetidos++;
          else if (r.expirada) idsExpiradas.push(sub.id);
        }
      }
      await supabase.from("alertas").update({ push_repeticiones: paso, push_ultimo_at: ahora.toISOString() }).eq("id", alerta.id);
    } catch (err) {
      registrarError("cron/avisos-urgentes:repetir", err, { alertaId: alerta.id });
    }
  }
  if (idsExpiradas.length) await supabase.from("push_subscriptions").delete().in("id", idsExpiradas);
  return repetidos;
}

async function trabajoDeLaEmpresa(req: Request): Promise<Response> {
  const ahora = new Date();
  const creados = await avisarSinContestar(ahora);
  const repetidos = await repetirAvisos(ahora);
  return Response.json({ ok: true, creados, repetidos });
}


// Las tareas automáticas recorren todas las empresas activas; cada una corre con sus datos, su horario y su zona horaria.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) return new Response("Unauthorized", { status: 401 });
  const empresas = await paraCadaEmpresa(async () => (await trabajoDeLaEmpresa(req)).json());
  return Response.json({ ok: true, empresas });
}
