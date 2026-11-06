# Receta para el agente: configurar la app de Meta (6/11/2026)

Guion para que un agente con acceso al navegador (extensión) configure en **Meta for Developers** lo mismo que hoy está andando en Pfaffen. Complementa a `guia-conexion-canales.md` (que es la guía para personas) y la reemplaza como fuente cuando se trabaja con el agente.

**Fuente de lo que está acá:** capturas de la app de Pfaffen, el código de `pfaffenauto-web` (qué campos del webhook se procesan de verdad) y un **relevamiento de solo lectura hecho el 6/11/2026** directo en Meta for Developers (app PfaffenAutos IBot). En ese relevamiento no se leyó ni copió ningún secreto, token ni Verify Token. Lo que no se pudo ver sigue marcado **A COMPLETAR** y no se inventa.

## Reglas del agente (no negociables)

1. **Nunca pedir ni escribir contraseñas, códigos ni tokens en el chat.** El inicio de sesión, los códigos de verificación y el SMS del número los hace una persona.
2. **Los tokens y secretos los copia Walter** del navegador al panel de la empresa. El agente no los lee ni los repite.
3. **Nada en Meta sin el OK de Walter en el momento** (regla del proyecto). Antes de empezar, el agente dice qué va a hacer y espera el OK.
4. **Si una pantalla no se parece a lo descrito, frena y avisa.** Los menús de Meta cambian seguido. No improvisa.
5. **Frena y avisa** ante captcha, aviso de seguridad, pedido de documentos, medio de pago o cualquier cosa que no esté en esta receta.
6. Al terminar, recorre el **Estado esperado** y marca cada línea como "igual" o "distinto".

## Datos de entrada (los pone Walter)

| Dato | De dónde sale |
|---|---|
| Nombre de la empresa y su slug | Panel de superadmin (o el SQL de alta) |
| Dirección del webhook de WhatsApp, de Instagram y de Messenger | Pantalla de Configuración de cada canal de esa empresa |
| Verify Token de cada canal | Misma pantalla (lo copia Walter, no el agente) |
| Dirección de redirección de Instagram (`.../panel/configuracion/instagram`) | Pantalla de Configuración → Instagram |
| Dirección de la política de privacidad y de eliminación de datos | La web de la empresa (o la página provisoria) |

## Estado esperado de la app (así está la de Pfaffen)

### General
- Tipo de app: **Empresa**, creada dentro del Business Manager de la empresa.
- Casos de uso agregados (los 4 de Pfaffen):
  1. **Administrar mensajes y contenido en Instagram**
  2. **Conecta con los clientes a través de WhatsApp** (requiere portafolio empresarial)
  3. **Interactúa con los clientes en Messenger from Meta**
  4. **Administra todo en tu página**
- Estado de publicación: **Publicada** (Publicar → "Publicada"; en "Mis aplicaciones" dice "Modo: Publicada"). Pasó a modo activo el 23/9/2026 (aviso en la Bandeja de entrada de alertas). Es lo que permite recibir mensajes del público: **la app de Pfaffen NO pasó por App Review** (Revisión de la aplicación → "Sin enviar"; hay 18 permisos cargados como "Nuevas solicitudes" que nunca se mandaron).
- Verificación del negocio (Revisión → Verificación): el negocio "Pfaffen Autos 2" figura **Verificado**. Es la base del acceso avanzado.
- "Acciones requeridas": ninguna (el Panel dice "No tienes ningún elemento de acción requerida").
- Roles de la aplicación (Roles de la aplicación → Roles): **2 administradores** (una persona y una cuenta de servicio), **0 desarrolladores**, **0 evaluadores** comunes y **1 "Evaluador de Instagram"** (la cuenta de Instagram de la empresa). El negocio "Pfaffen Autos 2" aparece como el que administra la app; los roles se editan en Meta Business Suite.
- Bandeja de entrada de alertas: 1 alerta, solo informativa ("Cambio del modo de la aplicación", 23 de septiembre). Nada pendiente.
- Configuración básica (Configuración de la aplicación → Información básica):
  - Nombre para mostrar: PfaffenAutos IBot. Espacio de nombres: vacío. **Dominios de la aplicación: vacío.**
  - Correo de contacto: cargado.
  - **URL de la Política de privacidad: cargada** (la página `/privacidad` de la web de la empresa).
  - **URL de las Condiciones del servicio: puesta en `https://www.facebook.com/`** (provisorio, no es una página real de la empresa).
  - **Eliminación de datos de usuario: modo "URL de las instrucciones", con `https://www.facebook.com/`** (provisorio, no es una página real de la empresa).
  - Ícono: cargado (logo de la empresa). **Categoría: "Bots de Messenger para empresas".**
  - Información del delegado de protección de datos: vacía. Plataformas: ninguna agregada.
  - Clave secreta de la app: hay un valor cargado (no se lee).

