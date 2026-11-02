// Control de migraciones SQL nuevas (migraciones/*.sql). Las migraciones se
// corren a mano en Supabase, sin historial ni forma de volver atrás, así que
// toda migración NUEVA tiene que traer cómo deshacerla y no puede ser
// destructiva sin dejarlo dicho. Falla (código 1) si una migración agregada en
// el PR no cumple; las que ya existían no se tocan.
//
//   node scripts/check-migraciones.mjs                 -> archivos agregados vs origin/master
//   node scripts/check-migraciones.mjs origin/main     -> contra otra rama base
//   node scripts/check-migraciones.mjs --archivos a.sql b.sql  -> chequea esos archivos
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
let archivos;
if (args[0] === "--archivos") {
  archivos = args.slice(1);
} else {
  const base = args[0] || "origin/master";
  const salida = execFileSync("git", ["diff", "--name-status", `${base}...HEAD`, "--", "migraciones/"], { encoding: "utf8" });
  archivos = [];
  for (const linea of salida.split("\n").filter(Boolean)) {
    const [estado, ...ruta] = linea.split("\t");
    const archivo = ruta[ruta.length - 1];
    if (!archivo.endsWith(".sql") || archivo.endsWith("_plantilla.sql")) continue;
    if (estado.startsWith("A")) archivos.push(archivo);
    else if (estado.startsWith("M")) console.warn(`AVISO: se modificó una migración que ya existía (${archivo}). Si ya se corrió en producción, el cambio no se aplica solo: escribí una migración nueva.`);
  }
}

const DESTRUCTIVAS = [
  [/\bdrop\s+table\b/i, "DROP TABLE"],
  [/\bdrop\s+column\b/i, "DROP COLUMN"],
  [/\btruncate\b/i, "TRUNCATE"],
  [/\bdelete\s+from\b(?![^;]*\bwhere\b)/i, "DELETE sin WHERE"],
  [/\balter\s+table\b[^;]*\balter\s+column\b[^;]*\btype\b/i, "cambio de tipo de columna"],
];

let fallos = 0;
for (const archivo of archivos) {
  const sql = readFileSync(archivo, "utf8");
  const problemas = [];

  if (!/^\s*--\s*ROLLBACK\s*:/im.test(sql)) {
    problemas.push("falta el bloque `-- ROLLBACK:` con el SQL para deshacerla (en comentarios, al final del archivo)");
  }
  const sinComentarios = sql.replace(/--[^\n]*/g, "");
  const acepta = /^\s*--\s*DESTRUCTIVA\s*:\s*\S+/im.test(sql);
  for (const [patron, nombre] of DESTRUCTIVAS) {
    if (patron.test(sinComentarios) && !acepta) {
      problemas.push(`usa ${nombre}: si es a propósito, agregá una línea \`-- DESTRUCTIVA: <por qué es seguro>\``);
    }
  }
  if (/\bcreate\s+table\b(?!\s+if\s+not\s+exists)/i.test(sinComentarios)) {
    problemas.push("`create table` sin `if not exists` (no se puede volver a correr)");
  }
  if (/\badd\s+column\b(?!\s+if\s+not\s+exists)/i.test(sinComentarios)) {
    problemas.push("`add column` sin `if not exists` (no se puede volver a correr)");
  }

  if (problemas.length) {
    fallos++;
    console.error(`\n${archivo}\n  - ${problemas.join("\n  - ")}`);
  } else {
    console.log(`OK  ${archivo}`);
  }
}
if (!archivos.length) console.log("Sin migraciones nuevas en este cambio.");
if (fallos) {
  console.error(`\n${fallos} migración(es) no cumplen el formato. Usá migraciones/_plantilla.sql como base.`);
  process.exit(1);
}
