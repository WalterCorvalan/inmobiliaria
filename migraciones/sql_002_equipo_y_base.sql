-- sql_002_equipo_y_base.sql

create table if not exists perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  nombre text not null,
  roles text[] not null default '{}' check (roles <@ array['admin', 'encargado', 'ventas']::text[]),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  sucursal_id uuid,
  whatsapp text,
  foto_url text,
  usuario text,
  orden_ronda integer,
  tema_oscuro text not null default 'negro' check (tema_oscuro in ('negro', 'gris', 'azul_marino', 'noche_oro', 'oceano', 'softcars_oscuro', 'petroleo', 'softcars', 'bosque')),
  modo_oscuro boolean
);
alter table perfiles enable row level security;
create index if not exists perfiles_empresa_idx on perfiles (empresa_id);

-- ===== Ayudantes de seguridad =====
create or replace function public.soy_dueno() returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  return exists (select 1 from public.perfiles where id = auth.uid() and activo and 'admin' = any(roles));
end $$;

create or replace function public.soy_encargado_o_dueno() returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  return exists (select 1 from public.perfiles where id = auth.uid() and activo and roles && array['admin', 'encargado']);
end $$;

create or replace function public.soy_superadmin() returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  return exists (select 1 from public.superadmins where user_id = auth.uid());
end $$;

-- Empresa de quien consulta. Una empresa suspendida no puede usar el panel: sus usuarios dejan de tener empresa.
create or replace function public.mi_empresa_id() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare v uuid;
begin
  select p.empresa_id into v
  from public.perfiles p join public.empresas e on e.id = p.empresa_id
  where p.id = auth.uid() and p.activo and e.estado = 'activa';
  return v;
end $$;

-- ===== Empresas: cada uno ve la suya =====
drop policy if exists "ver_mi_empresa" on empresas;
create policy "ver_mi_empresa" on empresas for select to authenticated using (id = mi_empresa_id());

-- ===== Oficinas =====
create table if not exists sucursales (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default mi_empresa_id() references empresas(id) on delete cascade,
  nombre text not null,
  created_at timestamptz not null default now(),
  direccion text,
  telefono_encargado text,
  google_maps_url text,
  encargado_nombre text,
  slug text,
  imagen_url text,
  horario_texto text,
  horario_dia_desde smallint not null default 1,
  horario_dia_hasta smallint not null default 6,
  horario_hora_desde numeric not null default 9,
  horario_hora_hasta numeric not null default 19,
  latitude numeric,
  longitude numeric,
  horario2_dia_desde smallint,
  horario2_dia_hasta smallint,
  horario2_hora_desde numeric,
  horario2_hora_hasta numeric,
  unique (empresa_id, nombre),
  unique (empresa_id, slug)
);
alter table sucursales enable row level security;
create index if not exists sucursales_empresa_idx on sucursales (empresa_id);
drop policy if exists "ver_sucursales" on sucursales;
create policy "ver_sucursales" on sucursales for select to authenticated using (empresa_id = mi_empresa_id());
drop policy if exists "dueno_escribe_sucursales" on sucursales;
create policy "dueno_escribe_sucursales" on sucursales for all to authenticated
  using (empresa_id = mi_empresa_id() and soy_dueno()) with check (empresa_id = mi_empresa_id() and soy_dueno());

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'perfiles_sucursal_id_fkey') then
    alter table perfiles add constraint perfiles_sucursal_id_fkey foreign key (sucursal_id) references sucursales(id);
  end if;
end $$;
create unique index if not exists perfiles_usuario_unico on perfiles (empresa_id, lower(usuario)) where usuario is not null;

-- ===== Perfiles =====
drop policy if exists "ver_perfiles_de_mi_empresa" on perfiles;
create policy "ver_perfiles_de_mi_empresa" on perfiles for select to authenticated using (empresa_id = mi_empresa_id());
drop policy if exists "editar_perfiles" on perfiles;
create policy "editar_perfiles" on perfiles for update to authenticated
  using (empresa_id = mi_empresa_id() and (id = auth.uid() or soy_dueno()))
  with check (empresa_id = mi_empresa_id() and (id = auth.uid() or soy_dueno()));
-- Altas y bajas de usuarios: solo el servidor (clave de servicio).

