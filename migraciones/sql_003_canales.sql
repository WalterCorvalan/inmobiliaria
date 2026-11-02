-- sql_003_canales.sql
-- Credenciales de cada canal: solo el dueño de la empresa. Los tokens y secretos van cifrados.
create table if not exists whatsapp_configuracion (
  empresa_id uuid primary key references empresas(id) on delete cascade,
  token_cifrado text,
  token_iv text,
  token_tag text,
  app_id text,
  app_secret_cifrado text,
  app_secret_iv text,
  app_secret_tag text,
  
  proveedor text not null default 'meta',
  phone_number_id text,
  waba_id text,
  webhook_verify_token text,
  listo boolean not null default false,
  updated_at timestamptz not null default now(),
  bot_nombre text,
  horario_inicio smallint not null default 7,
  horario_fin smallint not null default 23,
  tono text
);
alter table whatsapp_configuracion enable row level security;
create unique index if not exists whatsapp_configuracion_webhook_verify_token_unico on whatsapp_configuracion (webhook_verify_token) where webhook_verify_token is not null;
drop policy if exists "dueno_whatsapp_configuracion" on whatsapp_configuracion;
create policy "dueno_whatsapp_configuracion" on whatsapp_configuracion for all to authenticated using (empresa_id = mi_empresa_id() and soy_dueno()) with check (empresa_id = mi_empresa_id() and soy_dueno());

create table if not exists instagram_configuracion (
  empresa_id uuid primary key references empresas(id) on delete cascade,
  token_cifrado text,
  token_iv text,
  token_tag text,
  app_id text,
  app_secret_cifrado text,
  app_secret_iv text,
  app_secret_tag text,
  
  ig_user_id text,
  webhook_verify_token text,
  listo boolean not null default false,
  updated_at timestamptz not null default now(),
  token_vence_en timestamptz,
  palabra_clave_comentario text,
  mensaje_comentario text,
  tono text
);
alter table instagram_configuracion enable row level security;
create unique index if not exists instagram_configuracion_webhook_verify_token_unico on instagram_configuracion (webhook_verify_token) where webhook_verify_token is not null;
drop policy if exists "dueno_instagram_configuracion" on instagram_configuracion;
create policy "dueno_instagram_configuracion" on instagram_configuracion for all to authenticated using (empresa_id = mi_empresa_id() and soy_dueno()) with check (empresa_id = mi_empresa_id() and soy_dueno());

create table if not exists messenger_configuracion (
  empresa_id uuid primary key references empresas(id) on delete cascade,
  token_cifrado text,
  token_iv text,
  token_tag text,
  app_id text,
  app_secret_cifrado text,
  app_secret_iv text,
  app_secret_tag text,
  
  page_id text,
  verify_token text,
  listo boolean not null default false,
  updated_at timestamptz,
  tono text
);
alter table messenger_configuracion enable row level security;
create unique index if not exists messenger_configuracion_verify_token_unico on messenger_configuracion (verify_token) where verify_token is not null;
drop policy if exists "dueno_messenger_configuracion" on messenger_configuracion;
create policy "dueno_messenger_configuracion" on messenger_configuracion for all to authenticated using (empresa_id = mi_empresa_id() and soy_dueno()) with check (empresa_id = mi_empresa_id() and soy_dueno());

create table if not exists whatsapp_contactos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default mi_empresa_id() references empresas(id) on delete cascade,
  telefono text not null,
  nombre_perfil text,
  cliente_id uuid references clientes(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  email text,
  cuil text,
  unique (empresa_id, telefono)
);
alter table whatsapp_contactos enable row level security;
create index if not exists whatsapp_contactos_empresa_idx on whatsapp_contactos (empresa_id);
drop policy if exists "empresa_whatsapp_contactos" on whatsapp_contactos;
create policy "empresa_whatsapp_contactos" on whatsapp_contactos for all to authenticated using (empresa_id = mi_empresa_id()) with check (empresa_id = mi_empresa_id());

