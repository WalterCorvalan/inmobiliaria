import { supabaseEmpresa as supabase } from "@/lib/empresa/db";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { chatJsonV2 } from "@/lib/ai/indexV2";
import { buildSystemPromptV2, menuBienvenidaV2, SEPARADOR_MENSAJES, type ResultadoStockV2, type SucursalInfo, type FinanciacionInfo } from "@/lib/ai/promptsV2";
import { asegurarPedidoDeDatosWeb, respuestaFinanciacionWeb, respuestaMencionaFinanciacionInventada, respuestaSeguraConFinanciacionReal } from "@/lib/ai/financiacionBot";
import { marcasQueCoinciden, modelosQueCoinciden, sacarAnio } from "@/lib/ai/busquedaStock";
import { ESTADOS_QUE_VE_EL_BOT, NOTA_REFERENCIA_VAGA, desdeVentaReciente, esEnPreparacion, esSenado, esVendido, referenciaVagaSinAnio, ventasRecientesQueCoinciden } from "@/lib/ai/estadoStockBot";
import {
  TOPES_FINANCIACION_DEFAULT, TOPE_0KM_DEFAULT, TNA_POR_ANIO_Y_PLAZO_DEFAULT, GASTOS_PCT_DEFAULT,
} from "@/lib/financiacion";

// Agente de ventas panel-v2 — lo usan tanto WhatsApp como Rodi (comparten el
// mismo prompt base, cada uno con su propio historial). Fork de
// lib/ai/agente.ts adaptado al schema de la base nova. Solo razona con el
// texto — nunca escribe la conversación, eso lo hace el webhook que lo llama.


export const AgentReplySchemaV2 = z.object({
  reply: z.string(),
  handoff: z.boolean(),
  pausar_sin_notificar: z.boolean().optional(),
  resumen_handoff: z.string().nullable(),
  intencion: z.enum(["COMPRA", "VENTA", "CONSIGNACION", "COMPRA_CON_PERMUTA", "SEGUROS", "HABLAR_CON_ASESOR", "OTRA_CONSULTA"]).nullable(),
  calificacion: z.enum(["caliente", "tibio", "frio"]).nullable(),
  datos_detectados: z.object({
    timing: z.string().nullable(),
    forma_pago: z.string().nullable(),
    tiene_permuta: z.boolean().nullable(),
    nombre: z.string().nullable(),
    email: z.string().nullable(),
    telefono: z.string().nullable(),
    cuil: z.string().nullable().optional(),
    precio_pedido: z.string().nullable().optional(),
    zona: z.string().nullable().optional() /* slug de la oficina de la empresa */,
    dia_visita: z.string().nullable().optional(),
    horario_visita: z.string().nullable().optional(),
    vehiculo_propio: z.object({
      marca: z.string().nullable(),
      modelo: z.string().nullable(),
      anio: z.string().nullable(),
      km: z.string().nullable().optional(),
    }).nullable().optional(),
    tipo_seguro: z.string().nullable().optional(),
    auto_que_quiere: z.string().nullable().optional(),
  }),
  vehiculo_mencionado: z.object({
    marca: z.string().nullable(),
    modelo: z.string().nullable(),
    categoria: z.enum(["Auto", "Pickup/Camioneta", "SUV", "Utilitario"]).nullable(),
    puertas: z.number().nullable().optional(),
    combustible: z.enum(["Nafta", "Diesel", "Eléctrico", "GNC", "Híbrido"]).nullable().optional(),
    anio: z.number().int().nullable().optional(),
  }).nullable(),
  presupuesto_mencionado: z.object({
    monto: z.number().positive(),
    moneda: z.enum(["USD", "ARS"]),
  }).nullable(),
  pedir_stock_general: z.boolean(),
  pedir_fotos: z.boolean().optional(),
  pedido_stock: z.object({
    marca: z.string().nullable(),
    modelo: z.string().nullable(),
    presupuesto_max: z.number().nullable(),
    moneda: z.enum(["USD", "ARS"]).nullable(),
    puertas: z.number().nullable(),
  }).nullable().optional(),
});

export type AgentReplyV2 = z.infer<typeof AgentReplySchemaV2>;
export type HistorialMensaje = { role: "user" | "assistant"; content: string };

// Tope de mensajes por conversación — evita charlas eternas (costo de API y
// vendedores esperando el handoff) cuando hay muchas consultas a la vez.
// SUAVE: a partir de este mensaje del cliente, el prompt empieza a
// sugerirle cerrar rápido con lo que necesita. DURO: a partir de acá se
// corta directo, sin llamar a la IA — se deriva con un mensaje fijo.
const LIMITE_MENSAJES_SUAVE = 50;
const LIMITE_MENSAJES_DURO = 70;

function respuestaLimiteAlcanzado(): AgentReplyV2 {
  return {
    reply: "Veo que ya llevamos bastante conversación — para no hacerte esperar más, en este momento te comunico con un asesor que sigue en persona con todo esto.",
    handoff: true,
    resumen_handoff: "Charla larga (tope de mensajes) — revisar historial del chat para el contexto completo.",
    pedir_stock_general: false,
    intencion: null,
    calificacion: null,
    datos_detectados: { timing: null, forma_pago: null, tiene_permuta: null, nombre: null, email: null, telefono: null },
    vehiculo_mencionado: null,
    presupuesto_mencionado: null,
  };
}

// El prompt separa "reply" en varias burbujas con SEPARADOR_MENSAJES cuando
// muestra opciones de stock (lista + pregunta corta abajo, como mandaría una
// persona) — los canales (WhatsApp, Rodi) usan esto para mandar cada parte
// como un mensaje separado en vez de un solo bloque de texto largo.
export function dividirRespuestaEnMensajes(reply: string): string[] {
  return reply.split(SEPARADOR_MENSAJES).map((s) => s.trim()).filter(Boolean);
}

