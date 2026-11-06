> **Documento histórico (README inicial del 3/11/2026).** La decisión vigente sobre Meta es **una app por empresa** (ver `decisiones.md`); lo que acá dice de "una sola app de Meta" quedó reemplazado. El resto sirve como visión original.

# Inmobiliaria — bandeja única de mensajes con asesores y bot

Proyecto de Walter Corvalán. Este archivo explica qué se quiere construir, para que cualquier persona (o sesión de Claude) que abra el repo lo entienda sin contexto previo.

## La idea en una frase

Una app simple para inmobiliarias (y después concesionarias u otros rubros) donde **todos los mensajes que les llegan por WhatsApp, Instagram y Facebook Messenger entran a un solo lugar**, se reparten entre los asesores, y un bot con IA (Claude) contesta solo lo que puede, con la información de cada empresa.

## El problema que resuelve

A una inmobiliaria le escriben por todos lados. Cada asesor contesta desde su celular, los mensajes se pierden, nadie sabe quién atendió a quién, y un cliente que escribió a la noche queda sin respuesta hasta el otro día.

## De dónde sale

Todo esto **ya funciona** en el CRM de Pfaffen Autos (concesionaria), repo `pfaffenauto-web`. Este proyecto es sacar de ese CRM la parte de mensajes y leads y convertirla en un producto que se pueda vender a otras empresas. Más adelante, si un cliente lo pide, se le puede sumar el resto del CRM (clientes, operaciones, finanzas, etc.).

Lo que se reusa de `pfaffenauto-web`:

- Bandejas de WhatsApp, Instagram y Messenger: recibir y contestar desde el panel (conexión con Meta por webhooks).
- Módulo **Leads**: junta todos los canales en una sola lista.
- Reparto de leads entre asesores por turno, y sacar a un asesor de la rotación (vacaciones, licencia).
- Cada asesor ve solo sus leads; el encargado y el dueño ven todo.
- Avisos de "sin respuesta" (2 días), "lead basura" y orden de "a quién contestar primero".
- Detectar si el mensaje vino de un anuncio de Meta.
- Botón "Conectar con Facebook" para cargar la página sin copiar claves a mano.
- Bot con IA que contesta con memoria de la conversación.

## Cómo se da de alta un cliente nuevo (lo que se quiere lograr)

El objetivo es que sumar una inmobiliaria sea rápido y sin tocar código:

1. Walter crea la empresa en el sistema (nombre, logo, usuarios de los asesores).
2. El dueño de la inmobiliaria entra a su panel y aprieta **"Conectar con Facebook / WhatsApp"**.
3. Inicia sesión él mismo en Facebook y elige su página, su Instagram y su número de WhatsApp.
4. Carga la información que el bot necesita saber (propiedades, horarios, zonas, preguntas frecuentes).
5. Listo: los mensajes empiezan a llegar a Leads y el bot contesta.

### Decisiones importantes (y por qué)

- **No se le piden contraseñas al cliente.** Las claves de Facebook las pone el cliente en la pantalla de Facebook, nunca pasan por nosotros. Entrar con la cuenta de otro desde otro lugar hace que Facebook la bloquee o pida verificación, y además es un riesgo que no queremos.
- **Una sola app de Meta para todos los clientes**, la de Walter, aprobada una vez por Meta para trabajar con otras empresas (proveedor de tecnología, con el alta de WhatsApp integrada). No se crea una app de Meta por cliente: cada app nueva tendría que pasar la revisión de Meta, que lleva semanas.
- **Un solo sistema para todas las empresas**, donde cada una ve solo lo suyo. No una copia en Vercel por cliente: con muchas copias, cada arreglo habría que subirlo muchas veces.
- **Simple antes que completo.** Primero la bandeja, los leads y el bot. El CRM completo, solo si un cliente lo pide.

## Qué hay que construir (etapas)

1. **Varias empresas en un mismo sistema.** Cada dato (conversaciones, leads, usuarios, configuración) pertenece a una empresa, y nadie ve datos de otra.
2. **Adaptar al rubro.** Donde el CRM de Pfaffen dice "auto de interés", acá es "propiedad" (venta o alquiler, zona, precio). Textos y campos del bot según el rubro.
3. **Conexión de canales por el cliente.** El botón de conectar ampliado a WhatsApp e Instagram, con la app de Meta aprobada para terceros. Este trámite en Meta lo hace Walter.
4. **Memoria del bot por empresa.** Cada inmobiliaria carga su información y el bot contesta solo con eso.
5. **Alta y cobro.** Registrar una empresa nueva y cobrar el abono mensual. El uso del bot (créditos de Claude) es un costo por cliente y tiene que estar incluido en el precio.
6. **Prueba con una o dos inmobiliarias conocidas** antes de salir a vender.

## Lo que hace Walter (no se automatiza)

- Trámites y revisión de la app en Meta (verificación de empresa, permisos).
- Cargar claves y secretos en Vercel. Nunca se escriben en este repo.
- Decidir precio y a quién se le ofrece primero.

## Competencia a tener en cuenta

En Argentina ya existen productos parecidos (Kommo, Leadsales, Clientify). La diferencia que se busca: más simple, en español, pensado para el rubro y con el bot incluido.

## Estado

Repo recién creado: todavía no hay código. El punto de partida es el CRM de Pfaffen (`pfaffenauto-web`).