create table if not exists whatsapp_conversaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default mi_empresa_id() references empresas(id) on delete cascade,
  contacto_id uuid not null references whatsapp_contactos(id) on delete cascade,
  estado_pipeline text check (estado_pipeline is null or estado_pipeline in ('sin_contactar', 'contactado', 'visita', 'negociacion', 'cerrado', 'perdido')),
  fuera_horario_avisado_fecha date,
  charla_quieta_avisada_at timestamptz,
  
  fuera_horario_avisado_at timestamptz,
  apertura_enviada_at timestamptz,
  aviso_caliente_sin_atender_enviado boolean not null default false,
  aviso_nudge_enviado boolean not null default false,
  last_inbound_at timestamptz,
  
  vendedor_id uuid references perfiles(id),
  vehiculo_id uuid,
  cliente_id uuid references clientes(id),
  calificacion text check (calificacion in ('caliente', 'tibio', 'frio')),
  notas text,
  unread_count integer not null default 0,
  ai_habilitada boolean not null default true,
  handoff_at timestamptz,
  handoff_reason text,
  handoff_resumen text,
  last_message_at timestamptz,
  estado_lead text not null default 'nuevo' check (estado_lead in ('nuevo', 'asignado', 'calificando', 'convertido', 'perdido')),
  canal_origen text,
  origen_ads text,
  archivada boolean not null default false,
  sucursal_id uuid references sucursales(id),
  es_basura boolean not null default false,
  prospeccion jsonb,
  lector_leido_hasta timestamptz,
  asistencia_solicitada boolean not null default false,
  asistencia_nota text,
  asistencia_para uuid references perfiles(id),
  asistencia_atendida boolean not null default false,
  motivo_cierre_id uuid references motivos_cierre(id),
  domicilio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table whatsapp_conversaciones enable row level security;
create index if not exists whatsapp_conversaciones_empresa_idx on whatsapp_conversaciones (empresa_id);
create unique index if not exists whatsapp_conversaciones_contacto_unico on whatsapp_conversaciones (contacto_id);
create index if not exists whatsapp_conv_orden_idx on whatsapp_conversaciones (empresa_id, last_message_at desc);
create index if not exists whatsapp_conv_vendedor_idx on whatsapp_conversaciones (empresa_id, vendedor_id);
drop policy if exists "empresa_whatsapp_conversaciones" on whatsapp_conversaciones;
create policy "empresa_whatsapp_conversaciones" on whatsapp_conversaciones for all to authenticated using (empresa_id = mi_empresa_id()) with check (empresa_id = mi_empresa_id());

create table if not exists whatsapp_mensajes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default mi_empresa_id() references empresas(id) on delete cascade,
  conversacion_id uuid not null references whatsapp_conversaciones(id) on delete cascade,
  direccion text not null check (direccion in ('in', 'out')),
  texto text,
  ai_generado boolean not null default false,
  created_at timestamptz not null default now(),
  tipo text not null default 'text',
  status text not null default 'pending',
  wa_message_id text,
  wa_timestamp timestamptz,
  media_url text,
  error_detalle text
);
alter table whatsapp_mensajes enable row level security;
create index if not exists whatsapp_mensajes_empresa_idx on whatsapp_mensajes (empresa_id);
create unique index if not exists whatsapp_msg_wa_id_idx on whatsapp_mensajes (wa_message_id) where wa_message_id is not null;
create index if not exists whatsapp_msg_conv_idx on whatsapp_mensajes (conversacion_id, created_at desc);
drop policy if exists "empresa_whatsapp_mensajes" on whatsapp_mensajes;
create policy "empresa_whatsapp_mensajes" on whatsapp_mensajes for all to authenticated using (empresa_id = mi_empresa_id()) with check (empresa_id = mi_empresa_id());