-- Nadie puede cambiarse de empresa. Roles y estado: solo el dueño. (El servidor, sin sesión, queda afuera de estas reglas.)
create or replace function public.proteger_columnas_perfiles() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.empresa_id is distinct from old.empresa_id then
    raise exception 'Un usuario no puede cambiar de empresa.';
  end if;
  if (new.roles is distinct from old.roles or new.activo is distinct from old.activo) and not public.soy_dueno() then
    raise exception 'Solo el dueño puede cambiar roles o estado de un usuario.';
  end if;
  return new;
end $$;
drop trigger if exists trg_proteger_columnas_perfiles on perfiles;
create trigger trg_proteger_columnas_perfiles before update on perfiles for each row execute function public.proteger_columnas_perfiles();

-- ===== Configuración de la empresa (una fila por empresa) =====
create table if not exists configuracion_empresa (
  empresa_id uuid primary key references empresas(id) on delete cascade,
  updated_at timestamptz not null default now(),
  branding_nombre text,
  branding_logo_url text,
  branding_color_primario text check (branding_color_primario is null or branding_color_primario ~ '^#[0-9A-Fa-f]{6}$'),
  branding_domicilio text,
  branding_telefono text,
  branding_email text,
  branding_web text,
  redes_whatsapp text,
  redes_instagram text,
  redes_facebook text,
  asignacion_leads_ronda boolean not null default true,
  asignacion_auto_canales text[] not null default array['whatsapp', 'instagram', 'messenger', 'rodi'],
  alertas_niveles jsonb not null default '{"leads": "alta"}'::jsonb,
  ia_saldo_inicial_usd numeric,
  ia_saldo_desde timestamptz,
  ia_alerta_saldo_usd numeric default 5,
  ia_alerta_enviada_en timestamptz,
  ia_credito_comprado_usd numeric,
  ia_credito_comprado_el date,
  -- Descripción del negocio que usa el bot para presentarse y responder (la completa cada empresa).
  bot_descripcion text
);
alter table configuracion_empresa enable row level security;
drop policy if exists "ver_configuracion" on configuracion_empresa;
create policy "ver_configuracion" on configuracion_empresa for select to authenticated using (empresa_id = mi_empresa_id());
drop policy if exists "dueno_escribe_configuracion" on configuracion_empresa;
create policy "dueno_escribe_configuracion" on configuracion_empresa for all to authenticated
  using (empresa_id = mi_empresa_id() and soy_dueno()) with check (empresa_id = mi_empresa_id() and soy_dueno());

create table if not exists motivos_cierre (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default mi_empresa_id() references empresas(id) on delete cascade,
  nombre text not null,
  created_at timestamptz not null default now(),
  unique (empresa_id, nombre)
);
alter table motivos_cierre enable row level security;
create index if not exists motivos_cierre_empresa_idx on motivos_cierre (empresa_id);
drop policy if exists "empresa_motivos_cierre" on motivos_cierre;
create policy "empresa_motivos_cierre" on motivos_cierre for all to authenticated using (empresa_id = mi_empresa_id()) with check (empresa_id = mi_empresa_id());

create table if not exists disponibilidad_vendedor (
  vendedor_id uuid primary key references perfiles(id) on delete cascade,
  empresa_id uuid not null default mi_empresa_id() references empresas(id) on delete cascade,
  estado text not null default 'disponible' check (estado in ('disponible', 'ausente', 'vacaciones', 'enfermo')),
  desde date,
  hasta date,
  recibir_leads boolean not null default true,
  actualizado_por uuid references perfiles(id),
  updated_at timestamptz not null default now()
);
alter table disponibilidad_vendedor enable row level security;
create index if not exists disponibilidad_vendedor_empresa_idx on disponibilidad_vendedor (empresa_id);
drop policy if exists "empresa_disponibilidad" on disponibilidad_vendedor;
create policy "empresa_disponibilidad" on disponibilidad_vendedor for all to authenticated using (empresa_id = mi_empresa_id()) with check (empresa_id = mi_empresa_id());

