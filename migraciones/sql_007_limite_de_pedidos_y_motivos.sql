-- sql_007_limite_de_pedidos_y_motivos.sql
-- 1) Límite de pedidos por IP (rate_limit_check): lo usan los webhooks y el chat de la web contra el abuso.
-- 2) Cada empresa nueva arranca con motivos de cierre de leads y se completan las que ya existían.

create table if not exists rate_limits (
  clave text primary key,
  ventana_inicio timestamptz not null default now(),
  cuenta integer not null default 0
);
alter table rate_limits enable row level security;
-- Sin políticas: solo el servidor (clave de servicio) usa esta tabla, a través de rate_limit_check.

create or replace function public.rate_limit_check(p_clave text, p_limite integer, p_ventana_ms integer)
returns table(ok boolean, retry_after_seconds integer)
language plpgsql security definer set search_path = public as $$
declare
  v_ahora timestamptz := clock_timestamp();
  v_fila public.rate_limits%rowtype;
begin
  insert into public.rate_limits as r (clave, ventana_inicio, cuenta) values (p_clave, v_ahora, 1)
  on conflict (clave) do update set
    ventana_inicio = case when r.ventana_inicio + (p_ventana_ms || ' milliseconds')::interval <= v_ahora then v_ahora else r.ventana_inicio end,
    cuenta = case when r.ventana_inicio + (p_ventana_ms || ' milliseconds')::interval <= v_ahora then 1 else r.cuenta + 1 end
  returning * into v_fila;
  if v_fila.cuenta > p_limite then
    return query select false, greatest(1, ceil(extract(epoch from (v_fila.ventana_inicio + (p_ventana_ms || ' milliseconds')::interval - v_ahora)))::integer);
  else
    return query select true, 0;
  end if;
end $$;
revoke all on function public.rate_limit_check(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_check(text, integer, integer) to service_role;

-- Motivos de cierre por defecto para cada empresa.
create or replace function public.motivos_de_cierre_iniciales(p_empresa_id uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.motivos_cierre (empresa_id, nombre)
  select p_empresa_id, m from unnest(array['No respondió', 'No le interesó', 'Compró o alquiló en otro lado', 'Precio', 'Datos incorrectos', 'Consulta duplicada']) as m
  on conflict (empresa_id, nombre) do nothing
$$;
revoke all on function public.motivos_de_cierre_iniciales(uuid) from public, anon, authenticated;

create or replace function public.crear_configuracion_de_empresa() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.configuracion_empresa (empresa_id, branding_nombre) values (new.id, new.nombre) on conflict do nothing;
  insert into public.whatsapp_configuracion (empresa_id, webhook_verify_token)
    values (new.id, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')) on conflict do nothing;
  insert into public.instagram_configuracion (empresa_id, webhook_verify_token)
    values (new.id, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')) on conflict do nothing;
  insert into public.messenger_configuracion (empresa_id, verify_token)
    values (new.id, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')) on conflict do nothing;
  perform public.motivos_de_cierre_iniciales(new.id);
  return new;
end $$;

select public.motivos_de_cierre_iniciales(id) from empresas;

insert into schema_migraciones (nombre) values ('sql_007_limite_de_pedidos_y_motivos.sql') on conflict do nothing;

-- ROLLBACK:
-- drop function if exists motivos_de_cierre_iniciales(uuid);
-- drop function if exists rate_limit_check(text, integer, integer);
-- drop table if exists rate_limits;
-- (volver a correr la definición de crear_configuracion_de_empresa() de sql_002_equipo_y_base.sql)
-- delete from schema_migraciones where nombre = 'sql_007_limite_de_pedidos_y_motivos.sql';
