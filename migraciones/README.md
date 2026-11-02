# Migraciones SQL

Se corren a mano en el SQL Editor de Supabase. Para que no dependa de la memoria de nadie:

1. **Correr una vez** `sql_schema_migraciones.sql`: crea la tabla `schema_migraciones`, el registro de lo aplicado.
2. **Cada migración nueva** parte de `_plantilla.sql` y tiene que:
   - poder correrse dos veces sin romper (`if not exists`, `on conflict do nothing`);
   - traer al final un bloque `-- ROLLBACK:` con el SQL para deshacerla (en comentarios);
   - no ser destructiva (`DROP`, `TRUNCATE`, `DELETE` sin `WHERE`, cambio de tipo de columna) salvo que lo declare con `-- DESTRUCTIVA: <por qué es seguro>`;
   - terminar anotándose: `insert into schema_migraciones (nombre) values ('sql_<tema>.sql') on conflict do nothing;`
3. El CI (`scripts/check-migraciones.mjs`) rechaza un PR si una migración **nueva** no cumple. Las que ya existían no se tocan.
4. Para ver qué falta correr, comparar `select nombre from schema_migraciones` con los archivos de esta carpeta.

Las migraciones anteriores a este registro no tienen bloque de rollback ni están anotadas: si se confirma que una ya está aplicada, anotarla a mano con el `insert` de arriba.

Antes de correr una migración en producción: probarla en una copia o, como mínimo, correr primero el `select` equivalente para ver cuántas filas toca.
