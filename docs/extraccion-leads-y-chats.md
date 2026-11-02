# Mapa de extracción: Leads y canales de chat (desde Pfaffen)

Base de la lectura: `WalterCorvalan/pfaffenauto-web`, commit `186a821` (2/11/2026). Solo lectura: nada se toca ni se sube allá.

## Método decidido por Walter (2/11/2026)

Cortar y pegar desde Pfaffen, sin reescribir todo, y después reemplazar y generalizar para que lo use cualquier inmobiliaria. El alcance de la primera versión es **Leads + todos los canales de chat** (WhatsApp, Instagram, Messenger y el chat de la web).

## Cuánto es

Siguiendo todo lo que importan Leads, las 4 bandejas, los webhooks, las pantallas de configuración de canales, el chat de la web y las tareas automáticas de chats:

- **167 archivos, unas 20.500 líneas** (sin tests).
- Reparto: `lib/panel` 48, `components/panel` 20, `app/api/panel` 20, `lib/ai` 18, `app/panel/configuracion` 8, `app/panel/leads` 8, tareas automáticas 7, el resto menos de 6 por carpeta.
- Aparte, **no incluido arriba**: el marco del panel (menú, login, layout: unas 1.300 líneas) y los tests de cada archivo.
- Usa **49 tablas** y **9 funciones de base de datos**.
- Pide 27 variables de entorno, la mayoría opcionales (marketing, imágenes, avisos al celular).

## Bloqueo principal: falta el esquema de la base

Las migraciones de Pfaffen (116 archivos) son solo cambios sobre una base que ya existía: **ninguna crea las tablas principales** (conversaciones, mensajes, perfiles, sucursales, leads, alertas…). Esas tablas se crearon directo en Supabase. Sin su estructura no se puede levantar la copia.

Hace falta que Walter exporte **solo la estructura (sin datos)** del Supabase de Pfaffen. Ver el pedido en el chat de la Fase 3.

## Tablas: qué hacer con cada una (propuesta)

**Se llevan (núcleo, todas con empresa dueña):**
whatsapp_configuracion, whatsapp_contactos, whatsapp_conversaciones, whatsapp_mensajes, whatsapp_memoria, whatsapp_plantillas, whatsapp_templates, instagram_configuracion, instagram_contactos, instagram_conversaciones, instagram_mensajes, instagram_automatizaciones_comentarios, messenger_configuracion, messenger_contactos, messenger_conversaciones, messenger_mensajes, rodi_conversaciones, rodi_mensajes, leads_manuales, eventos_lead, tareas_lead, motivos_cierre, perfiles, sucursales, alertas, push_subscriptions, espacio_notif_prefs, chats_vistos, disponibilidad_vendedor, logs_errores, uso_ia_anthropic, visitas, clientes.

**Se parten o se simplifican:**
- `configuracion_empresa`: hoy una sola fila con todo (marca, horarios, reparto, contenido del sitio). Se parte en varias por empresa.
- `modulos_config` y `visibilidad_sector`: sobran con solo tres roles fijos (dueño, encargado, asesor).

**Se reemplazan (de autos a propiedades):**
- `vehiculos` → propiedades.
- `pedidos` → pedidos de búsqueda de propiedad (el aviso automático queda para la Fase 14).
- `test_drives` → se junta con visitas.
- `consignaciones` → "quiero vender o alquilar mi propiedad" (tasación).

**Se dejan afuera por ahora (son de autos o de otros módulos):**
ventas, senas, expedientes, expediente_checklist, presupuestos, peritajes_lead, nps_envios, objetivos_vendedor, leads_tasacion.

## Dónde "autos" está metido en el código (hay que reescribir de verdad, no solo reemplazar palabras)

Archivos del conjunto que consultan tablas de autos o ventas:
- `components/panel/conversaciones/LeadDetailModal.tsx` (11 consultas)
- `app/api/cron/panel/automatizaciones/route.ts` (10)
- `lib/ai/agenteV2.ts` (9, la búsqueda de stock del bot)
- `lib/panel/consignacionDesdeChat.ts` (4), `components/panel/conversaciones/ChatClient.tsx` (4), `lib/panel/pedidoDelBot.ts` (3)
- 1 consulta en cada uno: `lib/panel/asignacionPorAuto.ts`, `components/panel/useStockParaElegir.ts`, `components/panel/detalle/DetalleUI.tsx`, `app/panel/leads/page.tsx`, webhook de WhatsApp, `instagram/publicar`, `lector-charlas`.

Además: `lib/ai/promptV2/*` (reglas del bot) y `lib/panel/mensajesAutomaticos.ts` hablan de autos, de Pfaffen y de sucursales por nombre.

## Lo que copiar y pegar NO resuelve (hay que hacerlo igual)

