# Registro de decisiones

Lo que decidió Walter. Si una decisión cambia, se actualiza la fila con la fecha nueva; no se borra la historia de por qué.

| Tema | Decisión | Desde |
|---|---|---|
| Producto | La app se vende como el mismo servicio a distintas inmobiliarias. Cada una la usa de forma independiente: sus datos, su bot, sus claves y sus usuarios, sin ver nada de las otras. | 2/11/2026 |
| SaaS y superadmin | Es un SaaS: se vende a la inmobiliaria A y, si va bien, a la B. Cada una configura y carga lo suyo. Hay un panel de **superadmin** del equipo (fuera de las empresas) desde donde se gestionan todas. El superadmin no pertenece a ninguna empresa. En la primera versión puede: dar de alta empresas (con su dueño y oficinas) y activarlas o suspenderlas; ver el estado de cada una (canales conectados o cortados, leads, mensajes, errores); ver el gasto de IA por empresa; y entrar como soporte a una empresa, dejando registrado quién entró y cuándo, sin ver nunca sus claves. | 2/11/2026 |
| Configuración del sitio por empresa | Se toma la idea de "Contenido del Sitio" de Pfaffen: cada empresa configura nombre, logo, colores y textos, y se reflejan en lo que ven sus clientes. Lo edita la empresa (el dueño) y el superadmin también puede verlo y corregirlo. | 2/11/2026 |
| Web pública | En la v1 no hay web nuestra: cada inmobiliaria sigue con su web y le damos el código del chat, que toma su nombre, logo y colores de la configuración. El catálogo propio con su dominio queda para la Fase 14; el diseño tiene que permitir sumarlo sin rehacer nada. | 2/11/2026 |
| Sucursales | Cada inmobiliaria puede tener más de una oficina. Se copia la lógica de sucursales del CRM de Pfaffen (ronda propia por sucursal, el encargado ve lo de su sucursal). Los nombres de ejemplo son "Oficina 1", "Oficina 2", "Oficina 3", etc.; cada empresa pone los suyos. | 2/11/2026 |
| Roles | Tres dentro de cada empresa: dueño, encargado y asesor. No hay director, taller, finanzas ni gestoría. Aparte, el superadmin de la plataforma (ver "SaaS y superadmin"). | 2/11/2026 |
| Reasignación por tiempo | **A revisar.** Walter eligió "no se construye, como en Pfaffen" (2/11/2026) porque se le dijo que Pfaffen no la tenía. Después se vio que la base de Pfaffen sí tiene las columnas y la pantalla de Lead Routing (activar, minutos, máximo de reasignaciones) y que una función de la base podría implementarla; en el código del repositorio no está. Se decide de nuevo cuando se vean las funciones de la base. Mientras tanto: no se construye nada nuevo. | 2/11/2026 |
| Repositorio | Se trabaja en este repositorio (`waltercorvalan/inmobiliaria`), separado del CRM de Pfaffen, que queda solo para mirar. | 2/11/2026 |
| Cuentas | Proyectos nuevos y propios en Supabase y en Vercel, a nombre de Walter, separados de los de Pfaffen. Ningún dato ni clave se comparte con el CRM de Pfaffen. | 2/11/2026 |
| Nombre de la app | Provisorio: "Inmobiliaria CRM". Se cambia antes de venderla (cambian solo textos y dominio). Dominio: pendiente. | 2/11/2026 |
| Orígenes de cliente | Lista cerrada: Zonaprop, Argenprop, MercadoLibre, Instagram, Facebook, Messenger, WhatsApp, Web, Oficina, Llamada, Otro. No se agrega ni se saca ninguno sin que lo pida Walter. Un test la congela. | 2/11/2026 |
| Cobro | Todavía sin definir. La base se arma sin límites por plan; si después se cobra por asesor o por mensajes, se suma un contador. | 2/11/2026 |
| Alcance de la primera versión | Leads y todos los canales de chat (WhatsApp, Instagram, Messenger y el chat de la web). Reemplaza la decisión anterior "solo WhatsApp y chat de la web". Las demás funciones del CRM (señas, ventas, expedientes, etc.) quedan para después. | 2/11/2026 |
| Método: copiar y generalizar | No se reescribe todo: se corta y pega desde `pfaffenauto-web` y después se reemplaza y generaliza para cualquier inmobiliaria. Lo que se copia es solo código, nunca datos ni claves. Mapa en `docs/extraccion-leads-y-chats.md`. | 2/11/2026 |
| App de Meta | Una app por empresa, creada en su propia cuenta (sin aprobación especial de Meta). Los secretos de cada app se guardan cifrados por empresa, no en Vercel. | 2/11/2026 |
