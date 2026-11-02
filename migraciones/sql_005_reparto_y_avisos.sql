-- sql_005_reparto_y_avisos.sql
-- Reparto de leads y avisos al equipo, siempre dentro de la empresa del lead.
-- En Pfaffen estas funciones buscaban "todos los perfiles" y "la configuración": con varias empresas un lead de una
-- avisaría a los asesores de otra. Acá todas reciben o deducen la empresa y filtran por ella.

-- Las funciones que se llaman desde el navegador (rpc) solo aceptan la empresa de quien las llama; las que se llaman
-- desde el servidor (sin sesión) aceptan cualquiera. Auxiliar para no repetir la comprobación.
create or replace function public.validar_empresa_de_la_sesion(p_empresa_id uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is not null and p_empresa_id is distinct from public.mi_empresa_id() then
    raise exception 'Empresa no permitida';
  end if;
end $$;

-- ¿Este canal reparte solo? Se lee de la configuración de la empresa indicada (o de la de quien llama).
create or replace function public.asignacion_auto_en_tabla(p_tabla text, p_empresa_id uuid default null) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_emp uuid := coalesce(p_empresa_id, public.mi_empresa_id());
begin
  perform public.validar_empresa_de_la_sesion(v_emp);
  return coalesce((
    select coalesce(c.asignacion_leads_ronda, true)
       and (split_part(p_tabla, '_', 1) not in ('whatsapp', 'instagram', 'messenger', 'rodi')
            or split_part(p_tabla, '_', 1) = any(c.asignacion_auto_canales))
    from public.configuracion_empresa c
    where c.empresa_id = v_emp
  ), true);
end $$;

-- Ronda general: por turnos entre los asesores activos de la empresa que no apagaron "recibir leads".
create or replace function public.proximo_vendedor_ronda(p_empresa_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_zona text := coalesce((select zona_horaria from public.empresas where id = p_empresa_id), 'America/Argentina/Buenos_Aires');
  v_hoy date := (now() at time zone v_zona)::date;
  v_ultimo_orden int;
begin
  perform public.validar_empresa_de_la_sesion(p_empresa_id);
  perform pg_advisory_xact_lock(hashtext('lead_ronda_general:' || p_empresa_id::text));

  select coalesce(p.orden_ronda, 1000) into v_ultimo_orden
  from public.lead_ronda_turnos t join public.perfiles p on p.id = t.vendedor_id
  where t.empresa_id = p_empresa_id
  order by t.ultima_asignacion desc nulls last
  limit 1;

  select p.id into v_id
  from public.perfiles p
  where p.empresa_id = p_empresa_id and p.activo = true and 'ventas' = any(p.roles)
    and not exists (
      select 1 from public.disponibilidad_vendedor d
      where d.vendedor_id = p.id and d.recibir_leads = false and (d.hasta is null or d.hasta >= v_hoy)
    )
  order by (coalesce(p.orden_ronda, 1000) <= coalesce(v_ultimo_orden, 0)), coalesce(p.orden_ronda, 1000), p.created_at, p.id
  limit 1;

  if v_id is null then
    return null;
  end if;

  insert into public.lead_ronda_turnos (empresa_id, vendedor_id, ultima_asignacion) values (p_empresa_id, v_id, clock_timestamp())
  on conflict (vendedor_id) do update set ultima_asignacion = excluded.ultima_asignacion;
  return v_id;
end $$;

-- Ronda de una oficina: el asesor de esa oficina que hace más tiempo no recibe una charla de este canal;
-- si no hay, el encargado de la oficina; si no, el dueño de la empresa.
create or replace function public._ronda_por_sucursal(p_tabla text, p_sucursal_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_emp uuid; v_candidato uuid;
begin
  select empresa_id into v_emp from public.sucursales where id = p_sucursal_id;
  if v_emp is null then
    return null;
  end if;
  if auth.uid() is not null and v_emp is distinct from public.mi_empresa_id() then
    return null;
  end if;
  execute format(
    'select p.id from public.perfiles p
       left join public.disponibilidad_vendedor d on d.vendedor_id = p.id
       left join lateral (select max(c.created_at) as ultimo from public.%I c where c.vendedor_id = p.id) u on true
      where p.empresa_id = $1 and p.activo = true and ''ventas'' = any(p.roles) and p.sucursal_id = $2
        and (d.recibir_leads is null or d.recibir_leads = true)
      order by u.ultimo asc nulls first
      limit 1', p_tabla) into v_candidato using v_emp, p_sucursal_id;
  if v_candidato is null then
    select p.id into v_candidato from public.perfiles p
     where p.empresa_id = v_emp and p.activo = true and 'encargado' = any(p.roles) and p.sucursal_id = p_sucursal_id limit 1;
  end if;
  if v_candidato is null then
    select p.id into v_candidato from public.perfiles p
     where p.empresa_id = v_emp and p.activo = true and 'admin' = any(p.roles) limit 1;
  end if;
  return v_candidato;
end $$;
revoke all on function public._ronda_por_sucursal(text, uuid) from public, anon, authenticated;

create or replace function public.asignar_vendedor_ronda_whatsapp_por_sucursal(p_sucursal_id uuid) returns uuid
language sql security definer set search_path = public as $$ select public._ronda_por_sucursal('whatsapp_conversaciones', p_sucursal_id) $$;
create or replace function public.asignar_vendedor_ronda_instagram_por_sucursal(p_sucursal_id uuid) returns uuid
language sql security definer set search_path = public as $$ select public._ronda_por_sucursal('instagram_conversaciones', p_sucursal_id) $$;
create or replace function public.asignar_vendedor_ronda_rodi_por_sucursal(p_sucursal_id uuid) returns uuid
language sql security definer set search_path = public as $$ select public._ronda_por_sucursal('rodi_conversaciones', p_sucursal_id) $$;

-- Lead nuevo sin asesor: se le asigna el próximo de la ronda de SU empresa, o se avisa a todo el equipo de su empresa
-- si el canal no reparte solo.
create or replace function public.asignar_lead_ronda_general() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_vendedor uuid;
  v_fila jsonb;
  v_nombre text;
  v_canal text := coalesce(nullif(TG_ARGV[0], ''), 'un canal');
begin
  -- WhatsApp mientras lo atiende el bot: entra sin asesor y se asigna al terminar la charla.
  if TG_TABLE_NAME = 'whatsapp_conversaciones' and coalesce(new.ai_habilitada, true) then
    return new;
  end if;
  if new.vendedor_id is not null then
    return new;
  end if;
  if not coalesce((select asignacion_leads_ronda from public.configuracion_empresa where empresa_id = new.empresa_id), true) then
    return new;
  end if;

  v_fila := to_jsonb(new);
  v_nombre := nullif(trim(coalesce(v_fila ->> 'nombre', v_fila ->> 'nombre_contacto', v_fila ->> 'username', v_fila ->> 'telefono', '')), '');

  if not public.asignacion_auto_en_tabla(TG_TABLE_NAME, new.empresa_id) then
    insert into public.alertas (empresa_id, destinatario_id, tipo, prioridad, titulo, mensaje, link)
    select new.empresa_id, p.id, 'lead_sin_asignar', 'novedad',
      left('Lead sin asignar por ' || v_canal || coalesce(': ' || v_nombre, ''), 120),
      'Entró un lead por ' || v_canal || ' sin asignar. Si es tuyo, asignátelo desde Leads.',
      '/panel/leads'
    from public.perfiles p
    left join public.disponibilidad_vendedor d on d.vendedor_id = p.id
    where p.empresa_id = new.empresa_id and p.activo = true and (p.roles && array['ventas', 'encargado'])
      and not (coalesce(d.recibir_leads, true) = false and (d.hasta is null or d.hasta >= current_date));
    return new;
  end if;

  v_vendedor := public.proximo_vendedor_ronda(new.empresa_id);
  if v_vendedor is null then
    return new;
  end if;

  new.vendedor_id := v_vendedor;
  if coalesce(new.estado_lead, 'nuevo') = 'nuevo' then
    new.estado_lead := 'asignado';
  end if;
  insert into public.alertas (empresa_id, destinatario_id, tipo, prioridad, titulo, mensaje, link)
  values (new.empresa_id, v_vendedor, 'lead_asignado', 'novedad',
    left('Nuevo lead por ' || v_canal || coalesce(': ' || v_nombre, ''), 120), 'Te llegó un lead nuevo por ' || v_canal || '.', '/panel/leads');
  return new;
end $$;
drop trigger if exists trg_zz_asignar_lead_ronda_general on whatsapp_conversaciones;
create trigger trg_zz_asignar_lead_ronda_general before insert on whatsapp_conversaciones for each row execute function public.asignar_lead_ronda_general('WhatsApp');
drop trigger if exists trg_zz_asignar_lead_ronda_general on instagram_conversaciones;
create trigger trg_zz_asignar_lead_ronda_general before insert on instagram_conversaciones for each row execute function public.asignar_lead_ronda_general('Instagram');
drop trigger if exists trg_zz_asignar_lead_ronda_general on messenger_conversaciones;
create trigger trg_zz_asignar_lead_ronda_general before insert on messenger_conversaciones for each row execute function public.asignar_lead_ronda_general('Messenger');
drop trigger if exists trg_zz_asignar_lead_ronda_general on rodi_conversaciones;
create trigger trg_zz_asignar_lead_ronda_general before insert on rodi_conversaciones for each row execute function public.asignar_lead_ronda_general('el chat de la web');

-- Reparto manual de lo que quedó sin asignar (solo el dueño, solo su empresa).
create or replace function public.repartir_leads_sin_asignar() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_emp uuid := public.mi_empresa_id();
  v_tabla text;
  v_fila record;
  v_vendedor uuid;
  v_total integer := 0;
begin
  if v_emp is null or not public.soy_dueno() then
    raise exception 'Solo el dueño puede repartir leads.';
  end if;
  foreach v_tabla in array array['whatsapp_conversaciones', 'instagram_conversaciones', 'messenger_conversaciones', 'rodi_conversaciones'] loop
    continue when not public.asignacion_auto_en_tabla(v_tabla, v_emp);
    for v_fila in execute format(
      'select id::text as id from public.%I where empresa_id = $1 and vendedor_id is null and coalesce(estado_lead, ''nuevo'') = ''nuevo'' and not coalesce(es_basura, false) order by created_at', v_tabla)
      using v_emp
    loop
      v_vendedor := public.proximo_vendedor_ronda(v_emp);
      exit when v_vendedor is null;
      execute format('update public.%I set vendedor_id = $1, estado_lead = ''asignado'' where id::text = $2 and empresa_id = $3', v_tabla)
        using v_vendedor, v_fila.id, v_emp;
      v_total := v_total + 1;
    end loop;
  end loop;
  return v_total;
end $$;

-- Estado del lead según la temperatura (WhatsApp y chat web, como en Pfaffen).
create or replace function public.avanzar_estado_lead_por_calificacion() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.calificacion in ('caliente', 'tibio') and old.calificacion is distinct from new.calificacion and new.estado_lead in ('nuevo', 'asignado') then
    new.estado_lead := 'calificando';
  end if;
  return new;
end $$;
drop trigger if exists trg_avanzar_estado_lead on whatsapp_conversaciones;
create trigger trg_avanzar_estado_lead before update on whatsapp_conversaciones for each row execute function public.avanzar_estado_lead_por_calificacion();
drop trigger if exists trg_avanzar_estado_lead on rodi_conversaciones;
create trigger trg_avanzar_estado_lead before update on rodi_conversaciones for each row execute function public.avanzar_estado_lead_por_calificacion();

-- ===== Avisos al equipo =====
-- Cliente que pide hablar con una persona: al asesor de la charla o, si no tiene, al dueño y los encargados de la empresa.
-- Un cliente ofensivo nunca avisa a nadie. Messenger no lo usa: lo avisa el código.
create or replace function public.notificar_handoff() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_canal text := TG_ARGV[0];
  v_link text := '/panel/' || TG_ARGV[0] || '?conversacion=' || new.id;
  v_tipo text := case TG_ARGV[0] when 'rodi' then 'rodi_handoff' else 'handoff_chat' end;
  v_titulo text := case TG_ARGV[0] when 'rodi' then 'El visitante del sitio pidió hablar con una persona' else 'El cliente pidió hablar con una persona' end;
begin
  if new.handoff_at is null or old.handoff_at is not null or new.handoff_reason = 'cliente_ofensivo' then
    return new;
  end if;
  if new.vendedor_id is not null then
    insert into public.alertas (empresa_id, destinatario_id, tipo, prioridad, titulo, mensaje, link)
    values (new.empresa_id, new.vendedor_id, v_tipo, 'alta', v_titulo, new.handoff_resumen, v_link);
  else
    insert into public.alertas (empresa_id, destinatario_id, tipo, prioridad, titulo, mensaje, link)
    select new.empresa_id, p.id, v_tipo, 'alta', v_titulo, new.handoff_resumen, v_link
    from public.perfiles p
    where p.empresa_id = new.empresa_id and p.activo = true and p.roles && array['admin', 'encargado'];
  end if;
  return new;
end $$;
drop trigger if exists trg_whatsapp_handoff on whatsapp_conversaciones;
create trigger trg_whatsapp_handoff after update on whatsapp_conversaciones for each row execute function public.notificar_handoff('whatsapp');
drop trigger if exists trg_instagram_handoff on instagram_conversaciones;
create trigger trg_instagram_handoff after update on instagram_conversaciones for each row execute function public.notificar_handoff('instagram');
drop trigger if exists trg_rodi_handoff on rodi_conversaciones;
create trigger trg_rodi_handoff after update on rodi_conversaciones for each row execute function public.notificar_handoff('rodi');

-- Mensaje nuevo del cliente: una alerta por charla (suma el contador mientras no se lea). Va al asesor de la charla o,
-- si no tiene, al equipo de la empresa. En WhatsApp, mientras habla solo el bot y no hay asesor, no se avisa a nadie.
create or replace function public.notificar_mensaje_entrante() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_canal text := TG_ARGV[0];
  v_vendedor uuid;
  v_ai boolean := false;
  v_nombre text;
  v_link text := '/panel/' || TG_ARGV[0] || '?conversacion=' || new.conversacion_id;
  v_tipo text := case TG_ARGV[0] when 'rodi' then 'rodi_nuevo_mensaje' else 'nuevo_mensaje_chat' end;
  v_titulo text;
  v_dest uuid;
  v_actualizadas int;
begin
  if new.direccion <> 'in' then
    return new;
  end if;

  if v_canal = 'whatsapp' then
    select c.vendedor_id, coalesce(c.ai_habilitada, true), coalesce(wc.nombre_perfil, wc.telefono) into v_vendedor, v_ai, v_nombre
    from public.whatsapp_conversaciones c join public.whatsapp_contactos wc on wc.id = c.contacto_id where c.id = new.conversacion_id;
    if v_vendedor is null and v_ai then
      return new;
    end if;
  elsif v_canal = 'instagram' then
    select c.vendedor_id, coalesce('@' || ic.username, ic.nombre_perfil) into v_vendedor, v_nombre
    from public.instagram_conversaciones c join public.instagram_contactos ic on ic.id = c.contacto_id where c.id = new.conversacion_id;
  elsif v_canal = 'messenger' then
    select c.vendedor_id, mc.nombre_perfil into v_vendedor, v_nombre
    from public.messenger_conversaciones c join public.messenger_contactos mc on mc.id = c.contacto_id where c.id = new.conversacion_id;
  else
    select c.vendedor_id, coalesce(c.nombre_contacto, 'Visitante del sitio') into v_vendedor, v_nombre
    from public.rodi_conversaciones c where c.id = new.conversacion_id;
  end if;

  v_titulo := coalesce(v_nombre, 'Cliente') || ': ' || coalesce(left(new.texto, 80), 'envió un mensaje');

  for v_dest in
    select x from (
      select v_vendedor as x where v_vendedor is not null
      union all
      select p.id from public.perfiles p
      where v_vendedor is null and p.empresa_id = new.empresa_id and p.activo = true and p.roles && array['admin', 'encargado', 'ventas']
    ) q
  loop
    update public.alertas set titulo = v_titulo, created_at = now(), contador = contador + 1, push_enviado = false
    where destinatario_id = v_dest and tipo = v_tipo and link = v_link and leida = false;
    get diagnostics v_actualizadas = row_count;
    if v_actualizadas = 0 then
      insert into public.alertas (empresa_id, destinatario_id, tipo, prioridad, titulo, link)
      values (new.empresa_id, v_dest, v_tipo, 'media', v_titulo, v_link);
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists trg_whatsapp_mensaje_entrante on whatsapp_mensajes;
create trigger trg_whatsapp_mensaje_entrante after insert on whatsapp_mensajes for each row execute function public.notificar_mensaje_entrante('whatsapp');
drop trigger if exists trg_instagram_mensaje_entrante on instagram_mensajes;
create trigger trg_instagram_mensaje_entrante after insert on instagram_mensajes for each row execute function public.notificar_mensaje_entrante('instagram');
drop trigger if exists trg_messenger_mensaje_entrante on messenger_mensajes;
create trigger trg_messenger_mensaje_entrante after insert on messenger_mensajes for each row execute function public.notificar_mensaje_entrante('messenger');
drop trigger if exists trg_rodi_mensaje_entrante on rodi_mensajes;
create trigger trg_rodi_mensaje_entrante after insert on rodi_mensajes for each row execute function public.notificar_mensaje_entrante('rodi');

-- ===== Cierre del lead: cliente convertido y pipeline =====
create or replace function public.marcar_lead_convertido() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.pipeline_stage = 'cerrado' and old.pipeline_stage is distinct from 'cerrado' then
    update public.whatsapp_conversaciones set estado_lead = 'convertido' where cliente_id = new.id and empresa_id = new.empresa_id and estado_lead <> 'convertido';
    update public.instagram_conversaciones set estado_lead = 'convertido' where cliente_id = new.id and empresa_id = new.empresa_id and estado_lead <> 'convertido';
    update public.messenger_conversaciones set estado_lead = 'convertido' where cliente_id = new.id and empresa_id = new.empresa_id and estado_lead <> 'convertido';
    update public.rodi_conversaciones set estado_lead = 'convertido' where cliente_id = new.id and empresa_id = new.empresa_id and estado_lead <> 'convertido';
  end if;
  return new;
end $$;
drop trigger if exists trg_marcar_lead_convertido on clientes;
create trigger trg_marcar_lead_convertido after update on clientes for each row execute function public.marcar_lead_convertido();

create or replace function public.clientes_notificar_convertido() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.estado_relacion = 'cliente' and old.estado_relacion is distinct from 'cliente' and new.vendedor_id is not null then
    insert into public.alertas (empresa_id, destinatario_id, tipo, titulo, link, prioridad)
    values (new.empresa_id, new.vendedor_id, 'lead_convertido', coalesce(new.nombre, 'Un lead') || ' se convirtió en cliente', '/panel/leads', 'media');
  end if;
  return new;
end $$;
drop trigger if exists trg_clientes_notificar_convertido on clientes;
create trigger trg_clientes_notificar_convertido after update on clientes for each row execute function public.clientes_notificar_convertido();

create or replace function public.sync_pipeline_desde_conversacion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.estado_pipeline is not null and new.cliente_id is not null and new.estado_pipeline is distinct from old.estado_pipeline then
    update public.clientes set pipeline_stage = new.estado_pipeline, updated_at = now()
    where id = new.cliente_id and empresa_id = new.empresa_id and pipeline_stage_manual = false;
  end if;
  return new;
end $$;
drop trigger if exists trg_sync_pipeline_desde_whatsapp on whatsapp_conversaciones;
create trigger trg_sync_pipeline_desde_whatsapp after update on whatsapp_conversaciones for each row execute function public.sync_pipeline_desde_conversacion();
drop trigger if exists trg_sync_pipeline_desde_instagram on instagram_conversaciones;
create trigger trg_sync_pipeline_desde_instagram after update on instagram_conversaciones for each row execute function public.sync_pipeline_desde_conversacion();
drop trigger if exists trg_sync_pipeline_desde_messenger on messenger_conversaciones;
create trigger trg_sync_pipeline_desde_messenger after update on messenger_conversaciones for each row execute function public.sync_pipeline_desde_conversacion();

-- ===== Consultas auxiliares (la empresa es obligatoria cuando las llama el servidor) =====
create or replace function public.leads_ultima_direccion(p_canal text, p_empresa_id uuid default null)
returns table(conversacion_id uuid, direccion text)
language plpgsql stable set search_path = public as $$
begin
  if p_canal not in ('whatsapp', 'instagram', 'messenger', 'rodi') then
    raise exception 'Canal inválido: %', p_canal;
  end if;
  return query execute format(
    'select distinct on (m.conversacion_id) m.conversacion_id, m.direccion from public.%I m where ($1 is null or m.empresa_id = $1) order by m.conversacion_id, m.created_at desc',
    p_canal || '_mensajes') using p_empresa_id;
end $$;

create or replace function public.visitas_horarios_ocupados(p_sucursal text, p_fecha date, p_empresa_id uuid default null)
returns table(horario_visita text)
language sql stable set search_path = public as $$
  select v.horario_visita from public.visitas v
  where v.sucursal = p_sucursal and v.fecha_visita = p_fecha and v.estado <> 'Cancelada'
    and (p_empresa_id is null or v.empresa_id = p_empresa_id)
$$;

-- Limpieza de charlas anónimas del chat web sin datos: solo el servidor.
create or replace function public.limpiar_conversaciones_rodi_sin_datos() returns integer
language plpgsql security definer set search_path = public as $$
declare total int;
begin
  delete from public.rodi_conversaciones where nombre_contacto is null and telefono_contacto is null and created_at < now() - interval '24 hours';
  get diagnostics total = row_count;
  return total;
end $$;
revoke all on function public.limpiar_conversaciones_rodi_sin_datos() from public, anon, authenticated;

insert into schema_migraciones (nombre) values ('sql_005_reparto_y_avisos.sql') on conflict do nothing;

-- ROLLBACK:
-- drop trigger if exists trg_zz_asignar_lead_ronda_general on whatsapp_conversaciones;
-- drop trigger if exists trg_zz_asignar_lead_ronda_general on instagram_conversaciones;
-- drop trigger if exists trg_zz_asignar_lead_ronda_general on messenger_conversaciones;
-- drop trigger if exists trg_zz_asignar_lead_ronda_general on rodi_conversaciones;
-- drop trigger if exists trg_avanzar_estado_lead on whatsapp_conversaciones;
-- drop trigger if exists trg_avanzar_estado_lead on rodi_conversaciones;
-- drop trigger if exists trg_whatsapp_handoff on whatsapp_conversaciones;
-- drop trigger if exists trg_instagram_handoff on instagram_conversaciones;
-- drop trigger if exists trg_rodi_handoff on rodi_conversaciones;
-- drop trigger if exists trg_whatsapp_mensaje_entrante on whatsapp_mensajes;
-- drop trigger if exists trg_instagram_mensaje_entrante on instagram_mensajes;
-- drop trigger if exists trg_messenger_mensaje_entrante on messenger_mensajes;
-- drop trigger if exists trg_rodi_mensaje_entrante on rodi_mensajes;
-- drop trigger if exists trg_marcar_lead_convertido on clientes;
-- drop trigger if exists trg_clientes_notificar_convertido on clientes;
-- drop trigger if exists trg_sync_pipeline_desde_whatsapp on whatsapp_conversaciones;
-- drop trigger if exists trg_sync_pipeline_desde_instagram on instagram_conversaciones;
-- drop trigger if exists trg_sync_pipeline_desde_messenger on messenger_conversaciones;
-- drop function if exists asignar_lead_ronda_general();
-- drop function if exists avanzar_estado_lead_por_calificacion();
-- drop function if exists notificar_handoff();
-- drop function if exists notificar_mensaje_entrante();
-- drop function if exists marcar_lead_convertido();
-- drop function if exists clientes_notificar_convertido();
-- drop function if exists sync_pipeline_desde_conversacion();
-- drop function if exists repartir_leads_sin_asignar();
-- drop function if exists asignar_vendedor_ronda_whatsapp_por_sucursal(uuid);
-- drop function if exists asignar_vendedor_ronda_instagram_por_sucursal(uuid);
-- drop function if exists asignar_vendedor_ronda_rodi_por_sucursal(uuid);
-- drop function if exists _ronda_por_sucursal(text, uuid);
-- drop function if exists proximo_vendedor_ronda(uuid);
-- drop function if exists asignacion_auto_en_tabla(text, uuid);
-- drop function if exists validar_empresa_de_la_sesion(uuid);
-- drop function if exists leads_ultima_direccion(text, uuid);
-- drop function if exists visitas_horarios_ocupados(text, date, uuid);
-- drop function if exists limpiar_conversaciones_rodi_sin_datos();
-- delete from schema_migraciones where nombre = 'sql_005_reparto_y_avisos.sql';
