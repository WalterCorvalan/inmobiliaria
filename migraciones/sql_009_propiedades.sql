-- sql_009_propiedades.sql
-- Propiedades de cada inmobiliaria (venta y alquiler). Cada fila es de una empresa; la base impide ver o tocar las de otra.
-- Cualquier persona de la empresa puede ver, cargar y editar; solo dueño y encargado pueden borrar.
-- La oficina y el responsable tienen que ser de la misma empresa que la propiedad (lo controla un trigger).

create table if not exists propiedades (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default mi_empresa_id() references empresas(id) on delete cascade,
  codigo text,
  titulo text not null check (length(btrim(titulo)) > 0),
  operacion text not null check (operacion in ('venta', 'alquiler', 'alquiler_temporario')),
  tipo text not null check (tipo in ('casa', 'departamento', 'ph', 'terreno', 'local', 'oficina', 'cochera', 'campo', 'galpon', 'otro')),
  estado text not null default 'disponible' check (estado in ('disponible', 'reservada', 'vendida', 'alquilada', 'no_disponible')),
  direccion text,
  barrio text,
  localidad text,
  provincia text,
  precio numeric check (precio is null or precio >= 0),
  moneda text not null default 'USD' check (moneda in ('ARS', 'USD')),
  expensas numeric check (expensas is null or expensas >= 0),
  ambientes integer check (ambientes is null or ambientes >= 0),
  dormitorios integer check (dormitorios is null or dormitorios >= 0),
  banios integer check (banios is null or banios >= 0),
  cocheras integer check (cocheras is null or cocheras >= 0),
  m2_cubiertos numeric check (m2_cubiertos is null or m2_cubiertos >= 0),
  m2_totales numeric check (m2_totales is null or m2_totales >= 0),
  antiguedad_anios integer check (antiguedad_anios is null or antiguedad_anios >= 0),
  descripcion text,
  fotos text[] not null default '{}',
  publicada boolean not null default true,
  sucursal_id uuid references sucursales(id) on delete set null,
  vendedor_id uuid references perfiles(id) on delete set null,
  notas_internas text,
  creado_por uuid references perfiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table propiedades enable row level security;
create index if not exists propiedades_empresa_idx on propiedades (empresa_id, created_at desc);
create index if not exists propiedades_filtro_idx on propiedades (empresa_id, operacion, estado);
create unique index if not exists propiedades_codigo_unico on propiedades (empresa_id, lower(codigo)) where codigo is not null and btrim(codigo) <> '';

drop policy if exists "empresa_propiedades_ver" on propiedades;
create policy "empresa_propiedades_ver" on propiedades for select to authenticated using (empresa_id = mi_empresa_id());
drop policy if exists "empresa_propiedades_alta" on propiedades;
create policy "empresa_propiedades_alta" on propiedades for insert to authenticated with check (empresa_id = mi_empresa_id());
drop policy if exists "empresa_propiedades_cambio" on propiedades;
create policy "empresa_propiedades_cambio" on propiedades for update to authenticated using (empresa_id = mi_empresa_id()) with check (empresa_id = mi_empresa_id());
drop policy if exists "empresa_propiedades_baja" on propiedades;
create policy "empresa_propiedades_baja" on propiedades for delete to authenticated using (empresa_id = mi_empresa_id() and soy_encargado_o_dueno());

-- La oficina y el responsable de una propiedad tienen que ser de su misma empresa, y la fecha de cambio se actualiza sola.
create or replace function public.controlar_propiedad() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.sucursal_id is not null and not exists (select 1 from public.sucursales where id = new.sucursal_id and empresa_id = new.empresa_id) then
    raise exception 'La oficina no es de la empresa de la propiedad';
  end if;
  if new.vendedor_id is not null and not exists (select 1 from public.perfiles where id = new.vendedor_id and empresa_id = new.empresa_id) then
    raise exception 'El responsable no es de la empresa de la propiedad';
  end if;
  if tg_op = 'UPDATE' and new.empresa_id <> old.empresa_id then
    raise exception 'Una propiedad no puede cambiar de empresa';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_controlar_propiedad on propiedades;
create trigger trg_controlar_propiedad before insert or update on propiedades for each row execute function public.controlar_propiedad();

insert into schema_migraciones (nombre) values ('sql_009_propiedades.sql') on conflict do nothing;

-- ROLLBACK:
-- drop table if exists propiedades cascade;
-- drop function if exists controlar_propiedad();
-- delete from schema_migraciones where nombre = 'sql_009_propiedades.sql';
