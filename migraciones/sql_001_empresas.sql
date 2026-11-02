-- sql_001_empresas.sql

-- Cada inmobiliaria es una fila de "empresas". Todo lo demás cuelga de ella con empresa_id.
create table if not exists empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  slug text not null unique,
  estado text not null default 'activa' check (estado in ('activa', 'suspendida')),
  zona_horaria text not null default 'America/Argentina/Buenos_Aires',
  created_at timestamptz not null default now()
);
alter table empresas enable row level security;

-- El equipo de la plataforma. No pertenece a ninguna empresa y no figura en "perfiles".
create table if not exists superadmins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table superadmins enable row level security;

-- Registro de cada vez que alguien del equipo entra a una empresa como soporte (nunca se ven claves).
create table if not exists soporte_accesos (
  id uuid primary key default gen_random_uuid(),
  superadmin_id uuid not null references superadmins(user_id),
  empresa_id uuid not null references empresas(id) on delete cascade,
  motivo text not null,
  desde timestamptz not null default now(),
  hasta timestamptz
);
alter table soporte_accesos enable row level security;
-- Sin políticas para "authenticated": solo el servidor (clave de servicio) lee y escribe estas dos tablas.

insert into schema_migraciones (nombre) values ('sql_001_empresas.sql') on conflict do nothing;

-- ROLLBACK:
-- drop table if exists soporte_accesos;
-- drop table if exists superadmins;
-- drop table if exists empresas;
-- delete from schema_migraciones where nombre = 'sql_001_empresas.sql';