// Devuelve además el total real de coincidencias (sin el limit) — el prompt
// necesita ese número para no inventar un "en total tengo N" a partir de
// cuántas filas le tocó ver, que es solo el tope de la query, no el total
// real de stock (bug detectado: dijo "en total tengo 6 pickups" habiendo 11).
// marcas/modelos: los nombres tal como están cargados en Stock (los arma buscarStockRealV2 con lib/ai/busquedaStock.ts);
// null = sin ese filtro, lista vacía = el cliente lo pidió y no hay nada parecido en stock.
async function ejecutarBusquedaStock(
  marcas: string[] | null,
  modelos: string[] | null,
  categoria?: string | null,
  presupuesto?: { monto: number; moneda: "USD" | "ARS" } | null,
  puertas?: number | null,
  combustible?: string | null,
  anio?: number | null
): Promise<{ resultados: ResultadoStockV2[]; total: number }> {
  if (marcas?.length === 0 || modelos?.length === 0) return { resultados: [], total: 0 };
  const aplicarFiltros = (q: any) => {
    if (marcas) q = q.in("marca", marcas);
    if (modelos) q = q.in("modelo", modelos);
    if (anio) q = q.eq("anio", anio);
    // Categoría (Auto/Camioneta/SUV/Moto/Otro) — el cliente puede acotar por
    // tipo de vehículo sin dar marca ("busco auto, no camioneta"). Es un
    // filtro duro: una vez que lo pidió, ninguna alternativa de otra
    // categoría se le vuelve a mostrar en esta búsqueda.
    if (categoria) q = q.eq("categoria", categoria);
    if (puertas) q = q.eq("puertas", puertas);
    // Combustible (Nafta/Diesel/GNC/Eléctrico/Híbrido) — filtro duro igual
    // que categoría: si el cliente pidió puntualmente GNC, no tiene sentido
    // mostrarle una alternativa a Nafta como si cumpliera el pedido.
    if (combustible) q = q.eq("combustible", combustible);
    // Sin conversor de dólar propio en v2 todavía — filtramos solo por la
    // moneda que mencionó el cliente, sin intentar convertir la otra.
    // Margen de estiramiento del 15%: un cliente con $20M no quiere ver SOLO
    // autos hasta $20M exactos, quiere ver también algo de $22-23M si le
    // sirve (con financiación de por medio) — antes el corte era exacto y
    // dejaba afuera opciones cercanas que el vendedor sí mostraría en mano.
    if (presupuesto) q = q.eq("moneda_venta", presupuesto.moneda).lte("precio_venta", presupuesto.monto * 1.15);
    return q;
  };

  const query = aplicarFiltros(
    supabase
      .from("vehiculos")
      .select("id, estado, marca, modelo, anio, precio_venta, moneda_venta, precio_publicado_ars, precio_publicado_usd, patente, color, km, version, transmision, combustible, categoria, puertas, origen, carroceria, motor_cilindrada, segmento, traccion, potencia_cv, cantidad_plazas, fotos, sucursales!vehiculos_sucursal_id_fkey ( nombre )")
      .in("estado", ESTADOS_QUE_VE_EL_BOT)
      // Sin ORDER BY antes traía siempre las mismas filas "por orden de
      // fila" del motor, sin relación con lo que le convenía ver al cliente
      // (reportado: pidió "Ford" con 13 unidades en stock y vio 4-6 al azar,
      // ni las más nuevas ni las más baratas). Ordenamos por año más reciente
      // primero y, entre autos del mismo año, por precio más bajo primero —
      // así el corte de abajo (limit) se queda con lo más atractivo real.
      .order("anio", { ascending: false })
      .order("precio_venta", { ascending: true })
  ).limit(6);

  const queryTotal = aplicarFiltros(
    supabase.from("vehiculos").select("id", { count: "exact", head: true }).in("estado", ESTADOS_QUE_VE_EL_BOT)
  );

  const [{ data }, { count }] = await Promise.all([query, queryTotal]);
  // El bot es de cara al cliente -- prioriza el precio publicado
  // (precio_publicado_ars/usd), el mismo que ve cualquiera en la web. Si un
  // auto no tiene precio publicado cargado, cae al precio de venta (el que
  // se carga en Stock) en vez de forzar "Consultar precio" -- pedido del
  // 25/9, un auto con precio de venta cargado tiene que mostrar ese precio.
  const resultados = (data ?? []).map((v: any) => {
    const precioVenta = v.precio_publicado_ars || v.precio_publicado_usd || v.precio_venta || 0;
    const monedaVenta = v.precio_publicado_ars ? "ARS" : v.precio_publicado_usd ? "USD" : v.moneda_venta;
    return { ...v, precio_venta: precioVenta, moneda_venta: monedaVenta, sucursal: v.sucursales?.nombre ?? null };
  }) as ResultadoStockV2[];
  return { resultados, total: count ?? resultados.length };
}

const CAMPOS_STOCK_BOT = "id, estado, marca, modelo, anio, precio_venta, moneda_venta, precio_publicado_ars, precio_publicado_usd, patente, color, km, version, transmision, combustible, categoria, puertas, origen, carroceria, motor_cilindrada, segmento, traccion, potencia_cv, cantidad_plazas, fotos, sucursales!vehiculos_sucursal_id_fkey ( nombre )";

// Si en la lista hay un auto señado o reservado, se suman hasta 4 disponibles parecidos, como la ficha del catálogo
// (app/(public)/catalogo/[slug]/page.tsx): 2 de la misma marca ("También te podría interesar") y 2 de precio similar
// (±15%, en la misma moneda). Walter, 30/10/2026 (lib/ai/estadoStockBot.ts).
async function sumarParecidosDeSenados(resultados: ResultadoStockV2[]): Promise<ResultadoStockV2[]> {
  const senados = resultados.filter((v) => esSenado(v.estado) || esVendido(v.estado));
  if (senados.length === 0) return resultados;
  const usados = new Set(resultados.map((v) => v.id));
  const extra: ResultadoStockV2[] = [];
  for (const s of senados.slice(0, 2)) {
    const nombre = `${s.marca} ${s.modelo} ${s.anio}`;
    const [{ data: porMarca }, { data: porPrecio }] = await Promise.all([
      supabase.from("vehiculos").select(CAMPOS_STOCK_BOT).eq("estado", "disponible").eq("marca", s.marca).order("anio", { ascending: false }).limit(4),
      s.precio_venta > 0
        // El precio del señado ya es el publicado (comoResultado): se compara contra la misma columna publicada.
        ? supabase.from("vehiculos").select(CAMPOS_STOCK_BOT).eq("estado", "disponible")
          .gte(s.moneda_venta === "USD" ? "precio_publicado_usd" : "precio_publicado_ars", s.precio_venta * 0.85)
          .lte(s.moneda_venta === "USD" ? "precio_publicado_usd" : "precio_publicado_ars", s.precio_venta * 1.15)
          .order("anio", { ascending: false }).limit(4)
        : Promise.resolve({ data: [] }),
    ]);
    for (const lista of [porMarca ?? [], porPrecio ?? []]) {
      let sumados = 0;
      for (const v of lista as unknown as FilaVehiculoBot[]) {
        if (sumados >= 2 || usados.has(v.id)) continue;
        usados.add(v.id);
        sumados++;
        extra.push({ ...comoResultado(v), parecidoA: nombre });
      }
    }
  }
  return [...resultados, ...extra];
}

