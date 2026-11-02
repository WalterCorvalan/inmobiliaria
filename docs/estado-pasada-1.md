# Estado al terminar la pasada 1 (2/11/2026)

## Qué hay

- Instala (`npm ci`), compila (`tsc`) y pasan los tests (314). El lint no suma avisos nuevos (tope en `.lint-baseline.json`).
- Menú del panel: Leads, WhatsApp, Instagram, Messenger, Chat de la web y Configuración (canales).
- Sin nombres propios de Pfaffen en lógica, textos que ve el cliente, archivos públicos ni prompts.
  Quedan nombres solo en **comentarios** (historia de decisiones de Pfaffen) en unos 70 archivos; no afectan nada y se irán limpiando al tocar cada archivo.

## Qué NO es todavía una inmobiliaria

- **Los prompts del bot siguen hablando de autos** (stock, permuta, test drive, financiación prendaria, seguros). Se reescriben en la Fase 7.
- El código y la base siguen usando `vehiculos`, `vehiculo_id`, `consignaciones`, `pedidos`. Pasan a propiedades junto con la Fase 5 (el esquema de propiedades se define ahí).
- Una sola empresa: todavía se lee `id = true` en la configuración y no hay empresa en ninguna tabla (pasada 2).
- Falta la pantalla de Configuración de la empresa, usuarios y oficinas (Fase 4): el menú solo lleva a la configuración de canales.

**Regla firme: no conectar ninguna inmobiliaria real hasta terminar la pasada 3.** Con los prompts de autos el bot daría respuestas equivocadas.

## Qué sigue

Pasada 2: empresa en cada dato, seguridad por empresa y test de aislamiento (ver `fase-3-diseno-base.md`).
