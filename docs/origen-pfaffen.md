# Origen de la copia

- Repositorio de origen: `WalterCorvalan/pfaffenauto-web` (solo lectura, no se toca).
- Versión copiada: commit `186a821dc69dda0018157a192dfe5234fd4d530f` (2/11/2026).
- Método: copia en bloque, sin cambios, en un commit propio. Después se generaliza en commits aparte, para que se vea qué se sacó y qué se cambió.
- Qué se copió (379 archivos): lo que importan Leads, las 4 bandejas, los webhooks, la configuración de canales, el chat de la web y las tareas automáticas de chats; el marco del panel (menú, login, estilos); los tests de esos archivos; la configuración del proyecto; los íconos del panel. Lista exacta en `origen-pfaffen-archivos.txt`.
- Qué NO se copió: datos, claves, archivos `.env`, documentos de marketing, las migraciones de Pfaffen (la base se rehace con empresa; ver `fase-3-diseno-base.md`), la web pública y los módulos de autos, ventas, señas, finanzas, taller, etc.
- Estado: **no compila todavía**. El marco del panel arrastra pantallas de otros módulos (nueva venta, nueva seña, nueva cotización, nuevo vehículo, nuevo cliente) que se sacan en la pasada 1.

## Pasadas siguientes (ver `extraccion-leads-y-chats.md`)

1. Sacar lo que no es de la v1, autos → propiedades, quitar nombres propios de Pfaffen. Que compile y pasen los tests.
2. Empresa en cada dato, seguridad por empresa y test de aislamiento.
3. Credenciales de Meta por empresa y tareas automáticas por empresa.
4. Panel superadmin y configuración de marca por empresa.
