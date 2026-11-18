// Configuración de la demo para inmobiliarias: negocio, oficinas, propiedades, asesores y leads. TODO es ficticio
// (Walter, 13/11/2026: demos de marca blanca con datos inventados). Para mostrarla con el nombre de un cliente se
// cambian nombreNegocio y nombreBot; el resto se puede dejar igual.
import type { LeadDemo, RubroDemo } from "./tipos";

// Código, operación, tipo, zona, datos y precio. Lo lee el bot como "información de la empresa".
const PROPIEDADES = [
  "A101 · Alquiler · Monoambiente en Belgrano, 32 m², balcón, a 3 cuadras del subte D · $ 520.000/mes + expensas $ 85.000 · no acepta mascotas",
  "A102 · Alquiler · Departamento 2 ambientes en Belgrano, 48 m², luminoso, cocina separada · $ 690.000/mes + expensas $ 110.000 · acepta mascotas",
  "A103 · Alquiler · Departamento 3 ambientes en Núñez, 72 m², cochera, amenities · $ 1.050.000/mes + expensas $ 190.000 · acepta mascotas",
  "A104 · Alquiler · PH 2 ambientes en Villa Urquiza, 55 m², patio propio · $ 640.000/mes, sin expensas · acepta mascotas",
  "A105 · Alquiler · Departamento 2 ambientes en Caballito, 45 m², a estrenar · $ 650.000/mes + expensas $ 95.000 · no acepta mascotas",
  "A106 · Alquiler · Departamento 3 ambientes en Lomas de Zamora centro, 68 m², balcón · $ 580.000/mes + expensas $ 70.000 · acepta mascotas",
  "A107 · Alquiler · Casa 3 ambientes en Banfield, 110 m², jardín y parrilla · $ 750.000/mes, sin expensas · acepta mascotas",
  "A108 · Alquiler · Monoambiente en Lomas de Zamora, 30 m², ideal estudiante · $ 380.000/mes + expensas $ 45.000 · no acepta mascotas",
  "V201 · Venta · Departamento 2 ambientes en Belgrano, 50 m², balcón al frente · USD 118.000 · apto crédito",
  "V202 · Venta · Departamento 3 ambientes en Núñez, 80 m², cochera y baulera · USD 215.000 · apto crédito",
  "V203 · Venta · Monoambiente en Colegiales, 35 m², a estrenar · USD 79.000 · apto crédito",
  "V204 · Venta · PH 3 ambientes en Villa Urquiza, 90 m², terraza propia · USD 165.000 · no apto crédito",
  "V205 · Venta · Departamento 4 ambientes en Belgrano R, 120 m², dependencia, 2 cocheras · USD 250.000 · apto crédito",
  "V206 · Venta · Casa 4 ambientes en Banfield, 180 m² cubiertos, lote 10x30, pileta · USD 195.000 · apto crédito",
  "V207 · Venta · Casa 3 ambientes en Lomas de Zamora, 120 m², garage · USD 128.000 · apto crédito",
  "V208 · Venta · Departamento 2 ambientes en Lomas de Zamora centro, 52 m² · USD 68.000 · apto crédito",
  "V209 · Venta · Departamento 3 ambientes en Temperley, 75 m², balcón aterrazado · USD 99.000 · apto crédito",
  "V210 · Venta · Lote 10x40 en Adrogué, barrio residencial · USD 60.000",
  "L301 · Alquiler · Local comercial en Av. Cabildo, Belgrano, 40 m², vidriera · $ 1.400.000/mes",
  "L302 · Venta · Local comercial en Lomas de Zamora centro, 60 m² · USD 140.000",
].join("\n");

const REQUISITOS = "Alquiler: contrato de 3 años (ley vigente), ajuste según índice pactado, garantía propietaria o seguro de caución, recibo de sueldo o constancia de ingresos, mes de depósito y mes de adelanto. Honorarios de la inmobiliaria: 1 mes de alquiler (inquilino). Venta: honorarios 3% comprador. Las visitas se coordinan con un asesor.";

