# Registro de decisiones

Lo que decidió Walter. Si una decisión cambia, se actualiza la fila con la fecha nueva; no se borra la historia de por qué.

| Tema | Decisión | Desde |
|---|---|---|
| Producto | La app se vende como el mismo servicio a distintas inmobiliarias. Cada una la usa de forma independiente: sus datos, su bot, sus claves y sus usuarios, sin ver nada de las otras. | 2/11/2026 |
| Sucursales | Cada inmobiliaria puede tener más de una oficina. Se copia la lógica de sucursales del CRM de Pfaffen (ronda propia por sucursal, el encargado ve lo de su sucursal). Los nombres de ejemplo son "Oficina 1", "Oficina 2", "Oficina 3", etc.; cada empresa pone los suyos. | 2/11/2026 |
| Roles | Tres: dueño, encargado y asesor. No hay director, taller, finanzas ni gestoría. | 2/11/2026 |
| Reasignación por tiempo | No se construye. Como en Pfaffen: el lead queda con su asesor y solo se avisa "cliente sin contestar" a quien lo tiene. Se puede sumar después del piloto si hace falta. | 2/11/2026 |
| Repositorio | Se trabaja en este repositorio (`waltercorvalan/inmobiliaria`), separado del CRM de Pfaffen, que queda solo para mirar. | 2/11/2026 |
| Cuentas | Proyectos nuevos y propios en Supabase y en Vercel, a nombre de Walter, separados de los de Pfaffen. Ningún dato ni clave se comparte con el CRM de Pfaffen. | 2/11/2026 |
| Nombre de la app | Provisorio: "Inmobiliaria CRM". Se cambia antes de venderla (cambian solo textos y dominio). Dominio: pendiente. | 2/11/2026 |
| Orígenes de cliente | Lista cerrada: Zonaprop, Argenprop, MercadoLibre, Instagram, Facebook, Messenger, WhatsApp, Web, Oficina, Llamada, Otro. No se agrega ni se saca ninguno sin que lo pida Walter. Un test la congela. | 2/11/2026 |
| Cobro | Todavía sin definir. La base se arma sin límites por plan; si después se cobra por asesor o por mensajes, se suma un contador. | 2/11/2026 |
| Canales de la primera versión | WhatsApp y el chat de la web. Instagram y Messenger después del piloto. | 2/11/2026 |
| App de Meta | Una app por empresa, creada en su propia cuenta (sin aprobación especial de Meta). Los secretos de cada app se guardan cifrados por empresa, no en Vercel. | 2/11/2026 |
