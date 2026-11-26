// Stock con el diseño Nuevo, estilo SaaS moderno (Linear / Notion / Front), pedido de Walter del 19/11/2026: fondo gris
// claro con tarjetas blancas, líneas finas en vez de sombras, esquinas apenas redondeadas (8 a 12 px, ni píldoras ni
// cuadradas: "un poquito de bordes") y estados en píldora chica,
// y secciones del formulario separadas por una línea. Misma información y mismos botones: solo cambia el aspecto.
// StockNuevoClient (y Leads y Señas, 19/11/2026) pone "stock-minimal" en la pantalla; alcanza a todo lo que se abre adentro (formulario de alta y
// edición, mandato, ficha). Va después de los estilos de siempre de Stock, por eso les gana.
export const ESTILO_STOCK_MINIMAL = `
  .stock-minimal { --linea: #E8E9ED; --linea-suave: #EEEFF2; --campo: #E4E6EB; }
  .dark .stock-minimal { --linea: rgba(255,255,255,0.09); --linea-suave: rgba(255,255,255,0.06); --campo: rgba(255,255,255,0.14); }

  /* Cajas: esquinas chicas y una línea fina en vez de sombra. */
  .stock-minimal :is(.rounded-\\[28px\\], .rounded-\\[24px\\], .rounded-\\[22px\\], .rounded-\\[20px\\], .rounded-\\[18px\\], .rounded-3xl, .rounded-2xl,
    .md\\:rounded-\\[22px\\], .md\\:rounded-\\[24px\\], .md\\:rounded-\\[28px\\]) { border-radius: 8px !important; }
  /* Franjas con texto (p. ej. "8 vehículos en lista") que eran píldoras; los círculos de las fotos no tienen px-. */
  .stock-minimal div.rounded-full[class*="px-"] { border-radius: 10px !important; }
  /* Números de arriba un poco más chicos, como en los tableros de Linear. */
  @media (min-width: 768px) { .stock-minimal .md\\:text-\\[32px\\] { font-size: 26px !important; } }
  .stock-minimal :is(div, section, article, li, details, form, label).ring-1,
  .stock-minimal :is(div, section, article, li, details, form, label)[class*="shadow-[0_1px"],
  .stock-minimal :is(div, section, article, li, details, form, label).shadow-sm { box-shadow: 0 0 0 1px var(--linea) !important; }
  .stock-minimal :is(div, section, article).shadow-xl { box-shadow: 0 0 0 1px var(--linea), 0 12px 32px rgba(15,23,42,0.12) !important; }

  /* Botones, pestañas y filtros: de píldora a esquina chica. Los grises pasan a blancos con línea. */
  .stock-minimal :is(button, a, input, select, textarea, label).rounded-full { border-radius: 8px !important; }
  .stock-minimal :is(button, a)[class*="bg-[#F3F4F7]"] { background-color: #fff !important; box-shadow: inset 0 0 0 1px var(--campo); }
  .dark .stock-minimal :is(button, a)[class*="bg-[#F3F4F7]"] { background-color: transparent !important; }
  .stock-minimal .boton-principal { box-shadow: none !important; }

  .stock-minimal .stock-tabla-nuevo td span.rounded-md:not(:empty), .stock-minimal .stock-tabla-nuevo td span.rounded-lg:not(:empty) { border-radius: 9999px !important; }
  /* Tabla y tarjetas del celular. */
  .stock-minimal .stock-tabla-nuevo > div:first-child { border-radius: 12px !important; box-shadow: 0 0 0 1px var(--linea) !important; }
  .stock-minimal .stock-tabla-nuevo > div:last-child > div { border-radius: 12px !important; box-shadow: 0 0 0 1px var(--linea) !important; }
  .stock-minimal .stock-tabla-nuevo thead tr, .stock-minimal .stock-tabla-nuevo thead th { background: #FAFAFB !important; }
  .dark .stock-minimal .stock-tabla-nuevo thead tr, .dark .stock-minimal .stock-tabla-nuevo thead th { background: rgba(255,255,255,0.03) !important; }
  /* Solo la línea de abajo: el borde izquierdo es el color de días en stock (verde, +30 amarillo, +60 rojo) y no se pisa
     (con "border-color" quedaba gris y se perdía, Walter 20/11/2026). */
  .stock-minimal .stock-tabla-nuevo tbody tr { border-bottom-color: var(--linea-suave); }

  /* Formularios (alta, edición, mandato): ventana con esquinas chicas, campos más bajos y secciones con una línea. */
  .stock-minimal .diseno-form > .fixed > .relative, .stock-minimal .diseno-form > .fixed > .shadow-2xl { border-radius: 14px !important; box-shadow: 0 0 0 1px var(--linea), 0 24px 48px rgba(15,23,42,0.16) !important; }
  .stock-minimal .diseno-form input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]),
  .stock-minimal .diseno-form select, .stock-minimal .diseno-form textarea {
    border-radius: 8px; border-color: var(--campo); min-height: 38px; font-size: 14px; box-shadow: none;
  }
  .stock-minimal .diseno-form input:focus, .stock-minimal .diseno-form select:focus, .stock-minimal .diseno-form textarea:focus { border-color: #9CA3AF; box-shadow: 0 0 0 3px rgba(148,163,184,0.18); }
  .stock-minimal .diseno-form :is(.rounded-xl, .rounded-lg) { border-radius: 8px; }
  .stock-minimal .diseno-form label.block { font-size: 12px; font-weight: 500; color: var(--color-slate-600); }
  .dark .stock-minimal .diseno-form label.block { color: var(--color-slate-400); }
  .stock-minimal .diseno-form nav button { border-radius: 8px; padding: 6px 10px; }
  .stock-minimal .diseno-form :is([id^="vehiculo-paso-"], [id^="mandato-paso-"], [id^="sena-paso-"], [id^="venta-paso-"], [id^="cotizacion-paso-"]) {
    background: transparent !important; border-radius: 0 !important; padding: 0 0 8px !important; margin-top: 20px !important;
    border-bottom: 1px solid var(--linea);
  }
  .stock-minimal .diseno-form :is([id^="vehiculo-paso-"], [id^="mandato-paso-"], [id^="sena-paso-"], [id^="venta-paso-"], [id^="cotizacion-paso-"]) p { font-size: 14px !important; font-weight: 600; color: var(--color-slate-900) !important; }
  .dark .stock-minimal .diseno-form :is([id^="vehiculo-paso-"], [id^="mandato-paso-"], [id^="sena-paso-"], [id^="venta-paso-"], [id^="cotizacion-paso-"]) p { color: #fff !important; }
  /* El ícono de color de cada parte se queda (Walter, 19/11/2026: "los iconos deben quedar siempre"), apenas más chico. */
  .stock-minimal .diseno-form :is([id^="vehiculo-paso-"], [id^="mandato-paso-"], [id^="sena-paso-"], [id^="venta-paso-"], [id^="cotizacion-paso-"]) p::before { width: 20px; height: 20px; }
  .stock-minimal .diseno-form :is([id^="vehiculo-paso-"], [id^="mandato-paso-"], [id^="sena-paso-"], [id^="venta-paso-"], [id^="cotizacion-paso-"]) > span {
    border-radius: 6px !important; background: #F3F4F6 !important; color: #6B7280 !important;
  }
  .dark .stock-minimal .diseno-form :is([id^="vehiculo-paso-"], [id^="mandato-paso-"], [id^="sena-paso-"], [id^="venta-paso-"], [id^="cotizacion-paso-"]) > span { background: rgba(255,255,255,0.08) !important; color: #9CA3AF !important; }

  /* Vistas de detalle (DetalleUIMaterial: ficha del auto, seña): ventana con esquinas chicas, el bloque de arriba sin caja
     gris, y cada sección separada por una línea en vez de un recuadro gris (Walter, 19/11/2026: "sacarle tantas tarjetas"). */
  .stock-minimal .detalle-ventana { border-radius: 14px 14px 0 0 !important; box-shadow: 0 0 0 1px var(--linea), 0 24px 48px rgba(15,23,42,0.16) !important; }
  @media (min-width: 640px) { .stock-minimal .detalle-ventana { border-radius: 14px !important; } }
  .stock-minimal .detalle-cabecera { background: transparent !important; border-radius: 0 !important; padding: 0 0 14px !important; border-bottom: 1px solid var(--linea); }
  .stock-minimal .detalle-cabecera > div.shrink-0:first-child { background: #F3F4F6; }
  .dark .stock-minimal .detalle-cabecera > div.shrink-0:first-child { background: rgba(255,255,255,0.05); }
  .stock-minimal .detalle-seccion { background: transparent !important; border-radius: 0 !important; padding: 14px 0 2px !important; border-top: 1px solid var(--linea); }
  .stock-minimal .detalle-seccion + .detalle-seccion { margin-top: 0 !important; }
  .stock-minimal .detalle-seccion > div:first-child > p { font-size: 13px; }
  /* Los íconos de color de cada sección quedan (Walter, 19/11/2026), en un cuadrito con línea fina como el del título. */
  .stock-minimal .detalle-icono-seccion { width: 28px !important; height: 28px !important; border-radius: 8px !important; background: #fff !important; box-shadow: inset 0 0 0 1px var(--linea) !important; }
  .dark .stock-minimal .detalle-icono-seccion { background: rgba(255,255,255,0.04) !important; }
  .stock-minimal .detalle-importe { background: #fff !important; border-radius: 10px !important; box-shadow: inset 0 0 0 1px var(--linea); }
  .dark .stock-minimal .detalle-importe { background: transparent !important; }
  .stock-minimal .detalle-importe > p:first-child { color: var(--color-slate-500) !important; font-size: 12px; }
  .stock-minimal .detalle-pie { border-color: var(--linea) !important; }
  .stock-minimal .detalle-pie :is(a, button) { height: auto !important; min-height: 40px; padding: 6px 10px !important; font-size: 13px !important; line-height: 1.2; border-radius: 8px !important; box-shadow: none !important; }
  @media (min-width: 640px) { .stock-minimal .detalle-pie :is(a, button) { font-size: 14px !important; } }
`;