### WhatsApp → Configuración → Webhook
- URL de devolución de llamada: la del canal WhatsApp de la empresa.
- Identificador de verificación: el Verify Token de esa pantalla.
- Botón **Verificar y guardar**: tiene que guardar sin error.
- Hay un botón "Suprimir suscripción" junto a "Verificar y guardar": **no usarlo**.
- Campos de webhook (lista completa vista en Pfaffen, 33 campos). **Suscritos (10), todos en v26.0:**
  `account_alerts`, `account_review_update`, `account_update`, `calls`, `message_template_quality_update`, `message_template_status_update`, **`messages`**, `phone_number_name_update`, `phone_number_quality_update`, `security`.
- **No suscritos (23)**, todos en v27.0: `account_settings_update`, `automatic_events`, `business_capability_update`, `business_status_update`, `business_username_updates`, `flows`, `group_lifecycle_update`, `group_participants_update`, `group_settings_update`, `group_status_update`, `history`, `message_echoes`, `message_template_components_update`, `messaging_handovers`, `partner_solutions`, `payment_configuration_update`, `smb_app_state_sync`, `smb_message_echoes`, `standby`, `template_category_update`, `template_correct_category_detection`, `tracking_events`, `user_preferences`.
- **Obligatorio para que funcione:** `messages` suscrito. El código solo procesa ese campo de WhatsApp (`field !== "messages"` se ignora). Los demás suscritos no hacen falta para la v1; sirven para avisos de plantillas, calidad del número y alertas de cuenta.
- Versiones: Meta marca v26.0 en los campos suscritos y v27.0 en los no suscritos. Dejar la que Meta propone por defecto.
- Otros datos de la pantalla (WhatsApp → Configuración): "Identificador permanente" (solo enlace a cómo crearlo), "Números de teléfono" (en Pfaffen: 1 número de producción y 1 de prueba), "Cuenta de prueba" y "Eliminar tu negocio" (**no tocar**).
- Permisos agregados al caso de uso (Permisos y funciones, estado "Listo para prueba"): `whatsapp_business_messaging`, `whatsapp_business_management`, `business_management`, `public_profile`. Sin agregar: `email`, `manage_app_solution`, `whatsapp_business_manage_events`.

