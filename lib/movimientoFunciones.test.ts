import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";

// Regresión de velocidad (15/10/2026): un solo `<motion.div>` vuelve a meter framer-motion entero (unos 138 KB) en el
// JavaScript de la portada. Los componentes usan `<m.div>` y las animaciones llegan después con LazyMotion
// (components/MovimientoDiferido.tsx).
describe("animaciones livianas", () => {
  it("ningún componente usa <motion.*>; se usa <m.*>", () => {
    let encontrados = "";
    try {
      encontrados = execSync('git grep -n "<motion\." -- "app/**/*.tsx" "components/**/*.tsx"', { encoding: "utf8" });
    } catch {
      encontrados = ""; // git grep sale con 1 cuando no encuentra nada
    }
    expect(encontrados).toBe("");
  });
});
