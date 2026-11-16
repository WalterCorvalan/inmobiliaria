# Demo con simulador de canales

Página pública **`/demo`** para mostrarle el producto a una inmobiliaria sin conectar nada a Meta ni a la base.
Diseño compartido con dental-bot y automotora: ver `docs/simulador.md` en el repo dental-bot.

## Qué tiene

- **Simulador de canales:** un celular que se ve como WhatsApp, Instagram o Messenger (pestañas arriba). Uno escribe como cliente y contesta **el mismo bot** del producto (mismo prompt y mismo formato de salida: `lib/ai/promptsV2.ts`, `AgentReplySchemaV2`), con la inmobiliaria de ejemplo "Propiedades del Sur".
- **Panel de leads:** bandeja con 15 leads ficticios de los 3 canales. La charla que se hace en el simulador aparece arriba como lead "EN VIVO".
- **Resumen de la conversación (simulado):** el botón "Resumir" no llama a la IA (Walter, 13/11/2026). Los leads de ejemplo traen el resumen escrito a mano; el de la charla en vivo se arma con una plantilla a partir de lo que juntó el bot (`lib/simulador/resumenPlantilla.ts`), con el mismo formato que el resumen real.
- **Reiniciar demo:** borra la charla. Nada se guarda: vive solo en el navegador.

Direcciones: `/demo`, `/demo?canal=instagram`, `/demo?canal=messenger`.

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

## Tope de gasto: USD 5

1. **Clave:** la misma `ANTHROPIC_API_KEY` del bot, de un solo espacio de trabajo de Anthropic (Walter, 16/11/2026). Si algún día se quiere separar, se carga `DEMO_ANTHROPIC_API_KEY` y la demo usa esa.
2. **Contador propio:** al llegar a USD 4,50 la demo deja de llamar a la IA y lo avisa. Cuenta en la memoria del servidor (se reinicia con cada deploy), por eso es aproximado.
3. **Por visita:** 30 mensajes por charla, 60 mensajes por hora desde la misma conexión, mensajes de hasta 600 letras.

Modelo: Claude Haiku 5.5 (`MODELO_BOTS`), con las instrucciones en caché.

## Para ponerla en línea

- Variables: `ANTHROPIC_API_KEY`. El resto del proyecto pide `NEXT_PUBLIC_SUPABASE2_URL` y `SUPABASE2_SERVICE_ROLE_KEY` al arrancar (`lib/panel/logger.ts`); la demo no usa la base, pero el servidor no arranca sin esas dos.
- Sin la clave, la demo funciona igual pero el bot contesta "La demo todavía no tiene la IA configurada".

## Probado

- Pantalla, cambio de canal, bandeja, ficha, "Resumir" y "Reiniciar" probados en el navegador (escritorio y celular), sin errores.
- **Falta probar las respuestas reales del bot**: se prueba antes de lanzar (Walter, 16/11/2026).