create table if not exists alertas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default mi_empresa_id() references empresas(id) on delete cascade,
  destinatario_id uuid not null references perfiles(id) on delete cascade,
  tipo text not null default 'general',
  prioridad text not null default 'novedad' check (prioridad in ('alta', 'media', 'baja', 'novedad')),
  titulo text not null,
  mensaje text,
  link text,
  leida boolean not null default false,
  created_at timestamptz not null default now(),
  contador integer not null default 1,
  push_enviado boolean not null default false,
  whatsapp_enviado boolean not null default false,
  push_repeticiones integer not null default 0,
  push_ultimo_at timestamptz
);
alter table alertas enable row level security;
create index if not exists alertas_empresa_idx on alertas (empresa_id);
create index if not exists alertas_destinatario_idx on alertas (destinatario_id, leida, created_at desc);
drop policy if exists "ver_propias_alertas" on alertas;
create policy "ver_propias_alertas" on alertas for select to authenticated using (empresa_id = mi_empresa_id() and destinatario_id = auth.uid());
drop policy if exists "actualizar_propias_alertas" on alertas;
create policy "actualizar_propias_alertas" on alertas for update to authenticated using (empresa_id = mi_empresa_id() and destinatario_id = auth.uid()) with check (empresa_id = mi_empresa_id() and destinatario_id = auth.uid());
drop policy if exists "borrar_propias_alertas" on alertas;
create policy "borrar_propias_alertas" on alertas for delete to authenticated using (empresa_id = mi_empresa_id() and destinatario_id = auth.uid());
drop policy if exists "crear_alertas_de_mi_empresa" on alertas;
create policy "crear_alertas_de_mi_empresa" on alertas for insert to authenticated with check (empresa_id = mi_empresa_id() and exists (select 1 from perfiles p where p.id = destinatario_id and p.empresa_id = alertas.empresa_id));

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default mi_empresa_id() references empresas(id) on delete cascade,
  perfil_id uuid not null references perfiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table push_subscriptions enable row level security;
create index if not exists push_subscriptions_empresa_idx on push_subscriptions (empresa_id);
drop policy if exists "propias_push" on push_subscriptions;
create policy "propias_push" on push_subscriptions for all to authenticated using (empresa_id = mi_empresa_id() and perfil_id = auth.uid()) with check (empresa_id = mi_empresa_id() and perfil_id = auth.uid());

create table if not exists espacio_notif_prefs (
  perfil_id uuid primary key references perfiles(id) on delete cascade,
  empresa_id uuid not null default mi_empresa_id() references empresas(id) on delete cascade,
  desactivadas jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table espacio_notif_prefs enable row level security;
create index if not exists espacio_notif_prefs_empresa_idx on espacio_notif_prefs (empresa_id);
drop policy if exists "propias_prefs" on espacio_notif_prefs;
create policy "propias_prefs" on espacio_notif_prefs for all to authenticated using (empresa_id = mi_empresa_id() and perfil_id = auth.uid()) with check (empresa_id = mi_empresa_id() and perfil_id = auth.uid());

create table if not exists lead_ronda_turnos (
  vendedor_id uuid primary key references perfiles(id) on delete cascade,
  empresa_id uuid not null default mi_empresa_id() references empresas(id) on delete cascade,
  ultima_asignacion timestamptz not null default now()
);
alter table lead_ronda_turnos enable row level security;
create index if not exists lead_ronda_turnos_empresa_idx on lead_ronda_turnos (empresa_id);
drop policy if exists "ver_turnos" on lead_ronda_turnos;
create policy "ver_turnos" on lead_ronda_turnos for select to authenticated using (empresa_id = mi_empresa_id() and soy_encargado_o_dueno());

create table if not exists logs_errores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid default mi_empresa_id() references empresas(id) on delete cascade,
  origen text not null,
  mensaje text not null,
  detalle jsonb,
  created_at timestamptz not null default now()
);
alter table logs_errores enable row level security;
create index if not exists logs_errores_empresa_idx on logs_errores (empresa_id);
create index if not exists logs_errores_created_at_idx on logs_errores (created_at desc);
drop policy if exists "dueno_ve_errores" on logs_errores;
create policy "dueno_ve_errores" on logs_errores for select to authenticated using (empresa_id = mi_empresa_id() and soy_dueno());
drop policy if exists "registrar_errores_de_mi_empresa" on logs_errores;
create policy "registrar_errores_de_mi_empresa" on logs_errores for insert to authenticated with check (empresa_id = mi_empresa_id());

