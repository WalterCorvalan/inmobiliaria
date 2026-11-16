# Demo con simulador de canales

Página pública **`/demo`** para mostrarle el producto a una inmobiliaria sin conectar nada a Meta ni a la base.
Diseño compartido con dental-bot y automotora: ver `docs/simulador.md` en el repo dental-bot.

## Qué tiene

- **Simulador de canales:** un celular que se ve como WhatsApp, Instagram o Messenger (pestañas arriba). Uno escribe como cliente y contesta **el mismo bot** del producto (mismo prompt y mismo formato de salida: `lib/ai/promptsV2.ts`, `AgentReplySchemaV2`), con la inmobiliaria de ejemplo "Propiedades del Sur".
- **Panel de leads:** bandeja con 15 leads ficticios de los 3 canales. La charla que se hace en el simulador aparece arriba como lead "EN VIVO".
- **Resumen de la conversación (simulado):** el botón "Resumir" no llama a la IA (Walter, 13/11/2026). Los leads de ejemplo traen el resumen escrito a mano; el de la charla en vivo se arma con una plantilla a partir de lo que juntó el bot (`lib/simulador/resumenPlantilla.ts`), con el mismo formato que el resumen real.
- **Reiniciar demo:** borra la charla. Nada se guarda: vive solo en el navegador.

Direcciones: `/demo`, `/demo?canal=instagram`, `/demo?canal=messenger`.

Hay **dos inmobiliarias de ejemplo** (se elige arriba a la izquierda, o `/demo?negocio=inmobiliaria-2`):

| | Propiedades del Sur | Martínez & Asociados |
|---|---|---|
| Tono | amable, con emojis | formal y sobrio, sin emojis |
| Oficinas | Belgrano y Lomas | solo Belgrano |
| Garantía | propietaria o seguro de caución | solo propietaria de CABA |
| Honorarios | 1 mes (alquiler), 3% (venta) | 4,15% (alquiler), 4% (venta) |
| Sábados | de 9 a 13 | no atiende |

## Archivos

| Archivo | Para qué |
|---|---|
| `app/demo/page.tsx`, `app/demo/DemoClient.tsx` | la pantalla (simulador + panel) |
| `app/demo/acciones.ts` | recibe el mensaje y llama al bot. Es una acción de servidor y no una ruta de `app/api` porque no pertenece a ninguna empresa |
| `lib/simulador/botDemo.ts` | arma el prompt con la empresa de ejemplo y llama a Claude |
| `lib/simulador/inmobiliaria.ts` | datos de ejemplo: negocio, oficinas, 20 propiedades, asesores, 15 leads con resumen |
| `lib/simulador/limites.ts` | control de gasto y límites por visita |
| `lib/simulador/rubros.ts`, `tipos.ts` | lista de rubros y tipos (para copiar el simulador a otro proyecto) |

Para mostrarla con el nombre de un cliente: cambiar `nombreNegocio` y `nombreBot` en `lib/simulador/inmobiliaria.ts`.

## Tope de gasto: USD 5 repartido entre los 3 productos

1. **Clave:** la misma `ANTHROPIC_API_KEY` del bot, de un solo espacio de trabajo de Anthropic (Walter, 16/11/2026). Si algún día se quiere separar, se carga `DEMO_ANTHROPIC_API_KEY` y la demo usa esa.
2. **Contador propio, por producto** (Walter, 16/11/2026): DentalBot, Inmobiliaria y Automotora tienen cada uno su tope. Por defecto **USD 1,50 por mes** (los tres suman USD 4,50, con margen dentro de los USD 5); se cambia con la variable `DEMO_TOPE_USD`. Al llegar, la demo deja de llamar a la IA y lo avisa. Cuenta en la memoria del servidor (se reinicia con cada deploy), por eso es aproximado.
3. **Por visita:** 30 mensajes por charla, 60 mensajes por hora desde la misma conexión, mensajes de hasta 600 letras.

Modelo: Claude Haiku 5.5 (`MODELO_BOTS`), con las instrucciones en caché.

## Para ponerla en línea

- Variables: `ANTHROPIC_API_KEY`. El resto del proyecto pide `NEXT_PUBLIC_SUPABASE2_URL` y `SUPABASE2_SERVICE_ROLE_KEY` al arrancar (`lib/panel/logger.ts`); la demo no usa la base, pero el servidor no arranca sin esas dos.
- Sin la clave, la demo funciona igual pero el bot contesta "La demo todavía no tiene la IA configurada".

## Probado

- Pantalla, cambio de canal, bandeja, ficha, "Resumir" y "Reiniciar" probados en el navegador (escritorio y celular), sin errores.
- **Falta probar las respuestas reales del bot**: se prueba antes de lanzar (Walter, 16/11/2026).

## Pruebas antes de lanzar (Walter, 16/11/2026)

Cada negocio tiene su nombre, su forma de trabajar y su tono, y el bot tiene que respetarlos. Antes de mostrarle la demo a un cliente (o de conectar su canal real), se cargan **sus datos** en un negocio de ejemplo y se corren estas charlas en los 3 canales. Se prueba con **los dos negocios de ejemplo** para confirmar que el bot no mezcla la información de uno con la del otro.

| # | Mensaje | Qué tiene que pasar |
|---|---|---|
| 1 | "Hola" | saluda con el nombre del negocio y del bot, una sola vez |
| 2 | "¿Sigue el 2 ambientes de Belgrano?" | da código, precio y expensas tal como están cargados |
| 3 | "¿Aceptan seguro de caución?" | Propiedades del Sur: sí. Martínez: no, solo garantía propietaria de CABA |
| 4 | "¿Cuánto cobran de honorarios?" | el valor de cada negocio, sin mezclar |
| 5 | "¿Atienden los sábados?" | Propiedades del Sur: sí, de 9 a 13. Martínez: no |
| 6 | "Tienen algo en Palermo por 500 mil?" | dice que no tiene, no inventa propiedades |
| 7 | "Quiero verlo el jueves a la mañana" | propone día y horario dentro del horario de la oficina |
| 8 | "Te ofrezco 100 mil" (negociar) | deriva a un asesor y no promete nada |
| 9 | Insulto | responde una vez con respeto y corta |
| 10 | Mismo pedido en Instagram | no pide el nombre; ofrece seguir por WhatsApp |

Anotar el costo de cada charla (sale en el contador de gasto) para fijar el precio del plan.
