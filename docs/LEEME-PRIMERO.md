# LEEME PRIMERO (manual del proyecto)

Si abrís este proyecto desde un chat nuevo, **leé este archivo entero antes de tocar nada**. Resume la idea, lo que se decidió, cómo está construido, en qué estado está y cómo seguir. Es la puerta de entrada; el detalle está en los demás archivos de `docs/` (mapa al final).

Última actualización: 6/11/2026.

## 1. Quién es Walter y cómo hay que hablarle

- Walter (dueño del proyecto) habla español de Argentina y no es programador.
- Respuestas **cortas, en español simple, sin jerga**. Si hace falta un término técnico, se explica en una línea.
- Cuando algo no se sabe, se dice. No se afirma sin mostrar la prueba (una vez se afirmó que algo no existía y sí existía: quedó registrado).
- **Nunca pedirle contraseñas, tokens ni claves en el chat.** Solo decirle el nombre de la clave y dónde se saca.
- **No hacer nada en Google, Meta ni MercadoLibre sin su OK en el momento.**
- El repositorio de Pfaffen (`WalterCorvalan/pfaffenauto-web`, commit `186a821`) es **solo de lectura**: se copia código de ahí, nunca se toca.

## 2. La idea general

Walter tiene un CRM propio para una concesionaria (Pfaffen). Quiere **venderlo como servicio a otras empresas** de ventas, empezando por **inmobiliarias**, sin armar todo de cero: se "corta y pega" lo que ya funciona en Pfaffen y se generaliza.

El producto, tal como lo definió, es una **micro app que centraliza los mensajes de los canales de venta** y los junta en un módulo de **Leads**:

- Canales: **WhatsApp, Instagram, Messenger y el chat de la web**.
- Una bandeja única para todos.
- **Resumen con IA** de cada charla.
- **Reparto de leads entre asesores** (ronda), por **oficina**.
- **Avisos** al equipo y **derivación** del bot a una persona.
- **No se vende como un CRM completo.** Propiedades, visitas, pedidos, tasaciones, ventas, señas, expedientes, finanzas quedan fuera de la primera versión.

Es un **SaaS multiempresa**: cada inmobiliaria usa la app de forma independiente (sus datos, su bot, sus claves, sus usuarios) sin ver nada de las otras. Más adelante habrá un **panel de superadmin** del equipo de la plataforma.

Plan a futuro de Walter: después hacer **otro CRM para una concesionaria, más simple** (canales + leads + stock y poco más). Para eso existe `manual-de-arranque.md`: la receta para que una sesión nueva lo arme de punta a punta.

## 3. Qué se decidió (resumen; la tabla completa con fechas está en `decisiones.md`)

- **Una base de datos compartida**, cada fila con su empresa; la base misma impide cruzar datos.
- **Roles:** dueño, encargado, asesor (por dentro `admin`, `encargado`, `ventas`). Sin director, taller, finanzas ni gestoría.
- **Una persona = una empresa.** Entra con mail y contraseña, mail único en toda la plataforma.
- **Oficinas:** cada empresa puede tener varias; ronda de leads propia por oficina; el encargado ve lo de su oficina.
- **Meta:** una app por empresa, creada en su propia cuenta (sin revisión especial de Meta). Los secretos se guardan **cifrados por empresa**, no en Vercel.
- **Web pública:** en la v1 no hay web nuestra; la inmobiliaria sigue con la suya y le damos el código del chat (que toma su nombre, logo y colores).
- **Asistente del chat web:** se llama "Asistente" por defecto, sin foto ni personaje; por dentro el código sigue diciendo "rodi".
- **Orígenes de cliente (lista cerrada):** Zonaprop, Argenprop, MercadoLibre, Instagram, Facebook, Messenger, WhatsApp, Web, Oficina, Llamada, Otro. No se agrega ni saca ninguno sin que lo pida Walter.
- **Sin reasignación automática por tiempo** en la v1 (en Pfaffen existe una función pero no cubre los chats; Walter puede cambiar esa decisión).
- **Tasaciones y consignaciones:** sin regla especial; siguen la ronda normal.
- **Funciones de autos que NO se copian:** publicar un auto en Instagram, objetivos por vendedor, mensajes automáticos de cumpleaños / fin de pago / renovación, agradecimiento post-venta, encuesta NPS, aviso de documentación.
- **Cuentas nuevas y propias** de Supabase y Vercel, a nombre de Walter, separadas de Pfaffen. Ningún dato ni clave se comparte con Pfaffen.
- **Nombre provisorio:** "Inmobiliaria CRM". **Cobro:** sin definir (la base no tiene límites por plan).
- **Módulos por rol:** no hay "módulos apagados" ni "visibilidad por sector" configurables; dueño, encargado y asesor ven todo lo de la v1.

