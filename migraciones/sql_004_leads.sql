-- sql_004_leads.sql
create table if not exists leads_manuales (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default mi_empresa_id() references empresas(id) on delete cascade,
  nombre text not null,
  telefono text,
  email text,
  canal_origen text,
  sucursal_id uuid references sucursales(id),
  estado_lead text not null default 'nuevo' check (estado_lead in ('nuevo', 'asignado', 'calificando', 'convertido', 'perdido')),
  calificacion text check (calificacion in ('caliente', 'tibio', 'frio')),
  vendedor_id uuid references perfiles(id),
  vehiculo_id uuid,
  cliente_id uuid references clientes(id),
  domicilio text,
  notas text,
  asistencia_solicitada boolean not null default false,
  asistencia_nota text,
  asistencia_para uuid references perfiles(id),
  asistencia_atendida boolean not null default false,
  motivo_cierre_id uuid references motivos_cierre(id),
  creado_por uuid references perfiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  es_basura boolean not null default false,
  prospeccion jsonb
);
alter table leads_manuales enable row level security;
create index if not exists leads_manuales_empresa_idx on leads_manuales (empresa_id);
create index if not exists leads_manuales_orden_idx on leads_manuales (empresa_id, created_at desc);
drop policy if exists "empresa_leads_manuales" on leads_manuales;
create policy "empresa_leads_manuales" on leads_manuales for all to authenticated using (empresa_id = mi_empresa_id()) with check (empresa_id = mi_empresa_id());

create table if not exists eventos_lead (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default mi_empresa_id() references empresas(id) on delete cascade,
  
  whatsapp_conversacion_id uuid references whatsapp_conversaciones(id) on delete cascade,
  instagram_conversacion_id uuid references instagram_conversaciones(id) on delete cascade,
  messenger_conversacion_id uuid references messenger_conversaciones(id) on delete cascade,
  rodi_conversacion_id uuid references rodi_conversaciones(id) on delete cascade,
  leads_manuales_id uuid references leads_manuales(id) on delete cascade,
  
  tipo text not null,
  descripcion text not null,
  creado_por uuid references perfiles(id),
  created_at timestamptz not null default now(),
  constraint eventos_lead_un_solo_origen check (num_nonnulls(whatsapp_conversacion_id, instagram_conversacion_id, messenger_conversacion_id, rodi_conversacion_id, leads_manuales_id) = 1)
);
alter table eventos_lead enable row level security;
create index if not exists eventos_lead_empresa_idx on eventos_lead (empresa_id);
create index if not exists eventos_lead_wa_idx on eventos_lead (whatsapp_conversacion_id) where whatsapp_conversacion_id is not null;
create index if not exists eventos_lead_ig_idx on eventos_lead (instagram_conversacion_id) where instagram_conversacion_id is not null;
create index if not exists eventos_lead_messenger_idx on eventos_lead (messenger_conversacion_id) where messenger_conversacion_id is not null;
create index if not exists eventos_lead_rodi_idx on eventos_lead (rodi_conversacion_id) where rodi_conversacion_id is not null;
create index if not exists eventos_lead_manual_idx on eventos_lead (leads_manuales_id) where leads_manuales_id is not null;
drop policy if exists "empresa_eventos_lead" on eventos_lead;
create policy "empresa_eventos_lead" on eventos_lead for all to authenticated using (empresa_id = mi_empresa_id()) with check (empresa_id = mi_empresa_id());