const leads: LeadDemo[] = [
  {
    id: "l1", nombre: "Carolina Méndez", canal: "whatsapp", estado: "calificando", calificacion: "caliente", asesor: "Laura Gómez", hace: "hace 20 min",
    resumen: "Quiere alquilar el 2 ambientes de Belgrano (A102) y consultó si acepta mascotas.\nPresupuesto: $ 700.000 por mes.\nTiene garantía propietaria.\nVisita: jueves 19 a las 11:00 en Oficina Belgrano.\nTemperatura: caliente.\nPendiente: que un asesor confirme la visita.",
    charla: [
      { role: "user", content: "Hola! Vi el 2 ambientes de Belgrano, sigue disponible?" },
      { role: "assistant", content: "¡Hola! Sí, el A102 sigue disponible: 48 m², luminoso, $ 690.000 por mes más expensas. ¿Me decís tu nombre?" },
      { role: "user", content: "Carolina. Acepta mascotas? Tengo un gato" },
      { role: "assistant", content: "Sí, Carolina, acepta mascotas. ¿Querés pasar a verlo? Tengo el jueves 19 a las 11:00." },
      { role: "user", content: "Dale, jueves 11 perfecto. Tengo garantía propietaria" },
    ],
  },
  {
    id: "l2", nombre: "martin.ruiz", canal: "instagram", estado: "nuevo", calificacion: "tibio", asesor: null, hace: "hace 1 h",
    resumen: "Quiere comprar un 2 ambientes para inversión y consultó qué hay en Belgrano.\nPresupuesto: USD 120.000.\nPendiente: que un asesor le mande opciones de propiedad.",
    charla: [
      { role: "user", content: "Buenas, tienen 2 ambientes en venta en Belgrano?" },
      { role: "assistant", content: "¡Hola! Sí, tenemos el V201: 2 ambientes, 50 m², balcón al frente, USD 118.000 y apto crédito. ¿Es para vivir o para inversión?" },
      { role: "user", content: "inversión, hasta 120 mil más o menos" },
    ],
  },
  {
    id: "l3", nombre: "Jorge Benítez", canal: "messenger", estado: "asignado", calificacion: "caliente", asesor: "Martín Ríos", hace: "hace 3 h",
    resumen: "Quiere comprar la casa de Banfield con pileta (V206) y consultó si aceptan propiedad en parte de pago.\nPresupuesto: USD 150.000 en efectivo más la venta de su departamento.\nPendiente: que un asesor le tase el departamento y coordine la visita.",
    charla: [
      { role: "user", content: "Hola, me interesa la casa de Banfield con pileta" },
      { role: "assistant", content: "¡Hola! Es la V206: 4 ambientes, 180 m² cubiertos, lote de 10x30 con pileta, USD 195.000. ¿Cómo pensás pagarla?" },
      { role: "user", content: "Tengo 150 mil y vendo mi depto. Toman propiedad en parte de pago?" },
      { role: "assistant", content: "Eso lo tiene que ver un asesor. Te paso con Martín, que te puede tasar el departamento. ¿Tenés alguna otra consulta mientras tanto?" },
    ],
  },
  {
    id: "l4", nombre: "Lucía Fernández", canal: "whatsapp", estado: "calificando", calificacion: "tibio", asesor: "Sofía Paz", hace: "hace 5 h",
    resumen: "Quiere alquilar una casa con patio en zona sur y consultó por la de Banfield (A107).\nPresupuesto: $ 750.000 por mes.\nNo tiene garantía propietaria, consultó por seguro de caución.\nPendiente: que un asesor le explique el seguro de caución.",
    charla: [
      { role: "user", content: "Hola, busco casa con patio en alquiler por zona sur" },
      { role: "assistant", content: "¡Hola! Tenemos la A107 en Banfield: 3 ambientes, jardín y parrilla, $ 750.000 por mes sin expensas, acepta mascotas. ¿Te interesa?" },
      { role: "user", content: "Sí! Pero no tengo garantía propietaria" },
      { role: "assistant", content: "No hay problema: también se acepta seguro de caución. ¿Me decís tu nombre así un asesor te explica cómo se tramita?" },
    ],
  },
  {
    id: "l5", nombre: "Ramiro Acosta", canal: "whatsapp", estado: "nuevo", calificacion: "frio", asesor: null, hace: "hace 6 h",
    resumen: "Consultó precios de monoambientes en venta, sin zona definida.\nPendiente: que un asesor lo contacte y definir qué propiedad le interesa.",
    charla: [
      { role: "user", content: "Cuánto sale un monoambiente?" },
      { role: "assistant", content: "¡Hola! Tenemos el V203 en Colegiales, a estrenar, USD 79.000. ¿Buscás en alguna zona en particular?" },
      { role: "user", content: "no sé todavía, estoy mirando" },
    ],
  },
  {
    id: "l6", nombre: "Valeria Sosa", canal: "instagram", estado: "calificando", calificacion: "caliente", asesor: "Laura Gómez", hace: "ayer",
    resumen: "Quiere comprar el 3 ambientes de Núñez con cochera (V202) con crédito hipotecario.\nPresupuesto: USD 80.000 de ahorro más crédito.\nTeléfono: 11 4000 1234.\nPendiente: que un asesor confirme la visita del sábado.",
    charla: [
      { role: "user", content: "Hola!! el depto de Núñez con cochera es apto crédito?" },
      { role: "assistant", content: "¡Hola! Sí, el V202 es apto crédito: 3 ambientes, 80 m², cochera y baulera, USD 215.000. ¿Ya tenés el crédito preaprobado?" },
      { role: "user", content: "Sí, tengo 80 mil ahorrados y el resto con el banco. Mi cel 11 4000 1234" },
    ],
  },
  {
    id: "l7", nombre: "Diego Paredes", canal: "messenger", estado: "perdido", calificacion: "frio", asesor: "Martín Ríos", hace: "ayer",
    resumen: "Quería alquilar un 3 ambientes en Palermo.\nPresupuesto: $ 500.000 por mes.\nNo hay propiedades en esa zona con ese precio.\nPendiente: avisarle si entra algo en Palermo.",
    charla: [
      { role: "user", content: "Tienen 3 ambientes en Palermo por 500 mil?" },
      { role: "assistant", content: "Por ahora no tenemos propiedades en Palermo. El más parecido es el A103 en Núñez, pero está $ 1.050.000. ¿Querés que te avisemos si entra algo?" },
      { role: "user", content: "ok avisame" },
    ],
  },
  {
    id: "l8", nombre: "Marcela Torres", canal: "whatsapp", estado: "convertido", calificacion: "caliente", asesor: "Sofía Paz", hace: "hace 2 días",
    resumen: "Quiere alquilar el 3 ambientes de Lomas centro (A106).\nPresupuesto: $ 600.000 por mes.\nVisita: martes 10 a las 17:00 en Oficina Lomas.\nFirmó la reserva.\nPendiente: preparar el contrato.",
    charla: [
      { role: "user", content: "Hola, el 3 ambientes de Lomas centro sigue?" },
      { role: "assistant", content: "¡Hola! Sí, el A106: 68 m² con balcón, $ 580.000 por mes más expensas. ¿Querés verlo?" },
      { role: "user", content: "Sí, el martes a la tarde puedo" },
      { role: "assistant", content: "Perfecto, te espero el martes 10 a las 17:00 en la Oficina Lomas. ¿Me decís tu nombre?" },
      { role: "user", content: "Marcela Torres" },
    ],
  },
  {
    id: "l9", nombre: "Federico Luna", canal: "whatsapp", estado: "calificando", calificacion: "tibio", asesor: "Laura Gómez", hace: "hace 2 días",
    resumen: "Quiere vender su departamento de 2 ambientes en Caballito y pidió una tasación.\nPara cuándo: antes de fin de año.\nPendiente: que un asesor coordine la tasación.",
    charla: [
      { role: "user", content: "Hola, quiero vender mi depto en Caballito, hacen tasaciones?" },
      { role: "assistant", content: "¡Hola! Sí, hacemos tasaciones sin cargo. ¿Cuántos ambientes tiene y para cuándo querés venderlo?" },
      { role: "user", content: "2 ambientes, la idea es antes de fin de año" },
    ],
  },
  {
    id: "l10", nombre: "sofi.garcia", canal: "instagram", estado: "nuevo", calificacion: "tibio", asesor: null, hace: "hace 3 días",
    resumen: "Quiere alquilar un monoambiente cerca de la facultad en Lomas (A108).\nPresupuesto: $ 400.000 por mes.\nPendiente: que un asesor le pase los requisitos para estudiantes.",
    charla: [
      { role: "user", content: "hola, el monoambiente de lomas es para estudiante?" },
      { role: "assistant", content: "¡Hola! Sí, el A108 es ideal para estudiantes: 30 m², $ 380.000 por mes más expensas. ¿Tenés quién te salga de garante?" },
    ],
  },
  {
    id: "l11", nombre: "Hernán Castro", canal: "messenger", estado: "asignado", calificacion: "caliente", asesor: "Martín Ríos", hace: "hace 3 días",
    resumen: "Quiere alquilar el local de Av. Cabildo (L301) para una cafetería.\nPresupuesto: $ 1.400.000 por mes.\nPara cuándo: enero.\nPendiente: que un asesor le mande el contrato modelo.",
    charla: [
      { role: "user", content: "Buenas, el local de Cabildo se puede usar para gastronomía?" },
      { role: "assistant", content: "¡Hola! El L301 tiene 40 m² con vidriera, $ 1.400.000 por mes. El uso para gastronomía lo confirma un asesor con la habilitación. ¿Para cuándo lo necesitarías?" },
      { role: "user", content: "Para enero, es para una cafetería" },
    ],
  },
  {
    id: "l12", nombre: "Paula Giménez", canal: "whatsapp", estado: "calificando", calificacion: "tibio", asesor: "Sofía Paz", hace: "hace 4 días",
    resumen: "Quiere comprar una casa en zona sur para mudarse con su familia.\nPresupuesto: USD 130.000.\nLe interesó la casa de Lomas con garage (V207).\nPendiente: que un asesor le mande más fotos.",
    charla: [
      { role: "user", content: "Hola, busco casa en zona sur hasta 130 mil dólares" },
      { role: "assistant", content: "¡Hola! Tenemos la V207 en Lomas de Zamora: 3 ambientes, 120 m², garage, USD 128.000 y apto crédito. ¿Te interesa verla?" },
      { role: "user", content: "Me pasás más fotos?" },
    ],
  },
  {
    id: "l13", nombre: "Gustavo Medina", canal: "whatsapp", estado: "perdido", calificacion: "frio", asesor: "Laura Gómez", hace: "hace 5 días",
    resumen: "Consultó por el lote de Adrogué (V210).\nDijo que ya compró otro.\nPendiente: nada.",
    charla: [
      { role: "user", content: "El lote de Adrogué sigue?" },
      { role: "assistant", content: "¡Hola! Sí, el V210: 10x40 en barrio residencial, USD 60.000. ¿Querés verlo?" },
      { role: "user", content: "No gracias, ya compré otro" },
    ],
  },
  {
    id: "l14", nombre: "Natalia Vega", canal: "instagram", estado: "calificando", calificacion: "caliente", asesor: "Martín Ríos", hace: "hace 6 días",
    resumen: "Quiere comprar el PH con terraza de Villa Urquiza (V204) en efectivo.\nPresupuesto: USD 165.000 en efectivo.\nVisita: sábado 21 a las 10:00 en Oficina Belgrano.\nPendiente: que un asesor confirme la visita.",
    charla: [
      { role: "user", content: "Me encantó el PH de Urquiza con terraza 😍" },
      { role: "assistant", content: "¡Hola! El V204 tiene 90 m² y terraza propia, USD 165.000. No es apto crédito. ¿Cómo pensás pagarlo?" },
      { role: "user", content: "En efectivo. Puedo verlo el sábado?" },
    ],
  },
  {
    id: "l15", nombre: "Andrés Molina", canal: "messenger", estado: "nuevo", calificacion: "frio", asesor: null, hace: "hace 1 semana",
    resumen: "Preguntó cuánto cobran de honorarios por alquilar.\nPendiente: que un asesor lo contacte y definir qué propiedad le interesa.",
    charla: [
      { role: "user", content: "Cuánto cobran de comisión por alquilar?" },
      { role: "assistant", content: "¡Hola! Los honorarios por alquiler son de 1 mes de alquiler, a cargo del inquilino. ¿Estás buscando algo en particular?" },
    ],
  },
];

