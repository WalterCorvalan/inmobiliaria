import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Cloudflare R2 (compatible con la API S3) — reemplazo de Bunny CDN para
// todo lo que se suba de acá en adelante. Lo ya subido a Bunny queda ahí,
// no se migra. Si faltan las env vars, r2Configurado() da false y cada
// ruta de upload cae de nuevo a Bunny (fallback, no rompe nada).

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      // Las versiones nuevas del SDK agregan un chequeo de integridad (CRC32) a cada pedido. En una
      // dirección firmada para subir desde el navegador queda calculado sobre un cuerpo VACÍO
      // ("AAAAAA==") y R2 rechaza cualquier archivo real contra ese valor. "WHEN_REQUIRED" es lo que
      // recomienda Cloudflare para R2: el chequeo solo se agrega cuando la operación lo exige.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return client;
}

export function r2Configurado(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME &&
    process.env.R2_PUBLIC_URL
  );
}

// Cada archivo se sube con un nombre que no se repite (lleva la hora), así que el navegador puede guardarlo un mes sin
// volver a pedirlo. Antes se subían sin esto y las fotos del catálogo se bajaban de nuevo en cada visita (28/10/2026).
export const CACHE_ARCHIVOS_R2 = "public, max-age=2592000, immutable";

// key ejemplo: "vehiculos/1699999999-foto.jpg"
export async function subirArchivoR2(buffer: Buffer, key: string, contentType = "application/octet-stream"): Promise<string> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: CACHE_ARCHIVOS_R2,
    })
  );
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}

// --- Subida directa desde el navegador (videos, que no entran por Vercel: tope de 4,5 MB) ---

// Dirección firmada para que el navegador suba UN archivo con PUT, derecho a R2. Sirve solo
// para esa clave y ese Content-Type, y vence a los 15 minutos. El bucket tiene que tener una
// regla CORS que permita PUT desde el sitio (ver docs de la subida directa).
export async function firmarSubidaR2(key: string, contentType: string, expiraSegundos = 900): Promise<string> {
  return getSignedUrl(
    getClient(),
    new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: key, ContentType: contentType }),
    { expiresIn: expiraSegundos }
  );
}

// Tamaño y primeros bytes de un archivo ya subido, para comprobar que es lo que dijo ser.
export async function inspeccionarObjetoR2(key: string, bytes = 16): Promise<{ tamano: number; inicio: Buffer } | null> {
  try {
    const cabecera = await getClient().send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: key }));
    const parte = await getClient().send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: key, Range: `bytes=0-${bytes - 1}` }));
    const inicio = Buffer.from(await parte.Body!.transformToByteArray());
    return { tamano: Number(cabecera.ContentLength ?? 0), inicio };
  } catch {
    return null;
  }
}

export async function borrarR2(key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: key }));
}

export function urlPublicaR2(key: string): string {
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}