### Instagram
- Caso de uso Instagram → Personalizar → **Login de Instagram para empresas** → "URIs de redirección OAuth válidas": la dirección de redirección de la empresa.
- Webhook (misma pantalla, sección "3. Configura los webhooks"): dirección y Verify Token de la empresa. Dice "Para recibir webhooks, tu aplicación debe tener el estado publicada". **Suscritos en Pfaffen (v26.0):** `comments`, `live_comments`, `message_edit`, `message_reactions`, `messages`, `messaging_postbacks`, `messaging_referral`, `messaging_seen`. **No suscritos (v27.0):** `messaging_handover`, `messaging_optins`, `standby`. Para la v1 hacen falta `messages` y `comments`; el código también atiende `message_reactions`, `messaging_seen` y `message_edit`, que en Pfaffen están suscritos.
- Permisos agregados al caso de uso (Permisos y funciones, "Listo para prueba"): `instagram_business_basic`, `instagram_business_manage_messages`, `instagram_business_manage_comments`, `instagram_business_content_publish`, `instagram_business_manage_insights`, más `business_management` y la función Human Agent. El resto (`instagram_basic`, `instagram_manage_messages`, `ads_management`, `ads_read`, `email`, etc.) figura "Añadir a la revisión de la aplicación" (sin agregar). El botón "Conectar con Instagram" de Pfaffen pide los cinco `instagram_business_*`. Para la v1 de inmobiliaria alcanzan los tres primeros (decidir con Walter).
- Pantalla "Configuración de la API con el inicio de sesión de Instagram" (es la ruta que usa el panel): tiene un **ID de app de Instagram propio, distinto del ID de la app de Meta** ("PfaffenAutos IBot - IG") y su propia clave secreta de Instagram (oculta, no se lee). **Ese ID es el que hoy está escrito fijo en el código** (ver `guia-conexion-canales.md`, sección 6): por empresa nueva habrá un ID distinto.
- URIs de redirección OAuth: en esa pantalla, sección "4. Configura un inicio de sesión empresarial de Instagram" → botón **"Configuración de inicio de sesión de empresa"** → campo "URI de redirección de OAuth". En Pfaffen hay **una sola**: `https://pfaffenauto-web.vercel.app/panel/configuracion/instagram`. Los campos "URL de devolución de llamada de desautorización" y "URL de solicitud de eliminación de datos" están vacíos. Meta avisa que hay que completarlos antes de enviar a revisión.
- Sección "2. Genera identificadores de acceso" (cuentas conectadas y botón de generar): se deja sin abrir; es donde está el botón "Generar identificador" que **no hay que usar**.
- Existe además la pantalla "API setup with Unified login" (configuración nueva, recomendada por Meta; la "con inicio de sesión de Instagram" figura como heredada pero sigue funcionando). Pfaffen **no tiene configuraciones creadas ahí** ("No se han encontrado configuraciones compatibles"). La URL de redirección que muestra es `https://www.pfaffencars.com/api/panel/messenger/oauth/callback`. No se usa en la v1.
- **No usar** el botón "Generar identificador" de Meta: ese token no deja mandar mensajes (error 190). El token sale del botón Conectar del panel y dura 60 días.

### Messenger
- Caso de uso Messenger → "Configuración de Messenger API": sección "1. Configurar webhooks" con la dirección y el Verify Token de la empresa. La lista tiene 71 campos; **en Pfaffen solo hay 3 suscritos, todos v26.0: `messages`, `message_echoes` y `message_reads`.** `messaging_postbacks`, `messaging_optins`, `messaging_handovers`, `message_reactions` y `messaging_referrals` están **sin suscribir**. (La guía de Pfaffen decía `messaging_postbacks` y `message_reads`; en pantalla solo `message_reads` está suscrito. El código procesa `messaging_seen`, que no aparece en esta lista: el equivalente es `message_reads`.)
- Sección "2. Generar identificadores de acceso": tabla "Nombre de página / Suscripción a webhook / Identificador". En Pfaffen hay **1 página** ("Pfaffen Cars") suscrita a `message_echoes`, `message_reads` y `messages`. Botones: "Generar" (token), "Suprimir página de la aplicación" y "Añadir página". **Suscribir la página a la app** se hace acá (lo que la guía llama "Agregar suscripciones"). Sin esto el webhook queda cargado y no llega nada. No se tocó ningún botón.
- Sección "3. Completar la revisión de la aplicación": Meta pide solicitar `pages_messaging` por revisión. En Pfaffen no se pidió y los mensajes igual andan (ver Estado de publicación).
- Permisos agregados al caso de uso Messenger ("Listo para prueba"): `pages_messaging`, `pages_manage_metadata`, `pages_read_engagement`, `pages_show_list`, `pages_utility_messaging`, `business_management`, `public_profile` y la función Human Agent.
- Caso de uso "Administra todo en tu página" (Pages API): permisos agregados `pages_manage_metadata`, `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`, `business_management`, `public_profile`. Sin agregar: `pages_manage_engagement`, `pages_read_user_content`, `read_insights`, `email`.
- Inicio de sesión con Facebook para empresas: en Pfaffen hay **1 "ajuste"** (configuración) llamado "CRM Pagina Facebook": variación General, token de acceso de usuario, permisos `business_management`, `pages_manage_metadata`, `pages_manage_posts`, `pages_messaging`, `pages_read_engagement`, `pages_show_list`. Es lo que usa el botón "Conectar con Facebook" del panel. Se crea en Inicio de sesión con Facebook para empresas → Ajustes → "Crear ajuste".
- URIs de redirección OAuth válidas (Inicio de sesión con Facebook para empresas → Configuración): **una sola**, `https://www.pfaffencars.com/api/panel/messenger/oauth/callback`. Con HTTPS obligatorio activado y OAuth web activado; "Forzar reautenticación" y "navegador integrado" en No. Dominios del SDK de JavaScript, URL de retirada de autorización y URL de eliminación de datos: vacíos.
- El token de página lo da el botón "Conectar con Facebook" del panel, o se pega a mano.