create table if not exists whatsapp_memoria (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default mi_empresa_id() references empresas(id) on delete cascade,
  categoria text not null check (categoria in ('saludo', 'horarios_ubicacion', 'pagos_financiacion', 'datos_empresa', 'fuera_horario', 'apertura')),
  palabras_clave text[] not null default '{}',
  respuesta text not null,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table whatsapp_memoria enable row level security;
create index if not exists whatsapp_memoria_empresa_idx on whatsapp_memoria (empresa_id);
drop policy if exists "ver_memoria" on whatsapp_memoria;
create policy "ver_memoria" on whatsapp_memoria for select to authenticated using (empresa_id = mi_empresa_id());
drop policy if exists "escribe_memoria" on whatsapp_memoria;
create policy "escribe_memoria" on whatsapp_memoria for all to authenticated using (empresa_id = mi_empresa_id() and soy_encargado_o_dueno()) with check (empresa_id = mi_empresa_id() and soy_encargado_o_dueno());

create table if not exists whatsapp_plantillas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default mi_empresa_id() references empresas(id) on delete cascade,
  sector text not null,
  nombre text not null,
  texto text not null,
  activa boolean not null default true,
  creado_por uuid references perfiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table whatsapp_plantillas enable row level security;
create index if not exists whatsapp_plantillas_empresa_idx on whatsapp_plantillas (empresa_id);
drop policy if exists "empresa_whatsapp_plantillas" on whatsapp_plantillas;
create policy "empresa_whatsapp_plantillas" on whatsapp_plantillas for all to authenticated using (empresa_id = mi_empresa_id()) with check (empresa_id = mi_empresa_id());

create table if not exists whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default mi_empresa_id() references empresas(id) on delete cascade,
  nombre text not null,
  idioma text not null default 'es_AR',
  categoria text not null default 'UTILITY',
  cuerpo text not null,
  estado text not null default 'pending' check (estado in ('pending', 'approved', 'rejected')),
  motivo_rechazo text,
  wa_template_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, nombre, idioma)
);
alter table whatsapp_templates enable row level security;
create index if not exists whatsapp_templates_empresa_idx on whatsapp_templates (empresa_id);
drop policy if exists "empresa_whatsapp_templates" on whatsapp_templates;
create policy "empresa_whatsapp_templates" on whatsapp_templates for all to authenticated using (empresa_id = mi_empresa_id()) with check (empresa_id = mi_empresa_id());

create table if not exists instagram_contactos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default mi_empresa_id() references empresas(id) on delete cascade,
  ig_user_id text not null,
  username text,
  cliente_id uuid references clientes(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  nombre_perfil text,
  telefono text,
  email text,
  cuil text,
  unique (empresa_id, ig_user_id)
);
alter table instagram_contactos enable row level security;
create index if not exists instagram_contactos_empresa_idx on instagram_contactos (empresa_id);
drop policy if exists "empresa_instagram_contactos" on instagram_contactos;
create policy "empresa_instagram_contactos" on instagram_contactos for all to authenticated using (empresa_id = mi_empresa_id()) with check (empresa_id = mi_empresa_id());

create table if not exists instagram_conversaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default mi_empresa_id() references empresas(id) on delete cascade,
  contacto_id uuid not null references instagram_contactos(id) on delete cascade,
  estado_pipeline text check (estado_pipeline is null or estado_pipeline in ('sin_contactar', 'contactado', 'visita', 'negociacion', 'cerrado', 'perdido')),
  
  fuera_horario_avisado_at timestamptz,
  apertura_enviada_at timestamptz,
  aviso_caliente_sin_atender_enviado boolean not null default false,
  aviso_nudge_enviado boolean not null default false,
  last_inbound_at timestamptz,
  
  vendedor_id uuid references perfiles(id),
  vehiculo_id uuid,
  cliente_id uuid references clientes(id),
  calificacion text check (calificacion in ('caliente', 'tibio', 'frio')),
  notas text,
  unread_count integer not null default 0,
  ai_habilitada boolean not null default true,
  handoff_at timestamptz,
  handoff_reason text,
  handoff_resumen text,
  last_message_at timestamptz,
  estado_lead text not null default 'nuevo' check (estado_lead in ('nuevo', 'asignado', 'calificando', 'convertido', 'perdido')),
  canal_origen text,
  origen_ads text,
  archivada boolean not null default false,
  sucursal_id uuid references sucursales(id),
  es_basura boolean not null default false,
  prospeccion jsonb,
  lector_leido_hasta timestamptz,
  asistencia_solicitada boolean not null default false,
  asistencia_nota text,
  asistencia_para uuid references perfiles(id),
  asistencia_atendida boolean not null default false,
  motivo_cierre_id uuid references motivos_cierre(id),
  domicilio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table instagram_conversaciones enable row level security;
create index if not exists instagram_conversaciones_empresa_idx on instagram_conversaciones (empresa_id);
create unique index if not exists instagram_conversaciones_contacto_unico on instagram_conversaciones (contacto_id);
create index if not exists instagram_conv_orden_idx on instagram_conversaciones (empresa_id, last_message_at desc);
create index if not exists instagram_conv_vendedor_idx on instagram_conversaciones (empresa_id, vendedor_id);
drop policy if exists "empresa_instagram_conversaciones" on instagram_conversaciones;
create policy "empresa_instagram_conversaciones" on instagram_conversaciones for all to authenticated using (empresa_id = mi_empresa_id()) with check (empresa_id = mi_empresa_id());