create table if not exists uso_ia_anthropic (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid default mi_empresa_id() references empresas(id) on delete cascade,
  origen text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  created_at timestamptz not null default now(),
  modelo text,
  busquedas_web integer not null default 0,
  cache_escritura_tokens integer not null default 0,
  cache_lectura_tokens integer not null default 0
);
alter table uso_ia_anthropic enable row level security;
create index if not exists uso_ia_anthropic_empresa_idx on uso_ia_anthropic (empresa_id);
create index if not exists uso_ia_created_idx on uso_ia_anthropic (empresa_id, created_at desc);
drop policy if exists "ver_uso_ia" on uso_ia_anthropic;
create policy "ver_uso_ia" on uso_ia_anthropic for select to authenticated using (empresa_id = mi_empresa_id() and soy_encargado_o_dueno());

create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default mi_empresa_id() references empresas(id) on delete cascade,
  nombre text not null,
  tipo text not null default 'Regular',
  sexo text,
  dni_cuit text,
  telefono text,
  email text,
  origen text not null default 'Otro' check (origen in ('Zonaprop', 'Argenprop', 'MercadoLibre', 'Instagram', 'Facebook', 'Messenger', 'WhatsApp', 'Web', 'Oficina', 'Llamada', 'Otro')),
  canal_ingreso text not null default 'lead_digital' check (canal_ingreso in ('walk_in', 'lead_digital')),
  vehiculo_interes_texto text,
  busca_marca text,
  busca_modelo text,
  busca_moneda text default 'USD',
  busca_anio_desde integer,
  busca_anio_hasta integer,
  busca_presupuesto_max numeric,
  fecha_nacimiento date,
  ultimo_contacto timestamptz,
  vendedor_id uuid references perfiles(id),
  direccion text,
  observaciones text,
  pipeline_stage text not null default 'sin_contactar' check (pipeline_stage in ('sin_contactar', 'contactado', 'visita', 'negociacion', 'cerrado', 'perdido')),
  pipeline_stage_motivo text,
  pipeline_stage_manual boolean not null default false,
  importado_excel boolean not null default false,
  creado_por uuid references perfiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ultima_reasignacion_en timestamptz,
  reasignacion_tope_alertada boolean not null default false,
  segmento text,
  no_contactar boolean not null default false,
  apellido text,
  cuit_cuil text,
  calle text,
  numero_calle text,
  depto text,
  localidad text,
  codigo_postal text,
  provincia text,
  estado_civil text,
  profesion text,
  telefono_linea text,
  estado_relacion text not null default 'lead' check (estado_relacion in ('lead', 'cliente')),
  deleted_at timestamptz,
  deleted_by uuid,
  motivo_eliminacion text,
  vehiculo_interes_id uuid,
  proximo_contacto date,
  proxima_accion text
);
alter table clientes enable row level security;
create index if not exists clientes_empresa_idx on clientes (empresa_id);
create index if not exists clientes_vendedor_idx on clientes (empresa_id, vendedor_id);
create index if not exists clientes_pipeline_idx on clientes (empresa_id, pipeline_stage);
create index if not exists clientes_telefono_idx on clientes (empresa_id, telefono);
drop policy if exists "empresa_clientes" on clientes;
create policy "empresa_clientes" on clientes for all to authenticated using (empresa_id = mi_empresa_id()) with check (empresa_id = mi_empresa_id());


-- Cada empresa nueva arranca con sus filas de configuración (marca y los tres canales) y su verify token propio.
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
  return new;
end $$;
drop trigger if exists trg_crear_configuracion_de_empresa on empresas;
create trigger trg_crear_configuracion_de_empresa after insert on empresas for each row execute function public.crear_configuracion_de_empresa();

insert into schema_migraciones (nombre) values ('sql_002_equipo_y_base.sql') on conflict do nothing;

-- ROLLBACK:
-- drop trigger if exists trg_crear_configuracion_de_empresa on empresas;
-- drop function if exists crear_configuracion_de_empresa();
-- drop table if exists clientes, uso_ia_anthropic, logs_errores, lead_ronda_turnos, espacio_notif_prefs, push_subscriptions, alertas, disponibilidad_vendedor, motivos_cierre, configuracion_empresa, perfiles, sucursales cascade;
-- drop function if exists proteger_columnas_perfiles();
-- drop function if exists soy_superadmin();
-- drop function if exists soy_encargado_o_dueno();
-- drop function if exists soy_dueno();
-- drop function if exists mi_empresa_id();
-- delete from schema_migraciones where nombre = 'sql_002_equipo_y_base.sql';