export const DEMO_INMOBILIARIA: RubroDemo = {
  slug: "inmobiliaria",
  nombreNegocio: "Propiedades del Sur",
  nombreBot: "Lucía",
  descripcion: "Inmobiliaria con oficinas en Belgrano (CABA) y Lomas de Zamora. Alquiler y venta de departamentos, casas, PH, locales y lotes en CABA norte y zona sur del GBA. Tasaciones sin cargo.",
  conocimiento: [
    { categoria: "Propiedades disponibles (código · operación · descripción · precio)", respuesta: `\n${PROPIEDADES}` },
    { categoria: "Requisitos y honorarios", respuesta: REQUISITOS },
    { categoria: "horarios_ubicacion", respuesta: "Lunes a viernes de 9 a 18 y sábados de 9 a 13. Las visitas a las propiedades se hacen en esos horarios." },
  ],
  sucursales: [
    { nombre: "Oficina Belgrano", slug: "belgrano", direccion: "Av. Cabildo 2100, Belgrano, CABA", telefono_encargado: null, google_maps_url: null, encargado_nombre: "Laura Gómez", horario_texto: "Lunes a viernes de 9 a 18, sábados de 9 a 13" },
    { nombre: "Oficina Lomas", slug: "lomas", direccion: "Av. Hipólito Yrigoyen 9000, Lomas de Zamora", telefono_encargado: null, google_maps_url: null, encargado_nombre: "Sofía Paz", horario_texto: "Lunes a viernes de 9 a 18, sábados de 9 a 13" },
  ],
  asesores: ["Laura Gómez", "Martín Ríos", "Sofía Paz"],
  leads,
  sugerencias: ["Hola, ¿sigue disponible el 2 ambientes de Belgrano?", "Busco casa en zona sur hasta USD 130.000", "¿Qué piden para alquilar?", "Quiero tasar mi departamento"],
  queBusca: "propiedad",
};

