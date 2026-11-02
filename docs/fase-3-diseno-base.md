# Fase 3: diseño de la base de datos para varias empresas

Estado: **propuesta, sin SQL todavía**. Se escribe el SQL recién con el OK de Walter.
Fuente: esquema, restricciones, políticas, triggers, índices y funciones exportados del Supabase de Pfaffen (2/11/2026). Solo estructura.

## Idea central

Una sola base compartida. Cada fila lleva su empresa (`empresa_id`). La base misma impide leer o escribir filas de otra empresa, aunque haya un error en una pantalla. Se mantienen los nombres de tablas y columnas de Pfaffen para que el código copiado cambie lo menos posible.

## Tablas nuevas (de la plataforma)

- `empresas`: id, nombre, slug, estado (activa / suspendida), zona horaria (por defecto Argentina), fecha de alta.
- `superadmins`: usuarios del equipo, fuera de cualquier empresa.
- `soporte_accesos`: registro de cada vez que el superadmin entra a una empresa (quién, a cuál, cuándo, motivo). Nunca se ven claves.

## Tablas que se llevan (todas con `empresa_id`)

Mensajería: `whatsapp_*` (configuracion, contactos, conversaciones, mensajes, memoria, plantillas, templates), `instagram_*` (los mismos más automatizaciones de comentarios), `messenger_*`, `rodi_conversaciones`, `rodi_mensajes`.
Leads: `leads_manuales`, `eventos_lead`, `tareas_lead`, `motivos_cierre`, `clientes`, `visitas`.
Equipo y avisos: `perfiles`, `sucursales` (en pantalla "oficinas"), `disponibilidad_vendedor`, `alertas`, `push_subscriptions`, `espacio_notif_prefs`, `chats_vistos`.
Sistema: `configuracion_empresa`, `uso_ia_anthropic`, `logs_errores` (empresa opcional: hay errores de plataforma), `lead_ronda_turnos` (falta ver su estructura).

## Cambios por tipo

1. **Configuración de fila única** (`id boolean`): `configuracion_empresa`, `whatsapp_configuracion`, `instagram_configuracion`, `messenger_configuracion`. La clave pasa a ser `empresa_id`. Las de canal ganan el secreto de la app de Meta (cifrado) y, en Instagram, el ID de la app. Los tres tokens de dirección (`webhook_verify_token`) pasan a ser únicos en toda la base: así el webhook sabe de qué empresa es cada mensaje.
2. **`configuracion_empresa` se achica** de unas 180 columnas a las que usan Leads y los canales: marca, reparto de leads, canales con asignación automática, niveles de alertas, saldo de IA, resumen diario, redes. Se van financiación, outlet, fraude, comisiones, portada, RRHH, NPS, OCR y los textos con "Pfaffen" (la web pública queda para la Fase 14).
3. **Unicidades por empresa**: teléfono de contacto de WhatsApp, `ig_user_id`, `psid`, `session_id` del chat web, nombre y slug de oficina, nombre de motivo de cierre, `(nombre, idioma)` de plantilla. Los IDs de mensaje de Meta siguen únicos globales (Meta no los repite).
4. **Seguridad**: las políticas de Pfaffen son casi todas "cualquier usuario logueado puede todo" (`USING true`). Se reemplazan por "solo filas de mi empresa", con funciones `mi_empresa_id()`, `soy_dueno()` y `soy_superadmin()`. Los tokens cifrados no se pueden leer desde el navegador. Un test con dos empresas de prueba prueba que ninguna ve lo de la otra.
5. **Rutas del servidor**: webhooks, tareas automáticas y varias APIs usan la clave de servicio, que se salta la seguridad de la base. Ahí el aislamiento depende del código: se pasa la empresa explícita en cada consulta, con un ayudante único y un test que falla si una consulta no la lleva.
6. **Roles**: por dentro siguen `admin`, `encargado`, `ventas`; en pantalla se leen dueño, encargado, asesor.

## Funciones y triggers de la base: hay que reescribirlos con empresa

Hoy todos buscan "todos los perfiles" y "la configuración", sin empresa. Si se copiaran tal cual, **un lead de la empresa A avisaría a los asesores de la B**.

Se llevan y se rehacen con empresa: `asignacion_auto_en_tabla`, `asignar_lead_ronda_general` (trigger de inserción en las 4 tablas de conversaciones), `proximo_vendedor_ronda` (bloqueo y turnos por empresa; la zona horaria sale de la empresa), `asignar_vendedor_ronda_{whatsapp,instagram,rodi}` y sus `_por_sucursal` (los nombres se mantienen porque el código los llama), `asignar_vendedor_por_vehiculo_{whatsapp,instagram,rodi}` (pasarán a propiedad), `avanzar_estado_lead_*`, `{whatsapp,instagram,messenger,rodi}_notificar_handoff` y `_notificar_mensaje_entrante`, `leads_ultima_direccion`, `visitas_horarios_ocupados`, `repartir_leads_sin_asignar`, `marcar_lead_convertido`, `marcar_lead_rodi_convertido`, `sync_pipeline_desde_{whatsapp,instagram}`, `clientes_notificar_convertido`, `limpiar_conversaciones_rodi_sin_datos`.

Faltan sus definiciones (se piden a Walter): `soy_admin`, `proteger_columnas_perfiles`, `rate_limit_check`, `log_primer_contacto_cliente` y la tabla `lead_ronda_turnos`.

Se dejan afuera (son de otros módulos): comisiones, ventas, premios, tiers, peritajes, liquidaciones, caja, reclamos, chat interno, reportes, pedidos, consignaciones y `promover_lead_a_cliente`.
Código muerto de Pfaffen que no se copia: `asignar_vendedor_conversacion_nueva*` (ningún trigger las usa).

## Cosas raras de Pfaffen que no se copian tal cual

- `eventos_lead`, `tareas_lead` y `test_drives` tienen una regla "un solo origen" que, según el export, cuenta solo WhatsApp e Instagram. Si es así, un evento o tarea de Messenger, del chat web o de un lead manual se rechazaría. A verificar; en la app nueva la regla cuenta los cinco orígenes.
- `marcar_lead_convertido` no actualiza Messenger.
- Messenger no tiene trigger de asignación por vehículo.
- `perfiles` se puede leer completo por cualquier usuario logueado e incluye `totp_secret`, y `whatsapp_configuracion` tiene permiso total para cualquier logueado. Conviene revisarlo en Pfaffen; no afecta a la app nueva porque se rehace.

## Reasignación por tiempo

Existe `reasignar_leads_vencidos()`, pero trabaja sobre `clientes` en etapa "sin contactar", no sobre las conversaciones de los canales, y no encontré en las migraciones ninguna tarea que la dispare. Para los leads de chat, en la práctica no reasigna. Decisión vigente: no se copia.

## Orden de trabajo

1. Pedir a Walter las definiciones que faltan.
2. Escribir las migraciones (con vuelta atrás) en `migraciones/`.
3. Escribir el test de aislamiento con dos empresas.
4. Walter corre las migraciones en el Supabase nuevo.
