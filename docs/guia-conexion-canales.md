# Guía de conexión de canales (WhatsApp, Instagram, Messenger)

Para saberla de memoria. Cada paso dice **dónde**, **qué hacer** y **cómo sé que quedó bien**.
Fuente: la guía de Pfaffen, lo que el código realmente pide y un **relevamiento de solo lectura de la app de Meta de Pfaffen hecho el 6/11/2026** (el detalle, con los recorridos exactos de menús y direcciones, está en `receta-agente-meta.md`). Los nombres de los botones de Meta cambian seguido: si un botón no está donde dice, buscar el mismo nombre en esa sección. **Decisión de Walter (6/11/2026): por ahora no se prueba con una empresa nueva; se replica lo que anda en Pfaffen.** Lo que falle en el primer alta real se corrige acá.

## La idea en una línea

Cuenta de Meta de la empresa → una app de Meta (WhatsApp + Instagram + Messenger) → de ahí salen **4 datos por canal** → se pegan en la pantalla del canal → se pega la **dirección del webhook** en Meta → prueba con un celular de afuera.

## 0. Antes de tocar nada (una vez por empresa)

- [ ] Chip del número de WhatsApp en un celular que reciba SMS o llamadas. Número **libre**: sin la app de WhatsApp y sin otro proveedor (Twilio, etc.). Si tenía PIN de dos pasos, conseguirlo.
- [ ] Administrador comercial de Facebook (Business Suite) a nombre de la empresa, **con dos administradores**.
- [ ] Empresa verificada en Meta (con papeles). Sin esto hay tope de mensajes y a veces no salen respuestas.
- [ ] Medio de pago cargado para WhatsApp (Business Suite → Facturación y pagos). Sin esto no salen las plantillas.
- [ ] Para Instagram y Messenger: página de Facebook e Instagram profesional, vinculados entre sí y dentro del mismo administrador comercial.
- [ ] En el Instagram del celular: Configuración → Mensajes → Herramientas conectadas → **permitir el acceso a los mensajes**. Apagado = no llega nada.

## 1. La app en Meta (una por empresa, en su propia cuenta)

1. developers.facebook.com/apps → **Crear app** → tipo **Empresa**, dentro del administrador comercial de la empresa.
2. Agregarle los **casos de uso** (así se llaman hoy los productos, menú **Casos de uso**): **Administrar mensajes y contenido en Instagram**, **Conecta con los clientes a través de WhatsApp**, **Interactúa con los clientes en Messenger from Meta** y **Administra todo en tu página**. Los permisos de cada uno se ven en Personalizar → Permisos y funciones.
3. **Configuración de la aplicación → Información básica**: copiar el **secreto de la app** (botón "Mostrar"). Va en la pantalla de la empresa (ver sección 6). Cargar ahí también la **URL de la política de privacidad**, la **categoría** (Pfaffen: "Bots de Messenger para empresas") y el **ícono**. Pfaffen dejó Condiciones del servicio y eliminación de datos con `https://www.facebook.com/` provisorio; conviene páginas reales.
   - **Modo de la app:** Meta solo manda los webhooks si la app está **Publicada** (menú **Publicar**). Pfaffen está Publicada desde el 23/9/2026 y **nunca envió nada a App Review** (Revisión de la aplicación dice "Sin enviar"); su negocio sí está **Verificado** (Revisión → Verificación). Funciona así hoy.
   - **Roles** (Roles de la aplicación → Roles): Pfaffen tiene 2 administradores y un **"Evaluador de Instagram"** (la cuenta de Instagram de la empresa). Meta pide ese rol para generar tokens de Instagram.
4. Business Suite → Configuración → **Usuarios del sistema** → crear uno con rol administrador → asignarle la app, la cuenta de WhatsApp y la página. Generar su **token permanente** (el de 24 horas no sirve).
   - Cómo sé que quedó bien: el token no vence a las 24 horas y, al pegarlo en WhatsApp, la pantalla muestra "Meta confirma: +54…".

## 2. WhatsApp

Datos a juntar:

| Dato | De dónde sale |
|---|---|
| Identificador del número (phone_number_id) | Meta → Casos de uso → WhatsApp → Personalizar → **Configuración de la API** → "Identificador del número de teléfono" |
| ID de la cuenta de WhatsApp Business (WABA ID) | Misma pantalla: "Identificador de la cuenta de mensajes" (también en Business Suite → Cuentas de WhatsApp). **No es el mismo** que el del número |
| Token permanente | Usuario del sistema (sección 1) |

Pasos:

1. En la micro app: Configuración → WhatsApp → pegar identificador del número, WABA ID y token → **Guardar**.
   - Bien: aparece "Meta confirma: +54…" con el número real. Si no aparece, el identificador o el token están mal.