## Pasos (en orden)

Cada paso: **dónde**, **qué hace**, **cómo sé que quedó bien**. Lo que dice "PERSONA" lo hace Walter o el cliente.

1. **PERSONA:** inicia sesión en la cuenta de la empresa en Meta for Developers (con el cliente delante o con acceso de administrador ya dado). El agente no ve la clave.
2. Crear la app: tipo Empresa, dentro del Business Manager de la empresa. *Bien:* la app aparece en "Mis aplicaciones" con su identificador.
3. Agregar los 4 casos de uso del Estado esperado. *Bien:* el Panel muestra los 4 en "Casos de uso en esta aplicación".
4. **PERSONA:** copiar el **secreto de la app** (Configuración → Básica) y pegarlo en el panel de la empresa. El agente no lo lee.
5. Configuración de la aplicación → Información básica: cargar la URL de privacidad, la categoría ("Bots de Messenger para empresas" en Pfaffen) y el ícono. Pfaffen dejó Condiciones del servicio y eliminación de datos con `https://www.facebook.com/` provisorio; para una empresa nueva conviene poner páginas reales (decidir con Walter).
6. WhatsApp → Configuración: pegar la dirección y el Verify Token, **Verificar y guardar**, suscribir `messages` (y los demás del Estado esperado). *Bien:* guarda sin error.
7. **PERSONA:** crear el usuario del sistema, asignarle la app, la cuenta de WhatsApp y la página, y generar el token **permanente**. Pegarlo en el panel. *Bien:* el panel muestra "Meta confirma: +54…".
8. Instagram → Login de Instagram para empresas: cargar la dirección de redirección. Webhook: dirección, Verify Token, suscribir `messages` y `comments`.
9. **PERSONA:** apretar "Conectar con Instagram" en el panel e iniciar sesión con la cuenta de la empresa. *Bien:* el panel muestra "Conectado" y completa solo el ID.
10. Messenger → Configuración: webhook, suscribir campos, y "Agregar suscripciones" a la página.
11. **Publicar** la app (pasarla a modo Publicada). La pantalla Publicar de Pfaffen (ya publicada) solo lista los casos de uso y tiene un botón "Anular publicación" (**no tocar**). **A COMPLETAR:** qué requisitos muestra Meta antes de publicar una app nueva; no se pudo ver porque la de Pfaffen ya está publicada. Probable: privacidad cargada, categoría e ícono.
12. Recorrer el **Estado esperado** y entregar el informe "igual / distinto".