## 4. Cómo está construido

- **Tecnología:** Next.js 16 + React 19 + TypeScript, Supabase (Postgres, seguridad por fila, login), pruebas con vitest. Next.js 16 trae cambios respecto de lo que muchos modelos conocen: antes de escribir código de Next, leer la guía en `node_modules/next/dist/docs/` si existe.
- **Multiempresa en la base:** toda tabla de empresa lleva `empresa_id` y política de seguridad por fila con funciones `mi_empresa_id()`, `soy_dueno()`, `soy_encargado_o_dueno()`, `soy_superadmin()`. Una empresa suspendida no ve nada. Nadie cambia de empresa.
- **Multiempresa en el servidor:** `lib/empresa/db.ts`. El servidor usa la clave de servicio (salta la seguridad por fila), así que todo pasa por `dentroDeEmpresa(id, fn)` y el cliente `supabaseEmpresa`, que agrega solo el filtro y el `empresa_id` en cada consulta. Sin empresa fijada, falla. La empresa de un webhook sale del **verify token** único de su dirección; la del chat web, de su identificador público (slug).
- **Bot:** prompt neutro (no habla de ningún rubro) armado con el nombre del negocio, su descripción y su memoria (respuestas fijas); califica al lead, pide datos de contacto, agenda visitas y deriva a una persona. Salida con formato fijo. Código en `lib/ai/`.
- **Tareas automáticas:** recorren las empresas activas, cada una con su zona horaria (`paraCadaEmpresa`).
- **Tests que protegen el aislamiento:** `migraciones/tests/aislamiento.test.ts` (base en memoria, dos empresas), `lib/empresa/db.test.ts`, `lib/empresa/guardia.test.ts`. Si fallan, se arregla el código, no el test.
- **Carpetas clave:** `app/panel/` (pantallas), `app/api/panel/webhooks/` (entrada de mensajes), `app/api/cron/panel/` (tareas), `components/panel/conversaciones/` (bandejas y ficha del lead), `lib/panel/`, `lib/ai/`, `lib/empresa/`, `migraciones/`.

## 5. Cómo se trabajó (el método)

Resumen; el detalle está en `manual-de-arranque.md`.

1. Leer y decidir con Walter (alcance, mapa de qué copiar).
2. Copia en bloque desde Pfaffen, sin cambios, en un commit propio.
3. **Pasada 1:** sacar lo que no es de la v1, quitar nombres propios.
4. **Pasada 2:** empresa en cada dato + seguridad + test de aislamiento.
5. **Pasada 2b:** el código usa el esquema nuevo (servidor atado a la empresa, secretos de Meta por empresa, tareas por empresa).
6. **Bot neutro** sin catálogo.
7. **Limpiar pantallas** de lo que consultaba tablas que no existen.
8. Probar con Supabase real y recién después conectar una inmobiliaria.

## 6. Estado actual (5/11/2026)

**Hecho y verificado con tests:** todo lo de arriba hasta el punto 7. `tsc` sin errores, 253 tests pasan, el lint no sube, ninguna consulta apunta a una tabla que no exista.

**NUNCA se probó contra un Supabase real ni contra Meta real.** La base se probó en memoria. Hasta que eso pase, la guía de canales y el manual figuran como "sin probar".

**Regla firme:** no conectar ninguna inmobiliaria real hasta probar todo contra un Supabase real.

### Lo que sigue (en este orden sugerido)