// Precio que ve el cliente: el publicado (el de la web) y, si no hay, el de venta.
type FilaVehiculoBot = Omit<ResultadoStockV2, "sucursal"> & { precio_publicado_ars: number | null; precio_publicado_usd: number | null; sucursales?: { nombre: string } | null };
function comoResultado(v: FilaVehiculoBot): ResultadoStockV2 {
  const precioVenta = v.precio_publicado_ars || v.precio_publicado_usd || v.precio_venta || 0;
  const monedaVenta = v.precio_publicado_ars ? "ARS" : v.precio_publicado_usd ? "USD" : v.moneda_venta;
  return { ...v, precio_venta: precioVenta, moneda_venta: monedaVenta, sucursal: v.sucursales?.nombre ?? null } as ResultadoStockV2;
}

// Red de seguridad: el modelo (Haiku) a veces no completa "vehiculo_mencionado"
// cuando la mención viene en frase indirecta ("buscaba un Toyota", "no tienen
// Hilux?", pasado en vez de presente) aunque la regla del prompt lo pida
// explícito -- en vez de perder el mensaje, se busca por texto plano la
// marca/modelo real (de stock actual) que aparezca en el último mensaje del
// cliente. Solo se usa cuando el modelo no encontró nada por su cuenta.
async function extraerVehiculoFallback(ultimoMensaje: string): Promise<{ marca: string | null; modelo: string | null } | null> {
  const texto = ultimoMensaje.toLowerCase();
  const { data } = await supabase.from("vehiculos").select("marca, modelo").in("estado", ESTADOS_QUE_VE_EL_BOT);
  if (!data) return null;

  const marcas = Array.from(new Set(data.map((v) => v.marca).filter(Boolean)));
  const modelos = Array.from(new Set(data.map((v) => v.modelo).filter(Boolean)));

  // Modelo primero (más específico) -- si el cliente nombra el modelo, la
  // marca no hace falta para buscar bien. Se compara solo la PRIMERA palabra
  // del modelo real ("RANGER" de "RANGER XL 3.0 TDI S/C 4X2 PLUS"), no el
  // nombre completo -- un mensaje corto tipo "la Ranger" nunca iba a
  // contener la ficha técnica entera, así nunca matcheaba nada.
  const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const modeloMatch = modelos.find((m) => {
    const primeraPalabra = m.split(/\s+/)[0];
    if (primeraPalabra.length < 3) return false;
    return new RegExp(`\\b${escapeRegex(primeraPalabra.toLowerCase())}\\b`).test(texto);
  });
  const marcaMatch = marcas.find((m) => texto.includes(m.toLowerCase()));

  if (!modeloMatch && !marcaMatch) return null;
  return { marca: marcaMatch ?? null, modelo: modeloMatch ?? null };
}

// Buscar exacto (marca+modelo+categoría) primero; si no hay nada, no le
// devolvemos al cliente una lista vacía sin salida — probamos combinaciones
// cada vez menos específicas hasta encontrar stock real. La categoría es la
// señal MÁS débil de las tres: si el cliente pidió "Ford" pensando en un
// auto pero la Ford que hay es una pickup, mostrar esa pickup es mejor que
// decir "no tenemos Ford" — por eso se relaja antes que marca/modelo.
export async function buscarStockRealV2(
  marca: string | null,
  modelo: string | null,
  categoria?: string | null,
  presupuesto?: { monto: number; moneda: "USD" | "ARS" } | null,
  puertas?: number | null,
  combustible?: string | null,
  anio?: number | null
): Promise<{ resultados: ResultadoStockV2[]; esAlternativa: boolean; total: number }> {
  const enStock = await buscarStockEnVenta(marca, modelo, categoria, presupuesto, puertas, combustible, anio);
  // Un modelo puntual que no está y se vendió hace poco: se avisa que ya se vendió (lib/ai/estadoStockBot.ts).
  if (!modelo || (!enStock.esAlternativa && enStock.resultados.length > 0)) return enStock;
  const { data: ventas } = await supabase.from("ventas").select("vehiculo_marca, vehiculo_modelo, fecha_cierre")
    .eq("estado", "cerrada").gte("fecha_cierre", desdeVentaReciente()).order("fecha_cierre", { ascending: false }).limit(200);
  const vendida = ventasRecientesQueCoinciden(ventas ?? [], marca, modelo)[0];
  if (!vendida) return enStock;
  const comoVendido = {
    id: "", estado: "vendido", marca: vendida.vehiculo_marca ?? marca ?? "", modelo: vendida.vehiculo_modelo ?? modelo, anio: 0, precio_venta: 0, moneda_venta: "ARS",
    patente: null, color: null, km: null, version: null, transmision: null, combustible: null, sucursal: null, categoria: null, puertas: null,
    origen: null, carroceria: null, motor_cilindrada: null, segmento: null, traccion: null, potencia_cv: null, cantidad_plazas: null, fotos: [],
  } as ResultadoStockV2;
  // Con el vendido primero, sumarParecidosDeSenados trae 2 de la misma marca (el vendido no tiene precio, no hay "precio similar").
  const conParecidos = await sumarParecidosDeSenados([comoVendido, ...enStock.resultados]);
  return { resultados: conParecidos, esAlternativa: true, total: enStock.total };
}

