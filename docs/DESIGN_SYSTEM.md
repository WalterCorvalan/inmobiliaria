# Sistema de diseño

Rediseño del 25/11/2026 (pedido de Walter): el panel toma el aspecto del panel completo de Pfaffen. Limpio, claro y con
un solo color de acento. Reemplaza al estilo "planilla de taller" (arena, ladrillo, oliva, letras condensadas).

Dónde vive: `app/panel-limpio.css` (letra y acento), `app/panel-marca.css` (color de la empresa), `app/inmo.css`
(variables `--im-*` y clases `im-*` para pantallas nuevas) y el armado del panel en `app/panel/PanelLayoutClient.tsx`.

## 01 Identidad
Profesional y simple: fondo gris muy claro, tarjetas blancas, mucho aire. La foto del auto y los números mandan.

## 02 Colores (modo claro; el oscuro redefine las mismas variables)
| Nombre | Valor | Uso |
|---|---|---|
| Marca | `--marca` (color de la empresa; por defecto #0145F2) | Botones primarios, menú activo, foco, barras |
| Fondo | #F6F7F9 | Fondo de página |
| Superficie | #FFFFFF | Tarjetas, menú, barras |
| Superficie 2 | #F1F5F9 (slate-100) | Hover, campos |
| Línea | #E2E8F0 (slate-200) | Bordes |
| Texto | #0F172A (slate-900) | Texto principal |
| Apagado | #64748B (slate-500) | Texto secundario |
| Estados | emerald (OK), amber (pendiente), rose (urgente/caliente), sky (frío/info) | Etiquetas y puntos |

La escala `indigo` de Tailwind se calcula desde `--marca`: usar `indigo-*` es usar el color de la empresa.

## 03 Tipografía
Plus Jakarta Sans en todo el panel. Títulos 800 (H1 de barra 20px, saludo de Inicio 30px), texto 13-15px, notas 12px.
Números con `tabular-nums`.

## 04 Espaciado
Escala de 4/8 px. Páginas: 16px de margen en el celular, 32px en la compu, ancho máximo 1280px.

## 05 Bordes
Tarjetas 16px (`rounded-2xl`) con borde slate-200 y sombra mínima · Botones y campos 10-12px · Etiquetas redondas.

## 06 Armado del panel
- Compu: menú lateral blanco con nombres (252px). Entre 768 y 1280px queda angosto con íconos y se abre al pasar el mouse.
- Barra de arriba: nombre de la pantalla (no se repite adentro), "Probar el bot" en la demo, modo oscuro y avisos.
- Celular: barra de arriba fina (menú + pantalla + avisos), barra de abajo con Inicio, Leads, Stock, Agenda y Menú, y el
  menú completo entra desde la izquierda por encima de todo.
- Franja de demo: una sola línea, sin repetir el menú.

## 07 Componentes
- `im-page`, `im-head` (en el panel solo muestra la bajada: el título está en la barra), `im-box`, `im-card`, `im-grid`,
  `im-kpis`, `im-tabs`/`im-tab`, `im-chips`/`im-chip`, `im-btn` / `im-btn primary`, `im-input`, `im-field`.
- Modales: `im-overlay` > `im-modal` > `im-modal-h` / `im-modal-b` / `im-modal-f`.
- `im-error`, `im-note`, `im-vacio`.

## 08 Íconos
Menú e Inicio: los dibujos en color de `public/icons/panel/` (componente `IconoPanel`). Dentro de las pantallas: Lucide de
línea, 14-18px.

## 09 Pantallas
Celular < 768px · Tablet 768-1280px · Escritorio > 1280px. Probar a 390px, 1366×768 y modo oscuro.

## Reglas
- Un solo acento: el color de la empresa. Nada de colores fuera de esta paleta.
- No repetir el nombre de la pantalla dentro de la página.
- Primero celular. Modo oscuro: sí (clase `dark`).
