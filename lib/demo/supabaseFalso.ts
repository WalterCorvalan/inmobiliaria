/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- base de mentira del modo demo: imita la forma libre de las respuestas de Supabase */
// Base de datos de mentira para el MODO DEMO del panel (23/11/2026, pedido de Walter: "quiero ver todos los módulos").
//
// Cuando el sitio se publica sin base conectada (sin NEXT_PUBLIC_SUPABASE2_URL), el panel usa este cliente en vez del de
// Supabase: imita lo que el panel le pide a la base (select, insert, update, filtros, orden, rpc, sesión, tiempo real) sobre
// tablas en memoria cargadas con datos de ejemplo (lib/demo/datos.ts). Cada pedido del servidor arranca con los datos de
// ejemplo limpios; en el navegador los cambios duran hasta recargar la página. Nada sale de la compu del visitante.
//
// Las relaciones del select ("*, whatsapp_contactos(nombre_perfil)") se resuelven por nombre: si la fila tiene la columna
// `<alias>_id`, `<singular>_id` o la que dice la pista `!tabla_columna_fkey`, trae esa fila; si no, trae las filas de la
// otra tabla que apuntan a esta (`<singular de esta tabla>_id`). Las columnas pedidas no se recortan: vuelve la fila entera.

type Fila = Record<string, any>;
type Tablas = Record<string, Fila[]>;
type Resultado = { data: any; error: { message: string; code?: string } | null; count?: number | null; status: number; statusText: string };