1. Walter crea el proyecto nuevo en Supabase y corre las migraciones en orden (ver `pasada-2-estado.md`, sección "Para correrlo en Supabase"). Después se prueba un recorrido real: entrar, conectar un canal, mandar un mensaje.
2. Corregir lo que aparezca en esa primera prueba (se anota en las guías).
3. Panel de superadmin (hoy la primera empresa se crea con SQL).
4. Código para pegar el chat en la web de cada inmobiliaria.
5. Memoria inicial del bot por empresa.
6. Que el dueño no pueda leer los tokens cifrados desde el navegador.
7. Crear `.env.example` con los nombres de las variables (no existe todavía).
8. Fases posteriores del plan original: pantalla de configuración de empresa, usuarios y oficinas; propiedades; catálogo propio con dominio (Fase 14, solo si se decide). El orden propuesto de módulos nuevos (Propiedades, Clientes, Visitas, etc.) está en `plan-modulos.md`. El plan original por fases no quedó escrito completo en el repositorio: lo que se sabe está en `fase-3-diseno-base.md`, `estado-pasada-1.md` y `pasada-2-estado.md`.

La lista viva de pendientes es `pasada-2-estado.md`, sección "Lo que sigue pendiente".

## 7. Reglas para trabajar acá

- **Antes de subir:** `npm run typecheck`, `npm test`, `npm run lint:baseline`, `npm run check:migraciones`. El lint no puede subir; si bajó, `npm run lint:baseline -- --update`.
- Las reglas de permisos y de negocio van en `lib/` como **funciones puras con test**, no dentro de rutas o componentes.
- **Migraciones:** archivos nuevos en `migraciones/` con vuelta atrás (`-- ROLLBACK:`), sin nada destructivo sin declararlo. Las corre Walter a mano **antes** de subir el código que las necesita. Ver `migraciones/README.md`.
- **Una tabla nueva con `empresa_id`** necesita: seguridad por fila, entrada en `TABLAS_DE_EMPRESA` (`lib/empresa/db.ts`) y que pase el test de aislamiento.
- **Idioma del código:** sustantivos de negocio en español (`cliente`, `sucursal`); patrones técnicos en inglés (`useState`, `handleSubmit`, sufijos `Form`, `Modal`, `Client`).
- Lo que decide Walter se anota en `docs/decisiones.md` (con fecha). Lo que falta, en la lista de pendientes. Nada queda solo en el chat.
- Commit y push solo a la rama indicada para la sesión. **No abrir pull request si no se pide.**
- Los textos para el cliente final usan "oficina" (en el código sigue `sucursal`) y "asesor" (en el código `ventas`).

## 8. Documentos (mapa)

| Archivo | Para qué |
|---|---|
| `docs/LEEME-PRIMERO.md` | este manual: idea, decisiones, estado, cómo seguir |
| `docs/decisiones.md` | tabla de decisiones de Walter con fecha (lo que está acá no es un bug) |
| `docs/manual-de-arranque.md` | receta para armar otro CRM con este método (ej: concesionaria) |
| `docs/guia-conexion-canales.md` | conectar WhatsApp, Instagram y Messenger paso a paso |
| `docs/receta-agente-meta.md` | guion para que un agente configure la app de Meta (estado esperado, pasos, paradas) |
| `docs/plan-modulos.md` | qué módulos de Pfaffen sumar después de la v1, cuáles repensar y cuáles no copiar |
| `docs/pasada-2-estado.md` | seguridad, cómo correr las migraciones, pendientes |
| `docs/fase-3-diseno-base.md` | diseño de la base con empresa |
| `docs/extraccion-leads-y-chats.md` | mapa de lo que se copió de Pfaffen y qué se partió |
| `docs/origen-pfaffen.md` | de dónde salió la copia (commit, qué no se copió) |
| `docs/estado-pasada-1.md` | foto histórica al terminar la pasada 1 |
| `migraciones/README.md` | cómo se escriben y corren las migraciones |

Copias en el Drive de Walter (cuenta nicocorvalan505@gmail.com): la guía de canales y el manual de arranque. La copia **de referencia** es la del repositorio; la de Drive se reemplaza cuando cambia (el link cambia).

## 9. Al terminar tu trabajo en una sesión

1. Actualizá la sección 6 de este archivo (estado y qué sigue) y la fecha de arriba.
2. Anotá decisiones nuevas en `decisiones.md` y pendientes en `pasada-2-estado.md`.
3. Si cambiaste la guía de canales o el manual de arranque, avisale a Walter para renovar la copia de Drive.
