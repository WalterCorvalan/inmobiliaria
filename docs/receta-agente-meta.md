# Receta para el agente: configurar la app de Meta (6/11/2026)

Guion para que un agente con acceso al navegador (extensión) configure en **Meta for Developers** lo mismo que hoy está andando en Pfaffen. Complementa a `guia-conexion-canales.md` (que es la guía para personas) y la reemplaza como fuente cuando se trabaja con el agente.

**Fuente de lo que está acá:** capturas de la app de Pfaffen (panel, casos de uso, webhook de WhatsApp) y el código de `pfaffenauto-web` (qué campos del webhook se procesan de verdad). Todo lo marcado **A COMPLETAR** falta ver en pantalla de Pfaffen y no se inventa.

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
- Estado de publicación: **Publicada** (Publicar → "Publicada"). Es lo que permite recibir mensajes del público sin App Review, según la experiencia de Pfaffen: no se pidió revisión.
- "Acciones requeridas": ninguna.
- Roles de la aplicación: al menos dos administradores. **A COMPLETAR** (ver qué roles tiene la de Pfaffen).
- Configuración básica (privacidad, eliminación de datos, categoría, dominios): **A COMPLETAR**.

### WhatsApp → Configuración → Webhook
- URL de devolución de llamada: la del canal WhatsApp de la empresa.
- Identificador de verificación: el Verify Token de esa pantalla.
- Botón **Verificar y guardar**: tiene que guardar sin error.
- Campos de webhook (visto en Pfaffen, primeras filas):

| Campo | Suscrito en Pfaffen |
|---|---|
| `account_alerts` | Sí |
| `account_review_update` | Sí |
| `account_update` | Sí |
| `account_settings_update` | No |
| `automatic_events` | No |
| `business_capability_update` | No |
| `business_status_update` | No |
| `business_username_updates` | No |
| `calls` | Sí |
| resto de la lista (incluye **`messages`**) | **A COMPLETAR**: la captura se corta |

- **Obligatorio para que funcione:** `messages` suscrito. El código solo procesa ese campo de WhatsApp (`field !== "messages"` se ignora).
- Versiones: Pfaffen muestra v26.0 y v27.0 según el campo. Dejar la que Meta propone por defecto.

### Instagram
- Caso de uso Instagram → Personalizar → **Login de Instagram para empresas** → "URIs de redirección OAuth válidas": la dirección de redirección de la empresa.
- Webhook: dirección y Verify Token de la empresa; suscripción a **`messages`** y **`comments`**. El código también atiende reacciones, "visto" y mensajes editados (`message_reactions`, `messaging_seen`, `message_edit`): **A COMPLETAR** cuáles están suscritos en Pfaffen.
- Permisos que pide el botón "Conectar con Instagram" en Pfaffen: `instagram_business_basic`, `instagram_business_manage_messages`, `instagram_business_manage_comments`, `instagram_business_content_publish`, `instagram_business_manage_insights`. Para la v1 de inmobiliaria alcanzan los tres primeros (decidir con Walter).
- **No usar** el botón "Generar identificador" de Meta: ese token no deja mandar mensajes (error 190). El token sale del botón Conectar del panel y dura 60 días.

### Messenger
- Caso de uso Messenger → Configuración: webhook con la dirección y el Verify Token de la empresa; campo **`messages`** (el código procesa también `messaging_seen`; la guía de Pfaffen suma `messaging_postbacks` y `message_reads`: **A COMPLETAR** cuáles están suscritos).
- **Suscribir la página a la app** ("Agregar suscripciones" junto a la página). Sin esto el webhook queda cargado y no llega nada.
- El token de página lo da el botón "Conectar con Facebook" del panel, o se pega a mano.

## Pasos (en orden)

Cada paso: **dónde**, **qué hace**, **cómo sé que quedó bien**. Lo que dice "PERSONA" lo hace Walter o el cliente.

1. **PERSONA:** inicia sesión en la cuenta de la empresa en Meta for Developers (con el cliente delante o con acceso de administrador ya dado). El agente no ve la clave.
2. Crear la app: tipo Empresa, dentro del Business Manager de la empresa. *Bien:* la app aparece en "Mis aplicaciones" con su identificador.
3. Agregar los 4 casos de uso del Estado esperado. *Bien:* el Panel muestra los 4 en "Casos de uso en esta aplicación".
4. **PERSONA:** copiar el **secreto de la app** (Configuración → Básica) y pegarlo en el panel de la empresa. El agente no lo lee.
5. Configuración → Básica: cargar privacidad y eliminación de datos. **A COMPLETAR** con los valores de Pfaffen.
6. WhatsApp → Configuración: pegar la dirección y el Verify Token, **Verificar y guardar**, suscribir `messages` (y los demás del Estado esperado). *Bien:* guarda sin error.
7. **PERSONA:** crear el usuario del sistema, asignarle la app, la cuenta de WhatsApp y la página, y generar el token **permanente**. Pegarlo en el panel. *Bien:* el panel muestra "Meta confirma: +54…".
8. Instagram → Login de Instagram para empresas: cargar la dirección de redirección. Webhook: dirección, Verify Token, suscribir `messages` y `comments`.
9. **PERSONA:** apretar "Conectar con Instagram" en el panel e iniciar sesión con la cuenta de la empresa. *Bien:* el panel muestra "Conectado" y completa solo el ID.
10. Messenger → Configuración: webhook, suscribir campos, y "Agregar suscripciones" a la página.
11. **Publicar** la app (pasarla a modo Publicada). **A COMPLETAR** qué pide Meta para eso (privacidad, categoría, etc.).
12. Recorrer el **Estado esperado** y entregar el informe "igual / distinto".

## Atajos de navegación (direcciones directas)

Visto en la app de Pfaffen. El agente puede ir directo en vez de buscar los menús; si la dirección no abre la pantalla esperada, vuelve a navegar por los menús y lo anota.

| Pantalla | Dirección (reemplazar `APP_ID` y `BUSINESS_ID` por los de la empresa) |
|---|---|
| WhatsApp → Configuración (webhook) | `https://developers.facebook.com/apps/APP_ID/use_cases/customize/wa-settings/?use_case_enum=WHATSAPP_BUSINESS_MESSAGING&selected_tab=wa-settings&product_route=whatsapp-business&business_id=BUSINESS_ID` |

El resto de las direcciones (Instagram, Messenger, Roles, Publicar) están **A COMPLETAR**: se anotan en la primera pasada de lectura.

## Para que sea repetible

- Si algo se corrige en la primera conexión real, se corrige **acá** y en `guia-conexion-canales.md`, no solo en el chat.
- Después de cada alta, anotar en la ficha de la empresa (sin contraseñas): quién es dueño de cada cuenta, la fecha de conexión y el vencimiento del token de Instagram.

## Qué falta para completar esta receta

Capturas de la app de Pfaffen, **sin mostrar secretos** (ni el secreto de la app, ni tokens, ni el Verify Token):

1. WhatsApp → Configuración: la lista completa de campos de webhook, mostrando cuáles están suscritos (en especial `messages`).
2. Instagram: Configuración de la API / Login de Instagram para empresas, con los campos del webhook y las URIs de redirección.
3. Messenger → Configuración: campos del webhook y la página suscrita.
4. Cada caso de uso → Personalizar: los permisos agregados.
5. Configuración de la aplicación → Básica (sin el secreto), Roles de la aplicación y Publicar.