async function buscarStockEnVenta(
  marca: string | null,
  modelo: string | null,
  categoria?: string | null,
  presupuesto?: { monto: number; moneda: "USD" | "ARS" } | null,
  puertas?: number | null,
  combustible?: string | null,
  anio?: number | null
): Promise<{ resultados: ResultadoStockV2[]; esAlternativa: boolean; total: number }> {
  const cat = categoria ?? null;
  // Marca y modelo se traducen a como están cargados en Stock: sin importar mayúsculas, tildes, guiones ni errores de
  // tipeo comunes (caso Fran Arias, 29/10/2026: "Mercedes-Benz" no encontraba la "Mercedes Benz" Sprinter 2018).
  const anioPedido = anio ?? (modelo ? sacarAnio(modelo).anio : null);
  let marcasR: string[] | null = null;
  let modelosR: string[] | null = null;
  if (marca || modelo) {
    const { data: enStock } = await supabase.from("vehiculos").select("marca, modelo").in("estado", ESTADOS_QUE_VE_EL_BOT);
    const filas = enStock ?? [];
    if (marca) marcasR = marcasQueCoinciden(marca, filas.map((v) => v.marca));
    if (modelo) modelosR = modelosQueCoinciden(modelo, filas.map((v) => v.modelo));
  }
  // Si el cliente pidió una marca/modelo puntual, la búsqueda nunca debe
  // degradar hasta "mostrame lo que sea del stock" (último intento, sin
  // ningún filtro) -- eso ignoraba por completo lo que pidió y, como
  // ejecutarBusquedaStock no tiene ORDER BY, devolvía siempre la misma
  // terna de autos sin relación con la marca pedida (reportado: pidió
  // "Ford" y recibió la lista idéntica que ya había recibido antes por otro
  // motivo, pareciendo que el bot "se quedó pegado"). Con marca/modelo
  // específico, el peor caso es soltar la marca pero conservar la
  // categoría (si la pidió) -- nunca un catálogo completamente genérico.
  const pidioMarcaOModelo = !!(marca || modelo);
  // Si la marca no coincide pero el modelo sí, se prueba con el modelo solo antes de decir que no hay.
  type Intento = [string[] | null, string[] | null, string | null];
  const intentos: Intento[] = [
    [marcasR, modelosR, cat],
    [marcasR, modelosR, null],
    ...(marcasR && modelosR ? [[null, modelosR, cat] as Intento, [null, modelosR, null] as Intento] : []),
    [marcasR, null, cat],
    [marcasR, null, null],
    ...(pidioMarcaOModelo ? [] : [[null, null, cat] as Intento, [null, null, null] as Intento]),
  ];

  // Combustible es un filtro duro (igual que categoría): si el cliente pidió
  // GNC puntualmente, se prueba primero CON el filtro y recién si no aparece
  // nada en ninguna combinación se repite la secuencia SIN combustible --
  // eso sí queda marcado como alternativa (esAlternativa=true), porque el
  // resultado NO cumple lo que el cliente pidió (regla de reglasStock.ts:
  // ahí se ofrece dejar el teléfono en vez del genérico "¿te interesa
  // alguna?").
  for (const combustibleIntento of combustible ? [combustible, null] : [null]) {
    // Puertas es el filtro más débil de todos -- hoy no todo el stock tiene
    // ese dato cargado, así que se prueba primero CON el filtro y, si no
    // aparece nada en ninguna combinación, se repite toda la secuencia SIN
    // puertas antes de rendirse (evita decir "no hay" solo porque falta cargar
    // ese campo en un auto que sí está disponible).
    for (const puertasIntento of puertas ? [puertas, null] : [null]) {
      const probados = new Set<string>();
      for (let i = 0; i < intentos.length; i++) {
        const [m, mo, c] = intentos[i];
        const clave = JSON.stringify([m, mo, c]);
        if (probados.has(clave)) continue;
        probados.add(clave);
        // El año primero: si pidió "la sprinter 2018" se muestra esa; si no hay de ese año, las de otros años como alternativa.
        let { resultados, total } = await ejecutarBusquedaStock(m, mo, c, presupuesto, puertasIntento, combustibleIntento, anioPedido);
        const bajoPorAnio = !!anioPedido && resultados.length === 0;
        if (bajoPorAnio) ({ resultados, total } = await ejecutarBusquedaStock(m, mo, c, presupuesto, puertasIntento, combustibleIntento, null));
        // esAlternativa solo debe subir por puertas/combustible cuando el
        // cliente SÍ pidió ese filtro y hubo que soltarlo para encontrar
        // algo -- si nunca lo pidió, el intento es null desde el arranque
        // (no es una "alternativa", es la búsqueda normal) y antes igual se
        // marcaba como alternativa siempre, haciendo que CASI toda búsqueda
        // exacta mostrara "ese modelo puntual no lo tengo" aunque fuera un
        // match real.
        const bajoPorPuertas = puertas != null && puertasIntento === null;
        const bajoPorCombustible = combustible != null && combustibleIntento === null;
        if (resultados.length > 0) return { resultados: await sumarParecidosDeSenados(resultados), esAlternativa: i > 0 || bajoPorPuertas || bajoPorCombustible || bajoPorAnio, total };
      }
    }
  }
  return { resultados: [], esAlternativa: true, total: 0 };
}

// Red de seguridad anti-alucinación: el prompt ya prohíbe inventar stock,
// pero un modelo chico (Haiku) a veces igual fabrica un auto "más lindo" en
// vez de mostrar los resultados reales que se le pasaron — visto en pruebas
// reales (pidió "Chevrolet Tracker" sin stock, el modelo inventó dos
// unidades con precio y año de la nada). No confiamos en el prompt solo:
// si la respuesta menciona un precio/año/km de 4+ dígitos que no aparece en
// los resultados reales, la descartamos y mostramos el stock real armado
// por código en su lugar.
function extraerNumerosRelevantes(texto: string): number[] {
  return Array.from(texto.matchAll(/\d[\d.,]*\d|\d/g))
    .map((m) => Number(m[0].replace(/[.,]/g, "")))
    .filter((n) => n >= 1900);
}