## Atajos de navegación (direcciones directas)

Visto en la app de Pfaffen. El agente puede ir directo en vez de buscar los menús; si la dirección no abre la pantalla esperada, vuelve a navegar por los menús y lo anota.

| Pantalla | Dirección (reemplazar `APP_ID` y `BUSINESS_ID` por los de la empresa) |
|---|---|
| WhatsApp → Configuración (webhook) | `https://developers.facebook.com/apps/APP_ID/use_cases/customize/wa-settings/?use_case_enum=WHATSAPP_BUSINESS_MESSAGING&selected_tab=wa-settings&product_route=whatsapp-business&business_id=BUSINESS_ID` |

Direcciones relevadas el 6/11/2026 (mismos `APP_ID` y `BUSINESS_ID`; agregar `?business_id=BUSINESS_ID` a las que no lo traen). Las que dicen "por menú" no abrieron por dirección directa: se llega con clics.

| Pantalla | Dirección |
|---|---|
| Panel | `https://developers.facebook.com/apps/APP_ID/dashboard/?business_id=BUSINESS_ID` |
| Casos de uso (lista) | `.../apps/APP_ID/use_cases/?business_id=BUSINESS_ID` |
| Instagram → Permisos y funciones | `.../apps/APP_ID/use_cases/customize/permissions/?use_case_enum=INSTAGRAM_BUSINESS&selected_tab=permissions&product_route=use_cases&business_id=BUSINESS_ID` |
| Instagram → Configuración de la API con el inicio de sesión de Instagram (webhook y redirección) | `.../apps/APP_ID/use_cases/customize/API-Setup/?use_case_enum=INSTAGRAM_BUSINESS&selected_tab=API-Setup&product_route=instagram-business&business_id=BUSINESS_ID` |
| WhatsApp → Configuración de la API | `.../apps/APP_ID/use_cases/customize/wa-dev-console/?use_case_enum=WHATSAPP_BUSINESS_MESSAGING&selected_tab=wa-dev-console&product_route=whatsapp-business&business_id=BUSINESS_ID` |
| WhatsApp → Permisos y funciones | `.../apps/APP_ID/use_cases/customize/permissions/?use_case_enum=WHATSAPP_BUSINESS_MESSAGING&selected_tab=permissions&product_route=use_cases&business_id=BUSINESS_ID` |
| Messenger → Configuración de Messenger API | `.../apps/APP_ID/use_cases/customize/messenger_api_settings/?use_case_enum=FACEBOOK_MESSAGING&business_id=BUSINESS_ID&selected_tab=messenger_api_settings&product_route=messenger` |
| Messenger → Permisos y funciones | `.../apps/APP_ID/use_cases/customize/?use_case_enum=FACEBOOK_MESSAGING&business_id=BUSINESS_ID&selected_tab=permissions&product_route=use_cases` |
| Página (Pages API) → Permisos | `.../apps/APP_ID/use_cases/customize/?use_case_enum=PAGES_API&business_id=BUSINESS_ID&selected_tab=permissions&product_route=use_cases` |
| Inicio de sesión con Facebook para empresas → Ajustes | `.../apps/APP_ID/business-login/configurations/?business_id=BUSINESS_ID` |
| Inicio de sesión con Facebook para empresas → Configuración | `.../apps/APP_ID/business-login/settings/?business_id=BUSINESS_ID` |
| Revisión → Verificación | `.../apps/APP_ID/verification/?business_id=BUSINESS_ID` |
| Revisión → Revisión de la aplicación | `.../apps/APP_ID/app-review/?business_id=BUSINESS_ID` |
| Publicar | `.../apps/APP_ID/go_live/?business_id=BUSINESS_ID` (con guion bajo; `go-live` no existe) |
| Configuración de la aplicación → Información básica | `.../apps/APP_ID/settings/basic/?business_id=BUSINESS_ID` |
| Roles de la aplicación → Roles | `.../apps/APP_ID/roles/roles/?business_id=BUSINESS_ID` |
| Bandeja de entrada de alertas | `.../apps/APP_ID/alerts/inbox/?business_id=BUSINESS_ID` |
| Instagram → Permisos (variante) `selected_tab=Permissions-and-Features` | no abre contenido: por menú |
| `.../fb-login/settings/` y `.../app-review/permissions/` | redirigen al Panel / lista de casos de uso: no usar |