create table if not exists instagram_mensajes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default mi_empresa_id() references empresas(id) on delete cascade,
  conversacion_id uuid not null references instagram_conversaciones(id) on delete cascade,
  direccion text not null check (direccion in ('in', 'out')),
  tipo text not null default 'text',
  texto text,
  status text not null default 'pending',
  ai_generado boolean not null default false,
  ig_message_id text,
  created_at timestamptz not null default now(),
  media_url text,
  reaccion text,
  leido_at timestamptz,
  editado boolean not null default false
);
alter table instagram_mensajes enable row level security;
create index if not exists instagram_mensajes_empresa_idx on instagram_mensajes (empresa_id);
create unique index if not exists instagram_msg_ig_id_idx on instagram_mensajes (ig_message_id) where ig_message_id is not null;
create index if not exists instagram_msg_conv_idx on instagram_mensajes (conversacion_id, created_at desc);
drop policy if exists "empresa_instagram_mensajes" on instagram_mensajes;
create policy "empresa_instagram_mensajes" on instagram_mensajes for all to authenticated using (empresa_id = mi_empresa_id()) with check (empresa_id = mi_empresa_id());

create table if not exists instagram_automatizaciones_comentarios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default mi_empresa_id() references empresas(id) on delete cascade,
  palabras_clave text[] not null,
  respuesta_dm text not null,
  respuesta_publica text,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);
alter table instagram_automatizaciones_comentarios enable row level security;
create index if not exists instagram_automatizaciones_comentarios_empresa_idx on instagram_automatizaciones_comentarios (empresa_id);
drop policy if exists "empresa_instagram_automatizaciones_comentarios" on instagram_automatizaciones_comentarios;
create policy "empresa_instagram_automatizaciones_comentarios" on instagram_automatizaciones_comentarios for all to authenticated using (empresa_id = mi_empresa_id()) with check (empresa_id = mi_empresa_id());

create table if not exists messenger_contactos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default mi_empresa_id() references empresas(id) on delete cascade,
  psid text not null,
  nombre_perfil text,
  created_at timestamptz not null default now(),
  telefono text,
  email text,
  cuil text,
  unique (empresa_id, psid)
);
alter table messenger_contactos enable row level security;
create index if not exists messenger_contactos_empresa_idx on messenger_contactos (empresa_id);
drop policy if exists "empresa_messenger_contactos" on messenger_contactos;
create policy "empresa_messenger_contactos" on messenger_contactos for all to authenticated using (empresa_id = mi_empresa_id()) with check (empresa_id = mi_empresa_id());

create table if not exists messenger_conversaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default mi_empresa_id() references empresas(id) on delete cascade,
  contacto_id uuid not null references messenger_contactos(id) on delete cascade,
  estado_pipeline text default 'sin_contactar' check (estado_pipeline is null or estado_pipeline in ('sin_contactar', 'contactado', 'visita', 'negociacion', 'cerrado', 'perdido')),
  
  fuera_horario_avisado_at timestamptz,
  apertura_enviada_at timestamptz,
  aviso_caliente_sin_atender_enviado boolean not null default false,
  aviso_nudge_enviado boolean not null default false,
  last_inbound_at timestamptz,
  
  vendedor_id uuid references perfiles(id),
  vehiculo_id uuid,
  cliente_id uuid references clientes(id),
  calificacion text check (calificacion in ('caliente', 'tibio', 'frio')),
  notas text,
  unread_count integer not null default 0,
  ai_habilitada boolean not null default true,
  handoff_at timestamptz,
  handoff_reason text,
  handoff_resumen text,
  last_message_at timestamptz,
  estado_lead text not null default 'nuevo' check (estado_lead in ('nuevo', 'asignado', 'calificando', 'convertido', 'perdido')),
  canal_origen text,
  origen_ads text,
  archivada boolean not null default false,
  sucursal_id uuid references sucursales(id),
  es_basura boolean not null default false,
  prospeccion jsonb,
  lector_leido_hasta timestamptz,
  asistencia_solicitada boolean not null default false,
  asistencia_nota text,
  asistencia_para uuid references perfiles(id),
  asistencia_atendida boolean not null default false,
  motivo_cierre_id uuid references motivos_cierre(id),
  domicilio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table messenger_conversaciones enable row level security;