// Los números "reales" no son solo precio/año del stock: si la respuesta
// también menciona una dirección de sucursal (ej: "el Vento está en Av. del
// Libertador 2067"), esos números vienen del prompt (dato real), no son una
// alucinación — sin esta lista, "2067" no matchea contra ningún precio/año
// y toda la respuesta se descarta por error, incluida la dirección real.
function respuestaMencionaStockInventado(reply: string, resultados: ResultadoStockV2[], sucursales: SucursalInfo[] = []): boolean {
  const numerosReply = extraerNumerosRelevantes(reply);
  if (numerosReply.length === 0) return false;

  const numerosReales = new Set<number>();
  for (const v of resultados) {
    numerosReales.add(v.precio_venta);
    numerosReales.add(v.anio);
    if (v.km != null) numerosReales.add(v.km);
  }
  for (const s of sucursales) {
    if (s.direccion) extraerNumerosRelevantes(s.direccion).forEach((n) => numerosReales.add(n));
    if (s.telefono_encargado) extraerNumerosRelevantes(s.telefono_encargado).forEach((n) => numerosReales.add(n));
  }

  return numerosReply.some((n) => !numerosReales.has(n));
}

// pedirDatos: en el chat de la web (Rodi) el cierre pide nombre y WhatsApp (ver bloqueCierreSitioWeb en promptV2/sitioWeb.ts).
function respuestaSeguraConStockReal(resultados: ResultadoStockV2[], esAlternativa: boolean, pedirDatos = false): string {
  if (resultados.length === 0) {
    return "Por ahora no tengo esa unidad en stock. ¿Querés que te avise apenas entre una, o te muestro otras opciones que sí tengo?";
  }
  if (esVendido(resultados[0].estado)) {
    const otras = resultados.slice(1, 3).map((v) => `🚗 ${v.marca} ${v.modelo} ${v.anio} — 💰 ${v.precio_venta > 0 ? `${v.moneda_venta === "USD" ? "US$" : "$"} ${v.precio_venta.toLocaleString("es-AR")}` : "Consultar precio"}`).join("\n");
    return `Ese ${resultados[0].marca} ${resultados[0].modelo} ya se vendió. ${otras ? `Te dejo opciones parecidas que sí tengo:\n\n${otras}\n\nSi te interesa alguna, seguimos con los detalles.` : "¿Querés que te muestre otras opciones?"}`;
  }
  const lista = resultados.slice(0, 3)
    .map((v) => `🚗 ${v.marca} ${v.modelo} ${v.anio} — ${
      esVendido(v.estado) ? "ya se vendió"
      : esEnPreparacion(v.estado) ? "en preparación: un asesor te confirma si está a la venta"
      : esSenado(v.estado) ? "ya está señado"
      : `💰 ${v.precio_venta > 0 ? `${v.moneda_venta === "USD" ? "US$" : "$"} ${v.precio_venta.toLocaleString("es-AR")}` : "Consultar precio"}`}`)
    .join("\n");
  const intro = esAlternativa ? "Ese modelo puntual no lo tengo ahora, pero estas son opciones que sí tengo:" : "Estas son las opciones que tengo:";
  const cierre = pedirDatos
    ? "¿Me dejás tu nombre y tu WhatsApp así un asesor te pasa todos los detalles? También te puedo agendar una visita para verla en la sucursal."
    : resultados.length === 1 ? "Contame si te interesa y seguimos con los detalles." : "Si te interesa alguna, seguimos con los detalles.";
  return `${intro}\n\n${lista}\n\n${cierre}`;
}

// Red de seguridad: el prompt ya prohíbe pedir más precisión (año/modelo/
// categoría) ANTES de mostrar opciones reales cuando ya hay resultados de
// una búsqueda -- pero un modelo chico a veces igual responde con una
// pregunta de "¿qué modelo te interesa?" en vez de listar el stock real que
// ya se le pasó, incluso NOMBRANDO modelos reales de ejemplo sin precio ni
// datos ("¿Argo, Pulse o Cronos?") -- esto hace inútil chequear solo si
// menciona el nombre de un modelo real, porque lo hace igual sin mostrar
// nada. Señal más fuerte: una lista de verdad siempre trae el PRECIO real de
// al menos un resultado; una pregunta de "cuál preferís" nunca lo trae.
function respuestaNoMuestraStockReal(reply: string, resultados: ResultadoStockV2[]): boolean {
  if (resultados.length === 0) return false;
  const numerosReply = new Set(extraerNumerosRelevantes(reply));
  return !resultados.some((v) => numerosReply.has(v.precio_venta) || numerosReply.has(v.anio));
}

// El prompt prohíbe estos cierres genéricos y abiertos (regla en
// promptsV2.ts, sección de listado de stock), pero un modelo chico los
// repite igual a veces — se detecta y se corta la oración completa que los
// contiene, dejando el resto de la respuesta intacto.
const FRASES_CIERRE_PROHIBIDAS = [
  /¿?alguna te interesa,?\s*o buscás un año o versión en particular\??/i,
  /¿?alguna (de estas )?te (late|gusta),?\s*o preferís seguir viendo más opciones\??/i,
  // Catch-all: cualquier variante de "¿te late/interesa/gusta ESTO, o preferís/querés VER/SEGUIR/EXPLORAR otra cosa?"
  // -- el modelo reformula la frase prohibida en vez de repetirla igual, así que se banea la estructura completa, no el texto exacto.
  /¿?te (late|interesa|gusta)\b[^?]*\b(o\s+(preferís|querés|buscás))\b[^?]*\?/i,
  /¿?te interesa conocer más[^?]*\?/i,
  /¿?(preferís|querés) explorar otras marcas\??/i,
  /¿?hay algo más que quieras (saber|preguntar)[^?]*\?/i,
];