2. Copiar de la pantalla la **dirección del webhook** y el **Verify Token**. En Meta → Casos de uso → WhatsApp → Personalizar → pestaña **Configuración** → sección **Webhook**: pegar los dos en "URL de devolución de llamada" e "Identificador de verificación", apretar **Verificar y guardar** y suscribirse al campo **messages**.
   - Bien: Meta guarda sin error (si da error, el Verify Token o la dirección no coinciden).
   - **Pfaffen tiene suscritos (v26.0):** `messages` (el único que procesa el código), `account_alerts`, `account_review_update`, `account_update`, `calls`, `message_template_quality_update`, `message_template_status_update`, `phone_number_name_update`, `phone_number_quality_update` y `security`. Los otros 23 campos de la lista están sin suscribir. Para replicar a Pfaffen se suscriben esos 10.
   - No usar "Suprimir suscripción".
3. **Verificar estado** (botón en la pantalla). Si dice desconectado: poner el **PIN de 6 números** (el viejo si tenía) → **Registrar número**.
   - Si Meta responde **#133006**, el número no está verificado: la pantalla pide un código por SMS o llamada al chip → ingresarlo → **Confirmar código** → volver a registrar.
   - Bien: número verificado, negocio verificado y método de pago asociado, todo en verde.
4. Configurar el horario del bot (por defecto 7 a 23, vale para los tres canales).
5. **Plantillas**: crear las de todos los días con el botón "Crear" y después **Sincronizar**. Meta las aprueba (estado pending → approved). Sin plantilla aprobada no se le puede escribir a nadie pasadas 24 horas.
6. Memoria del bot: mensaje de fuera de horario, mensaje de la mañana y respuestas fijas (horarios, ubicación, formas de pago).

## 3. Instagram

Datos: **Instagram User ID** y **token**. No se sacan a mano.

1. En Meta → Casos de uso → Administrar mensajes y contenido en Instagram → Personalizar → pestaña **"Configuración de la API con el inicio de sesión de Instagram"** (Meta la marca como "heredada" pero es la que usa Pfaffen y funciona; la otra, "API setup with Unified login", no tiene configuraciones creadas en Pfaffen y no se usa). En la sección **"4. Configura un inicio de sesión empresarial de Instagram"** apretar **"Configuración de inicio de sesión de empresa"** y en **"URI de redirección de OAuth"** pegar la dirección que muestra la pantalla de Configuración → Instagram de la micro app, debajo del botón (en Pfaffen hay una sola: la de `/panel/configuracion/instagram`). Las URL de desautorización y de eliminación de datos quedan vacías en Pfaffen.
   - Esa misma pestaña muestra el **ID de la app de Instagram** (es distinto del ID de la app de Meta; es el que hoy está fijo en el código, ver sección 6) y su clave secreta de Instagram.
   - El rol **Evaluador de Instagram** de la cuenta de la empresa tiene que estar en Roles de la aplicación (Meta lo pide para generar tokens).
2. En la micro app: **Conectar con Instagram** e iniciar sesión con la cuenta de la empresa. Pide estos permisos: `instagram_business_basic`, `instagram_business_manage_messages`, `instagram_business_manage_comments` (el botón pide además contenido e insights, que la v1 no usa).
   - Se completan solos el User ID y el token (dura **60 días**).
   - **No usar** el botón "Generar identificador" de Meta: ese token no deja mandar mensajes (error 190 "Cannot parse access token").
3. Webhook: dirección y Verify Token de la pantalla → misma pestaña, sección **"3. Configura los webhooks"** → suscribirse a **messages** y **comments**. **Pfaffen tiene suscritos (v26.0):** `comments`, `live_comments`, `message_edit`, `message_reactions`, `messages`, `messaging_postbacks`, `messaging_referral` y `messaging_seen`; sin suscribir: `messaging_handover`, `messaging_optins` y `standby`. El código atiende `messages`, `comments`, `message_reactions`, `messaging_seen` y `message_edit`.
4. Anotar la fecha: **a los 60 días hay que "Reconectar"**, antes de que venza.
5. Comentarios (opcional): palabra clave en un comentario → mensaje privado automático.

## 4. Messenger

Datos: **Page ID** y **token de la página**.

