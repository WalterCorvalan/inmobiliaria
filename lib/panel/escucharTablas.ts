import type { SupabaseClient } from "@supabase/supabase-js";

// Escucha cambios de varias tablas en tiempo real, con un canal por tabla.
//
// Por qué uno por tabla (15/10/2026): si un mismo canal escucha varias tablas y UNA no está en la publicación
// supabase_realtime, Supabase rechaza el canal entero y no llega ningún cambio. Pasó en la bandeja de chats y en
// Leads: messenger_conversaciones, rodi_conversaciones y leads_manuales no estaban publicadas, y por eso tampoco se
// actualizaban WhatsApp ni Instagram sin recargar. Así, una tabla que falte deja de avisar sola y lo dice en la
// consola, sin apagar a las demás.
export function escucharTablas(cliente: SupabaseClient, tablas: string[], alCambiar: () => void, prefijo = "vivo"): () => void {
  const sufijo = Math.random().toString(36).slice(2);
  const canales = tablas.map((tabla) =>
    cliente
      .channel(`${prefijo}-${tabla}-${sufijo}`)
      .on("postgres_changes", { event: "*", schema: "public", table: tabla }, alCambiar)
      .subscribe((estado) => {
        if (estado === "CHANNEL_ERROR") console.warn(`Tiempo real: la tabla ${tabla} no avisa sus cambios (¿falta en la publicación supabase_realtime?).`);
      })
  );
  return () => {
    for (const canal of canales) cliente.removeChannel(canal);
  };
}
