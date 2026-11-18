-- sql_010_visitas_propiedad.sql
-- Visitas a propiedades: cada visita puede quedar atada a una propiedad de la cartera (la elige el asesor o la deja el bot
-- con el código que dio el cliente) y llevar una nota. Las columnas vehiculo_* quedan como estaban (vienen de Pfaffen) y no
-- se usan en la inmobiliaria.

alter table visitas add column if not exists propiedad_id uuid references propiedades(id) on delete set null;
alter table visitas add column if not exists propiedad_codigo text;
alter table visitas add column if not exists notas text;
-- Cuándo se le avisó al asesor que la visita es mañana (tarea recordatorio-visitas): una sola vez por visita.
alter table visitas add column if not exists recordatorio_enviado_at timestamptz;
create index if not exists visitas_propiedad_idx on visitas (empresa_id, propiedad_id);

-- Si llega solo el código (el bot), se busca la propiedad de la MISMA empresa y se completa propiedad_id.
create or replace function public.visitas_vincular_propiedad() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.propiedad_id is null and new.propiedad_codigo is not null and new.empresa_id is not null then
    select p.id into new.propiedad_id from public.propiedades p
     where p.empresa_id = new.empresa_id and upper(p.codigo) = upper(trim(new.propiedad_codigo))
     limit 1;
  end if;
  return new;
end $$;

drop trigger if exists visitas_vincular_propiedad on visitas;
create trigger visitas_vincular_propiedad before insert or update of propiedad_codigo on visitas
  for each row execute function public.visitas_vincular_propiedad();

-- La tarea nueva recordatorio-visitas (18 hs de cada empresa) se suma a las que programa programar_tareas.
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
    ('bots-apertura',        '0 * * * *'),
    ('recordatorio-visitas', '0 * * * *'),   -- cada hora: cada empresa actúa a las 18 de su zona
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

insert into schema_migraciones (nombre) values ('sql_010_visitas_propiedad.sql') on conflict do nothing;

-- ROLLBACK:
-- (programar_tareas: volver a correr la de sql_008_programar_tareas.sql y select cron.unschedule('panel-recordatorio-visitas');)
-- drop trigger if exists visitas_vincular_propiedad on visitas;
-- drop function if exists public.visitas_vincular_propiedad();
-- drop index if exists visitas_propiedad_idx;
-- alter table visitas drop column if exists recordatorio_enviado_at;
-- alter table visitas drop column if exists notas;
-- alter table visitas drop column if exists propiedad_codigo;
-- alter table visitas drop column if exists propiedad_id;
-- delete from schema_migraciones where nombre = 'sql_010_visitas_propiedad.sql';
