-- sql_009_propiedades.sql
-- Módulo Propiedades (v1): las propiedades de cada inmobiliaria y sus fotos.
-- Cada fila lleva su empresa y la seguridad por fila la aísla, igual que el resto de las tablas.
-- Las fotos guardan la dirección de la imagen (url). La subida de archivos a Storage se suma en otra migración.

create table if not exists propiedades (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default mi_empresa_id() references empresas(id) on delete cascade,
  sucursal_id uuid references sucursales(id) on delete set null,
  asesor_id uuid references perfiles(id) on delete set null,
  codigo text,
  titulo text not null,
  tipo text not null default 'departamento' check (tipo in ('departamento', 'casa', 'ph', 'local', 'oficina', 'terreno', 'cochera', 'otro')),
  operacion text not null default 'venta' check (operacion in ('venta', 'alquiler')),
  estado text not null default 'disponible' check (estado in ('disponible', 'reservada', 'vendida', 'alquilada', 'pausada')),
  precio numeric(14, 2),
  moneda text not null default 'USD' check (moneda in ('USD', 'ARS')),
  expensas numeric(14, 2),
  direccion text,
  barrio text,
  ciudad text,
  ambientes smallint check (ambientes is null or ambientes >= 0),
  dormitorios smallint check (dormitorios is null or dormitorios >= 0),
  banos smallint check (banos is null or banos >= 0),
  cocheras smallint check (cocheras is null or cocheras >= 0),
  superficie_total numeric(10, 2) check (superficie_total is null or superficie_total >= 0),
  superficie_cubierta numeric(10, 2) check (superficie_cubierta is null or superficie_cubierta >= 0),
  descripcion text,
  latitud numeric(9, 6),
  longitud numeric(9, 6),
  creado_por uuid references perfiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table propiedades enable row level security;
create index if not exists propiedades_empresa_idx on propiedades (empresa_id);
create index if not exists propiedades_orden_idx on propiedades (empresa_id, created_at desc);
create index if not exists propiedades_filtro_idx on propiedades (empresa_id, operacion, estado, tipo);
create unique index if not exists propiedades_codigo_unico on propiedades (empresa_id, codigo) where codigo is not null;
drop policy if exists "empresa_propiedades" on propiedades;
create policy "empresa_propiedades" on propiedades for all to authenticated using (empresa_id = mi_empresa_id()) with check (empresa_id = mi_empresa_id());

create table if not exists propiedad_fotos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default mi_empresa_id() references empresas(id) on delete cascade,
  propiedad_id uuid not null references propiedades(id) on delete cascade,
  url text not null,
  orden smallint not null default 0,
  es_portada boolean not null default false,
  created_at timestamptz not null default now()
);
alter table propiedad_fotos enable row level security;
create index if not exists propiedad_fotos_empresa_idx on propiedad_fotos (empresa_id);
create index if not exists propiedad_fotos_propiedad_idx on propiedad_fotos (propiedad_id, orden);
drop policy if exists "empresa_propiedad_fotos" on propiedad_fotos;
create policy "empresa_propiedad_fotos" on propiedad_fotos for all to authenticated using (empresa_id = mi_empresa_id()) with check (empresa_id = mi_empresa_id());

insert into schema_migraciones (nombre) values ('sql_009_propiedades.sql') on conflict do nothing;

-- ROLLBACK:
-- drop table if exists propiedad_fotos;
-- drop table if exists propiedades;
-- delete from schema_migraciones where nombre = 'sql_009_propiedades.sql';
