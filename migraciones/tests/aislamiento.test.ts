// Prueba de aislamiento entre empresas. Levanta una base Postgres en memoria (PGlite), aplica TODAS las migraciones en
// orden y comprueba con dos empresas que ninguna ve, toca ni avisa a la otra. Si este test falla NO se cambia el test:
// se arregla la migración. Cada tabla nueva con empresa_id queda cubierta sola por la prueba "toda tabla ...".
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { TABLAS_DE_EMPRESA } from "../../lib/empresa/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DIR = join(process.cwd(), "migraciones");
const U = {
  duenoA: "a0000000-0000-0000-0000-000000000001", encargadoA: "a0000000-0000-0000-0000-000000000002",
  asesorA1: "a0000000-0000-0000-0000-000000000003", asesorA2: "a0000000-0000-0000-0000-000000000004",
  duenoB: "b0000000-0000-0000-0000-000000000001", asesorB1: "b0000000-0000-0000-0000-000000000002",
  superadmin: "c0000000-0000-0000-0000-000000000001",
};
const A = "aaaaaaaa-0000-0000-0000-00000000000a";
const B = "bbbbbbbb-0000-0000-0000-00000000000b";

let db: PGlite;
const filas = async (sql: string) => (await db.query(sql)).rows as Record<string, unknown>[];
const uno = async (sql: string) => (await filas(sql))[0];

// Ejecuta como un usuario logueado (role "authenticated", con su sesión), o sin sesión = el servidor (clave de servicio).
async function como<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`select set_config('request.jwt.claim.sub', '${uid}', false); set role authenticated;`);
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
}

