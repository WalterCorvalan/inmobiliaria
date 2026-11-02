-- sql_006_instagram_secreto_meta.sql
-- Los webhooks de Instagram pueden venir firmados con el secreto de la app de Instagram o con el de la app de Meta
-- (Pfaffen aceptaba los dos). Cada empresa guarda los dos, cifrados; el primero ya existe como app_secret_*.
alter table instagram_configuracion add column if not exists meta_app_secret_cifrado text;
alter table instagram_configuracion add column if not exists meta_app_secret_iv text;
alter table instagram_configuracion add column if not exists meta_app_secret_tag text;

insert into schema_migraciones (nombre) values ('sql_006_instagram_secreto_meta.sql') on conflict do nothing;

-- ROLLBACK:
-- alter table instagram_configuracion drop column if exists meta_app_secret_tag;
-- alter table instagram_configuracion drop column if exists meta_app_secret_iv;
-- alter table instagram_configuracion drop column if exists meta_app_secret_cifrado;
-- delete from schema_migraciones where nombre = 'sql_006_instagram_secreto_meta.sql';