create index if not exists messenger_conversaciones_empresa_idx on messenger_conversaciones (empresa_id);
create unique index if not exists messenger_conversaciones_contacto_unico on messenger_conversaciones (contacto_id);
create index if not exists messenger_conv_orden_idx on messenger_conversaciones (empresa_id, last_message_at desc);
create index if not exists messenger_conv_vendedor_idx on messenger_conversaciones (empresa_id, vendedor_id);
drop policy if exists "empresa_messenger_conversaciones" on messenger_conversaciones;
create policy "empresa_messenger_conversaciones" on messenger_conversaciones for all to authenticated using (empresa_id = mi_empresa_id()) with check (empresa_id = mi_empresa_id());

create table if not exists messenger_mensajes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default mi_empresa_id() references empresas(id) on delete cascade,
  conversacion_id uuid not null references messenger_conversaciones(id) on delete cascade,
  messenger_message_id text,
  direccion text not null check (direccion in ('in', 'out')),
  tipo text not null default 'text',
  texto text,
  media_url text,
  status text not null default 'received',
  ai_generado boolean not null default false,
  leido_at timestamptz,
  created_at timestamptz not null default now()
);
alter table messenger_mensajes enable row level security;
create index if not exists messenger_mensajes_empresa_idx on messenger_mensajes (empresa_id);
create unique index if not exists messenger_msg_id_idx on messenger_mensajes (messenger_message_id) where messenger_message_id is not null;
create index if not exists messenger_msg_conv_idx on messenger_mensajes (conversacion_id, created_at desc);
drop policy if exists "empresa_messenger_mensajes" on messenger_mensajes;
create policy "empresa_messenger_mensajes" on messenger_mensajes for all to authenticated using (empresa_id = mi_empresa_id()) with check (empresa_id = mi_empresa_id());

create table if not exists rodi_conversaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default mi_empresa_id() references empresas(id) on delete cascade,
  session_id text not null unique,
  nombre_contacto text,
  telefono_contacto text,
  email_contacto text,
  origen_pagina text,
  cliente_id uuid references clientes(id),
  vendedor_id uuid references perfiles(id),
  calificacion text check (calificacion in ('caliente', 'tibio', 'frio')),
  estado_lead text not null default 'nuevo' check (estado_lead in ('nuevo', 'asignado', 'calificando', 'convertido', 'perdido')),
  ai_habilitada boolean not null default true,
  handoff_at timestamptz,
  handoff_reason text,
  handoff_resumen text,
  notas text,
  last_message_at timestamptz,
  unread_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  vehiculo_id uuid,
  asistencia_solicitada boolean not null default false,
  asistencia_nota text,
  asistencia_para uuid references perfiles(id),
  asistencia_atendida boolean not null default false,
  motivo_cierre_id uuid references motivos_cierre(id),
  domicilio text,
  canal_origen text,
  sucursal_id uuid references sucursales(id),
  cuil text,
  es_basura boolean not null default false,
  canal_entrada text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  prospeccion jsonb,
  lector_leido_hasta timestamptz
);
alter table rodi_conversaciones enable row level security;
create index if not exists rodi_conversaciones_empresa_idx on rodi_conversaciones (empresa_id);
create index if not exists rodi_conv_orden_idx on rodi_conversaciones (empresa_id, last_message_at desc);
create index if not exists rodi_conv_vendedor_idx on rodi_conversaciones (empresa_id, vendedor_id);
drop policy if exists "empresa_rodi_conversaciones" on rodi_conversaciones;
create policy "empresa_rodi_conversaciones" on rodi_conversaciones for all to authenticated using (empresa_id = mi_empresa_id()) with check (empresa_id = mi_empresa_id());

create table if not exists rodi_mensajes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default mi_empresa_id() references empresas(id) on delete cascade,
  conversacion_id uuid not null references rodi_conversaciones(id) on delete cascade,
  direccion text not null check (direccion in ('in', 'out')),
  texto text not null,
  ai_generado boolean not null default false,
  created_at timestamptz not null default now()
);
alter table rodi_mensajes enable row level security;
create index if not exists rodi_mensajes_empresa_idx on rodi_mensajes (empresa_id);
create index if not exists rodi_msg_conv_idx on rodi_mensajes (conversacion_id, created_at desc);
drop policy if exists "empresa_rodi_mensajes" on rodi_mensajes;
create policy "empresa_rodi_mensajes" on rodi_mensajes for all to authenticated using (empresa_id = mi_empresa_id()) with check (empresa_id = mi_empresa_id());

