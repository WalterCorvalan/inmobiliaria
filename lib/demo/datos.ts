// Datos de ejemplo del MODO DEMO de la inmobiliaria (todo inventado). Lo común (equipo, leads, charlas, avisos) se arma en
// lib/demo/datosComunes.ts; acá van el negocio, las charlas de ejemplo, las propiedades y las visitas.
import { armarDatosDemo, enDias, fechaISO, haceMin, idFijo, EMPRESA_DEMO, USUARIO_DEMO, type RubroDatosDemo } from "./datosComunes";

type P = [codigo: string, titulo: string, tipo: string, operacion: "venta" | "alquiler", precio: number, moneda: "USD" | "ARS", expensas: number | null, barrio: string, ciudad: string, amb: number | null, dorm: number | null, banos: number | null, coch: number, sup: number, estado: string, oficina: number, asesor: number];

const PROPIEDADES: P[] = [
  ["A101", "Monoambiente con balcón cerca del subte", "departamento", "alquiler", 520000, "ARS", 85000, "Belgrano", "CABA", 1, 0, 1, 0, 32, "disponible", 0, 1],
  ["A102", "2 ambientes luminoso con cocina separada", "departamento", "alquiler", 690000, "ARS", 110000, "Belgrano", "CABA", 2, 1, 1, 0, 48, "reservada", 0, 1],
  ["A103", "3 ambientes con cochera y amenities", "departamento", "alquiler", 1050000, "ARS", 190000, "Núñez", "CABA", 3, 2, 2, 1, 72, "disponible", 0, 2],
  ["A104", "PH 2 ambientes con patio propio", "ph", "alquiler", 640000, "ARS", null, "Villa Urquiza", "CABA", 2, 1, 1, 0, 55, "disponible", 0, 2],
  ["A107", "Casa 3 ambientes con jardín y parrilla", "casa", "alquiler", 750000, "ARS", null, "Banfield", "Lomas de Zamora", 3, 2, 1, 1, 110, "alquilada", 1, 3],
  ["V201", "2 ambientes con balcón al frente, apto crédito", "departamento", "venta", 118000, "USD", 95000, "Belgrano", "CABA", 2, 1, 1, 0, 50, "disponible", 0, 1],
  ["V202", "3 ambientes con cochera y baulera", "departamento", "venta", 215000, "USD", 160000, "Núñez", "CABA", 3, 2, 2, 1, 80, "disponible", 0, 2],
  ["V204", "PH 3 ambientes con terraza propia", "ph", "venta", 165000, "USD", null, "Villa Urquiza", "CABA", 3, 2, 1, 0, 90, "disponible", 0, 1],
  ["V206", "Casa 4 ambientes con pileta, lote 10x30", "casa", "venta", 195000, "USD", null, "Banfield", "Lomas de Zamora", 4, 3, 2, 2, 180, "reservada", 1, 3],
  ["V207", "Casa 3 ambientes con garage", "casa", "venta", 128000, "USD", null, "Lomas de Zamora", "Lomas de Zamora", 3, 2, 1, 1, 120, "disponible", 1, 3],
  ["V209", "3 ambientes con balcón aterrazado", "departamento", "venta", 99000, "USD", 65000, "Temperley", "Lomas de Zamora", 3, 2, 1, 0, 75, "vendida", 1, 3],
  ["V210", "Lote 10x40 en barrio residencial", "terreno", "venta", 60000, "USD", null, "Adrogué", "Almirante Brown", null, null, null, 0, 400, "disponible", 1, 3],
  ["L301", "Local comercial con vidriera sobre Cabildo", "local", "alquiler", 1400000, "ARS", 120000, "Belgrano", "CABA", 1, null, 1, 0, 40, "disponible", 0, 2],
  ["L302", "Local comercial en el centro", "local", "venta", 140000, "USD", null, "Lomas de Zamora", "Lomas de Zamora", 2, null, 1, 0, 60, "pausada", 1, 3],
];

