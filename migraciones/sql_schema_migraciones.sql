-- Registro de qué migraciones ya se corrieron en esta base. Hasta ahora las
-- migraciones se corrían a mano y nadie podía saber con certeza cuáles estaban
-- aplicadas. Correr ESTA primero, una sola vez.
create table if not exists schema_migraciones (
  nombre text primary key,
  aplicada_en timestamptz not null default now(),
  notas text
);

-- ROLLBACK:
-- drop table if exists schema_migraciones;