1. **Empresa en cada dato**: 115 lugares leen una "fila única" de configuración; hay que cambiarlos todos.
2. **Seguridad por empresa** en la base (para que una no lea lo de otra).
3. **Secretos y tokens de Meta por empresa**, cifrados en la base, no en Vercel. Hoy el secreto de la app es uno solo y el ID de la app de Instagram está escrito fijo en 2 lugares.
4. **Tareas automáticas** que recorran todas las empresas, cada una con su horario.
5. **Nombres propios** de Pfaffen en el código (Gabriel, Lucas, Casa Central, Don Torcuato…): 176 archivos en todo el CRM.

## Orden propuesto

1. Copiar en bloque, sin cambios, en un commit que diga de qué commit de Pfaffen salió.
2. Dejarlo andando contra una base nueva de prueba (una sola empresa, sin datos reales).
3. Pasada 1: autos → propiedades, y sacar nombres propios.
4. Pasada 2: empresa en cada dato + seguridad por empresa + test de aislamiento.
5. Pasada 3: credenciales de Meta por empresa y tareas automáticas por empresa.
6. Pasada 4: panel superadmin y configuración de marca por empresa.
7. Nunca se conecta una inmobiliaria real antes de terminar la pasada 3.

## Lista de archivos del conjunto (167)

