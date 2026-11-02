-- sql_008_programar_tareas.sql
-- Deja lista la función que programa las tareas automáticas (pg_cron + pg_net, que Supabase trae). NO las programa sola:
-- hay que llamarla UNA vez con la dirección de la app y la clave CRON_SECRET (la misma que se carga en Vercel):
--   select programar_tareas('https://tu-dominio.com', 'EL_CRON_SECRET');
-- Cada tarea recorre todas las empresas activas, cada una con su horario y su zona horaria.
-- Requiere las extensiones pg_cron y pg_net (Supabase → Database → Extensions).
create or replace function public.programar_tareas(p_base_url text, p_token text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_tarea record;
begin
  for v_tarea in select * from (values
    ('lector-charlas',       '*/10 * * * *'),
    ('avisos-urgentes',      '*/15 * * * *'),
    ('aviso-ventana-24h',    '*/15 * * * *'),
    ('automatizaciones',     '*/15 * * * *'),
    ('salud-integraciones',  '*/30 * * * *'),
    ('bots-apertura',        '0 * * * *'),   -- cada hora: cada empresa actúa a las 9 de su zona
    ('archivado-chats',      '0 6 * * *')
  ) as t(ruta, cuando)
  loop
    perform cron.schedule(
      'panel-' || v_tarea.ruta, v_tarea.cuando,
      format('select net.http_get(url := %L)', p_base_url || '/api/cron/panel/' || v_tarea.ruta || '?token=' || p_token)
    );
  end loop;
end $$;
revoke all on function public.programar_tareas(text, text) from public, anon, authenticated;

insert into schema_migraciones (nombre) values ('sql_008_programar_tareas.sql') on conflict do nothing;

-- ROLLBACK:
-- select cron.unschedule(jobname) from cron.job where jobname like 'panel-%';
-- drop function if exists programar_tareas(text, text);
-- delete from schema_migraciones where nombre = 'sql_008_programar_tareas.sql';
