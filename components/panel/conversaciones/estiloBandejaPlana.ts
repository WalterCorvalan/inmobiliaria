// WhatsApp con el diseño Nuevo (Walter, 19/11/2026): tres columnas planas, como la imagen de referencia. ChatClient pone
// `chat-plano` en la bandeja y `chat-plano-detalles` en "Perfil del cliente"; esto alinea los controles que comparte con
// los otros diseños (secciones, selects, botones y notas) sin tocar sus clases. Lo agrega ConversacionesShell.
export const ESTILO_BANDEJA_PLANA = `
  .chat-plano-detalles .border-b { border-color: #EEEFF2; }
  .dark .chat-plano-detalles .border-b { border-color: rgba(255,255,255,0.06); }
  .chat-plano-detalles h4 { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; color: #6B7280 !important; }
  .dark .chat-plano-detalles h4 { color: #9CA3AF !important; }
  .chat-plano-detalles dt { color: #6B7280 !important; }
  .dark .chat-plano-detalles dt { color: #9CA3AF !important; }
  /* El tema Softcars pinta los títulos de oscuro también en modo oscuro: acá van en blanco. */
  .dark .diseno-material :is(h1, h2, h3) { color: #fff !important; }
  .chat-plano-detalles select, .chat-plano-detalles textarea, .chat-plano-detalles input {
    border-radius: 8px; border-color: #E4E6EB; background-color: #fff; font-size: 13px;
  }
  .dark .chat-plano-detalles select, .dark .chat-plano-detalles textarea, .dark .chat-plano-detalles input {
    border-color: rgba(255,255,255,0.12); background-color: rgba(255,255,255,0.03);
  }
  .chat-plano-detalles select:focus, .chat-plano-detalles textarea:focus, .chat-plano-detalles input:focus { border-color: #9CA3AF; box-shadow: none; }
  .chat-plano-detalles button.rounded-lg { border-radius: 8px; border-color: #E4E6EB; background-color: #fff; font-weight: 500; }
  .chat-plano-detalles button.rounded-lg:hover { background-color: #F9FAFB; }
  .dark .chat-plano-detalles button.rounded-lg { border-color: rgba(255,255,255,0.12); background-color: transparent; }
  .chat-plano-detalles .bg-emerald-600 { background-color: #374151; }
  .dark .chat-plano-detalles .bg-emerald-600 { background-color: #D1D5DB; }
`;
