# Guía de conexión de canales (WhatsApp, Instagram, Messenger)

Para saberla de memoria. Cada paso dice **dónde**, **qué hacer** y **cómo sé que quedó bien**.
Fuente: la guía de Pfaffen y lo que el código realmente pide (pantallas de Configuración y llamadas a Meta). Los nombres de los botones de Meta cambian seguido: si un botón no está donde dice, buscar el mismo nombre en esa sección. **Todavía no se probó con una empresa nueva**: lo que falle en el primer alta se corrige acá.

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
2. Agregarle los productos **WhatsApp**, **Instagram** y **Messenger**.
3. **Configuración → Básica**: copiar el **secreto de la app**. Va en la pantalla de la empresa (ver sección 6).
4. Business Suite → Configuración → **Usuarios del sistema** → crear uno con rol administrador → asignarle la app, la cuenta de WhatsApp y la página. Generar su **token permanente** (el de 24 horas no sirve).
   - Cómo sé que quedó bien: el token no vence a las 24 horas y, al pegarlo en WhatsApp, la pantalla muestra "Meta confirma: +54…".

## 2. WhatsApp

Datos a juntar:

| Dato | De dónde sale |
|---|---|
| Identificador del número (phone_number_id) | Meta → WhatsApp → Configuración de la API |
| ID de la cuenta de WhatsApp Business (WABA ID) | Business Suite → Cuentas de WhatsApp. **No es el mismo** que el del número |
| Token permanente | Usuario del sistema (sección 1) |

Pasos:

1. En la micro app: Configuración → WhatsApp → pegar identificador del número, WABA ID y token → **Guardar**.
   - Bien: aparece "Meta confirma: +54…" con el número real. Si no aparece, el identificador o el token están mal.
2. Copiar de la pantalla la **dirección del webhook** y el **Verify Token**. En Meta → WhatsApp → Configuración → Webhook → Editar: pegar los dos y suscribirse al campo **messages**.
   - Bien: Meta guarda sin error (si da error, el Verify Token o la dirección no coinciden).
3. **Verificar estado** (botón en la pantalla). Si dice desconectado: poner el **PIN de 6 números** (el viejo si tenía) → **Registrar número**.
   - Si Meta responde **#133006**, el número no está verificado: la pantalla pide un código por SMS o llamada al chip → ingresarlo → **Confirmar código** → volver a registrar.
   - Bien: número verificado, negocio verificado y método de pago asociado, todo en verde.
4. Configurar el horario del bot (por defecto 7 a 23, vale para los tres canales).
5. **Plantillas**: crear las de todos los días con el botón "Crear" y después **Sincronizar**. Meta las aprueba (estado pending → approved). Sin plantilla aprobada no se le puede escribir a nadie pasadas 24 horas.
6. Memoria del bot: mensaje de fuera de horario, mensaje de la mañana y respuestas fijas (horarios, ubicación, formas de pago).

## 3. Instagram

Datos: **Instagram User ID** y **token**. No se sacan a mano.

1. En Meta → app → Instagram → **Login de Instagram para empresas** → "URIs de redirección OAuth válidas": pegar la dirección que muestra la pantalla de Configuración → Instagram debajo del botón (es la dirección de esa misma pantalla).
2. En la micro app: **Conectar con Instagram** e iniciar sesión con la cuenta de la empresa. Pide estos permisos: `instagram_business_basic`, `instagram_business_manage_messages`, `instagram_business_manage_comments` (el botón pide además contenido e insights, que la v1 no usa).
   - Se completan solos el User ID y el token (dura **60 días**).
   - **No usar** el botón "Generar identificador" de Meta: ese token no deja mandar mensajes (error 190 "Cannot parse access token").
3. Webhook: dirección y Verify Token de la pantalla → Meta → Instagram → Configuración → Webhook → suscribirse a **messages** y **comments**.
4. Anotar la fecha: **a los 60 días hay que "Reconectar"**, antes de que venza.
5. Comentarios (opcional): palabra clave en un comentario → mensaje privado automático.

## 4. Messenger

Datos: **Page ID** y **token de la página**.

1. Page ID: página de Facebook → Configuración → ID de la página.
2. Token: Meta → app → Messenger → Configuración de la API → **Generar identificador de acceso** para la página (permanente).
3. Pegar los dos en Configuración → Messenger → Guardar.
4. Webhook: dirección y Verify Token de la pantalla → Meta → app → Messenger → Configuración → Webhook → suscribirse a **messages** (y, según la guía de Pfaffen, **messaging_postbacks** y **message_reads**).
5. **Suscribir la página a la app**: en esa misma pantalla, "Agregar suscripciones" al lado de la página. Sin esto el webhook queda cargado pero no llega nada.
6. Botón **Importar últimos 21 días**: Meta no reenvía lo que llegó antes de conectar. Trae los mensajes como leads, sin contestar.

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

- Los nombres exactos de los menús de Meta (cambian).
- Si la app de Meta puede quedarse en modo desarrollo o tiene que pasar a modo publicado para recibir mensajes de público general. Pfaffen decidió no hacer la revisión de Meta y reporta que los bots responden, pero conviene confirmarlo con una empresa nueva.
- La lista exacta de campos del webhook de Messenger.