let secuencia = 0;
export function idDemo(): string {
  secuencia++;
  const hex = (Date.now().toString(16) + secuencia.toString(16).padStart(6, "0") + Math.random().toString(16).slice(2)).replace(/[^0-9a-f]/g, "").padEnd(32, "0").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function singular(palabra: string): string {
  if (/[dnlrz]es$/.test(palabra)) return palabra.slice(0, -2);
  if (palabra.endsWith("s")) return palabra.slice(0, -1);
  return palabra;
}
const ultimaParte = (tabla: string) => tabla.split("_").pop() || tabla;

// ---------- lectura del select con relaciones ----------
type Relacion = { alias: string; tabla: string; pista: string | null; interno: string };

function partirNivel(texto: string, sep = ","): string[] {
  const partes: string[] = [];
  let nivel = 0, actual = "";
  for (const ch of texto) {
    if (ch === "(") nivel++;
    if (ch === ")") nivel--;
    if (ch === sep && nivel === 0) { partes.push(actual.trim()); actual = ""; continue; }
    actual += ch;
  }
  if (actual.trim()) partes.push(actual.trim());
  return partes;
}

function relacionesDelSelect(columnas: string): Relacion[] {
  const out: Relacion[] = [];
  for (const parte of partirNivel(columnas.replace(/\s+/g, " "))) {
    const m = parte.match(/^(?:([a-zA-Z0-9_]+)\s*:\s*)?([a-zA-Z0-9_]+)(?:!([a-zA-Z0-9_]+))?(?:!inner|!left)?\s*\(([\s\S]*)\)$/);
    if (!m) continue;
    out.push({ alias: m[1] || m[2], tabla: m[2], pista: m[3] || null, interno: m[4] });
  }
  return out;
}

function resolverRelaciones(tablas: Tablas, tablaOrigen: string, filas: Fila[], columnas: string): Fila[] {
  const rels = relacionesDelSelect(columnas);
  if (!rels.length) return filas.map((f) => ({ ...f }));
  return filas.map((fila) => {
    const copia: Fila = { ...fila };
    for (const r of rels) {
      const destino = tablas[r.tabla] || [];
      const candidatas = [
        r.pista ? r.pista.replace(new RegExp(`^${tablaOrigen}_`), "").replace(/_fkey$/, "") : null,
        r.pista && !r.pista.endsWith("_fkey") ? r.pista : null,
        `${r.alias}_id`,
        `${singular(ultimaParte(r.tabla))}_id`,
        `${singular(r.tabla)}_id`,
        r.tabla === "perfiles" ? "vendedor_id" : null,
      ].filter(Boolean) as string[];
      const col = candidatas.find((c) => c in fila);
      let valor: any;
      if (col) {
        const encontrada = fila[col] == null ? null : destino.find((d) => d.id === fila[col] || d.empresa_id === fila[col] && r.tabla === "empresas") ?? null;
        valor = encontrada ? resolverRelaciones(tablas, r.tabla, [encontrada], r.interno)[0] : null;
      } else {
        const inversa = [`${singular(ultimaParte(tablaOrigen))}_id`, `${singular(tablaOrigen)}_id`, `${tablaOrigen.replace(/s$/, "")}_id`];
        const colInv = inversa.find((c) => destino.some((d) => c in d));
        valor = colInv ? resolverRelaciones(tablas, r.tabla, destino.filter((d) => d[colInv] === fila.id), r.interno) : [];
      }
      copia[r.alias] = valor;
    }
    return copia;
  });
}

// ---------- filtros ----------
type Filtro = (f: Fila) => boolean;

function valorCol(f: Fila, col: string): any {
  if (col.includes("->")) {
    const [base, ...resto] = col.split(/->>?/);
    let v = f[base];
    for (const k of resto) v = v?.[k.replace(/'/g, "")];
    return v;
  }
  if (col.includes(".")) {
    const [rel, c] = col.split(".");
    const r = f[rel];
    if (r && typeof r === "object") return Array.isArray(r) ? r.map((x) => x?.[c]) : r[c];
    return undefined;
  }
  return f[col];
}

function comoLista(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") return v.replace(/^[({]|[)}]$/g, "").split(",").map((x) => x.trim().replace(/^"|"$/g, "")).filter((x) => x !== "");
  return [v];
}

function comparar(a: any, b: any): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === "number" || typeof b === "number") return Number(a) - Number(b);
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

function patron(p: string, flags = ""): RegExp {
  const esc = String(p).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/\*/g, ".*").replace(/_/g, ".");
  return new RegExp(`^${esc}$`, flags);
}

function aplicarOp(op: string, valorFila: any, valor: any): boolean {
  const normal = (v: any) => (v === "true" ? true : v === "false" ? false : v === "null" ? null : v);
  switch (op) {
    case "eq": return valorFila === normal(valor) || (valorFila != null && String(valorFila) === String(valor));
    case "neq": return !(valorFila === normal(valor) || (valorFila != null && String(valorFila) === String(valor)));
    case "gt": return valorFila != null && comparar(valorFila, valor) > 0;
    case "gte": return valorFila != null && comparar(valorFila, valor) >= 0;
    case "lt": return valorFila != null && comparar(valorFila, valor) < 0;
    case "lte": return valorFila != null && comparar(valorFila, valor) <= 0;
    case "like": return valorFila != null && patron(valor).test(String(valorFila));
    case "ilike": return valorFila != null && patron(valor, "i").test(String(valorFila));
    case "is": { const v = normal(valor); return v === null ? valorFila == null : valorFila === v; }
    case "in": return comoLista(valor).some((x) => String(x) === String(valorFila));
    case "cs": { const l = comoLista(valor); const fila = Array.isArray(valorFila) ? valorFila : []; return l.every((x) => fila.map(String).includes(String(x))); }
    case "cd": { const l = comoLista(valor).map(String); return (Array.isArray(valorFila) ? valorFila : []).every((x: any) => l.includes(String(x))); }
    case "ov": { const l = comoLista(valor).map(String); return (Array.isArray(valorFila) ? valorFila : []).some((x: any) => l.includes(String(x))); }
    case "fts": case "plfts": case "wfts": case "phfts": return valorFila != null && String(valorFila).toLowerCase().includes(String(valor).toLowerCase());
    default: return true;
  }
}

function filtroDeTexto(expr: string): Filtro {
  // "col.op.valor", "col.not.op.valor", "and(a.eq.1,b.eq.2)", "or(...)"
  const grupo = expr.match(/^(and|or)\(([\s\S]*)\)$/);
  if (grupo) {
    const hijos = partirNivel(grupo[2]).map(filtroDeTexto);
    return grupo[1] === "and" ? (f) => hijos.every((h) => h(f)) : (f) => hijos.some((h) => h(f));
  }
  const m = expr.match(/^([^.]+(?:\.[a-z_]+(?=\.(?:not\.)?(?:eq|neq|gt|gte|lt|lte|like|ilike|is|in|cs|cd|ov|fts)\.))?)\.(not\.)?([a-z]+)\.([\s\S]*)$/);
  if (!m) return () => true;
  const [, col, negar, op, valor] = m;
  return (f) => { const r = aplicarOp(op, valorCol(f, col), valor); return negar ? !r : r; };
}

// ---------- el constructor de consultas ----------
class Consulta implements PromiseLike<Resultado> {
  private filtros: Filtro[] = [];
  private orden: { col: string; asc: boolean; nullsFirst?: boolean }[] = [];
  private tope: number | null = null;
  private desde = 0;
  private modo: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private columnas = "*";
  private devolver = false;
  private unico: "single" | "maybe" | null = null;
  private valores: any = null;
  private opcionesConteo: { count?: string; head?: boolean } = {};
  private conflicto: string | null = null;

  constructor(private db: BaseFalsa, private tabla: string) {}

  select(columnas = "*", opciones: { count?: string; head?: boolean } = {}) {
    if (this.modo === "select") { this.columnas = columnas; this.opcionesConteo = opciones || {}; }
    else { this.devolver = true; this.columnas = columnas; }
    return this;
  }
  insert(valores: any, _op?: any) { this.modo = "insert"; this.valores = valores; return this; }
  upsert(valores: any, op?: { onConflict?: string }) { this.modo = "upsert"; this.valores = valores; this.conflicto = op?.onConflict || null; return this; }
  update(valores: any, _op?: any) { this.modo = "update"; this.valores = valores; return this; }
  delete(_op?: any) { this.modo = "delete"; return this; }

  private agregar(f: Filtro) { this.filtros.push(f); return this; }
  eq(c: string, v: any) { return this.agregar((f) => aplicarOp("eq", valorCol(f, c), v)); }
  neq(c: string, v: any) { return this.agregar((f) => aplicarOp("neq", valorCol(f, c), v)); }
  gt(c: string, v: any) { return this.agregar((f) => aplicarOp("gt", valorCol(f, c), v)); }
  gte(c: string, v: any) { return this.agregar((f) => aplicarOp("gte", valorCol(f, c), v)); }
  lt(c: string, v: any) { return this.agregar((f) => aplicarOp("lt", valorCol(f, c), v)); }
  lte(c: string, v: any) { return this.agregar((f) => aplicarOp("lte", valorCol(f, c), v)); }
  like(c: string, v: any) { return this.agregar((f) => aplicarOp("like", valorCol(f, c), v)); }
  ilike(c: string, v: any) { return this.agregar((f) => aplicarOp("ilike", valorCol(f, c), v)); }
  is(c: string, v: any) { return this.agregar((f) => aplicarOp("is", valorCol(f, c), v === null ? "null" : v)); }
  in(c: string, v: any[]) { return this.agregar((f) => aplicarOp("in", valorCol(f, c), v)); }
  contains(c: string, v: any) { return this.agregar((f) => (typeof v === "object" && !Array.isArray(v) ? Object.entries(v).every(([k, x]) => valorCol(f, c)?.[k] === x) : aplicarOp("cs", valorCol(f, c), v))); }
  containedBy(c: string, v: any) { return this.agregar((f) => aplicarOp("cd", valorCol(f, c), v)); }
  overlaps(c: string, v: any) { return this.agregar((f) => aplicarOp("ov", valorCol(f, c), v)); }
  textSearch(c: string, v: any) { return this.agregar((f) => aplicarOp("fts", valorCol(f, c), v)); }
  match(obj: Record<string, any>) { return this.agregar((f) => Object.entries(obj).every(([c, v]) => aplicarOp("eq", valorCol(f, c), v))); }
  not(c: string, op: string, v: any) { return this.agregar((f) => !aplicarOp(op, valorCol(f, c), v === null ? "null" : v)); }
  filter(c: string, op: string, v: any) {
    if (op.startsWith("not.")) return this.not(c, op.slice(4), v);
    return this.agregar((f) => aplicarOp(op, valorCol(f, c), v));
  }
  or(expr: string, _op?: any) { const f = filtroDeTexto(`or(${expr})`); return this.agregar(f); }
  order(col: string, op: { ascending?: boolean; nullsFirst?: boolean; foreignTable?: string; referencedTable?: string } = {}) {
    if (op.foreignTable || op.referencedTable) return this;
    this.orden.push({ col, asc: op.ascending !== false, nullsFirst: op.nullsFirst });
    return this;
  }
  limit(n: number, op: { foreignTable?: string; referencedTable?: string } = {}) { if (!op.foreignTable && !op.referencedTable) this.tope = n; return this; }
  range(a: number, b: number) { this.desde = a; this.tope = b - a + 1; return this; }
  single() { this.unico = "single"; return this; }
  maybeSingle() { this.unico = "maybe"; return this; }
  abortSignal(_s: any) { return this; }
  returns() { return this; }
  overrideTypes() { return this; }
  throwOnError() { return this; }
  csv() { return this; }
  explain() { return this; }

  private filas(): Fila[] { return this.db.tablas[this.tabla] || (this.db.tablas[this.tabla] = []); }

  private ejecutar(): Resultado {
    const ok = (data: any, count: number | null = null): Resultado => ({ data, error: null, count, status: 200, statusText: "OK" });
    const tablas = this.db.tablas;
    const filas = this.filas();
    let afectadas: Fila[] = [];

    if (this.modo === "insert" || this.modo === "upsert") {
      const lista = (Array.isArray(this.valores) ? this.valores : [this.valores]).map((v: Fila) => ({ ...v }));
      for (const nueva of lista) {
        const ahora = new Date().toISOString();
        const claves = this.conflicto ? this.conflicto.split(",").map((s) => s.trim()) : ["id"];
        const existente = this.modo === "upsert" ? filas.find((f) => claves.every((k) => nueva[k] !== undefined && f[k] === nueva[k])) : undefined;
        if (existente) { Object.assign(existente, nueva, { updated_at: ahora }); afectadas.push(existente); continue; }
        const fila = { id: idDemo(), empresa_id: this.db.empresaId, created_at: ahora, updated_at: ahora, ...nueva };
        filas.unshift(fila);
        afectadas.push(fila);
      }
      this.db.avisar(this.tabla, "INSERT", afectadas);
    } else if (this.modo === "update" || this.modo === "delete") {
      afectadas = filas.filter((f) => this.filtros.every((fn) => fn(f)));
      if (this.modo === "update") {
        for (const f of afectadas) Object.assign(f, this.valores, this.valores && "updated_at" in this.valores ? {} : { updated_at: new Date().toISOString() });
        this.db.avisar(this.tabla, "UPDATE", afectadas);
      } else {
        this.db.tablas[this.tabla] = filas.filter((f) => !afectadas.includes(f));
        this.db.avisar(this.tabla, "DELETE", afectadas);
      }
    }

    if (this.modo !== "select") {
      if (!this.devolver) return { ...ok(null), status: this.modo === "insert" ? 201 : 204 };
      const data = resolverRelaciones(tablas, this.tabla, afectadas, this.columnas);
      return this.cerrar(data, null);
    }

    // select: primero se arman las relaciones (algunos filtros miran columnas de la tabla relacionada)
    let lista = resolverRelaciones(tablas, this.tabla, filas, this.columnas).filter((f) => this.filtros.every((fn) => fn(f)));
    for (const o of [...this.orden].reverse()) {
      lista = [...lista].sort((a, b) => {
        const va = valorCol(a, o.col), vb = valorCol(b, o.col);
        if (va == null || vb == null) {
          if (va == null && vb == null) return 0;
          const nullsFirst = o.nullsFirst ?? !o.asc;
          return (va == null ? -1 : 1) * (nullsFirst ? 1 : -1);
        }
        return o.asc ? comparar(va, vb) : -comparar(va, vb);
      });
    }
    const total = lista.length;
    if (this.desde || this.tope != null) lista = lista.slice(this.desde, this.tope != null ? this.desde + this.tope : undefined);
    if (this.opcionesConteo.head) return ok(null, total);
    return this.cerrar(lista, this.opcionesConteo.count ? total : null);
  }

  private cerrar(data: Fila[], count: number | null): Resultado {
    if (this.unico === "single") {
      if (data.length !== 1) return { data: null, error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116" }, count, status: 406, statusText: "Not Acceptable" };
      return { data: data[0], error: null, count, status: 200, statusText: "OK" };
    }
    if (this.unico === "maybe") return { data: data[0] ?? null, error: null, count, status: 200, statusText: "OK" };
    return { data, error: null, count, status: 200, statusText: "OK" };
  }

  then<A = Resultado, B = never>(ok?: ((r: Resultado) => A | PromiseLike<A>) | null, mal?: ((e: any) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    let r: Resultado;
    try { r = this.ejecutar(); } catch (e: any) { r = { data: null, error: { message: String(e?.message || e) }, status: 500, statusText: "Error" }; }
    return Promise.resolve(r).then(ok, mal);
  }
}

// ---------- tiempo real (los cambios hechos en esta misma pestaña) ----------
type Oyente = { tabla: string; evento: string; filtro?: string; fn: (p: any) => void };

class CanalFalso {
  oyentes: Oyente[] = [];
  constructor(private db: BaseFalsa, public nombre: string) {}
  on(_tipo: string, opciones: any, fn: (p: any) => void) {
    if (opciones?.table) this.oyentes.push({ tabla: opciones.table, evento: opciones.event || "*", filtro: opciones.filter, fn });
    return this;
  }
  subscribe(cb?: (estado: string) => void) { this.db.canales.add(this); setTimeout(() => cb?.("SUBSCRIBED"), 0); return this; }
  unsubscribe() { this.db.canales.delete(this); return Promise.resolve("ok"); }
  send() { return Promise.resolve("ok"); }
  track() { return Promise.resolve("ok"); }
  presenceState() { return {}; }
}

// ---------- el cliente completo ----------
export type OpcionesBaseFalsa = {
  empresaId: string;
  usuario: { id: string; email: string; nombre: string };
  datos: () => Tablas;
  rpc?: (nombre: string, args: any, tablas: Tablas) => any;
};

export class BaseFalsa {
  tablas: Tablas;
  canales = new Set<CanalFalso>();
  empresaId: string;
  private sesionActiva = true;
  private oyentesAuth = new Set<(e: string, s: any) => void>();

  constructor(private op: OpcionesBaseFalsa) {
    this.tablas = op.datos();
    this.empresaId = op.empresaId;
  }

  avisar(tabla: string, evento: string, filas: Fila[]) {
    for (const canal of this.canales) for (const o of canal.oyentes) {
      if (o.tabla !== tabla || (o.evento !== "*" && o.evento !== evento)) continue;
      for (const fila of filas) {
        if (o.filtro) {
          const m = o.filtro.match(/^([a-z_]+)=([a-z]+)\.(.*)$/);
          if (m && !aplicarOp(m[2], fila[m[1]], m[3])) continue;
        }
        setTimeout(() => o.fn({ eventType: evento, new: evento === "DELETE" ? {} : { ...fila }, old: evento === "DELETE" ? { ...fila } : {}, table: tabla, schema: "public" }), 0);
      }
    }
  }

  from(tabla: string) { return new Consulta(this, tabla); }
  schema(_s: string) { return this; }

  rpc(nombre: string, args: any = {}, _op?: any) {
    const resultado = (): Resultado => {
      try {
        const data = this.op.rpc ? this.op.rpc(nombre, args, this.tablas) : null;
        return { data: data === undefined ? null : data, error: null, status: 200, statusText: "OK" };
      } catch (e: any) {
        return { data: null, error: { message: String(e?.message || e) }, status: 500, statusText: "Error" };
      }
    };
    const p: any = { then: (a: any, b: any) => Promise.resolve(resultado()).then(a, b) };
    for (const m of ["single", "maybeSingle", "select", "eq", "order", "limit", "abortSignal", "returns"]) p[m] = () => p;
    return p;
  }

  channel(nombre: string) { return new CanalFalso(this, nombre); }
  removeChannel(c: CanalFalso) { this.canales.delete(c); return Promise.resolve("ok"); }
  removeAllChannels() { this.canales.clear(); return Promise.resolve([]); }
  getChannels() { return [...this.canales]; }

  private get usuarioSupabase() {
    const u = this.op.usuario;
    return { id: u.id, email: u.email, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: { nombre: u.nombre }, created_at: new Date().toISOString() };
  }
  private get sesion() {
    return { access_token: "demo", refresh_token: "demo", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: this.usuarioSupabase };
  }

  auth = {
    getUser: async (_jwt?: string) => ({ data: { user: this.sesionActiva ? this.usuarioSupabase : null }, error: null }),
    getSession: async () => ({ data: { session: this.sesionActiva ? this.sesion : null }, error: null }),
    getClaims: async () => ({ data: this.sesionActiva ? { claims: { sub: this.op.usuario.id, email: this.op.usuario.email } } : null, error: null }),
    signInWithPassword: async (_c?: any) => { this.sesionActiva = true; this.oyentesAuth.forEach((fn) => fn("SIGNED_IN", this.sesion)); return { data: { user: this.usuarioSupabase, session: this.sesion }, error: null }; },
    signInWithOtp: async (_c?: any) => ({ data: {}, error: null }),
    signOut: async (_o?: any) => { this.sesionActiva = true; return { error: null }; },
    onAuthStateChange: (fn: (e: string, s: any) => void) => {
      this.oyentesAuth.add(fn);
      setTimeout(() => fn("INITIAL_SESSION", this.sesion), 0);
      return { data: { subscription: { id: "demo", unsubscribe: () => this.oyentesAuth.delete(fn) } } };
    },
    updateUser: async (_d?: any) => ({ data: { user: this.usuarioSupabase }, error: null }),
    resetPasswordForEmail: async () => ({ data: {}, error: null }),
    refreshSession: async () => ({ data: { session: this.sesion, user: this.usuarioSupabase }, error: null }),
    setSession: async () => ({ data: { session: this.sesion, user: this.usuarioSupabase }, error: null }),
    exchangeCodeForSession: async () => ({ data: { session: this.sesion, user: this.usuarioSupabase }, error: null }),
    admin: {
      createUser: async (d: any) => ({ data: { user: { ...this.usuarioSupabase, id: idDemo(), email: d?.email } }, error: null }),
      deleteUser: async () => ({ data: {}, error: null }),
      updateUserById: async () => ({ data: { user: this.usuarioSupabase }, error: null }),
      listUsers: async () => ({ data: { users: [this.usuarioSupabase] }, error: null }),
      getUserById: async () => ({ data: { user: this.usuarioSupabase }, error: null }),
      inviteUserByEmail: async () => ({ data: { user: this.usuarioSupabase }, error: null }),
    },
  };

  storage = {
    from: (_bucket: string) => ({
      upload: async (ruta: string) => ({ data: { path: ruta, id: idDemo(), fullPath: ruta }, error: null }),
      remove: async (_r: string[]) => ({ data: [], error: null }),
      list: async () => ({ data: [], error: null }),
      download: async () => ({ data: null, error: { message: "En la demo no hay archivos guardados" } }),
      createSignedUrl: async (ruta: string) => ({ data: { signedUrl: ruta.startsWith("http") || ruta.startsWith("/") ? ruta : "/icons/panel-app-180.png" }, error: null }),
      createSignedUrls: async (rutas: string[]) => ({ data: rutas.map((r) => ({ path: r, signedUrl: r, error: null })), error: null }),
      getPublicUrl: (ruta: string) => ({ data: { publicUrl: ruta.startsWith("http") || ruta.startsWith("/") ? ruta : "/icons/panel-app-180.png" } }),
    }),
  };

  functions = { invoke: async () => ({ data: null, error: null }) };
}