create table if not exists chats_vistos (
  empresa_id uuid not null default mi_empresa_id() references empresas(id) on delete cascade,
  canal text not null check (canal in ('whatsapp', 'instagram', 'messenger', 'rodi')),
  conversacion_id uuid not null,
  perfil_id uuid not null references perfiles(id) on delete cascade,
  visto_at timestamptz not null default now(),
  primary key (canal, conversacion_id, perfil_id)
);
alter table chats_vistos enable row level security;
create index if not exists chats_vistos_empresa_idx on chats_vistos (empresa_id);
drop policy if exists "propios_chats_vistos" on chats_vistos;
create policy "propios_chats_vistos" on chats_vistos for all to authenticated using (empresa_id = mi_empresa_id() and perfil_id = auth.uid()) with check (empresa_id = mi_empresa_id() and perfil_id = auth.uid());


-- ===== La empresa de cada fila hija sale de su padre =====
-- El servidor (webhooks, tareas automáticas) guarda mensajes sin sesión: la empresa se copia de la conversación y,
-- si se manda una distinta, se rechaza. Así un mensaje nunca queda en una empresa distinta a la de su charla.
create or replace function public.copiar_empresa_del_padre() returns trigger
language plpgsql set search_path = public as $$
declare v_emp uuid;
begin
  execute format('select empresa_id from public.%I where id = $1', TG_ARGV[0]) into v_emp using (to_jsonb(new) ->> TG_ARGV[1])::uuid;
  if v_emp is null then
    raise exception 'No existe el registro padre en %', TG_ARGV[0];
  end if;
  if new.empresa_id is null then
    new.empresa_id := v_emp;
  elsif new.empresa_id <> v_emp then
    raise exception 'La empresa no coincide con la de %', TG_ARGV[0];
  end if;
  return new;
end $$;
drop trigger if exists trg_aa_empresa_del_padre on whatsapp_conversaciones;
create trigger trg_aa_empresa_del_padre before insert on whatsapp_conversaciones for each row execute function public.copiar_empresa_del_padre('whatsapp_contactos', 'contacto_id');
drop trigger if exists trg_aa_empresa_del_padre on instagram_conversaciones;
create trigger trg_aa_empresa_del_padre before insert on instagram_conversaciones for each row execute function public.copiar_empresa_del_padre('instagram_contactos', 'contacto_id');
drop trigger if exists trg_aa_empresa_del_padre on messenger_conversaciones;
create trigger trg_aa_empresa_del_padre before insert on messenger_conversaciones for each row execute function public.copiar_empresa_del_padre('messenger_contactos', 'contacto_id');
drop trigger if exists trg_aa_empresa_del_padre on whatsapp_mensajes;
create trigger trg_aa_empresa_del_padre before insert on whatsapp_mensajes for each row execute function public.copiar_empresa_del_padre('whatsapp_conversaciones', 'conversacion_id');
drop trigger if exists trg_aa_empresa_del_padre on instagram_mensajes;
create trigger trg_aa_empresa_del_padre before insert on instagram_mensajes for each row execute function public.copiar_empresa_del_padre('instagram_conversaciones', 'conversacion_id');
drop trigger if exists trg_aa_empresa_del_padre on messenger_mensajes;
create trigger trg_aa_empresa_del_padre before insert on messenger_mensajes for each row execute function public.copiar_empresa_del_padre('messenger_conversaciones', 'conversacion_id');
drop trigger if exists trg_aa_empresa_del_padre on rodi_mensajes;
create trigger trg_aa_empresa_del_padre before insert on rodi_mensajes for each row execute function public.copiar_empresa_del_padre('rodi_conversaciones', 'conversacion_id');

insert into schema_migraciones (nombre) values ('sql_003_canales.sql') on conflict do nothing;

-- ROLLBACK:
-- drop table if exists chats_vistos, rodi_mensajes, rodi_conversaciones, messenger_mensajes, messenger_conversaciones, messenger_contactos,
--   instagram_automatizaciones_comentarios, instagram_mensajes, instagram_conversaciones, instagram_contactos,
--   whatsapp_templates, whatsapp_plantillas, whatsapp_memoria, whatsapp_mensajes, whatsapp_conversaciones, whatsapp_contactos,
--   messenger_configuracion, instagram_configuracion, whatsapp_configuracion cascade;
-- drop function if exists copiar_empresa_del_padre();
-- delete from schema_migraciones where nombre = 'sql_003_canales.sql';