function sacarCierreGenericoProhibido(reply: string): string {
  let limpio = reply;
  for (const patron of FRASES_CIERRE_PROHIBIDAS) {
    const match = limpio.match(patron);
    if (!match || match.index == null) continue;
    // No alcanza con sacar solo la frase prohibida: eso dejaba colgado el
    // principio de la pregunta que la contenía (ej: reply terminaba en
    // "¿Alguno de estos Fiat" a mitad de camino, sin el cierre que se
    // recortó). Se corta desde el inicio de ESA pregunta/oración (el último
    // "¿" o salto de línea antes de la frase encontrada), no solo la frase.
    const antes = limpio.slice(0, match.index);
    const inicioOracion = Math.max(antes.lastIndexOf("¿"), antes.lastIndexOf("\n"));
    limpio = (inicioOracion === -1 ? antes : antes.slice(0, inicioOracion)).trim();
  }
  return limpio;
}

async function fetchSucursalesInfo(): Promise<SucursalInfo[]> {
  const { data } = await supabase.from("sucursales").select("nombre, direccion, telefono_encargado, google_maps_url, encargado_nombre").order("nombre");
  return (data ?? []) as SucursalInfo[];
}

// Misma tabla y mismos defaults que /api/financiacion-config (el simulador
// público) -- el bot tiene que citar EXACTAMENTE los mismos números que ve
// el cliente en la web, no una copia vieja hardcodeada en el prompt.
async function fetchFinanciacionInfo(): Promise<FinanciacionInfo> {
  const { data } = await supabase.from("configuracion_empresa").select("financiacion_topes, financiacion_tope_0km, financiacion_tna, financiacion_gastos_pct").maybeSingle();
  return {
    topes: data?.financiacion_topes?.length ? data.financiacion_topes : TOPES_FINANCIACION_DEFAULT,
    tope0km: data?.financiacion_tope_0km ?? TOPE_0KM_DEFAULT,
    tna: data?.financiacion_tna?.length ? data.financiacion_tna : TNA_POR_ANIO_Y_PLAZO_DEFAULT,
    gastosPct: data?.financiacion_gastos_pct ?? GASTOS_PCT_DEFAULT,
  };
}

export async function generarRespuestaAgenteV2(historial: HistorialMensaje[], canal: string = "whatsapp-v2", nombreBot?: string, vehiculoEnFocoId?: string | null, tono?: string | null, esInstagram?: boolean): Promise<
  | { ok: true; data: AgentReplyV2; fotosParaEnviar: string[]; vehiculoFocoId: string | null; pedidoStock: AgentReplyV2["pedido_stock"] }
  | { ok: false; error: string }
