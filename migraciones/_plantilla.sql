-- Plantilla de migración. Copiala como migraciones/sql_<tema>.sql.
-- Reglas (las valida scripts/check-migraciones.mjs en el CI):
--   1. Que se pueda correr dos veces sin romper (if not exists / on conflict).
--   2. Traer abajo el bloque ROLLBACK con el SQL para deshacerla.
--   3. Nada destructivo (DROP/TRUNCATE/DELETE sin WHERE/cambio de tipo) sin una
--      línea `-- DESTRUCTIVA: <por qué es seguro>`.
--   4. Después de correrla en Supabase, anotarla (ver migraciones/README.md).

create table if not exists ejemplo (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  created_at timestamptz not null default now()
);

alter table ejemplo add column if not exists nota text;

insert into schema_migraciones (nombre) values ('sql_ejemplo.sql') on conflict do nothing;

-- ROLLBACK:
-- alter table ejemplo drop column if exists nota;
-- drop table if exists ejemplo;
-- delete from schema_migraciones where nombre = 'sql_ejemplo.sql';
