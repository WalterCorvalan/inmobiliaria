-- sql_011_reservas_operaciones_finanzas.sql
-- Reservas, operaciones cerradas y finanzas simples (pedido de Walter, 26/11/2026). Tres tablas nuevas, cada una con su
-- empresa y seguridad por fila.
-- 1) reservas: la plata que deja un cliente para reservar una propiedad.
-- 2) operaciones: cada venta o alquiler cerrado, con los honorarios y la parte del asesor.
-- 3) movimientos: lo que entra y sale de la inmobiliaria, en dólares o en pesos, por separado.

create table if not exists reservas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default mi_empresa_id() references empresas(id) on delete cascade,
  propiedad_id uuid references propiedades(id) on delete set null,
  cliente_nombre text not null,
  cliente_telefono text,
  monto numeric(14, 2) not null check (monto > 0),
  moneda text not null default 'USD' check (moneda in ('USD', 'ARS')),
  fecha date not null default current_date,
  vence_el date,
  estado text not null default 'vigente' check (estado in ('vigente', 'convertida', 'devuelta', 'perdida')),
  asesor_id uuid references perfiles(id) on delete set null,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table reservas enable row level security;
create index if not exists reservas_empresa_idx on reservas (empresa_id, fecha desc);
drop policy if exists "empresa_reservas" on reservas;
create policy "empresa_reservas" on reservas for all to authenticated using (empresa_id = mi_empresa_id()) with check (empresa_id = mi_empresa_id());

create table if not exists operaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default mi_empresa_id() references empresas(id) on delete cascade,
  tipo text not null default 'venta' check (tipo in ('venta', 'alquiler')),
  propiedad_id uuid references propiedades(id) on delete set null,
  propiedad_descripcion text, -- queda aunque se borre la propiedad
  reserva_id uuid references reservas(id) on delete set null,
  cliente_nombre text not null,
  cliente_telefono text,
  fecha date not null default current_date,
  valor numeric(14, 2) not null check (valor >= 0), -- precio de venta o alquiler mensual
  moneda text not null default 'USD' check (moneda in ('USD', 'ARS')),
  honorarios_pct numeric(6, 2) check (honorarios_pct >= 0),
  honorarios_monto numeric(14, 2) check (honorarios_monto >= 0),
  asesor_id uuid references perfiles(id) on delete set null,
  asesor_pct numeric(5, 2) check (asesor_pct between 0 and 100),
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table operaciones enable row level security;
create index if not exists operaciones_empresa_idx on operaciones (empresa_id, fecha desc);
drop policy if exists "empresa_operaciones" on operaciones;
create policy "empresa_operaciones" on operaciones for all to authenticated using (empresa_id = mi_empresa_id()) with check (empresa_id = mi_empresa_id());

create table if not exists movimientos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default mi_empresa_id() references empresas(id) on delete cascade,
  fecha date not null default current_date,
  tipo text not null check (tipo in ('ingreso', 'egreso')),
  categoria text not null,
  descripcion text,
  monto numeric(14, 2) not null check (monto > 0),
  moneda text not null default 'ARS' check (moneda in ('USD', 'ARS')),
  operacion_id uuid references operaciones(id) on delete set null,
  creado_por uuid references perfiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table movimientos enable row level security;
create index if not exists movimientos_empresa_idx on movimientos (empresa_id, fecha desc);
drop policy if exists "empresa_movimientos" on movimientos;
create policy "empresa_movimientos" on movimientos for all to authenticated using (empresa_id = mi_empresa_id()) with check (empresa_id = mi_empresa_id());

insert into schema_migraciones (nombre) values ('sql_011_reservas_operaciones_finanzas.sql') on conflict do nothing;

-- ROLLBACK:
-- drop table if exists movimientos;
-- drop table if exists operaciones;
-- drop table if exists reservas;
-- delete from schema_migraciones where nombre = 'sql_011_reservas_operaciones_finanzas.sql';
