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

## Pasada 2b: el código ya usa el esquema nuevo (2/11/2026)

Todo lo que el servidor hace con la base pasa por `lib/empresa/db.ts`:
- `dentroDeEmpresa(id, fn)` fija la empresa del pedido (cada pedido la suya, aunque corran a la vez).
- `supabaseEmpresa` es el cliente de servicio atado a esa empresa: cada consulta a una tabla de empresa lleva sola el filtro `empresa_id`, y cada alta lleva el `empresa_id`. Sin empresa fijada, falla en vez de leer todo.
- Las funciones de la base que reciben empresa la reciben siempre la del pedido.

Qué cambió:
1. **Webhooks de WhatsApp, Instagram y Messenger**: la empresa sale del verify token de la dirección; la firma de Meta se comprueba con el secreto de ESA empresa (cifrado en su configuración). Una empresa suspendida no recibe mensajes.
2. **Chat de la web**: el pedido lleva el identificador público (slug) de la empresa (`FloatingChatbot` recibe `empresa` o toma `NEXT_PUBLIC_EMPRESA_SLUG`).
3. **15 rutas del panel** (configuración, envío, plantillas, estado, registro del número, importar, etc.) corren con la empresa de quien las llama; sin sesión o con la empresa suspendida responden 401.
4. **Credenciales de Meta por empresa**: las pantallas de WhatsApp, Instagram y Messenger piden y guardan cifrados el secreto de la app (Instagram: ID y secreto de la app de Instagram, más el de Meta opcional). El ID de la app de Instagram ya no está escrito en el código; el botón "Conectar con Instagram" usa el de la empresa. Migración `sql_006`.
5. **Las 7 tareas automáticas** recorren las empresas activas, cada una con su horario y su zona horaria. El mensaje de la mañana sale a las 9 de la zona de cada empresa (la tarea corre cada hora).
6. **Gasto de IA** y **registro de errores** se anotan con la empresa.
7. **Límite de pedidos por IP** (`rate_limit_check`) y **motivos de cierre iniciales** por empresa: migración `sql_007`.
8. **Programación de las tareas**: migración `sql_008` deja la función `programar_tareas(url, clave)`; hay que llamarla una vez (ver el encabezado del archivo).

Pruebas:
- `migraciones/tests/aislamiento.test.ts`: 26 pruebas con dos empresas sobre Postgres en memoria (incluye que la lista de tablas de `lib/empresa/db.ts` coincida con la base).
- `lib/empresa/db.test.ts`: el cliente atado a la empresa (filtros, altas, no se puede pisar la empresa, pedidos simultáneos no se mezclan).
- `lib/empresa/guardia.test.ts`: falla si alguien usa la clave de servicio fuera de `lib/empresa`, crea su propio cliente, lee `id = true`, agrega una ruta de la API sin empresa o una tarea automática que no recorra las empresas.

Correr en Supabase, en orden: `sql_schema_migraciones`, `sql_001` a `sql_007`, y después `sql_008` si se quieren las tareas programadas (requiere pg_cron y pg_net).

## Lo que sigue pendiente

1. **Catálogo en los chats** (decidido el 2/11: no es del núcleo). El código aún consulta tablas que la base nueva no tiene (`vehiculos`, `pedidos`, `consignaciones`, `test_drives`, `ventas`, `senas`, `presupuestos`, `peritajes_lead`, `leads_tasacion`, `modulos_config`, `visibilidad_sector`, mensajes internos). Esas pantallas (detalle del lead, sugerencias de vehículo) y partes del bot fallan hasta sacarlas. **Es lo que más pesa antes del piloto.**
2. **Nunca se corrió contra un Supabase real**: la base se probó en memoria. Tampoco se probó `programar_tareas` (pg_cron no existe en la base en memoria).
3. **Firma de Instagram**: si Meta firma con un secreto distinto al cargado, el webhook rechaza y deja el error en "Errores del sistema". Cargar entonces el otro secreto (hay dos campos).
4. **Datos iniciales**: falta la memoria del bot por empresa (respuestas fijas); las empresas nuevas arrancan con las genéricas de fuera de horario y apertura.
5. **Código para pegar el chat en la web de cada inmobiliaria** (Fase 6): hoy el chat toma el identificador de una variable.
6. **Endurecimiento de credenciales**: el dueño puede leer los tokens cifrados desde el navegador; pasarlos a lectura solo del servidor.
7. **Panel superadmin** (alta de empresas sin SQL): hoy la primera empresa se crea con el SQL de más arriba.

Regla firme: no conectar ninguna inmobiliaria real hasta resolver el punto 1 y probar contra un Supabase real.
