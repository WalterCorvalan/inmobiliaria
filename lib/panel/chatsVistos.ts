import { supabase2 } from "@/lib/supabase/client";
import type { CanalChat } from "@/lib/panel/clienteSinContestar";

// Anota que esta persona abrió el chat (migraciones/sql_avisos_urgentes.sql). Con eso el aviso de "cliente sin
// contestar" deja de repetirse en el celular (app/api/cron/panel/avisos-urgentes). Si falla no pasa nada: el aviso
// sigue sonando hasta que lo lean o le contesten al cliente.
export function marcarChatVisto(canal: CanalChat, conversacionId: string, perfilId: string) {
  if (!conversacionId || !perfilId) return;
  void supabase2.from("chats_vistos")
    .upsert({ canal, conversacion_id: conversacionId, perfil_id: perfilId, visto_at: new Date().toISOString() })
    .then(() => {});
}