beforeAll(async () => {
  db = new PGlite();
  // Lo que Supabase ya trae: roles, esquema auth, usuarios y auth.uid().
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
    grant usage on schema auth to authenticated, anon;
  `);
  const archivos = readdirSync(DIR).filter((f) => /^sql_(schema_migraciones|\d{3}_.*)\.sql$/.test(f)).sort((a, b) => (a.startsWith("sql_schema") ? -1 : b.startsWith("sql_schema") ? 1 : a.localeCompare(b)));
  for (const f of archivos) await db.exec(readFileSync(join(DIR, f), "utf8"));
  // Supabase da permisos de tabla a "authenticated"; lo que filtra es la seguridad por fila.
  await db.exec(`grant usage on schema public to authenticated, anon; grant all on all tables in schema public to authenticated;`);

  // Dos empresas y su gente.
  await db.exec(`insert into empresas (id, nombre, slug) values ('${A}', 'Inmobiliaria A', 'a'), ('${B}', 'Inmobiliaria B', 'b');`);
  for (const id of Object.values(U)) await db.exec(`insert into auth.users (id) values ('${id}');`);
  await db.exec(`
    insert into sucursales (id, empresa_id, nombre, slug) values
      ('a1000000-0000-0000-0000-000000000001', '${A}', 'Oficina 1', 'oficina-1'),
      ('b1000000-0000-0000-0000-000000000001', '${B}', 'Oficina 1', 'oficina-1');
    insert into perfiles (id, empresa_id, nombre, roles, orden_ronda, sucursal_id) values
      ('${U.duenoA}', '${A}', 'Dueño A', '{admin}', null, null),
      ('${U.encargadoA}', '${A}', 'Encargado A', '{encargado}', null, 'a1000000-0000-0000-0000-000000000001'),
      ('${U.asesorA1}', '${A}', 'Asesor A1', '{ventas}', 1, 'a1000000-0000-0000-0000-000000000001'),
      ('${U.asesorA2}', '${A}', 'Asesor A2', '{ventas}', 2, 'a1000000-0000-0000-0000-000000000001'),
      ('${U.duenoB}', '${B}', 'Dueño B', '{admin}', null, null),
      ('${U.asesorB1}', '${B}', 'Asesor B1', '{ventas}', 1, 'b1000000-0000-0000-0000-000000000001');
    insert into superadmins (user_id) values ('${U.superadmin}');
  `);
}, 120_000);

afterAll(async () => { await db?.close(); });

describe("alta de una empresa", () => {
  it("cada empresa nace con sus motivos de cierre", async () => {
    const r = await filas(`select empresa_id, count(*)::int n from motivos_cierre where nombre in ('No respondió', 'Precio') group by empresa_id`);
    expect(r.length).toBe(2);
    expect(r.every((x) => x.n === 2)).toBe(true);
  });

  it("cada empresa nace con sus filas de configuración y sus tres verify tokens propios", async () => {
    expect((await filas(`select empresa_id from configuracion_empresa`)).length).toBe(2);
    const tokens = await filas(`select webhook_verify_token t from whatsapp_configuracion union all select webhook_verify_token from instagram_configuracion union all select verify_token from messenger_configuracion`);
    expect(tokens.length).toBe(6);
    expect(new Set(tokens.map((r) => r.t)).size).toBe(6);
    expect(tokens.every((r) => String(r.t).length >= 40)).toBe(true);
  });

  it("el mismo verify token no puede estar en dos empresas (así el webhook sabe de quién es cada mensaje)", async () => {
    const a = await uno(`select webhook_verify_token t from whatsapp_configuracion where empresa_id = '${A}'`);
    await expect(db.exec(`update whatsapp_configuracion set webhook_verify_token = '${a.t}' where empresa_id = '${B}'`)).rejects.toThrow(/duplicate|unique|único/i);
  });
});

describe("límite de pedidos", () => {
  it("corta al pasar el tope y vuelve a dejar pasar al terminar la ventana; nadie logueado lo puede llamar", async () => {
    const llamar = async () => uno(`select * from rate_limit_check('ip:1.2.3.4', 3, 60000)`);
    const r = [await llamar(), await llamar(), await llamar(), await llamar()];
    expect(r.map((x) => x.ok)).toEqual([true, true, true, false]);
    expect(Number(r[3].retry_after_seconds)).toBeGreaterThan(0);
    await db.exec(`update rate_limits set ventana_inicio = now() - interval '2 minutes' where clave = 'ip:1.2.3.4'`);
    expect((await llamar()).ok).toBe(true);
    await como(U.asesorA1, async () => {
      await expect(db.query(`select * from rate_limit_check('x', 1, 1000)`)).rejects.toThrow(/permission|permiso/i);
      expect((await filas(`select * from rate_limits`)).length).toBe(0);
    });
  });
});

describe("estructura: ninguna tabla con empresa queda sin protección", () => {
  it("toda tabla con empresa_id tiene seguridad por fila activada y una política que usa mi_empresa_id()", async () => {
    const tablas = await filas(`select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and exists (select 1 from information_schema.columns k where k.table_schema = 'public' and k.table_name = c.relname and k.column_name = 'empresa_id')`);
    expect(tablas.length).toBeGreaterThan(25);
    for (const t of tablas) {
      expect(t.relrowsecurity, `${t.relname} sin seguridad por fila`).toBe(true);
      const pols = await filas(`select qual, with_check from pg_policies where schemaname = 'public' and tablename = '${t.relname}'`);
      // soporte_accesos es de la plataforma: con la seguridad activada y SIN políticas nadie la toca desde el navegador.
      if (t.relname === "soporte_accesos") { expect(pols.length).toBe(0); continue; }
      expect(pols.length, `${t.relname} sin políticas`).toBeGreaterThan(0);
      expect(pols.some((p) => /mi_empresa_id/.test(`${p.qual} ${p.with_check}`)), `${t.relname}: ninguna política mira la empresa`).toBe(true);
    }
  });

  it("la lista de tablas que el servidor ata a la empresa (lib/empresa/db.ts) coincide con la base", async () => {
    const enBase = await filas(`select distinct table_name from information_schema.columns where table_schema = 'public' and column_name = 'empresa_id' and table_name <> 'soporte_accesos' order by 1`);
    expect(enBase.map((r) => r.table_name as string)).toEqual([...TABLAS_DE_EMPRESA].sort());
  });

  it("las únicas tablas sin empresa_id son las de la plataforma", async () => {
    const sin = await filas(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not exists (select 1 from information_schema.columns k where k.table_schema = 'public' and k.table_name = c.relname and k.column_name = 'empresa_id') order by 1`);
    expect(sin.map((r) => r.relname)).toEqual(["empresas", "rate_limits", "schema_migraciones", "superadmins"]);
  });

  it("las tablas de la plataforma no se leen desde el navegador", async () => {
    await como(U.duenoA, async () => {
      expect((await filas(`select * from superadmins`)).length).toBe(0);
      expect((await filas(`select * from soporte_accesos`)).length).toBe(0);
      expect((await filas(`select id from empresas`)).map((r) => r.id)).toEqual([A]);
    });
    await como(U.asesorA1, async () => {
      await expect(db.exec(`insert into empresas (nombre, slug) values ('X', 'x')`)).rejects.toThrow();
      await expect(db.exec(`insert into superadmins (user_id) values ('${U.asesorA1}')`)).rejects.toThrow();
    });
  });
});

