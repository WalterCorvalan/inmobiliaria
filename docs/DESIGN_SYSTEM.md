# Sistema de diseño

Todo vive en `app/inmo.css` (variables `--im-*` y clases `im-*`). Las pantallas nuevas se arman solo con eso.

## 01 Identidad
Cálido, de inmobiliaria, sobrio, la foto manda.

## 02 Colores (modo claro; el oscuro redefine las mismas variables)
| Nombre | Hex | Uso |
|---|---|---|
| Marca | #B4532F (o el color de la empresa, `--marca`) | Botones primarios, foco |
| Fondo | #F3EDE4 | Fondo de página |
| Superficie | #FFFFFF | Tarjetas, cajas |
| Superficie 2 | #F7F1E8 | Hover, fondos suaves |
| Línea | #E8DFD1 | Bordes |
| Texto | #2B241D | Texto principal |
| Apagado | #857A6D | Texto secundario |
| Oliva | #5D6B3C | Disponible / OK |
| Cielo | #3F6F86 | Información |
| Peligro | #B3382C | Errores, cancelar |

## 03 Tipografía
- Títulos: Fraunces 500-600 (H1 26px).
- Texto: Figtree 400-700 (14-16px; notas 12.5-13px).

## 04 Espaciado
Escala de 4/8 px: 4, 8, 12, 16, 20, 28.

## 05 Bordes
Tarjetas y cajas 12px · Botones 9px · Inputs 8px.

## 06 Componentes
- `im-page`, `im-head`, `im-box`, `im-card`, `im-grid`, `im-kpis` (fila de 4 números), `im-tabs`/`im-tab`, `im-chips`/`im-chip`.
- `im-btn` y `im-btn primary`; `im-input`; `im-field` (`full` para ocupar el ancho).
- Modales: `im-overlay` > `im-modal` > `im-modal-h` / `im-modal-b` / `im-modal-f`.
- `im-error` para errores, `im-note` para texto apagado, `im-vacio` para estados vacíos.

## 07 Íconos
Lucide, de línea, 14-18px.

## 08 Pantallas
Celular < 640px · Tablet 640-1024px · Escritorio > 1024px. En el celular hay barra de accesos abajo.

## Reglas
- Nunca colores fuera de esta paleta (salvo el color de marca de cada empresa).
- Primero celular. Modo oscuro: sí (clase `dark`).
