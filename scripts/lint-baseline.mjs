// Tope de lint: el proyecto tiene ~2000 avisos de ESLint de antes de que
// existiera cualquier control (la mayoría `no-explicit-any`). Exigir arreglar
// todo de golpe frenaría todo, y no exigir nada deja que sigan creciendo. Este
// script congela el nivel actual POR REGLA (.lint-baseline.json): el CI falla
// si alguna regla tiene más avisos que el tope, y avisa cuando bajan para que
// se actualice el tope hacia abajo y no se vuelva a subir.
//
//   npm run lint:baseline            -> compara contra el tope (lo usa el CI)
//   npm run lint:baseline -- --update -> reescribe el tope con el estado actual
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ARCHIVO = new URL("../.lint-baseline.json", import.meta.url);
const actualizar = process.argv.includes("--update");

// Se llama al binario de ESLint con node, no con `npx`: en Windows `npx` es
// `npx.cmd` y spawnSync sin shell no lo encuentra (ENOENT, salida vacía).
const ESLINT = fileURLToPath(new URL("../node_modules/eslint/bin/eslint.js", import.meta.url));

const r = spawnSync(
  process.execPath,
  [ESLINT, ".", "-f", "json", "--ignore-pattern", ".agents/**", "--ignore-pattern", ".claude/**"],
  { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 },
);
let resultados;
try {
  if (r.error) throw r.error;
  resultados = JSON.parse(r.stdout);
} catch (e) {
  const detalle = r.error ? String(r.error) : r.stderr || r.stdout || String(e);
  console.error("ESLint no devolvió un resultado válido:\n", detalle.slice(0, 2000));
  process.exit(2);
}

const porRegla = {};
for (const archivo of resultados) {
  for (const m of archivo.messages) {
    const clave = m.ruleId || "(error de sintaxis)";
    porRegla[clave] = (porRegla[clave] || 0) + 1;
  }
}
const total = Object.values(porRegla).reduce((a, b) => a + b, 0);

if (actualizar) {
  const ordenado = Object.fromEntries(Object.entries(porRegla).sort((a, b) => b[1] - a[1]));
  writeFileSync(ARCHIVO, JSON.stringify({ total, porRegla: ordenado }, null, 2) + "\n");
  console.log(`Tope actualizado: ${total} avisos en ${Object.keys(porRegla).length} reglas.`);
  process.exit(0);
}

if (!existsSync(ARCHIVO)) {
  console.error("Falta .lint-baseline.json. Generalo con: npm run lint:baseline -- --update");
  process.exit(2);
}
const tope = JSON.parse(readFileSync(ARCHIVO, "utf8")).porRegla;

const peores = [];
const mejoras = [];
for (const [regla, cantidad] of Object.entries(porRegla)) {
  const permitido = tope[regla] || 0;
  if (cantidad > permitido) peores.push(`${regla}: ${permitido} -> ${cantidad} (+${cantidad - permitido})`);
}
for (const [regla, permitido] of Object.entries(tope)) {
  const cantidad = porRegla[regla] || 0;
  if (cantidad < permitido) mejoras.push(`${regla}: ${permitido} -> ${cantidad}`);
}

if (peores.length) {
  console.error("Este cambio agrega avisos de lint por encima del tope:\n  " + peores.join("\n  "));
  console.error("\nArreglá los avisos nuevos (los de las líneas que tocaste). Si de verdad es inevitable, hablalo antes de subir el tope.");
  process.exit(1);
}
console.log(`Lint dentro del tope (${total} avisos).`);
if (mejoras.length) {
  console.log("\nBajaron avisos, conviene bajar el tope (npm run lint:baseline -- --update) para que no vuelvan a subir:\n  " + mejoras.join("\n  "));
}