describe("cada empresa ve y toca solo lo suyo", () => {
  beforeAll(async () => {
    await db.exec(`
      insert into leads_manuales (empresa_id, nombre, vendedor_id) values ('${A}', 'Lead de A', '${U.asesorA1}'), ('${B}', 'Lead de B', '${U.asesorB1}');
      insert into clientes (empresa_id, nombre) values ('${A}', 'Cliente de A'), ('${B}', 'Cliente de B');
      insert into motivos_cierre (empresa_id, nombre) values ('${A}', 'Motivo propio'), ('${B}', 'Motivo propio');
      insert into whatsapp_contactos (empresa_id, telefono, nombre_perfil) values ('${A}', '5491100000000', 'Cliente WA A'), ('${B}', '5491100000000', 'Cliente WA B');
    `);
  });

  it("un asesor de A solo ve filas de A en todas las tablas", async () => {
    await como(U.asesorA1, async () => {
      const tablas = await filas(`select table_name from information_schema.columns where table_schema = 'public' and column_name = 'empresa_id' order by 1`);
      for (const { table_name } of tablas) {
        const r = await uno(`select count(*)::int as n from ${table_name} where empresa_id is distinct from '${A}'`);
        expect(r.n, `${table_name} deja ver filas de otra empresa`).toBe(0);
      }
      expect((await filas(`select nombre from leads_manuales`)).map((r) => r.nombre)).toEqual(["Lead de A"]);
      expect((await filas(`select nombre from perfiles order by nombre`)).length).toBe(4);
    });
  });

  it("el mismo teléfono puede ser contacto de las dos empresas, sin mezclarse", async () => {
    await como(U.asesorA1, async () => expect((await filas(`select nombre_perfil from whatsapp_contactos`)).map((r) => r.nombre_perfil)).toEqual(["Cliente WA A"]));
    await como(U.asesorB1, async () => expect((await filas(`select nombre_perfil from whatsapp_contactos`)).map((r) => r.nombre_perfil)).toEqual(["Cliente WA B"]));
    await expect(db.exec(`insert into whatsapp_contactos (empresa_id, telefono) values ('${A}', '5491100000000')`)).rejects.toThrow(/duplicate|unique/i);
  });

  it("no se puede guardar una fila a nombre de otra empresa; sin decir empresa, queda en la propia", async () => {
    await como(U.asesorA1, async () => {
      await expect(db.exec(`insert into leads_manuales (empresa_id, nombre) values ('${B}', 'Intruso')`)).rejects.toThrow(/row-level security/i);
      await db.exec(`insert into leads_manuales (nombre) values ('Nuevo de A')`);
      expect((await uno(`select empresa_id from leads_manuales where nombre = 'Nuevo de A'`)).empresa_id).toBe(A);
    });
  });

  it("no se puede modificar ni borrar lo de otra empresa (afecta 0 filas)", async () => {
    await como(U.asesorA1, async () => {
      expect((await filas(`update leads_manuales set nombre = 'Hackeado' where nombre = 'Lead de B' returning id`)).length).toBe(0);
      expect((await filas(`delete from clientes where nombre = 'Cliente de B' returning id`)).length).toBe(0);
    });
    expect((await uno(`select nombre from leads_manuales where empresa_id = '${B}' and nombre like 'Lead de%'`)).nombre).toBe("Lead de B");
  });

  it("una empresa suspendida deja de ver todo", async () => {
    await db.exec(`update empresas set estado = 'suspendida' where id = '${B}'`);
    await como(U.asesorB1, async () => {
      expect((await filas(`select * from leads_manuales`)).length).toBe(0);
      expect((await filas(`select * from perfiles`)).length).toBe(0);
    });
    await db.exec(`update empresas set estado = 'activa' where id = '${B}'`);
    await como(U.asesorB1, async () => expect((await filas(`select * from leads_manuales`)).length).toBe(1));
  });
});

describe("usuarios: nadie se cambia de empresa ni se sube de rol", () => {
  it("un asesor no puede pasarse a otra empresa ni cambiarse el rol", async () => {
    await como(U.asesorA1, async () => {
      await expect(db.exec(`update perfiles set empresa_id = '${B}' where id = '${U.asesorA1}'`)).rejects.toThrow(/cambiar de empresa|row-level security/i);
      await expect(db.exec(`update perfiles set roles = '{admin}' where id = '${U.asesorA1}'`)).rejects.toThrow(/dueño/i);
      await db.exec(`update perfiles set nombre = 'Asesor A1 (editado)' where id = '${U.asesorA1}'`);
    });
  });

  it("el dueño cambia roles de su gente pero no puede mover a nadie de empresa ni tocar a la otra empresa", async () => {
    await como(U.duenoA, async () => {
      await db.exec(`update perfiles set roles = '{ventas,encargado}' where id = '${U.asesorA2}'`);
      await expect(db.exec(`update perfiles set empresa_id = '${B}' where id = '${U.asesorA2}'`)).rejects.toThrow(/cambiar de empresa|row-level security/i);
      expect((await filas(`update perfiles set activo = false where id = '${U.duenoB}' returning id`)).length).toBe(0);
    });
    await db.exec(`update perfiles set roles = '{ventas}' where id = '${U.asesorA2}'`);
  });

  it("solo existen los tres roles", async () => {
    await expect(db.exec(`update perfiles set roles = '{director}' where id = '${U.asesorA2}'`)).rejects.toThrow(/check|perfiles_roles/i);
  });
});

