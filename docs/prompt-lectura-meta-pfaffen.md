# Prompt: relevar la app de Meta de Pfaffen (solo lectura)

Para pegar en Claude Code, en la computadora de Walter, con la extensión de Chrome activada y la sesión de Meta for Developers ya iniciada. Sirve para completar las secciones **A COMPLETAR** de `receta-agente-meta.md`.

**Antes de pegarlo:** abrir Claude Code dentro del repo `inmobiliaria` (rama `claude/wonderful-ritchie-q9y3jw`) e iniciar sesión en Meta for Developers a mano. El agente no recibe ninguna clave.

---

## Texto para pegar

Leé `docs/receta-agente-meta.md` y `docs/guia-conexion-canales.md` de este repo. Después entrá con el navegador a Meta for Developers, a la app **PfaffenAutos IBot**, y relevá cómo está configurada hoy, para completar todo lo marcado **A COMPLETAR** en la receta.

### Reglas (obligatorias)

1. **Solo lectura.** No cambies, guardes, suscribas, regeneres, publiques ni borres nada. Si una pantalla tiene un botón que modifica algo, no lo toques. No uses "Test", "Verificar y guardar", "Suprimir suscripción" ni "Reconectar".
2. **No leas, copies ni escribas** secretos de la app, tokens de acceso, identificadores de verificación (Verify Token), ni claves de ningún tipo. Si un valor sensible aparece en pantalla, anotá solo "hay un valor cargado" y seguí. No lo repitas en el chat ni en ningún archivo.
3. No pidas contraseñas ni códigos. Si Meta pide volver a iniciar sesión, un código o resolver un captcha, **frená y avisame**.
4. Si una pantalla no se parece a lo esperado, frená y avisame. No improvises.
5. No toques nada fuera de la app PfaffenAutos IBot.

### Qué relevar

Recorré en este orden y anotá, de cada pantalla, **qué está activado, suscrito o cargado** (no los valores secretos):

1. **Panel:** casos de uso agregados y "Acciones requeridas".
2. **Casos de uso → Personalizar**, uno por uno (Instagram, WhatsApp, Messenger, Página): los **permisos y funciones** agregados y su estado.
3. **WhatsApp → Configuración (webhook):** la lista **completa** de campos, con la versión y si está suscrito o no. Marcá en especial `messages`.
4. **WhatsApp → Configuración de la API:** qué datos se piden y de dónde salen (solo nombres de los campos, sin valores).
5. **Instagram → Login de Instagram para empresas:** las URIs de redirección OAuth válidas (la dirección, no secretos) y los permisos.
6. **Instagram → Webhook:** campos y cuáles están suscritos.
7. **Messenger → Configuración:** campos del webhook suscritos y las páginas suscritas a la app.
8. **Inicio de sesión con Facebook para empresas** → Ajustes: URIs de redirección válidas.
9. **Revisión:** permisos y su estado de acceso (estándar o avanzado), sin pedir nada.
10. **Publicar:** estado de la app y qué requisitos muestra.
11. **Configuración de la aplicación → Básica:** categoría, URL de política de privacidad, URL de eliminación de datos, dominios, ícono. **No el secreto.**
12. **Roles de la aplicación:** cuántos administradores, desarrolladores y probadores hay, sin copiar mails.
13. **Bandeja de entrada de alertas:** si hay alguna pendiente.

### Qué entregar

1. Editá `docs/receta-agente-meta.md`: reemplazá cada **A COMPLETAR** con lo relevado. Si algo no se pudo ver, dejalo como A COMPLETAR y anotá por qué.
2. Agregá al final de la receta una sección **"Diferencias entre lo que decía la receta y lo que se vio"**, con cada cosa que no coincidía.
3. Agregá una sección **"Pantallas y nombres reales de los menús"** con el recorrido exacto de cada paso (por ejemplo: Casos de uso → Personalizar → Permisos), porque los nombres cambian seguido.
4. No subas nada a Git: dejá los cambios sin commit y mostrame el resultado para que lo revise.
5. Al terminar, decime qué partes de la receta crees que el agente podría hacer solo y cuáles seguro necesitan a una persona.

---

## Después

Walter sube el archivo ya completado a la rama `claude/wonderful-ritchie-q9y3jw` (o se lo pasa a la sesión que trabaja el repo), y se revisa con cuidado antes de usarlo en el primer alta real.
