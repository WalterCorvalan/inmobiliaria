# Publicar las 3 demos de los bots en Cloudflare (gratis)

Tiempo: unos 10 minutos en total. El código ya está listo y probado en la rama `claude/project-thread-yh3bhx` de cada repo.

Al final quedan:

- DentalBot: https://dentalbot.waltercorvalan505.workers.dev
- Inmobiliaria: https://inmobiliaria.waltercorvalan505.workers.dev
- Automotora: https://automotora.waltercorvalan505.workers.dev

(La dirección principal de cada una abre directamente la demo.)

## Hacer esto 3 veces, una por bot

1. Entrá a **dash.cloudflare.com** → **Workers & Pages** → **Create application** → **Import a repository**.
2. Si no aparece el repo en la lista: tocá **Configure GitHub / Manage access**, y en GitHub sumá los repos `dental-bot`, `inmobiliaria` y `automotora` (además de `microapps-admin`, que ya está) → **Save**.
3. Elegí el repo y completá:

   | Campo | dental-bot | inmobiliaria | automotora |
   |---|---|---|---|
   | Project name | `dentalbot` | `inmobiliaria` | `automotora` |
   | Production branch | `claude/project-thread-yh3bhx` | `claude/project-thread-yh3bhx` | `claude/project-thread-yh3bhx` |
   | Build command | `npx opennextjs-cloudflare build` | igual | igual |
   | Deploy command | `npx opennextjs-cloudflare deploy` | igual | igual |

   El nombre tiene que ser exactamente ese (es el que está en el archivo `wrangler.jsonc` de cada repo).
4. **Deploy**. Tarda 3 a 5 minutos. No hace falta cargar ninguna variable para que la demo ande.

No toca nada de lo que ya tenés (Pfaffen, AppsYa, dominios, bases): cada una es un Worker nuevo.

## Cómo se ven sin la clave de Claude

- **DentalBot:** contesta con respuestas de ejemplo (agenda turnos de mentira) y avisa abajo "modo sin IA".
- **Inmobiliaria y Automotora:** el chat contesta "el asistente está en mantenimiento, volvé a probar en un rato". Todo lo demás de la pantalla (leads de ejemplo, canales) se ve igual.
- El panel (/panel) todavía no anda: necesita la base (Supabase), que se conecta después.

## Después: conectar la clave de Claude

En **Workers & Pages → (el bot) → Settings → Variables and Secrets → Add**, tipo **Secret**:

| Bot | Nombre de la variable |
|---|---|
| DentalBot | `ANTHROPIC_API_KEY_DEMO` |
| Inmobiliaria | `DEMO_ANTHROPIC_API_KEY` |
| Automotora | `DEMO_ANTHROPIC_API_KEY` |

La clave se saca en **console.anthropic.com → API Keys**. Poné un límite de gasto en ese espacio de Anthropic (Settings → Limits): es el tope de verdad, porque el contador de la app es aproximado.

Opcional: `DEMO_TOPE_USD` (Text) con el tope por mes de cada demo, por ejemplo `1.5`.

## Si algo falla

En **Deployments** tocá el que falló → **View build log** y pasale a Claude las últimas 20 líneas.

## Cuando se fusionen los PR

Cambiar en cada Worker **Settings → Build → Branch control → Production branch** a `main` (dental-bot) o `master` (inmobiliaria, automotora).

## Estado (22/11/2026)

Los Workers `dentalbot`, `inmobiliaria` y `automotora` ya están creados en la cuenta de Walter, conectados a la rama `claude/project-thread-yh3bhx` de cada repo. Cada push a esa rama vuelve a publicar.