## Para que sea repetible

- Si algo se corrige en la primera conexión real, se corrige **acá** y en `guia-conexion-canales.md`, no solo en el chat.
- Después de cada alta, anotar en la ficha de la empresa (sin contraseñas): quién es dueño de cada cuenta, la fecha de conexión y el vencimiento del token de Instagram.

## Qué falta para completar esta receta

Relevado el 6/11/2026 (ver las dos secciones de abajo). Todavía **A COMPLETAR**:

1. Qué requisitos muestra Meta en Publicar al publicar una app **nueva** (la de Pfaffen ya está publicada).
2. Instagram → sección "2. Genera identificadores de acceso" y el estado del webhook de Instagram "Verificar y guardar": no se abrieron para no arriesgar tocar tokens. Verlo en el primer alta real, con Walter mirando.
3. Pantalla de WhatsApp → Configuración → "Administrar números de teléfono" y "Identificador permanente": no se abrieron.
4. Estado exacto de dos interruptores de Inicio de sesión con Facebook para empresas → Configuración (modo estricto de URI y SDK de JavaScript): la lectura por código no fue concluyente.
5. Pfaffen no pasó App Review: falta probar con una empresa nueva que los mensajes de público general lleguen con la app en modo Publicada sin revisión. **Decisión de Walter (6/11/2026): por ahora no se prueba con una empresa nueva; se replica lo que anda en Pfaffen y se corrige en el primer alta real.**

## Diferencias entre lo que decía la receta y lo que se vio

1. **WhatsApp suscritos:** la receta tenía `calls` y 3 `account_*` como suscritos y el resto "A COMPLETAR". Es cierto; además están suscritos `message_template_quality_update`, `message_template_status_update`, `phone_number_name_update`, `phone_number_quality_update` y `security`. **`messages` está suscrito.**
2. **Versiones del webhook:** los suscritos van en v26.0 y los no suscritos muestran v27.0. No es que "Pfaffen use v26 y v27 según el campo": v27 es solo lo que muestra Meta como disponible en los que no están suscritos.
3. **Instagram: la pantalla que usa el panel no es la que decía la guía.** La guía habla de "Login de Instagram para empresas". Hoy hay dos pantallas: "API setup with Unified login" (nueva, sin configuraciones creadas en Pfaffen) y "Configuración de la API con el inicio de sesión de Instagram" (marcada como heredada, **es la que Pfaffen usa**: tiene el ID de app de Instagram, el webhook y la redirección).
4. **URIs de redirección de Instagram:** no están en una lista de "URIs de redirección OAuth válidas" a la vista, sino adentro de un cuadro que abre el botón "Configuración de inicio de sesión de empresa". La de Pfaffen apunta a `pfaffenauto-web.vercel.app/panel/configuracion/instagram` (la dirección de la micro app, como decía la guía).
5. **Webhook de Instagram:** la receta decía solo `messages` y `comments` y "A COMPLETAR" el resto. En Pfaffen hay 8 suscritos: `comments`, `live_comments`, `message_edit`, `message_reactions`, `messages`, `messaging_postbacks`, `messaging_referral`, `messaging_seen`.
6. **Messenger:** la guía decía `messages`, `messaging_postbacks` y `message_reads`. En pantalla solo están suscritos `messages`, `message_echoes` y `message_reads`; **`messaging_postbacks` no está suscrito.** Además `messaging_seen` no existe como campo en esa lista (el nombre es `message_reads`).
7. **Páginas suscritas de Messenger:** hay una sola ("Pfaffen Cars") y la suscripción se ve en la sección "2. Generar identificadores de acceso" de esa pantalla, no en un botón aparte "Agregar suscripciones". El botón se llama "Añadir página".
8. **Estado Publicada sin App Review:** confirmado. Revisión de la aplicación dice "Sin enviar" y tiene 18 permisos como "Nuevas solicitudes" sin mandar. Pero **el negocio está Verificado** (Revisión → Verificación); la receta no lo mencionaba y probablemente influye.
9. **Roles:** no son "al menos dos administradores personas": son 2 administradores (una persona y una cuenta de servicio), 0 desarrolladores y un "Evaluador de Instagram" (la cuenta de Instagram de la empresa; Meta pide ese rol para generar tokens de Instagram).
10. **Configuración básica:** Condiciones del servicio y eliminación de datos tienen `https://www.facebook.com/` provisorio. Dominios vacío. La receta suponía algo más completo.
11. **Inicio de sesión con Facebook para empresas:** la receta no lo mencionaba. Tiene 1 ajuste ("CRM Pagina Facebook") y una URI de redirección (`pfaffencars.com/.../messenger/oauth/callback`); es la ruta del botón "Conectar con Facebook". Esa URI es de otro dominio que la de Instagram: ojo al copiar.
12. **Casos de uso y permisos:** los 4 casos coinciden. Hay permisos agregados que la receta no listaba (por ejemplo `pages_manage_posts`, `pages_utility_messaging`, `public_profile`, `business_management`).
13. **Existe una segunda app** en la cuenta, "Bot_wpp" (en desarrollo, empresa "PfaffenCars"). No se abrió ni se tocó. No forma parte de esta receta.
14. **Atajo de WhatsApp → Configuración:** el atajo de la receta abre bien, pero el contenido tarda hasta ~15 segundos en aparecer.

