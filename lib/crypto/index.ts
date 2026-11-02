import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY no está definida");
  const buf = Buffer.from(key, "base64");
  if (buf.length !== 32) {
    throw new Error("ENCRYPTION_KEY debe ser exactamente 32 bytes en base64");
  }
  return buf;
}

export function encrypt(plaintext: string): { cipher: string; iv: string; tag: string } {
  const iv = randomBytes(12);
  const cipherObj = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipherObj.update(plaintext, "utf8"), cipherObj.final()]);
  const tag = cipherObj.getAuthTag();
  return {
    cipher: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decrypt(cipher: string, iv: string, tag: string): string {
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipher, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}