// Segundo negocio de ejemplo: mismo producto, otra inmobiliaria con otras reglas y otro tono (Walter, 16/11/2026: cada
// inmobiliaria tiene su nombre, su forma de trabajar y su tono; el bot se configura por empresa). Sirve para mostrar
// que el bot cambia con la configuración y para las pruebas antes de lanzar.
const PROPIEDADES_CABA = PROPIEDADES.split("\n").filter((l) => !/Lomas|Banfield|Temperley|Adrogué/.test(l)).join("\n");

export const DEMO_INMOBILIARIA_2: RubroDemo = {
  slug: "inmobiliaria-2",
  nombreNegocio: "Martínez & Asociados",
  nombreBot: "Asistente de Martínez & Asociados",
  tono: "tono formal y sobrio, trato respetuoso, sin emojis",
  descripcion: "Estudio inmobiliario familiar con una sola oficina en Belgrano. Trabaja solo CABA norte. Especialistas en ventas y alquileres con garantía propietaria.",
  conocimiento: [
    { categoria: "Propiedades disponibles (código · operación · descripción · precio)", respuesta: `\n${PROPIEDADES_CABA}` },
    { categoria: "Requisitos y honorarios", respuesta: "Alquiler: contrato de 3 años, solo garantía propietaria de CABA (NO se acepta seguro de caución), recibo de sueldo. Honorarios: 4,15% del total del contrato (inquilino). Venta: honorarios 4% comprador. No se toman propiedades en parte de pago. Las mascotas las decide cada propietario: siempre se consulta." },
    { categoria: "horarios_ubicacion", respuesta: "Lunes a viernes de 10 a 17. No se atiende sábados. Visitas solo con turno confirmado por un asesor." },
  ],
  sucursales: [
    { nombre: "Oficina Belgrano", slug: "belgrano", direccion: "Av. Cabildo 2100, Belgrano, CABA", telefono_encargado: null, google_maps_url: null, encargado_nombre: "Laura Gómez", horario_texto: "Lunes a viernes de 10 a 17" },
  ],
  asesores: ["Laura Gómez", "Martín Ríos"],
  leads: leads.filter((l) => !/Lomas|Banfield|Adrogué|zona sur|caución/i.test(l.resumen)).map((l) => ({ ...l, asesor: l.asesor === "Sofía Paz" ? "Laura Gómez" : l.asesor })),
  sugerencias: ["Buenas tardes, ¿el 2 ambientes de Belgrano sigue disponible?", "¿Aceptan seguro de caución?", "¿Cuánto cobran de honorarios?", "¿Atienden los sábados?"],
  queBusca: "propiedad",
};