## Pantallas y nombres reales de los menús

Menú lateral de la app (lo que se ve hoy): **Panel**, **Acciones requeridas**, **Casos de uso**, **Inicio de sesión con Facebook para empresas** (Configuración, Inicio rápido, Ajustes, Plantillas), **Revisión** (Tests, Verificación, Revisión de la aplicación), **Publicar**; abajo: **Configuración de la aplicación** (Información básica, Opciones avanzadas), **Roles de la aplicación** (Roles, Usuarios de prueba), **Bandeja de entrada de alertas**. Arriba: Mis aplicaciones, Acciones necesarias, Documentos, Herramientas, Ayuda.

| Paso de la receta | Recorrido exacto |
|---|---|
| Ver casos de uso agregados | Panel → "Casos de uso en esta aplicación"; o menú Casos de uso |
| Permisos de un caso de uso | Casos de uso → botón "Personalizar" del caso → pestaña "Permisos y funciones" (columnas: Llamadas a la API, Estado, Acción; estado "Listo para prueba" = agregado; "Añadir a la revisión de la aplicación" = no agregado) |
| WhatsApp: webhook | Casos de uso → Conecta con los clientes a través de WhatsApp → Personalizar → pestaña "Configuración" → sección "Webhook" (URL de devolución de llamada, Identificador de verificación, "Verificar y guardar", "Campos de webhook") |
| WhatsApp: datos de la API | Misma pantalla → pestaña "Configuración de la API": "Identificador de acceso" (token temporal, botón "Generar identificador de acceso"), "Identificador del número de teléfono", "Identificador de la cuenta de mensajes" (es el WABA ID) |
| Instagram: webhook y redirección | Casos de uso → Administrar mensajes y contenido en Instagram → Personalizar → pestaña "Configuración de la API con el inicio de sesión de Instagram" → secciones "3. Configura los webhooks" y "4. Configura un inicio de sesión empresarial de Instagram" → botón "Configuración de inicio de sesión de empresa" |
| Instagram: ID de app de Instagram | Misma pestaña, arriba ("Identificador de la aplicación de Instagram") |
| Messenger: webhook y páginas | Casos de uso → Interactúa con los clientes en Messenger from Meta → Personalizar → "Configuración de Messenger API" → "1. Configurar webhooks" y "2. Generar identificadores de acceso" (botón "Ver más" desplegable en cada sección) |
| Facebook para empresas: redirecciones | Inicio de sesión con Facebook para empresas → Configuración → "URI de redireccionamiento de OAuth válidos" |
| Facebook para empresas: permisos del token | Inicio de sesión con Facebook para empresas → Ajustes → botón "Crear ajuste" / desplegable de cada ajuste |
| Verificación del negocio | Revisión → Verificación |
| Estado de App Review | Revisión → Revisión de la aplicación ("Sin enviar" / "Nuevas solicitudes") |
| Estado de publicación | Publicar (etiqueta "Publicada" junto al menú); botón "Anular publicación" (no tocar) |
| Datos básicos (privacidad, categoría, ícono) | Configuración de la aplicación → Información básica |
| Roles | Roles de la aplicación → Roles (filtros: Todos los roles, Administradores, Desarrolladores, Evaluadores; "Editar roles en Meta Business Suite") |
| Alertas | Bandeja de entrada de alertas (pestañas Bandeja de entrada / Archivadas) |