describe("credenciales de los canales: solo el dueño de la empresa", () => {
  it("un asesor no ve la configuración de WhatsApp, Instagram ni Messenger; el dueño ve solo la suya", async () => {
    await como(U.asesorA1, async () => {
      for (const t of ["whatsapp_configuracion", "instagram_configuracion", "messenger_configuracion"]) expect((await filas(`select * from ${t}`)).length, t).toBe(0);
    });
    await como(U.duenoA, async () => {
      for (const t of ["whatsapp_configuracion", "instagram_configuracion", "messenger_configuracion"]) expect((await filas(`select empresa_id from ${t}`)).map((r) => r.empresa_id), t).toEqual([A]);
      expect((await filas(`update whatsapp_configuracion set phone_number_id = 'x' where empresa_id = '${B}' returning empresa_id`)).length).toBe(0);
      await db.exec(`update whatsapp_configuracion set phone_number_id = '123' where empresa_id = '${A}'`);
    });
  });

  it("la marca la ven todos los de la empresa, pero solo el dueño la cambia", async () => {
    await como(U.asesorA1, async () => {
      expect((await filas(`select branding_nombre from configuracion_empresa`)).map((r) => r.branding_nombre)).toEqual(["Inmobiliaria A"]);
      expect((await filas(`update configuracion_empresa set branding_nombre = 'X' returning empresa_id`)).length).toBe(0);
    });
    await como(U.duenoA, async () => expect((await filas(`update configuracion_empresa set branding_nombre = 'Inmobiliaria A SA' returning empresa_id`)).length).toBe(1));
  });
});

describe("mensajes y charlas: la empresa sale del padre", () => {
  it("un mensaje guardado por el servidor queda en la empresa de su charla, y no se acepta otra", async () => {
    const c = await uno(`insert into whatsapp_conversaciones (contacto_id, ai_habilitada) values ((select id from whatsapp_contactos where empresa_id = '${A}'), false) returning id, empresa_id`);
    expect(c.empresa_id).toBe(A);
    const m = await uno(`insert into whatsapp_mensajes (conversacion_id, direccion, texto) values ('${c.id}', 'in', 'hola') returning empresa_id`);
    expect(m.empresa_id).toBe(A);
    await expect(db.exec(`insert into whatsapp_mensajes (empresa_id, conversacion_id, direccion, texto) values ('${B}', '${c.id}', 'in', 'cruzado')`)).rejects.toThrow(/no coincide/i);
  });

  it("eventos y tareas de un lead toman la empresa del lead; la regla de un solo origen cubre los 5 canales", async () => {
    const l = await uno(`select id from leads_manuales where empresa_id = '${B}' limit 1`);
    expect((await uno(`insert into eventos_lead (leads_manuales_id, tipo, descripcion) values ('${l.id}', 'nota', 'x') returning empresa_id`)).empresa_id).toBe(B);
    expect((await uno(`insert into tareas_lead (leads_manuales_id, tipo, fecha_vencimiento) values ('${l.id}', 'llamar', now()) returning empresa_id`)).empresa_id).toBe(B);
    await expect(db.exec(`insert into eventos_lead (tipo, descripcion) values ('nota', 'sin charla')`)).rejects.toThrow();
  });
});

