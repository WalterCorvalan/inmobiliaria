# Plan de módulos después de la v1 (6/11/2026)

La v1 es **mensajes + leads + bot** (5 módulos: Leads, WhatsApp, Instagram, Messenger, Chat web). Este documento ordena qué módulos de Pfaffen (`pfaffenauto-web`, solo lectura) se pueden sumar después, cuáles hay que repensar y cuáles no se copian.

Es una propuesta para que Walter la valide: lo que está acá todavía **no es una decisión cerrada**, salvo lo que figure en `decisiones.md`.

## Principios

- **No se ofrece todo de entrada.** La ventaja frente a Kommo, Leadsales o Clientify es que es simple. Se vende la v1 y se suman módulos según lo que pida la inmobiliaria.
- **Un módulo por vez**, con el método de siempre: copiar de Pfaffen, pasar de "auto" a "propiedad", atar cada dato a la empresa, tabla nueva con seguridad por fila, entrada en `TABLAS_DE_EMPRESA` (`lib/empresa/db.ts`) y que pase el test de aislamiento.
- **El orden lo define el dolor del cliente piloto.** Preguntarle a la inmobiliaria piloto qué le duele más (consultar propiedades, perder visitas, cobrar alquileres) antes de arrancar.
- Los textos para el cliente final dicen "oficina" y "asesor" (en el código siguen `sucursal` y `ventas`).

## Se adaptan bien (cambio de vocabulario y poco más)

| Módulo de Pfaffen | En la inmobiliaria | Nota |
|---|---|---|
| Stock | **Propiedades** | Venta y alquiler, fotos, precio, zona, estado. Es el primero: el bot de los chats podría ofrecerlas |
| Test drives | **Visitas** | La base de visitas ya existe en `sql_004_leads.sql` |
| Calendario | Calendario | Visitas y vencimientos |
| Clientes | Clientes | Compradores, inquilinos y propietarios |
| Dormidos y recontactos | Seguimiento de clientes y leads sin movimiento | Se apoya en los avisos de "sin respuesta" que ya existen |
| Alertas | Avisos de seguimiento | |
| Dashboard y reportes | Dashboard y reportes | Con números del rubro |

## Se adaptan, pero hay que repensarlos

| Módulo de Pfaffen | En la inmobiliaria | Por qué no es copia directa |
|---|---|---|
| Señas | **Reservas** | Distinto circuito y distintos papeles |
| Ventas | **Operaciones** (venta o alquiler) | Hay que modelar las dos puntas: propietario e interesado |
| Comisiones | **Honorarios** | Es el negocio central: se cobra a ambas partes y con porcentajes por operación |
| Cotizaciones | **Tasaciones** | Otra lógica: se valúa una propiedad, no se presupuesta un auto |
| Finanzas | Versión chica | Ingresos por honorarios y gastos. Más adelante |
| Postventa | **Renovaciones** | En una inmobiliaria se parece a renovar contratos |

## No se copian

Transferencias, financiación y seguros (acá serían hipotecas, otro tema), peritajes, taller, gestoría e infracciones: son cosas de autos. Ya figuran en `decisiones.md` como "Funciones de autos que NO se copian" las de marketing de autos, cumpleaños, post-venta, NPS y documentación.

## Lo que Pfaffen no tiene y una inmobiliaria sí necesita (se construye, no se copia)

- **Administración de alquileres:** contratos, cobro mensual, ajustes por índice, vencimientos y rendiciones al propietario. Para muchas inmobiliarias es el corazón del negocio.
- **Publicación en portales** (Zonaprop, Argenprop) en lugar de MercadoLibre. Es una integración grande: dejarla para el final.

## Orden sugerido

1. **Propiedades** (y que el bot las ofrezca).
2. **Clientes.**
3. **Visitas + Calendario.**
4. **Recontactos + Alertas** (seguimiento de lo que se enfrió).
5. **Reservas, Operaciones y Honorarios.**
6. **Dashboard y reportes.**
7. **Administración de alquileres**, si el cliente piloto la necesita (puede subir de lugar).
8. **Finanzas chica y portales**, al final.

Si el piloto necesita alquileres desde el día uno, el punto 7 pasa a ser el primero.

## Antes de arrancar cualquier módulo

- La prueba real contra un Supabase real y contra Meta sigue siendo obligatoria antes de conectar una inmobiliaria real (ver `LEEME-PRIMERO.md`).
- Leer el `ARCHITECTURE.md` del módulo equivalente en Pfaffen, si existe, para no romper componentes compartidos.
- Anotar en `decisiones.md` el módulo elegido y su fecha.

## Nota: el repo `Automotora`

Tiene un esqueleto de panel (`crm/`, rama `claude/compraventa-autos-setup-5vc9s3`) con carpetas con estos mismos nombres, pero para **compraventa de autos**. Es un proyecto aparte; no se mezcla con este.
