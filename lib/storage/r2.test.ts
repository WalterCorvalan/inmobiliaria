import { beforeAll, describe, expect, it } from "vitest";

// La dirección firmada para subir un video desde el navegador no puede llevar parámetros de
// checksum: las versiones nuevas del SDK los agregan calculados sobre un cuerpo vacío
// ("x-amz-checksum-crc32=AAAAAA==") y R2 rechaza cualquier archivo real contra ese valor.
// Sin red: con claves falsas, solo se firma una dirección.
describe("firmarSubidaR2", () => {
  beforeAll(() => {
    process.env.R2_ACCOUNT_ID = "cuentademo";
    process.env.R2_ACCESS_KEY_ID = "clave-demo";
    process.env.R2_SECRET_ACCESS_KEY = "secreto-demo";
    process.env.R2_BUCKET_NAME = "bucket-demo";
    process.env.R2_PUBLIC_URL = "https://pub-demo.r2.dev";
  });

  it("firma una dirección PUT de R2 para esa clave, sin checksum y con vencimiento", async () => {
    const { firmarSubidaR2 } = await import("./r2");
    const url = new URL(await firmarSubidaR2("entregas/1-2-demo.mp4", "video/mp4", 900));
    // El SDK pone el bucket en el dominio o en la ruta según la versión; las dos formas las acepta R2.
    expect(url.hostname.endsWith("cuentademo.r2.cloudflarestorage.com")).toBe(true);
    expect(`${url.hostname}${url.pathname}`).toContain("bucket-demo");
    expect(url.pathname.endsWith("/entregas/1-2-demo.mp4")).toBe(true);
    expect(url.searchParams.get("X-Amz-Expires")).toBe("900");
    const claves = [...url.searchParams.keys()].join(",").toLowerCase();
    expect(claves).not.toContain("checksum");
  });
});
