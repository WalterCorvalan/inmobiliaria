# Propiedades: cómo funciona y con qué se conecta

Primer módulo que se suma encima de Leads y canales (idea de Pfaffen: el stock, pero de propiedades). Versión corta a propósito: no se copió el módulo de stock de Pfaffen (MercadoLibre, Instagram, mandatos, peritajes, ficha de gastos); se escribió lo mínimo que una inmobiliaria necesita para cargar y ofrecer propiedades.

## Tabla

`propiedades` (migración `migraciones/sql_009_propiedades.sql`). Una fila por propiedad, con `empresa_id`.
- Operación: `venta`, `alquiler`, `alquiler_temporario`. Estados: `disponible`, `reservada`, `vendida` (solo ventas), `alquilada` (solo alquileres), `no_disponible`.
- Precio con su moneda (`USD` o `ARS`). **No se convierte entre monedas en ningún lado**; si hace falta, va en `lib/` con su test.
- `fotos` es una lista de direcciones públicas. `publicada` = se puede ofrecer a los clientes (bot, catálogo futuro).
- `sucursal_id` (oficina) y `vendedor_id` (responsable) tienen que ser de la misma empresa: lo controla el trigger `controlar_propiedad` (una clave foránea sola no alcanza para eso).
- Seguridad: cualquiera de la empresa ve, carga y edita; **solo dueño y encargado borran**. El código interno no se repite dentro de una empresa (sí entre empresas).

## Código

- `lib/propiedades.ts` (+ test): listas cerradas, formato de precio, lectura de números a la argentina, validación y limpieza del formulario. Los valores tienen que coincidir con los CHECK de la tabla.
- `app/panel/propiedades/page.tsx`: carga con la sesión de la persona (la seguridad por fila hace el filtro por empresa).
- `PropiedadesClient.tsx`: lista, filtros, cambio de estado, borrado.
- `PropiedadModal.tsx`: alta y edición, con subida de fotos.
- `EstadoPropiedadSelector.tsx`: cambia el estado desde la lista (solo ofrece los que corresponden a la operación).
- `app/api/panel/propiedades/foto/route.ts`: da una dirección firmada para que el navegador suba la foto directo a R2, en `propiedades/<empresa>/...`. Solo JPG, PNG y WebP. Necesita las variables `R2_*` (ver `.env.example`) y que el bucket permita PUT desde el sitio (CORS).

## Qué es frágil

- Si se agrega un valor a operación, tipo o estado, hay que cambiarlo en **tres lugares**: el CHECK de la migración, `lib/propiedades.ts` y el test.
- La tabla está en `TABLAS_DE_EMPRESA` (`lib/empresa/db.ts`); el test de aislamiento falla si falta.
- El límite de 10 MB por foto se controla en el navegador; la dirección firmada no lo impone en el servidor.

## Lo que falta (a propósito)

- Que el bot de los chats ofrezca propiedades y que el lead guarde "propiedad de interés" (siguiente paso).
- Visitas, catálogo web propio, importar desde Excel, publicar en portales.
