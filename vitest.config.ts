import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Solo se corren los tests del proyecto (lib/ y components/). Los de los
// skills internos (.agents/, .claude/) quedan afuera a propósito.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "components/**/*.test.ts", "app/**/*.test.ts", "migraciones/**/*.test.ts"],
    testTimeout: 60000,
    hookTimeout: 120000,
  },
});
