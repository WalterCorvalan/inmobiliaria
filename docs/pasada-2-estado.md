# Pasada 2: empresa en cada dato y seguridad (2/11/2026)

## Hecho y probado

Cinco migraciones en `migraciones/`, con vuelta atrás, que pasan el chequeo del CI (`scripts/check-migraciones.mjs`):

| Archivo | Qué hace |
|---|---|
| `sql_001_empresas.sql` | `empresas`, `superadmins`, `soporte_accesos` |
| `sql_002_equipo_y_base.sql` | oficinas, perfiles, configuración de la empresa, alertas, clientes, ayudantes de seguridad (`mi_empresa_id()`, `soy_dueno()`, ...) |
| `sql_003_canales.sql` | configuración de WhatsApp / Instagram / Messenger (con secreto de la app cifrado por empresa), contactos, charlas y mensajes de los 4 canales |
| `sql_004_leads.sql` | leads manuales, eventos, tareas y visitas |
| `sql_005_reparto_y_avisos.sql` | ronda de leads, avisos al equipo, cierre de leads; todo dentro de la empresa del lead |

El test `migraciones/tests/aislamiento.test.ts` levanta una base Postgres en memoria, aplica las 5 migraciones y prueba con dos empresas (23 pruebas). Se comprobó que detecta una fuga: al aflojar a propósito una política, fallan 5 pruebas.

Reglas de seguridad que quedaron:
- Toda tabla con `empresa_id` tiene seguridad por fila y una política que mira la empresa. Una tabla nueva sin eso hace fallar el test.
- Una empresa suspendida deja de ver todo.
- Nadie se cambia de empresa, ni siquiera el dueño. Los roles solo los cambia el dueño. Solo existen `admin`, `encargado` y `ventas`.
- Las credenciales de los canales las ve y escribe solo el dueño de la empresa.
- La empresa de un mensaje, evento o tarea se copia de su charla; si se manda otra, se rechaza.
- Los tres verify tokens de webhook son únicos en toda la plataforma: así el webhook sabe de qué empresa es cada mensaje.
- El cliente ofensivo no avisa a nadie.
- `empresas` solo se lee la propia; `superadmins` y `soporte_accesos` solo las toca el servidor.

## Para correrlo en Supabase (lo hacés vos, en este orden)

1. `migraciones/sql_schema_migraciones.sql`
2. `sql_001` a `sql_005`, en orden.
3. Primera empresa y primer dueño (reemplazar los valores):

```sql
-- 1) En Supabase → Authentication → Users: crear el usuario del dueño (mail y contraseña) y copiar su id.
-- 2) Correr esto con ese id:
insert into empresas (nombre, slug) values ('Nombre de la inmobiliaria', 'nombre-corto') returning id;
insert into perfiles (id, empresa_id, nombre, roles)
values ('<id del usuario>', '<id de la empresa>', 'Nombre del dueño', '{admin}');
```

Al crear la empresa se crean solas su configuración y los tres verify tokens.

## Lo que falta: el código todavía no usa el esquema nuevo

La base está lista; la aplicación sigue escrita para una sola empresa. Pendiente (pasada 2b, antes de conectar nada):

1. **56 lecturas de `id = true`** en 26 archivos (configuración de WhatsApp, Instagram, Messenger y empresa, crons, webhooks). Pasan a "la fila de esta empresa".
2. **Webhooks y tareas automáticas** (corren con la clave de servicio, que se salta la seguridad): deben identificar la empresa por el verify token de la dirección, filtrar por ella en cada consulta y recorrer todas las empresas, cada una con su horario.
3. **Chat de la web**: hoy no sabe de qué empresa es la visita; el código para pegar tiene que llevar un identificador de empresa.
4. **Secreto de la app de Meta y ID de la app de Instagram por empresa** (columnas ya creadas, el código sigue usando variables de entorno y un número fijo).
5. **Llamadas a funciones de la base** (`proximo_vendedor_ronda`, `asignacion_auto_en_tabla`, `leads_ultima_direccion`, `visitas_horarios_ocupados`) con la empresa como parámetro.
6. **Gasto de IA** (`uso_ia_anthropic`): hoy el código lo guarda sin empresa; la columna es opcional hasta completarlo.
7. **Catálogo**: el código aún consulta tablas que la base nueva no tiene (`vehiculos`, `pedidos`, `consignaciones`, `test_drives`, `ventas`, `senas`, `presupuestos`, `peritajes_lead`, `leads_tasacion`, `modulos_config`, `visibilidad_sector`, mensajes internos). Esas pantallas y partes del bot fallarán hasta sacar el catálogo de los chats (decidido el 2/11: no es del núcleo).
8. **`rate_limit_check`** (límite de pedidos por IP): no está en la base nueva; el código cae a un contador en memoria. Falta su tabla y función.
9. **Datos iniciales por empresa** que Pfaffen cargaba a mano: motivos de cierre, memoria del bot y plantillas.
10. **Endurecimiento de credenciales**: el dueño puede leer los tokens cifrados desde el navegador. Pasarlos a lectura solo del servidor cuando las rutas de configuración lo permitan.

Hasta terminar los puntos 1 al 6: no conectar ninguna inmobiliaria real.
