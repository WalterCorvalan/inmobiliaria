# Arquitectura

## 01 Visión general
Cliente (WhatsApp / Instagram / Messenger / chat web) → webhooks de Meta y `/api/panel/rodi/mensaje` → bot (Claude) → base (Supabase) → panel `/panel` (Next.js).

## 02 Stack
| Área | Herramienta | Costo |
|---|---|---|
| Frontend y servidor | Next.js 16, React 19, TypeScript | gratis |
| Base de datos y login | Supabase (Postgres con seguridad por fila, Auth, pg_cron, pg_net) | plan gratis; USD 25/mes con varios clientes |
| IA | Claude Haiku 5.5 (Anthropic), respaldo OpenRouter | por uso, con tope en la consola |
| Canales | API de Meta (WhatsApp Cloud, Instagram, Messenger) | respuestas gratis; plantillas ~USD 0,03 |
| Fotos y audios | Cloudflare R2 | gratis hasta 10 GB |
| Hosting | Cloudflare (Workers con OpenNext) — decidido 18/11/2026 | plan gratis / USD 5 |
| Avisos push | Web Push (VAPID) | gratis |
| Pruebas | vitest | gratis |

## 03 Estructura de carpetas
- `app/panel/` pantallas del panel (leads, canales, propiedades, visitas, configuración).
- `app/api/panel/webhooks/` entrada de mensajes de Meta; `app/api/panel/rodi/` chat web; `app/api/panel/equipo/` altas.
- `app/api/cron/panel/` tareas automáticas (8), las dispara pg_cron (`programar_tareas`).
- `app/chat/[empresa]/` chat para enmarcar en la web de cada inmobiliaria (`public/chat-web.js`).
- `app/superadmin/` alta de inmobiliarias. `app/demo/` demo pública.
- `lib/ai/` bot (prompt, reglas, propiedades). `lib/empresa/` multiempresa. `lib/visitas/`, `lib/propiedades/`, `lib/panel/` reglas puras con test.
- `migraciones/` SQL en orden (001 a 010).

## 04 Flujo de datos
1. El cliente escribe por un canal; Meta llama al webhook con el token de la empresa.
2. El servidor fija la empresa (`dentroDeEmpresa`), guarda el mensaje y llama al bot con la cartera, las oficinas y la memoria de esa empresa.
3. El bot contesta en JSON (respuesta, calificación, datos, visita, propiedad); se guarda todo y, si deriva, se asigna asesor por ronda y se agenda la visita.
4. El asesor ve el lead y la visita en el panel en tiempo real.

## 05 Crecimiento
- Un módulo por vez (`docs/plan-modulos.md`), cada tabla con `empresa_id` y su test de aislamiento.
- Variables de entorno: `.env.example`.
