# Instrucciones para cualquier sesión de Claude en este proyecto

**Antes de hacer nada, leé `docs/LEEME-PRIMERO.md` entero.** Tiene la idea del producto, lo que decidió Walter, cómo está construido, el estado actual y qué sigue. Después leé lo que corresponda del mapa de documentos que está ahí.

Lo esencial, por si no llegás a leerlo todo:

- Hablale a Walter en español simple, corto y sin jerga. Nunca le pidas contraseñas ni claves: solo el nombre y dónde se sacan.
- No hagas nada en Google, Meta ni MercadoLibre sin su OK en el momento.
- El repositorio de Pfaffen es solo de lectura.
- No conectes ninguna empresa real hasta probar todo contra un Supabase real.
- Antes de subir: `npm run typecheck`, `npm test`, `npm run lint:baseline`, `npm run check:migraciones`.
- Lo que decide Walter se anota en `docs/decisiones.md`; lo que falta, en `docs/pasada-2-estado.md`; al cerrar la sesión, actualizá el estado en `docs/LEEME-PRIMERO.md`.
- Sin pull request si no te lo piden. Cada sesión sube solo a la rama que se le indique.
