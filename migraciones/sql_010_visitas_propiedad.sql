-- sql_010_visitas_propiedad.sql
-- Visitas a propiedades: cada visita puede quedar atada a una propiedad de la cartera (la elige el asesor o la deja el bot
-- con el código que dio el cliente) y llevar una nota. Las columnas vehiculo_* quedan como estaban (vienen de Pfaffen) y no
-- se usan en la inmobiliaria.

alter table visitas add column if not exists propiedad_id uuid references propiedades(id) on delete set null;
alter table visitas add column if not exists propiedad_codigo text;
alter table visitas add column if not exists notas text;
create index if not exists visitas_propiedad_idx on visitas (empresa_id, propiedad_id);

-- Si llega solo el código (el bot), se busca la propiedad de la MISMA empresa y se completa propiedad_id.
create or replace function public.visitas_vincular_propiedad() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.propiedad_id is null and new.propiedad_codigo is not null and new.empresa_id is not null then
    select p.id into new.propiedad_id from public.propiedades p
     where p.empresa_id = new.empresa_id and upper(p.codigo) = upper(trim(new.propiedad_codigo))
     limit 1;
  end if;
  return new;
end $$;

drop trigger if exists visitas_vincular_propiedad on visitas;
create trigger visitas_vincular_propiedad before insert or update of propiedad_codigo on visitas
  for each row execute function public.visitas_vincular_propiedad();

insert into schema_migraciones (nombre) values ('sql_010_visitas_propiedad.sql') on conflict do nothing;

-- ROLLBACK:
-- drop trigger if exists visitas_vincular_propiedad on visitas;
-- drop function if exists public.visitas_vincular_propiedad();
-- drop index if exists visitas_propiedad_idx;
-- alter table visitas drop column if exists notas;
-- alter table visitas drop column if exists propiedad_codigo;
-- alter table visitas drop column if exists propiedad_id;
-- delete from schema_migraciones where nombre = 'sql_010_visitas_propiedad.sql';
