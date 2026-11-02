import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TABLAS_DE_EMPRESA, acotarAEmpresa, dentroDeEmpresa, empresaActual, empresaActualOpcional, supabaseEmpresa } from "./db";

// Cliente falso que anota cada llamada de la cadena, para ver qué filtros y datos terminan viajando a la base.
function falso() {
  const llamadas: { tabla: string; op: string; args: unknown[]; filtros: [string, unknown][] }[] = [];
  const rpcs: { fn: string; args: unknown }[] = [];
  const cliente = {
    from(tabla: string) {
      const registro = (op: string) => (...args: unknown[]) => {
        const entrada = { tabla, op, args, filtros: [] as [string, unknown][] };
        llamadas.push(entrada);
        const cadena: Record<string, unknown> = { eq: (c: string, v: unknown) => { entrada.filtros.push([c, v]); return cadena; } };
        return cadena;
      };
      return { select: registro("select"), insert: registro("insert"), update: registro("update"), upsert: registro("upsert"), delete: registro("delete") };
    },
    rpc(fn: string, args: unknown) { rpcs.push({ fn, args }); return Promise.resolve({ data: null }); },
    storage: { marca: "storage" },
  };
  return { cliente: cliente as unknown as SupabaseClient, llamadas, rpcs };
}

describe("cliente atado a la empresa", () => {
  it("lecturas, cambios y borrados de una tabla de empresa llevan el filtro de la empresa", () => {
    const { cliente, llamadas } = falso();
    const c = acotarAEmpresa(cliente, "emp-A");
    c.from("whatsapp_contactos").select("id");
    c.from("leads_manuales").update({ nombre: "x" });
    c.from("clientes").delete();
    expect(llamadas.map((l) => l.filtros)).toEqual([[["empresa_id", "emp-A"]], [["empresa_id", "emp-A"]], [["empresa_id", "emp-A"]]]);
  });

  it("las altas llevan la empresa, y no se puede pisar con otra", () => {
    const { cliente, llamadas } = falso();
    const c = acotarAEmpresa(cliente, "emp-A");
    c.from("leads_manuales").insert({ nombre: "a", empresa_id: "emp-B" });
    c.from("alertas").insert([{ titulo: "1" }, { titulo: "2" }]);
    c.from("sucursales").upsert({ nombre: "o" });
    expect(llamadas[0].args[0]).toEqual({ empresa_id: "emp-A", nombre: "a" });
    expect(llamadas[1].args[0]).toEqual([{ empresa_id: "emp-A", titulo: "1" }, { empresa_id: "emp-A", titulo: "2" }]);
    expect(llamadas[2].args[0]).toEqual({ empresa_id: "emp-A", nombre: "o" });
  });

  it("las tablas de la plataforma no se tocan", () => {
    const { cliente, llamadas } = falso();
    acotarAEmpresa(cliente, "emp-A").from("empresas").select("id");
    expect(llamadas[0].filtros).toEqual([]);
  });

  it("las funciones que reciben empresa la reciben siempre la de la sesión", async () => {
    const { cliente, rpcs } = falso();
    const c = acotarAEmpresa(cliente, "emp-A");
    await c.rpc("leads_ultima_direccion", { p_canal: "whatsapp", p_empresa_id: "emp-B" });
    await c.rpc("asignar_vendedor_ronda_whatsapp_por_sucursal", { p_sucursal_id: "s1" });
    expect(rpcs[0].args).toEqual({ p_canal: "whatsapp", p_empresa_id: "emp-A" });
    expect(rpcs[1].args).toEqual({ p_sucursal_id: "s1" });
  });

  it("el resto del cliente (storage, etc.) sigue funcionando", () => {
    const { cliente } = falso();
    expect((acotarAEmpresa(cliente, "emp-A") as unknown as { storage: { marca: string } }).storage.marca).toBe("storage");
  });
});

describe("contexto del pedido", () => {
  it("sin empresa fijada, consultar una tabla de empresa falla en vez de leer todo", () => {
    expect(empresaActualOpcional()).toBeNull();
    expect(() => empresaActual()).toThrow(/sin empresa/i);
    expect(() => supabaseEmpresa.from("whatsapp_mensajes")).toThrow(/sin empresa/i);
  });

  it("dos pedidos a la vez no se mezclan", async () => {
    const vistas: string[] = [];
    const pedido = (id: string, ms: number) => dentroDeEmpresa(id, async () => {
      await new Promise((r) => setTimeout(r, ms));
      vistas.push(`${id}:${empresaActual()}`);
    });
    await Promise.all([pedido("A", 20), pedido("B", 5), pedido("C", 10)]);
    expect(vistas.sort()).toEqual(["A:A", "B:B", "C:C"]);
    expect(empresaActualOpcional()).toBeNull();
  });

  it("la lista de tablas de empresa no tiene repetidas ni a las de la plataforma", () => {
    for (const t of ["empresas", "superadmins", "soporte_accesos"]) expect(TABLAS_DE_EMPRESA.has(t)).toBe(false);
    expect(TABLAS_DE_EMPRESA.size).toBe(35);
    vi.restoreAllMocks();
  });
});