describe("reparto y avisos: nunca cruzan de empresa", () => {
  it("la ronda reparte por turnos entre los asesores de SU empresa", async () => {
    const asignados: string[] = [];
    for (let i = 0; i < 4; i++) {
      const ct = await uno(`insert into instagram_contactos (empresa_id, ig_user_id, username) values ('${A}', 'ig-a-${i}', 'user${i}') returning id`);
      asignados.push((await uno(`insert into instagram_conversaciones (contacto_id) values ('${ct.id}') returning vendedor_id`)).vendedor_id as string);
    }
    expect(new Set(asignados)).toEqual(new Set([U.asesorA1, U.asesorA2]));
    expect(asignados[0]).not.toBe(asignados[1]);
    const ctB = await uno(`insert into instagram_contactos (empresa_id, ig_user_id, username) values ('${B}', 'ig-b-1', 'userb') returning id`);
    expect((await uno(`insert into instagram_conversaciones (contacto_id) values ('${ctB.id}') returning vendedor_id`)).vendedor_id).toBe(U.asesorB1);
  });

  it("los avisos de leads y mensajes van solo a perfiles de la misma empresa", async () => {
    // Con el reparto automático apagado la charla queda sin asesor y el mensaje avisa a todo el equipo de la empresa.
    await db.exec(`update configuracion_empresa set asignacion_leads_ronda = false where empresa_id = '${A}'`);
    const ct = await uno(`insert into messenger_contactos (empresa_id, psid, nombre_perfil) values ('${A}', 'ps-1', 'Cliente M') returning id`);
    const conv = await uno(`insert into messenger_conversaciones (contacto_id, vendedor_id) values ('${ct.id}', null) returning id, vendedor_id`);
    expect(conv.vendedor_id).toBeNull();
    await db.exec(`insert into messenger_mensajes (conversacion_id, direccion, texto) values ('${conv.id}', 'in', 'hola desde messenger')`);
    await db.exec(`update configuracion_empresa set asignacion_leads_ronda = true where empresa_id = '${A}'`);
    const avisos = await filas(`select a.empresa_id, p.empresa_id as de_perfil from alertas a join perfiles p on p.id = a.destinatario_id`);
    expect(avisos.length).toBeGreaterThan(0);
    expect(avisos.every((a) => a.empresa_id === a.de_perfil)).toBe(true);
    const aB = await filas(`select a.* from alertas a where a.empresa_id = '${B}' and a.link like '%${conv.id}%'`);
    expect(aB.length).toBe(0);
    const aA = await filas(`select destinatario_id from alertas where link like '%${conv.id}%'`);
    expect(aA.map((r) => r.destinatario_id).sort()).toEqual([U.duenoA, U.encargadoA, U.asesorA1, U.asesorA2].sort());
  });

  it("un cliente ofensivo no avisa a nadie", async () => {
    const ct = await uno(`insert into instagram_contactos (empresa_id, ig_user_id, username) values ('${A}', 'ig-ofensivo', 'ofensivo') returning id`);
    const conv = await uno(`insert into instagram_conversaciones (contacto_id) values ('${ct.id}') returning id`);
    await db.exec(`update instagram_conversaciones set handoff_at = now(), handoff_reason = 'cliente_ofensivo', ai_habilitada = false where id = '${conv.id}'`);
    expect((await filas(`select 1 from alertas where tipo = 'handoff_chat' and link like '%${conv.id}%'`)).length).toBe(0);
  });

  it("las funciones que se llaman desde el navegador rechazan la empresa de otro", async () => {
    await como(U.asesorA1, async () => {
      await expect(db.query(`select proximo_vendedor_ronda('${B}')`)).rejects.toThrow(/Empresa no permitida/i);
      await expect(db.query(`select asignacion_auto_en_tabla('whatsapp_conversaciones', '${B}')`)).rejects.toThrow(/Empresa no permitida/i);
      expect((await uno(`select asignar_vendedor_ronda_whatsapp_por_sucursal('b1000000-0000-0000-0000-000000000001') as v`)).v).toBeNull();
    });
  });

  it("el reparto por oficina elige a alguien de esa oficina y de esa empresa", async () => {
    const v = await uno(`select asignar_vendedor_ronda_whatsapp_por_sucursal('a1000000-0000-0000-0000-000000000001') as v`);
    expect([U.asesorA1, U.asesorA2]).toContain(v.v);
    const w = await uno(`select asignar_vendedor_ronda_whatsapp_por_sucursal('b1000000-0000-0000-0000-000000000001') as v`);
    expect(w.v).toBe(U.asesorB1);
  });

  it("el dueño reparte solo lo de su empresa", async () => {
    await db.exec(`insert into whatsapp_conversaciones (empresa_id, contacto_id, ai_habilitada, vendedor_id) select '${B}', id, true, null from whatsapp_contactos where empresa_id = '${B}'`);
    await como(U.duenoA, async () => { await db.query(`select repartir_leads_sin_asignar()`); });
    expect((await uno(`select vendedor_id from whatsapp_conversaciones where empresa_id = '${B}' limit 1`)).vendedor_id).toBeNull();
    await como(U.asesorA1, async () => { await expect(db.query(`select repartir_leads_sin_asignar()`)).rejects.toThrow(/dueño/i); });
  });
});