> {
  const mensajesCliente = historial.filter((h) => h.role === "user").length;
  if (mensajesCliente > LIMITE_MENSAJES_DURO) {
    return { ok: true, data: respuestaLimiteAlcanzado(), fotosParaEnviar: [], vehiculoFocoId: null, pedidoStock: null };
  }
  const sugerirCierre = mensajesCliente >= LIMITE_MENSAJES_SUAVE;

  const [sucursales, financiacion] = await Promise.all([fetchSucursalesInfo(), fetchFinanciacionInfo()]);

  const result = await chatJsonV2(AgentReplySchemaV2, [
    { role: "system", content: buildSystemPromptV2(undefined, undefined, nombreBot, undefined, sucursales, sugerirCierre, undefined, undefined, tono, esInstagram, financiacion) },
    ...historial,
  ], { origen: canal });

  if (!result.ok) return { ok: false, error: result.error };

  let respuesta = result.data;
  let resultadosBusqueda: ResultadoStockV2[] = [];

  // El vehículo que el cliente menciona cuando quiere VENDER o CONSIGNAR el
  // suyo NO es una búsqueda de stock para comprar — es el auto que él
  // ofrece. Sin este filtro, "quiero vender mi Corolla 2019" disparaba una
  // búsqueda de Corollas en stock y el bot terminaba mostrándole autos para
  // comprar en respuesta a que quería vender el propio.
  const esIntencionDeCompra = respuesta.intencion !== "VENTA" && respuesta.intencion !== "CONSIGNACION";

  // Ojo: NO se usa "tiene_permuta" acá -- ese flag queda en true durante TODA
  // la charla de permuta (no solo en el mensaje donde describe su auto), así
  // que apagaba el fallback en cualquier mensaje posterior aunque el cliente
  // ya esté buscando qué comprar ("busco solo fiat" mid-permuta se colaba).
  // La señal correcta es que "vehiculo_propio" se haya completado JUSTO en
  // este turno -- eso sí es específico del mensaje, no del estado general.
  const hablandoDeAutoPropio = !!respuesta.datos_detectados?.vehiculo_propio?.marca || !!respuesta.datos_detectados?.vehiculo_propio?.modelo;
  const noEncontroNadaParaBuscar = esIntencionDeCompra && !hablandoDeAutoPropio && !respuesta.vehiculo_mencionado?.modelo && !respuesta.vehiculo_mencionado?.marca && !respuesta.vehiculo_mencionado?.categoria && !respuesta.vehiculo_mencionado?.puertas && !respuesta.presupuesto_mencionado && !respuesta.pedir_stock_general;
  if (noEncontroNadaParaBuscar) {
    const ultimoMensajeCliente = [...historial].reverse().find((h) => h.role === "user")?.content;
    // Si el cliente pide una PARTE/pieza suelta (paragolpe, óptica, espejo,
    // repuesto, etc.) y de paso nombra una marca real de stock (ej:
    // "paragolpes de Corolla"), el modelo ya clasificó bien vehiculo_mencionado
    // en null (reglasStock.ts prohíbe mostrar stock ahí) -- pero este mismo
    // fallback, pensado para el caso de "se olvidó de completar el campo",
    // encontraba "Corolla" por texto plano y pisaba esa decisión correcta,
    // terminando en una venta de auto en vez de la respuesta de "no vendemos
    // repuestos sueltos". Se corta acá antes de intentar el match de texto.
    const pareceRepuestoOPieza = ultimoMensajeCliente && /(repuesto|autoparte|accesorio|pieza|paragolpe|parabrisa|óptica|optica|farol|espejo|batería|bateria|cubierta|neumático|neumatico|amortiguador|embrague|buje|correa|filtro|tapa|techo)/i.test(ultimoMensajeCliente);
    const fallback = ultimoMensajeCliente && !pareceRepuestoOPieza ? await extraerVehiculoFallback(ultimoMensajeCliente) : null;
    if (fallback) {
      respuesta = { ...respuesta, vehiculo_mencionado: { marca: fallback.marca, modelo: fallback.modelo, categoria: respuesta.vehiculo_mencionado?.categoria ?? null } };
    }
  }

  // 2da pasada con stock real inyectado -- misma llamada se usa en dos
  // casos: (a) el cliente mencionó algo nuevo para buscar, o (b) no mencionó
  // nada nuevo pero hay un auto en foco de turnos anteriores (ver más abajo).
  // Se factoriza acá para no duplicar el pass2+redes de seguridad dos veces.
  const correrPasada2 = async (resultados: ResultadoStockV2[], esAlternativa: boolean, total: number, categoriaSolicitada: string | null) => {
    resultadosBusqueda = resultados.filter((v) => !esVendido(v.estado));
    // "¿Está el de la historia?" sin año: no se confirma nada, se le piden modelo y año (lib/ai/estadoStockBot.ts).
    const sinSaberCual = referenciaVagaSinAnio(historial.filter((h) => h.role === "user").map((h) => h.content));
    const result2 = await chatJsonV2(AgentReplySchemaV2, [
      { role: "system", content: buildSystemPromptV2(undefined, resultados, nombreBot, esAlternativa, sucursales, sugerirCierre, categoriaSolicitada, total, tono, esInstagram, financiacion) + (sinSaberCual ? NOTA_REFERENCIA_VAGA : "") },
      ...historial,
    ], { origen: canal });

    // Auto único ya en foco (no alternativa, un solo resultado): esto es el
    // caso de "y el color?", "cuánto sale" sobre un auto puntual que ya se
    // venía hablando -- acá NO tiene sentido la red de "no mostró stock
    // real", porque una respuesta honesta a una pregunta puntual (o un
    // "no tengo ese dato, te derivo") no tiene por qué mencionar precio/año,
    // y forzar el listado canned de vuelta es justamente el bug que se
    // estaba reportando (relistea en vez de contestar la pregunta puntual).
    const autoUnicoYaEnFoco = !esAlternativa && resultados.length === 1;

    if (result2.ok) {
      const reply = respuestaMencionaStockInventado(result2.data.reply, resultados, sucursales)
        ? respuestaSeguraConStockReal(resultados, esAlternativa, !!nombreBot)
        : !result2.data.pedir_fotos && !result2.data.handoff && !autoUnicoYaEnFoco && !sinSaberCual && respuestaNoMuestraStockReal(result2.data.reply, resultados)
        ? respuestaSeguraConStockReal(resultados, esAlternativa, !!nombreBot)
        : result2.data.reply;
      // La segunda pasada es la que tiene el dato correcto post-reglas
      // (permuta, confirmación, etc.) — si algo lee estos campos más
      // adelante (hoy nada los persiste, pero por las dudas), que refleje
      // la versión final, no la de la primera pasada sin stock inyectado.
      respuesta = {
        ...respuesta,
        reply,
        handoff: result2.data.handoff,
        resumen_handoff: result2.data.resumen_handoff,
        calificacion: result2.data.calificacion,
        vehiculo_mencionado: result2.data.vehiculo_mencionado,
        pedir_stock_general: result2.data.pedir_stock_general,
        pedir_fotos: result2.data.pedir_fotos,
        presupuesto_mencionado: result2.data.presupuesto_mencionado,
        datos_detectados: result2.data.datos_detectados,
        intencion: result2.data.intencion,
        pedido_stock: result2.data.pedido_stock,
      };
    } else {
      console.error("[agenteV2] error en 2da pasada (stock):", result2.error);
    }
  };

  const mencionaAlgoParaBuscar = esIntencionDeCompra && (respuesta.vehiculo_mencionado?.modelo || respuesta.vehiculo_mencionado?.marca || respuesta.vehiculo_mencionado?.categoria || respuesta.vehiculo_mencionado?.puertas || respuesta.vehiculo_mencionado?.combustible || respuesta.presupuesto_mencionado || respuesta.pedir_stock_general);

  if (mencionaAlgoParaBuscar) {
    const categoriaSolicitada = respuesta.vehiculo_mencionado?.categoria ?? null;
    const { resultados, esAlternativa, total } = await buscarStockRealV2(
      respuesta.vehiculo_mencionado?.marca ?? null,
      respuesta.vehiculo_mencionado?.modelo ?? null,
      categoriaSolicitada,
      respuesta.presupuesto_mencionado,
      respuesta.vehiculo_mencionado?.puertas ?? null,
      respuesta.vehiculo_mencionado?.combustible ?? null,
      respuesta.vehiculo_mencionado?.anio ?? null
    );
    await correrPasada2(resultados, esAlternativa, total, categoriaSolicitada);
  } else if (esIntencionDeCompra && !hablandoDeAutoPropio && vehiculoEnFocoId) {
    // No mencionó auto/marca/modelo nuevo, pero hay un auto en foco de
    // turnos anteriores (ej: "y el color?", "cuánto sale" sin repetir
    // nombre) -- sin esto, el bot solo tenía el historial de texto para
    // "acordarse" del auto, y con un modelo chico (Haiku) eso se pierde o se
    // confunde a los pocos mensajes. Le volvemos a pasar los datos REALES y
    // actuales de ese auto puntual en este prompt, en vez de depender de que
    // recuerde bien lo que él mismo dijo antes.
    const { data: vehiculoFoco } = await supabase
      .from("vehiculos")
      .select("id, estado, marca, modelo, anio, precio_venta, moneda_venta, precio_publicado_ars, precio_publicado_usd, patente, color, km, version, transmision, combustible, categoria, puertas, origen, carroceria, motor_cilindrada, segmento, traccion, potencia_cv, cantidad_plazas, fotos, sucursales!vehiculos_sucursal_id_fkey ( nombre )")
      .eq("id", vehiculoEnFocoId)
      .in("estado", ESTADOS_QUE_VE_EL_BOT)
      .maybeSingle();
    if (vehiculoFoco) {
      // Si mientras tanto se señó, van también los parecidos.
      await correrPasada2(await sumarParecidosDeSenados([comoResultado(vehiculoFoco as unknown as FilaVehiculoBot)]), false, 1, null);
    }
  }

  // El prompt prohíbe explícitamente estos cierres genéricos y abiertos
  // ("¿alguna te interesa, o buscás un año o versión en particular?", "¿te
  // late...?"), pero un modelo chico (Haiku) los repite igual de vez en
  // cuando — se cortan del final de la respuesta como red de seguridad, en
  // vez de confiar solo en la instrucción.
  respuesta = { ...respuesta, reply: sacarCierreGenericoProhibido(respuesta.reply) };

  // Red de seguridad anti-alucinación de financiación (pedido del 26/9,
  // mismo criterio que la de stock): si a pesar del bloque FINANCIACIÓN con
  // los números reales el modelo igual menciona un % que no es ninguno de
  // los reales, se descarta esa respuesta y se reemplaza por el bloque
  // seguro armado en código, con los datos reales tal cual están cargados.
  if (respuestaMencionaFinanciacionInventada(respuesta.reply, financiacion)) {
    respuesta = { ...respuesta, reply: nombreBot ? respuestaFinanciacionWeb(financiacion) : respuestaSeguraConFinanciacionReal(financiacion, [...historial].reverse().find((h) => h.role === "user")?.content || "", esInstagram) };
  }

  // Paffy, financiación paso 2 (Walter, 31/10/2026): si antes preguntó qué auto financiar, la respuesta pide nombre, teléfono y CUIL.
  if (nombreBot && !respuesta.handoff) {
    const ultimoBot = [...historial].reverse().find((h) => h.role === "assistant")?.content;
    respuesta = { ...respuesta, reply: asegurarPedidoDeDatosWeb(respuesta.reply, ultimoBot) };
  }

  // El modelo a veces devuelve el menú de bienvenida parafraseado (mismo
  // contenido, texto distinto) — si detectamos que ESTO es el menú
  // (arranca con saludo/bienvenida y menciona los 4 temas), pisamos con el
  // texto exacto en vez de confiar en que lo haya copiado bien.
  if (/^\s*[✨]?\s*(¡?hola|bienvenid)/i.test(respuesta.reply) && /comprar/i.test(respuesta.reply) && /vender/i.test(respuesta.reply) && /consignar/i.test(respuesta.reply) && /seguros/i.test(respuesta.reply)) {
    respuesta = { ...respuesta, reply: menuBienvenidaV2() };
  }

  // Auto en foco de la charla: si esta búsqueda trajo un solo resultado
  // claro, ese pasa a ser el foco (se persiste en la conversación) — así un
  // pedido de fotos SIN volver a nombrar marca/modelo ("pásame fotos") sigue
  // sabiendo de qué auto se trata. Cuando trajo VARIOS (ej: "un Golf" y hay
  // 3 Golf distintos en stock), antes se perdía el vínculo con la unidad
  // puntual que el cliente pidió aunque su marca/modelo alcance para
  // identificarla sin ambigüedad entre esos resultados -- el lead quedaba
  // sin auto asociado en el panel pese a que el bot sí supo de cuál se
  // trataba. Mismo criterio de match por nombre que ya usa "pedir_fotos"
  // más abajo, pero solo cuando el match es único (si hay más de un
  // resultado con ese nombre, seguimos sin poder saber a cuál se refería).
  let vehiculoFocoId: string | null = null;
  if (resultadosBusqueda.length === 1) {
    vehiculoFocoId = resultadosBusqueda[0].id;
  } else if (resultadosBusqueda.length > 1) {
    const nombreBuscadoInicial = `${respuesta.vehiculo_mencionado?.marca ?? ""} ${respuesta.vehiculo_mencionado?.modelo ?? ""}`.trim().toLowerCase();
    if (nombreBuscadoInicial) {
      const coincidencias = resultadosBusqueda.filter((v) => `${v.marca} ${v.modelo}`.toLowerCase().includes(nombreBuscadoInicial));
      if (coincidencias.length === 1) vehiculoFocoId = coincidencias[0].id;
    }
  }

  let fotosParaEnviar: string[] = [];
  if (respuesta.pedir_fotos) {
    if (resultadosBusqueda.length >= 1) {
      // Si esta misma búsqueda trajo varios, preferimos el que matchea el
      // nombre que el cliente dijo; si no hay match claro, el primero.
      const nombreBuscado = `${respuesta.vehiculo_mencionado?.marca ?? ""} ${respuesta.vehiculo_mencionado?.modelo ?? ""}`.trim().toLowerCase();
      const match = resultadosBusqueda.find((v) => nombreBuscado && `${v.marca} ${v.modelo}`.toLowerCase().includes(nombreBuscado)) ?? resultadosBusqueda[0];
      fotosParaEnviar = (match.fotos ?? []).slice(0, 3);
      vehiculoFocoId = match.id;
    } else if (vehiculoEnFocoId) {
      // Pidió fotos sin repetir marca/modelo — usamos el auto que ya
      // estaba en foco de charlas anteriores.
      const { data: vehiculoFoco } = await supabase.from("vehiculos").select("id, fotos").eq("id", vehiculoEnFocoId).maybeSingle();
      if (vehiculoFoco) {
        fotosParaEnviar = (vehiculoFoco.fotos ?? []).slice(0, 3);
        vehiculoFocoId = vehiculoFoco.id;
      }
    }
  }

  // Link al cotizador con el auto de compra ya en foco: si hay permuta en
  // juego y ya sabemos qué auto quiere comprar, el link debe pre-cargar esa
  // referencia (?permuta=<id>, mismo parámetro que usa el botón "¿tenés un
  // usado para entregar?" del detalle de auto) -- sin esto el cliente entra
  // al cotizador a ciegas aunque el bot ya sabía perfectamente qué auto buscaba.
  const focoParaCotizador = vehiculoFocoId ?? vehiculoEnFocoId ?? null;
  if (focoParaCotizador && respuesta.datos_detectados?.tiene_permuta && respuesta.reply.includes("/cotizador")) {
    respuesta = { ...respuesta, reply: respuesta.reply.replace(/\/cotizador(?!\?)/g, `/cotizador?permuta=${focoParaCotizador}`) };
  }

  return { ok: true, data: respuesta, fotosParaEnviar, vehiculoFocoId, pedidoStock: respuesta.pedido_stock ?? null };
}
