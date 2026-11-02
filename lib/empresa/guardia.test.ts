// Guardia contra el olvido: el servidor usa la clave de servicio, que se salta la seguridad de la base. Si alguien
// agrega una ruta o una consulta sin atarla a una empresa, este test falla. NO se cambia el test: se ata la consulta.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = process.cwd();
function archivos(dir: string, filtro: (ruta: string) => boolean, acumulado: string[] = []): string[] {
  for (const nombre of readdirSync(dir)) {
    if (nombre === "node_modules" || nombre.startsWith(".")) continue;
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) archivos(ruta, filtro, acumulado);
    else if (filtro(ruta)) acumulado.push(relative(RAIZ, ruta));
  }
  return acumulado;
}
const codigo = [...archivos(join(RAIZ, "app"), (r) => /\.(ts|tsx)$/.test(r) && !/\.test\./.test(r)), ...archivos(join(RAIZ, "lib"), (r) => /\.(ts|tsx)$/.test(r) && !/\.test\./.test(r))];
const leer = (r: string) => readFileSync(join(RAIZ, r), "utf8");

describe("el servidor nunca consulta sin una empresa", () => {
  it("la clave de servicio solo se toca en los archivos que la administran", () => {
    const permitidos = new Set(["lib/empresa/db.ts", "lib/panel/logger.ts", "lib/rateLimit.ts"]);
    const usan = codigo.filter((r) => /SUPABASE2_SERVICE_ROLE_KEY/.test(leer(r)));
    expect(usan.filter((r) => !permitidos.has(r))).toEqual([]);
  });

  it("nadie crea su propio cliente de base de datos de servicio (se usa supabaseEmpresa)", () => {
    const permitidos = new Set(["lib/empresa/db.ts", "lib/panel/logger.ts", "lib/rateLimit.ts", "lib/supabase/client.ts", "lib/supabase/server.ts", "lib/supabase/publico.ts", "lib/supabase/diferido.ts"]);
    const crean = codigo.filter((r) => /\bcreateClient\(/.test(leer(r)) && /@supabase\/supabase-js/.test(leer(r)));
    expect(crean.filter((r) => !permitidos.has(r))).toEqual([]);
  });

  it("no queda ninguna lectura de la fila única de configuración (id = true)", () => {
    expect(codigo.filter((r) => /\.eq\("id",\s*true\)/.test(leer(r)))).toEqual([]);
  });

  it("toda ruta de la API corre dentro de una empresa: sesión, token de webhook, identificador del chat web o tarea por empresa", () => {
    const rutas = archivos(join(RAIZ, "app/api"), (r) => /route\.ts$/.test(r));
    expect(rutas.length).toBeGreaterThan(20);
    const marcas = ["conEmpresaDeSesion", "dentroDeEmpresa", "paraCadaEmpresa"];
    const sinEmpresa = rutas.filter((r) => !marcas.some((m) => leer(r).includes(m)));
    expect(sinEmpresa).toEqual([]);
  });

  it("las tareas automáticas piden la clave de las tareas y recorren las empresas", () => {
    const crons = archivos(join(RAIZ, "app/api/cron"), (r) => /route\.ts$/.test(r));
    expect(crons.length).toBe(7);
    for (const r of crons) {
      const t = leer(r);
      expect(t, r).toContain("CRON_SECRET");
      expect(t, r).toContain("paraCadaEmpresa");
    }
  });
});