Notas de uso de la interfaz (para que el agente no se pierda):
- Muchos menús no son enlaces sino botones: hay que hacer clic, no navegar por dirección.
- Las secciones se despliegan con "Ver más" o con un chevron a la derecha; en pantalla angosta el chevron queda fuera de vista. Conviene una ventana ancha (≈1400 px).
- El texto de la pantalla no incluye los valores de los campos; para ver una dirección hay que mirarla en la captura. **Los campos de secreto, token y Verify Token aparecen enmascarados** (puntos); no apretar "Mostrar".
- Botones que modifican y que **no** se tocaron: Crear nueva configuración, Verificar y guardar, Test, Suprimir suscripción, Generar, Generar identificador de acceso, Suprimir página de la aplicación, Añadir página, Anular publicación, Eliminar (negocio), Guardar cambios, Registrar una nueva URL de redirección.
- Un cuadro de "Configuración de inicio de sesión de empresa" se abrió solo para leerlo y se cerró con "Cancelar".

## Qué puede hacer el agente solo y qué necesita una persona

**El agente probablemente pueda solo** (con el OK de Walter en cada paso, y verificando en pantalla):
- Leer y comparar el estado de una app contra el Estado esperado ("igual / distinto"). Es lo que se hizo acá y salió bien.
- Pegar la dirección del webhook y el Verify Token que la persona le indique, **suscribir los campos** (`messages`, `comments`, etc.) y poner las versiones. El Verify Token lo copia la persona.
- Cargar la URI de redirección de Instagram y la de Facebook.
- Agregar los casos de uso y los permisos de la lista.
- Cargar privacidad, categoría, ícono y páginas de eliminación de datos (con los archivos y direcciones que le den).
- Suscribir la página a la app en Messenger.

**Seguro necesita a una persona:**
- Iniciar sesión, códigos de verificación y captcha. Verificar la identidad o el negocio con papeles.
- Copiar el secreto de la app, el token permanente del usuario del sistema y el Verify Token (por la regla de no leer secretos).
- Crear el usuario del sistema, asignarle activos y generar su token en Business Suite.
- Medio de pago, número de teléfono (SMS/PIN) y verificación del negocio.
- "Conectar con Instagram" / "Conectar con Facebook" en el panel: inicio de sesión de la cuenta de la empresa.
- Agregar roles (Evaluador de Instagram) y aceptar la invitación desde la cuenta de Instagram.
- Cualquier cambio de modo de la app (publicar / anular publicación), y decidir qué hacer ante un aviso o pedido inesperado de Meta.
- La confirmación final con un celular que no sea de la empresa.