create table if not exists tareas_lead (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default mi_empresa_id() references empresas(id) on delete cascade,
  
  whatsapp_conversacion_id uuid references whatsapp_conversaciones(id) on delete cascade,
  instagram_conversacion_id uuid references instagram_conversaciones(id) on delete cascade,
  messenger_conversacion_id uuid references messenger_conversaciones(id) on delete cascade,
  rodi_conversacion_id uuid references rodi_conversaciones(id) on delete cascade,
  leads_manuales_id uuid references leads_manuales(id) on delete cascade,
  
  tipo text not null,
  titulo text,
  fecha_vencimiento timestamptz not null,
  completada boolean not null default false,
  resultado text,
  creado_por uuid references perfiles(id),
  created_at timestamptz not null default now(),
  aviso_vencida_enviado boolean not null default false,
  constraint tareas_lead_un_solo_origen check (num_nonnulls(whatsapp_conversacion_id, instagram_conversacion_id, messenger_conversacion_id, rodi_conversacion_id, leads_manuales_id) = 1)
);
alter table tareas_lead enable row level security;
create index if not exists tareas_lead_empresa_idx on tareas_lead (empresa_id);
create index if not exists tareas_lead_vencimiento_idx on tareas_lead (empresa_id, completada, fecha_vencimiento);
create index if not exists tareas_lead_wa_idx on tareas_lead (whatsapp_conversacion_id) where whatsapp_conversacion_id is not null;
create index if not exists tareas_lead_ig_idx on tareas_lead (instagram_conversacion_id) where instagram_conversacion_id is not null;
create index if not exists tareas_lead_messenger_idx on tareas_lead (messenger_conversacion_id) where messenger_conversacion_id is not null;
create index if not exists tareas_lead_rodi_idx on tareas_lead (rodi_conversacion_id) where rodi_conversacion_id is not null;
create index if not exists tareas_lead_manual_idx on tareas_lead (leads_manuales_id) where leads_manuales_id is not null;
drop policy if exists "empresa_tareas_lead" on tareas_lead;
create policy "empresa_tareas_lead" on tareas_lead for all to authenticated using (empresa_id = mi_empresa_id()) with check (empresa_id = mi_empresa_id());

create table if not exists visitas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default mi_empresa_id() references empresas(id) on delete cascade,
  vehiculo_id uuid,
  nombre_cliente text not null,
  telefono_cliente text not null,
  fecha_visita date not null,
  horario_visita text not null,
  sucursal text not null,
  estado text not null default 'Pendiente' check (estado in ('Pendiente', 'Confirmada', 'Asistió', 'Cancelada')),
  vendedor_id uuid references perfiles(id),
  cliente_id uuid references clientes(id),
  creado_por uuid references perfiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  vehiculo_marca text,
  vehiculo_modelo text,
  vehiculo_patente text,
  canal_origen text,
  utm_source text,
  utm_medium text,
  utm_campaign text
);
alter table visitas enable row level security;
create index if not exists visitas_empresa_idx on visitas (empresa_id);
create index if not exists visitas_fecha_idx on visitas (empresa_id, fecha_visita, horario_visita);
create index if not exists visitas_sucursal_fecha_idx on visitas (empresa_id, sucursal, fecha_visita);
drop policy if exists "empresa_visitas" on visitas;
create policy "empresa_visitas" on visitas for all to authenticated using (empresa_id = mi_empresa_id()) with check (empresa_id = mi_empresa_id());


-- Eventos y tareas: la empresa sale de la conversación (o del lead manual) a la que pertenecen.
create or replace function public.copiar_empresa_de_la_charla() returns trigger
language plpgsql set search_path = public as $$
declare
  v_fila jsonb := to_jsonb(new);
  v_par text[];
  v_emp uuid;
begin
  foreach v_par slice 1 in array array[
    array['whatsapp_conversacion_id', 'whatsapp_conversaciones'], array['instagram_conversacion_id', 'instagram_conversaciones'],
    array['messenger_conversacion_id', 'messenger_conversaciones'], array['rodi_conversacion_id', 'rodi_conversaciones'],
    array['leads_manuales_id', 'leads_manuales']]
  loop
    if v_fila ->> v_par[1] is not null then
      execute format('select empresa_id from public.%I where id = $1', v_par[2]) into v_emp using (v_fila ->> v_par[1])::uuid;
      exit;
    end if;
  end loop;
  if v_emp is null then
    raise exception 'No se encontró la charla de este registro';
  end if;
  if new.empresa_id is null then
    new.empresa_id := v_emp;
  elsif new.empresa_id <> v_emp then
    raise exception 'La empresa no coincide con la de la charla';
  end if;
  return new;
end $$;
drop trigger if exists trg_aa_empresa_de_la_charla on eventos_lead;
create trigger trg_aa_empresa_de_la_charla before insert on eventos_lead for each row execute function public.copiar_empresa_de_la_charla();
drop trigger if exists trg_aa_empresa_de_la_charla on tareas_lead;
create trigger trg_aa_empresa_de_la_charla before insert on tareas_lead for each row execute function public.copiar_empresa_de_la_charla();

insert into schema_migraciones (nombre) values ('sql_004_leads.sql') on conflict do nothing;

-- ROLLBACK:
-- drop table if exists visitas, tareas_lead, eventos_lead, leads_manuales cascade;
-- drop function if exists copiar_empresa_de_la_charla();
-- delete from schema_migraciones where nombre = 'sql_004_leads.sql';