1. Page ID: página de Facebook → Configuración → ID de la página.
2. Token: o el botón **"Conectar con Facebook"** del panel (usa el ajuste de **Inicio de sesión con Facebook para empresas**, ver abajo), o Meta → Casos de uso → Messenger → Personalizar → **Configuración de Messenger API** → sección "2. Generar identificadores de acceso" → **Generar** para la página.
3. Pegar los dos en Configuración → Messenger → Guardar.
4. Webhook: dirección y Verify Token de la pantalla → misma pantalla de Meta, sección **"1. Configurar webhooks"** → suscribirse a **messages**. **Pfaffen tiene suscritos solo 3 (v26.0): `messages`, `message_echoes` y `message_reads`.** `messaging_postbacks` **no** está suscrito (la guía vieja decía que sí).
5. **Suscribir la página a la app**: en la sección **"2. Generar identificadores de acceso"** de esa misma pantalla, con el botón **"Añadir página"**. La tabla muestra, por página, a qué campos está suscrita (en Pfaffen: "Pfaffen Cars" con `message_echoes`, `message_reads` y `messages`). Sin esto el webhook queda cargado pero no llega nada.
6. **Inicio de sesión con Facebook para empresas** (lo usa el botón "Conectar con Facebook"): menú **Inicio de sesión con Facebook para empresas → Ajustes** → un ajuste con variación General, token de acceso de usuario y los permisos `business_management`, `pages_manage_metadata`, `pages_manage_posts`, `pages_messaging`, `pages_read_engagement`, `pages_show_list` (en Pfaffen se llama "CRM Pagina Facebook"). En **Configuración**, "URI de redireccionamiento de OAuth válidos": la dirección de retorno de Messenger de la micro app (una sola en Pfaffen, y **es de otro dominio que la de Instagram**: no copiar una por la otra). Con HTTPS obligatorio.
7. Botón **Importar últimos 21 días**: Meta no reenvía lo que llegó antes de conectar. Trae los mensajes como leads, sin contestar.

## 5. Prueba final (con un celular que no sea de la empresa)

- [ ] WhatsApp: el mensaje entra a la micro app y el bot contesta.
- [ ] WhatsApp: contestar desde la micro app y que llegue; mandar foto y audio.
- [ ] Instagram: un mensaje privado y un comentario entran.
- [ ] Messenger: un mensaje entra y la respuesta llega.
- [ ] Cada conversación aparece en Leads con su asesor.
- [ ] Pedir hablar con una persona: el bot deriva y llega el aviso.
- [ ] Plantilla enviada a un cliente con más de 24 horas sin escribir.

## 6. Dónde se carga cada cosa en la micro app

- Secreto de la app de Meta: **sin el no entra ningún mensaje** (la firma no se puede verificar). En Pfaffen es una variable de Vercel; en la micro app va **por empresa, cifrado, en la pantalla de la empresa** (se construye en la pasada 3; hoy sigue siendo una sola variable).
- ID de la app de Instagram: hoy está escrito fijo en el código; también pasa a ser por empresa en la pasada 3. **Hasta entonces no se puede conectar una segunda empresa.**
- Tokens: se guardan cifrados con `ENCRYPTION_KEY`. Si esa clave se pierde, todas las empresas tienen que volver a pegar sus tokens.

## 7. Si algo falla

| Síntoma | Causa más probable |
|---|---|
| No entra ningún mensaje de ningún canal | Falta o está mal el secreto de la app (firma rechazada). Revisar Errores del sistema |
| Meta no guarda el webhook | Dirección o Verify Token distintos a los de la pantalla (si se regeneró el token, hay que volver a cargarlo en Meta) |
| WhatsApp: no sale ningún mensaje | Número desconectado (registrar con PIN), empresa no verificada o sin medio de pago (#131042) |
| WhatsApp: #133006 al registrar | El número no está verificado: pedir código por SMS o llamada |
| Plantilla rechazada o no sale | Sin medio de pago, categoría equivocada o sin sincronizar |
| Instagram: error 190 | Token mal generado o vencido (60 días). Reconectar con el botón, no con "Generar identificador" |
| Instagram: no llegan mensajes | Acceso a mensajes apagado en la app del celular, o falta suscribirse a `messages` |
| Messenger: webhook cargado y no llega nada | La página no está suscripta a la app |
| No se puede contestar libre | Pasaron 24 horas del último mensaje del cliente: solo plantillas (en Instagram y Messenger, contestar desde la app del celular) |
| Se perdió el acceso a todo | Había un solo administrador en Meta: siempre dos |

La micro app avisa sola al dueño si algo se corta (revisa los tres canales cada 30 minutos: token vencido, número desconectado, pago, webhooks rechazados).

## 8. Ficha de la empresa (sin contraseñas)

Completar una por empresa: quién es dueño de cada cuenta de Meta, dónde está el chip y quién lo guarda, quiénes son los dos administradores, fecha de conexión de cada canal, **fecha de vencimiento del token de Instagram**, quién tiene acceso a la app.

## Pendiente de verificar en la primera conexión real

Resuelto con el relevamiento del 6/11/2026: los nombres de los menús (están en `receta-agente-meta.md`), la lista de campos del webhook de Messenger y el hecho de que Pfaffen anda **Publicada y sin App Review** (con el negocio verificado).

Sigue pendiente, para el primer alta real (Walter decidió el 6/11/2026 no probar con una empresa nueva por ahora):
- Confirmar que una app nueva, Publicada y sin App Review, recibe mensajes del público general como la de Pfaffen.
- Qué requisitos muestra Meta en **Publicar** al publicar una app nueva (la de Pfaffen ya estaba publicada).
- Instagram → sección "2. Genera identificadores de acceso" y el estado del webhook de Instagram: no se abrieron en el relevamiento para no tocar tokens.
