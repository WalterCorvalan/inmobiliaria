# AGENTS.md (reglas para cualquier agente: Claude Code, Cursor, Codex)

**Antes de hacer nada, leé `docs/LEEME-PRIMERO.md` entero.** Tiene la idea del producto, lo que decidió Walter, cómo está construido, el estado actual y qué sigue. El brief corto está en `docs/PRD.md`, `docs/DESIGN_SYSTEM.md` y `docs/ARCHITECTURE.md`.

## Cómo hablarle a Walter
- Español de Argentina, simple, corto y sin jerga. Si hace falta un término técnico, se explica en una línea.
- Nunca pedirle contraseñas ni claves: solo el nombre y dónde se sacan.
- No hacer nada en Google, Meta ni MercadoLibre sin su OK en el momento.

## Reglas de trabajo
- El repositorio de Pfaffen (`pfaffenauto-web`) es solo de lectura.
- No conectar ninguna empresa real hasta probar todo contra un Supabase real.
- Antes de subir: `npm run typecheck`, `npm test`, `npm run lint:baseline`, `npm run check:migraciones`.
- Reglas de negocio y permisos en `lib/` como funciones puras con test, no dentro de rutas o componentes.
- Toda tabla con `empresa_id`: seguridad por fila + entrada en `TABLAS_DE_EMPRESA` (`lib/empresa/db.ts`) + test de aislamiento. El servidor solo consulta con `supabaseEmpresa` dentro de una empresa (lo vigila `lib/empresa/guardia.test.ts`: si falla, se arregla el código, no el test).
- Migraciones nuevas en `migraciones/` con `-- ROLLBACK:`; las corre Walter a mano antes de subir el código que las usa.
- Pantallas nuevas con las clases `im-*` de `app/inmo.css` (ver `docs/DESIGN_SYSTEM.md`), no con Tailwind del CRM viejo.
- Textos para el cliente: "oficina" (en el código `sucursal`) y "asesor" (en el código `ventas`).
- Lo que decide Walter va en `docs/decisiones.md`; lo que falta, en `docs/pasada-2-estado.md`; al cerrar la sesión se actualiza el estado en `docs/LEEME-PRIMERO.md`.
- Cada sesión sube solo a la rama que se le indique. Pull request solo si se pide.
- Gratis primero: antes de sumar un servicio pago, proponer una alternativa gratuita o de código abierto y anotar el costo en `docs/ARCHITECTURE.md`.