const RUBRO: RubroDatosDemo = {
  negocio: {
    nombre: "Propiedades del Sur", color: "#B4532A", domicilio: "Av. Cabildo 2150, Belgrano, CABA", telefono: "5491155550100", email: "hola@propiedadesdelsur.demo", web: "propiedadesdelsur.demo", instagram: "@propiedadesdelsur", bot: "Lucía",
    descripcion: "Inmobiliaria con oficinas en Belgrano y Lomas de Zamora. Alquileres y ventas de departamentos, casas, PH, locales y lotes. Tasaciones sin cargo.",
  },
  equipo: [
    { nombre: "Mariana Paz", roles: ["admin"], usuario: "demo", whatsapp: "5491155550100" },
    { nombre: "Laura Gómez", roles: ["ventas"], usuario: "laura", whatsapp: "5491155550101" },
    { nombre: "Martín Ríos", roles: ["ventas"], usuario: "martin", whatsapp: "5491155550102" },
    { nombre: "Paula Díaz", roles: ["encargado", "ventas"], usuario: "paula", whatsapp: "5491155550103" },
    { nombre: "Diego Sosa", roles: ["ventas"], usuario: "diego", whatsapp: "5491155550104" },
  ],
  oficinas: [
    { nombre: "Oficina Belgrano", direccion: "Av. Cabildo 2150, CABA", encargado: "Laura Gómez", horario: "Lunes a viernes de 9 a 19, sábados de 10 a 14", slug: "belgrano" },
    { nombre: "Oficina Lomas", direccion: "Laprida 450, Lomas de Zamora", encargado: "Paula Díaz", horario: "Lunes a sábados de 9 a 18", slug: "lomas" },
  ],
  motivosCierre: ["Alquiló o compró en otro lado", "No le alcanza el presupuesto", "Dejó de responder", "No tiene garantía"],
  memoria: [
    { categoria: "saludo", palabras: ["hola", "buenas"], respuesta: "¡Hola! Soy Lucía, de Propiedades del Sur. ¿Buscás alquilar, comprar o tasar?" },
    { categoria: "horarios_ubicacion", palabras: ["horario", "dirección", "dónde están"], respuesta: "Estamos en Av. Cabildo 2150 (Belgrano) y en Laprida 450 (Lomas). Lunes a viernes de 9 a 19 y sábados de 10 a 14." },
    { categoria: "pagos_financiacion", palabras: ["garantía", "requisitos", "seguro de caución"], respuesta: "Para alquilar pedimos garantía propietaria o seguro de caución, recibo de sueldo y un mes de depósito." },
    { categoria: "datos_empresa", palabras: ["tasación", "tasar"], respuesta: "Las tasaciones son sin cargo. Te paso con un asesor para coordinar la visita." },
    { categoria: "fuera_horario", palabras: [], respuesta: "¡Gracias por escribir! Ahora estamos cerrados, mañana a primera hora te responde un asesor." },
  ],
  leads: [
    { nombre: "Carolina Méndez", canal: "whatsapp", calificacion: "caliente", pipeline: "visita", estado: "calificando", vendedor: 0, oficina: 0, haceMin: 20, sinLeer: 2, origenAds: "Zonaprop",
      resumen: "Quiere alquilar el 2 ambientes de Belgrano (A102) y tiene un gato.\nPresupuesto: $ 700.000 por mes.\nTiene garantía propietaria.\nVisita: jueves a las 11:00 en Oficina Belgrano.\nPendiente: confirmar la visita.",
      charla: [
        { de: "cliente", texto: "Hola! Vi el 2 ambientes de Belgrano, sigue disponible?" },
        { de: "bot", texto: "¡Hola! Sí, el A102 sigue disponible: 48 m², luminoso, $ 690.000 por mes más expensas. ¿Me decís tu nombre?" },
        { de: "cliente", texto: "Carolina. Acepta mascotas? Tengo un gato" },
        { de: "bot", texto: "Sí, Carolina, acepta mascotas. ¿Querés pasar a verlo? Tengo el jueves a las 11:00." },
        { de: "cliente", texto: "Dale, jueves 11 perfecto. Tengo garantía propietaria" },
        { de: "bot", texto: "¡Genial! Te agendé el jueves a las 11:00 en la Oficina Belgrano. Laura te va a confirmar por acá 😊" },
      ] },
    { nombre: "Martín Ruiz", usuario: "martin.ruiz", canal: "instagram", calificacion: "tibio", pipeline: "sin_contactar", estado: "nuevo", vendedor: null, oficina: 0, haceMin: 60, sinLeer: 1, botActivo: true,
      charla: [
        { de: "cliente", texto: "Buenas, tienen 2 ambientes en venta en Belgrano?" },
        { de: "bot", texto: "¡Hola! Sí, tenemos el V201: 2 ambientes, 50 m², balcón al frente, USD 118.000 y apto crédito. ¿Es para vivir o para inversión?" },
        { de: "cliente", texto: "inversión, hasta 120 mil más o menos" },
      ] },
    { nombre: "Jorge Benítez", canal: "messenger", calificacion: "caliente", pipeline: "negociacion", estado: "asignado", vendedor: 3, oficina: 1, haceMin: 180,
      resumen: "Quiere comprar la casa de Banfield con pileta (V206).\nTiene USD 150.000 y quiere entregar su departamento en parte de pago.\nPendiente: tasar el departamento y hacer la reserva.",
      charla: [
        { de: "cliente", texto: "Hola, me interesa la casa de Banfield con pileta" },
        { de: "bot", texto: "¡Hola! Es la V206: 4 ambientes, 180 m² cubiertos, lote de 10x30 con pileta, USD 195.000. ¿Cómo pensás pagarla?" },
        { de: "cliente", texto: "Tengo 150 mil y vendo mi depto. Toman propiedad en parte de pago?" },
        { de: "bot", texto: "Eso lo ve un asesor. Te paso con Paula, que te puede tasar el departamento." },
        { de: "asesor", texto: "Hola Jorge, soy Paula. ¿Te parece si paso el sábado a las 10 a tasar tu departamento?" },
        { de: "cliente", texto: "Perfecto, sábado 10 te espero" },
      ] },
    { nombre: "Valeria Torres", canal: "whatsapp", calificacion: "caliente", pipeline: "contactado", estado: "calificando", vendedor: 0, oficina: 0, haceMin: 95, sinLeer: 0,
      resumen: "Quiere tasar su departamento de 3 ambientes en Núñez para vender.\nPendiente: coordinar la tasación esta semana.",
      charla: [
        { de: "cliente", texto: "Hola, quiero vender mi depto en Núñez, hacen tasaciones?" },
        { de: "bot", texto: "¡Hola! Sí, las tasaciones son sin cargo. ¿Cuántos ambientes tiene y cuántos metros?" },
        { de: "cliente", texto: "3 ambientes, 78 metros, con cochera" },
        { de: "bot", texto: "Perfecto. Te paso con Martín, que coordina la visita para tasarlo." },
      ] },
    { nombre: "Lucía Fernández", canal: "rodi", calificacion: "tibio", pipeline: "contactado", estado: "asignado", vendedor: 0, oficina: 0, haceMin: 300, origenAds: "busqueda-alquiler",
      resumen: "Busca alquilar un monoambiente cerca del subte, hasta $ 550.000.\nPendiente: mandarle el A101.",
      charla: [
        { de: "cliente", texto: "Hola, busco monoambiente para alquilar cerca del subte D" },
        { de: "bot", texto: "¡Hola! Tenemos el A101 en Belgrano, a 3 cuadras del subte D: $ 520.000 más expensas. ¿Te paso más datos?" },
        { de: "cliente", texto: "Sí! Mi número es 11 4567 8910" },
      ] },
    { nombre: "Ramiro Acosta", canal: "whatsapp", calificacion: "frio", pipeline: "perdido", estado: "perdido", vendedor: 2, oficina: 0, haceMin: 60 * 26,
      charla: [
        { de: "cliente", texto: "Precio del 3 ambientes de Núñez?" },
        { de: "bot", texto: "¡Hola! El A103 está $ 1.050.000 por mes más expensas, con cochera y amenities." },
        { de: "cliente", texto: "Uh, se me va de presupuesto. Gracias" },
      ] },
    { nombre: "sofi.paz", usuario: "sofi.paz", canal: "instagram", calificacion: "caliente", pipeline: "visita", estado: "calificando", vendedor: 0, oficina: 1, haceMin: 40, sinLeer: 3,
      resumen: "Quiere comprar la casa de Lomas con garage (V207) con crédito hipotecario.\nVisita: sábado a las 11:00.\nPendiente: confirmar la visita.",
      charla: [
        { de: "cliente", texto: "Hola!! La casa de Lomas con garage es apta crédito?" },
        { de: "bot", texto: "¡Hola! Sí, la V207 es apta crédito: 3 ambientes, 120 m², USD 128.000. ¿Querés visitarla?" },
        { de: "cliente", texto: "Si, el sábado puedo" },
        { de: "bot", texto: "¡Buenísimo! Te propongo el sábado a las 11:00. Paula te confirma por acá." },
      ] },
    { nombre: "Hernán Castro", canal: "messenger", calificacion: "tibio", pipeline: "sin_contactar", estado: "nuevo", vendedor: null, oficina: 1, haceMin: 15, sinLeer: 1, botActivo: true,
      charla: [
        { de: "cliente", texto: "Buenas tardes, el lote de Adrogué sigue en venta?" },
        { de: "bot", texto: "¡Hola Hernán! Sí, el V210: lote de 10x40 en barrio residencial, USD 60.000. ¿Es para construir tu casa?" },
      ] },
    { nombre: "Gabriela Núñez", canal: "manual", calificacion: "caliente", pipeline: "cerrado", estado: "convertido", vendedor: 3, oficina: 1, haceMin: 60 * 48,
      notas: "Vino a la oficina. Compró el 3 ambientes de Temperley (V209).", charla: [] },
    { nombre: "Federico Morales", canal: "whatsapp", calificacion: "tibio", pipeline: "contactado", estado: "asignado", vendedor: 4, oficina: 1, haceMin: 60 * 5,
      resumen: "Busca alquilar casa con jardín en zona sur para enero.\nPendiente: avisarle cuando entre algo.",
      charla: [
        { de: "cliente", texto: "Hola, tienen casas en alquiler en Banfield o Temperley?" },
        { de: "bot", texto: "¡Hola! Ahora mismo la casa de Banfield está alquilada, pero entran casas seguido. ¿Te aviso cuando haya una?" },
        { de: "cliente", texto: "Si porfa, para enero" },
      ] },
    { nombre: "Andrea López", canal: "rodi", calificacion: "frio", pipeline: "sin_contactar", estado: "nuevo", vendedor: null, oficina: 0, haceMin: 60 * 9, botActivo: true,
      charla: [
        { de: "cliente", texto: "Cuánto cobran de comisión?" },
        { de: "bot", texto: "¡Hola! En alquileres los honorarios son un mes de alquiler y en ventas el 3% para el comprador. ¿Buscás algo en particular?" },
      ] },
  ],
  tareas: [
    { lead: 0, tipo: "Enviar WhatsApp", titulo: "Confirmar la visita del jueves", enDias: 0, hora: 17 },
    { lead: 2, tipo: "Visitar al Cliente", titulo: "Tasar el departamento de Jorge", enDias: 2, hora: 10 },
    { lead: 3, tipo: "Llamar", titulo: "Coordinar tasación en Núñez", enDias: 1, hora: 11 },
    { lead: 4, tipo: "Enviar WhatsApp", titulo: "Mandar fotos del A101", enDias: -1, hora: 12 },
    { lead: 9, tipo: "Llamar", titulo: "Avisar si entra una casa en zona sur", enDias: 7, hora: 10 },
  ],
  extras: ({ equipoIds, oficinaIds, leads }) => {
    const propiedades = PROPIEDADES.map((p, i) => ({
      id: idFijo(20, i + 1), empresa_id: EMPRESA_DEMO, sucursal_id: oficinaIds[p[15]], asesor_id: equipoIds[p[16]], codigo: p[0], titulo: p[1], tipo: p[2], operacion: p[3], estado: p[14],
      precio: p[4], moneda: p[5], expensas: p[6], direccion: null, barrio: p[7], ciudad: p[8], ambientes: p[9], dormitorios: p[10], banos: p[11], cocheras: p[12], superficie_total: p[13], superficie_cubierta: p[2] === "terreno" ? null : p[13],
      descripcion: `${p[1]}. ${p[13]} m² en ${p[7]}. Ideal para ver en el día: consultá por visitas.`, latitud: null, longitud: null, creado_por: USUARIO_DEMO, created_at: haceMin(60 * 24 * ((i * 13) % 110 + 3)), updated_at: haceMin(60 * 24 * i),
    }));
    const prop = (codigo: string) => propiedades.find((p) => p.codigo === codigo)!;
    const visita = (n: number, lead: number, codigo: string, dias: number, hora: string, estado: string, asesor: number, notas: string | null = null) => {
      const l = leads[lead];
      const d = enDias(dias);
      return {
        id: idFijo(21, n), empresa_id: EMPRESA_DEMO, vehiculo_id: null, propiedad_id: prop(codigo).id, propiedad_codigo: codigo, nombre_cliente: l.nombre, telefono_cliente: l.telefono, fecha_visita: fechaISO(d), horario_visita: hora,
        sucursal: prop(codigo).sucursal_id === oficinaIds[0] ? "Oficina Belgrano" : "Oficina Lomas", estado, vendedor_id: equipoIds[asesor], cliente_id: idFijo(12, lead + 1), creado_por: null, canal_origen: l.canal, notas,
        created_at: haceMin(60 * 3), updated_at: haceMin(60 * 2), recordatorio_enviado_at: null, vehiculo_marca: null, vehiculo_modelo: null, vehiculo_patente: null,
      };
    };
    return {
      propiedades,
      propiedad_fotos: [],
      visitas: [
        visita(1, 0, "A102", 1, "11:00", "Pendiente", 1, "Tiene un gato. Garantía propietaria."),
        visita(2, 6, "V207", 3, "11:00", "Confirmada", 3, "Viene con crédito hipotecario."),
        visita(3, 2, "V206", 0, "16:30", "Confirmada", 3),
        visita(4, 4, "A101", 2, "18:00", "Pendiente", 1),
        visita(5, 8, "V209", -3, "10:00", "Asistió", 3, "Reservó en el momento."),
        visita(6, 5, "A103", -1, "15:00", "Cancelada", 2, "Se le iba de presupuesto."),
      ],
    };
  },
};

export const crearDatosDemo = () => armarDatosDemo(RUBRO);
export { EMPRESA_DEMO, USUARIO_DEMO };
