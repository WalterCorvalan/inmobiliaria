# Inmobiliaria CRM

Micro app multiempresa para inmobiliarias. **Junta en un solo lugar los mensajes que llegan por WhatsApp, Instagram, Messenger y el chat de la web**, los muestra como consultas (leads), deja que una IA conteste fuera de horario o mientras nadie atiende, y los reparte entre los asesores de cada oficina. Cada consulta trae la **propiedad** por la que preguntó.

Se vende como el mismo servicio a distintas inmobiliarias. Cada una es independiente: sus datos, su bot, sus claves y sus usuarios, sin ver nada de las otras.

**Para entender el proyecto por dentro: [`docs/LEEME-PRIMERO.md`](docs/LEEME-PRIMERO.md).**

## Qué hace

| Módulo | Para qué sirve |
|---|---|
| **Propiedades** | La cartera de venta y alquiler, con foto, precio, ubicación y estado. Es lo que en una concesionaria de autos sería el stock. |
| **Leads (consultas)** | Todas las consultas en una bandeja única, con resumen de IA, prioridad, etapa del pipeline, tareas y asesor asignado. |
| **WhatsApp, Instagram, Messenger y chat web** | Reciben y contestan mensajes de cada canal desde el panel. |
| **Configuración** | Conexión de cada canal, horarios del bot, oficinas y equipo. |

Los módulos que siguen (visitas, clientes, alquileres y demás) están ordenados en [`docs/plan-modulos.md`](docs/plan-modulos.md).

## Qué necesita una inmobiliaria para usarlo

La idea central del sistema es **recibir los mensajes de los canales de venta, mostrarlos en el panel y que la IA conteste**. Para eso la inmobiliaria tiene que ponernos a disposición cuentas propias en Meta (la empresa dueña de Facebook, Instagram y WhatsApp). **Nunca nos pasa contraseñas**: inicia sesión ella misma, o con su gente delante, y nosotros solo pedimos permisos y el nombre de cada dato.

### Obligatorio

1. **Un número de WhatsApp para el negocio.**
   - Con chip en un celular que reciba SMS o llamadas (se usa una sola vez para verificarlo).
   - Tiene que estar **libre**: sin la app de WhatsApp normal instalada con ese número y sin otro proveedor (Twilio, etc.). Si tenía PIN de dos pasos, hay que conseguirlo.
2. **Una cuenta de Facebook con administrador comercial (Meta Business Suite) a nombre de la empresa.**
   - Con **dos administradores** como mínimo, para no perder el acceso si uno falta.
   - Con acceso para **crear la app en Meta for Developers**, que es lo que nos conecta con los canales.
3. **La empresa verificada en Meta** (con sus papeles). Sin esto hay tope de mensajes y a veces no salen las respuestas.
4. **Un medio de pago cargado para WhatsApp** (Business Suite, Facturación y pagos). Sin esto no salen las plantillas.

### Si quiere Instagram y Messenger

5. **Una página de Facebook** y una **cuenta de Instagram profesional**, vinculadas entre sí y dentro del mismo administrador comercial.
6. En el Instagram del celular: Configuración, Mensajes, Herramientas conectadas, **permitir el acceso a los mensajes**. Si está apagado, no llega nada.

### Si quiere el chat en su web

7. Una web propia donde pegar el código del chat. El chat toma el nombre, el logo y los colores de la configuración de la inmobiliaria.
8. Dos direcciones públicas en esa web: la **política de privacidad** y las instrucciones de **eliminación de datos** (Meta las pide).

### Para que el asistente conteste bien

9. Datos básicos del negocio: horarios de atención, ubicación de cada oficina y formas de pago.
10. Su cartera de propiedades cargada (o ayuda para cargarla).
11. Quiénes son los asesores, en qué oficina trabaja cada uno y cómo se reparten las consultas.

### Qué hacemos nosotros

- Crear la app de Meta dentro de **su** cuenta (una app por empresa, sin aprobación especial de Meta), suscribir los canales y cargar los datos en el panel.
- Los secretos y tokens de cada empresa se guardan **cifrados y por empresa**.
- El panel avisa solo al dueño si algo se corta (token vencido, número desconectado, pago, mensajes rechazados). El token de Instagram dura 60 días y hay que reconectarlo antes de que venza.

El paso a paso de la conexión está en [`docs/guia-conexion-canales.md`](docs/guia-conexion-canales.md) y el guion para un agente con navegador en [`docs/receta-agente-meta.md`](docs/receta-agente-meta.md).

## Cómo se creó

- Se partió del CRM de una concesionaria de autos (Pfaffen, solo lectura) y se **copió y generalizó** código, nunca datos ni claves. Cada dato lleva su empresa y la propia base de datos impide cruzar información entre inmobiliarias (seguridad por fila, con un test de aislamiento que corre en cada cambio).
- Se trabajó por pasadas, con tests y una base en memoria. Las decisiones están en [`docs/decisiones.md`](docs/decisiones.md) y el estado en [`docs/pasada-2-estado.md`](docs/pasada-2-estado.md).
- El diseño es propio, cálido y centrado en las propiedades (`app/inmo.css`, `components/inmo`). Las pantallas viejas todavía conservan el estilo del CRM de autos y se van rehaciendo.

## Tecnología

Next.js y React, TypeScript, Tailwind, Supabase (base de datos con seguridad por fila), IA de Anthropic para el asistente, y la API de Meta para WhatsApp, Instagram y Messenger.

## Para correrlo

```bash
npm ci
npm run typecheck
npm test
npm run dev
```

Antes de subir cambios: `npm run typecheck`, `npm test`, `npm run lint:baseline` y `npm run check:migraciones`.

## Estado

Probado con tests y una base en memoria. **Todavía no se corrió contra un Supabase real ni contra Meta real**, así que no se conecta ninguna inmobiliaria real hasta hacer esa prueba. La configuración de Meta replica la que anda hoy en Pfaffen (relevada en solo lectura).