- app/api/cron/panel/archivado-chats/route.ts
- app/api/cron/panel/automatizaciones/route.ts
- app/api/cron/panel/aviso-ventana-24h/route.ts
- app/api/cron/panel/avisos-urgentes/route.ts
- app/api/cron/panel/bots-apertura/route.ts
- app/api/cron/panel/lector-charlas/route.ts
- app/api/cron/panel/salud-integraciones/route.ts
- app/api/panel/instagram/backfill-usernames/route.ts
- app/api/panel/instagram/configuracion/route.ts
- app/api/panel/instagram/enviar/route.ts
- app/api/panel/instagram/oauth-callback/route.ts
- app/api/panel/instagram/publicar/route.ts
- app/api/panel/messenger/configuracion/route.ts
- app/api/panel/messenger/enviar/route.ts
- app/api/panel/messenger/importar/route.ts
- app/api/panel/rodi/mensaje/route.ts
- app/api/panel/webhooks/instagram/[token]/route.ts
- app/api/panel/webhooks/messenger/[token]/route.ts
- app/api/panel/webhooks/whatsapp/[token]/route.ts
- app/api/panel/whatsapp/configuracion/route.ts
- app/api/panel/whatsapp/enviar-plantilla/route.ts
- app/api/panel/whatsapp/enviar/route.ts
- app/api/panel/whatsapp/estado/route.ts
- app/api/panel/whatsapp/registrar/route.ts
- app/api/panel/whatsapp/templates/route.ts
- app/api/panel/whatsapp/templates/sync/route.ts
- app/api/panel/whatsapp/verificar-numero/route.ts
- app/panel/configuracion/TokenCargado.tsx
- app/panel/configuracion/instagram/ConfiguracionInstagramClient.tsx
- app/panel/configuracion/instagram/page.tsx
- app/panel/configuracion/messenger/ConfiguracionMessengerClient.tsx
- app/panel/configuracion/messenger/page.tsx
- app/panel/configuracion/whatsapp/ConfiguracionWhatsappClient.tsx
- app/panel/configuracion/whatsapp/MensajesAutomaticosConfig.tsx
- app/panel/configuracion/whatsapp/page.tsx
- app/panel/instagram/loading.tsx
- app/panel/instagram/page.tsx
- app/panel/leads/LeadsUnificadosClient.tsx
- app/panel/leads/LeadsVistas.tsx
- app/panel/leads/NuevoLeadManualModal.tsx
- app/panel/leads/TareasLeadBoard.tsx
- app/panel/leads/layout.tsx
- app/panel/leads/loading.tsx
- app/panel/leads/page.tsx
- app/panel/leads/tareasLead.ts
- app/panel/messenger/loading.tsx
- app/panel/messenger/page.tsx
- app/panel/rodi/RodiBandeja.tsx
- app/panel/rodi/RodiLeadsTab.tsx
- app/panel/rodi/RodiShell.tsx
- app/panel/rodi/loading.tsx
- app/panel/rodi/page.tsx
- app/panel/whatsapp/loading.tsx
- app/panel/whatsapp/page.tsx
- components/FloatingChatbot.tsx
- components/modals/VisorFotosModal.tsx
- components/panel/ConfirmDialog.tsx
- components/panel/Dialogos.tsx
- components/panel/PanelSkeleton.tsx
- components/panel/RefrescoEnVivo.tsx
- components/panel/TablaResponsiva.tsx
- components/panel/conversaciones/AvatarVendedor.tsx
- components/panel/conversaciones/AvisoSucursalLead.tsx
- components/panel/conversaciones/ChatClient.tsx
- components/panel/conversaciones/ConversacionesShell.tsx
- components/panel/conversaciones/FichaLeads.tsx
- components/panel/conversaciones/LeadDetailModal.tsx
- components/panel/conversaciones/LeadsTab.tsx
- components/panel/conversaciones/PeritajeLeadModal.tsx
- components/panel/conversaciones/ProspeccionLead.tsx
- components/panel/conversaciones/ResumenResaltado.tsx
- components/panel/conversaciones/SeparadorDia.tsx
- components/panel/conversaciones/VisorVideoModal.tsx
- components/panel/detalle/DetalleUI.tsx
- components/panel/graficos/paleta.tsx
- components/panel/useStockParaElegir.ts
- components/ui/IconoPaffy.tsx
- components/ui/IconoWhatsapp.tsx
- components/ui/IconosCanales.tsx
- components/ui/SelectorWeb.tsx
- components/ui/movimiento.tsx
- lib/ai/agenteV2.ts
- lib/ai/ajusteIa.ts
- lib/ai/busquedaStock.ts
- lib/ai/costoIa.ts
- lib/ai/estadoStockBot.ts
- lib/ai/estimarPrecioMercado.ts
- lib/ai/financiacionBot.ts
- lib/ai/indexV2.ts
- lib/ai/promptV2/cierreSugerido.ts
- lib/ai/promptV2/estiloYTono.ts
- lib/ai/promptV2/intenciones.ts
- lib/ai/promptV2/reglasGenerales.ts
- lib/ai/promptV2/reglasStock.ts
- lib/ai/promptV2/schemaSalida.ts
- lib/ai/promptV2/sitioWeb.ts
- lib/ai/promptsV2.ts
- lib/ai/saldoIa.ts
- lib/ai/usageLoggerV2.ts
- lib/analytics.ts
- lib/asistenteWeb.ts
- lib/busquedaCatalogo.ts
- lib/conversiones.ts
- lib/conversionesMeta.ts
- lib/crypto/index.ts
- lib/fechas.ts
- lib/financiacion.ts
- lib/meta/client.ts
- lib/meta/erroresWhatsapp.ts
- lib/meta/reaccionHistoria.ts
- lib/panel/adjuntosMeta.ts
- lib/panel/alertas.ts
- lib/panel/asignacionPorAuto.ts
- lib/panel/asignacionWhatsapp.ts
- lib/panel/botDespuesDelAgente.ts
- lib/panel/botonesCanal.ts
- lib/panel/chatsVistos.ts
- lib/panel/clienteSinContestar.ts
- lib/panel/consignacionContacto.ts
- lib/panel/consignacionDesdeChat.ts
- lib/panel/descuentoPorKm.ts
- lib/panel/enviarMensajeBot.ts
- lib/panel/escucharTablas.ts
- lib/panel/fetchPaginado.ts
- lib/panel/formatoResumen.ts
- lib/panel/fotosConsignacion.ts
- lib/panel/horarioBots.ts
- lib/panel/lectorCharlas.ts
- lib/panel/logger.ts
- lib/panel/mensajesAutomaticos.ts
- lib/panel/metricasVentas.ts
- lib/panel/moderacion.ts
- lib/panel/nivelesAlertas.ts
- lib/panel/nombreLead.ts
- lib/panel/notificaciones.ts
- lib/panel/objetivosVendedor.ts
- lib/panel/ordenBandeja.ts
- lib/panel/origenWeb.ts
- lib/panel/origenesCliente.ts
- lib/panel/pedidoDelBot.ts
- lib/panel/pedidoDesdeChat.ts
- lib/panel/permisosModulos.ts
- lib/panel/plantillasSugeridas.ts
- lib/panel/prioridadLeads.ts
- lib/panel/prospeccionLead.ts
- lib/panel/publicacionInstagram.ts
- lib/panel/resaltarResumen.ts
- lib/panel/saludIntegraciones.ts
- lib/panel/segurosVentas.ts
- lib/panel/sucursalLead.ts
- lib/panel/sugerenciaVehiculoLead.ts
- lib/panel/textosAnuncio.ts
- lib/panel/tokenActual.ts
- lib/panel/variablesPlantilla.ts
- lib/panel/ventana24h.ts
- lib/panel/visitaRepetida.ts
- lib/panel/whatsappMemoria.ts
- lib/panel/whatsappTemplates.ts
- lib/push.ts
- lib/rateLimit.ts
- lib/storage/r2.ts
- lib/supabase/client.ts
- lib/supabase/server.ts
- lib/utm.ts
- lib/vehiculos.ts
- lib/whatsappPublico.ts
- lib/zoomImagen.ts