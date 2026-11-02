import { decrypt } from "@/lib/crypto";

// Resumen del token de Meta guardado en una configuración de canal: solo los
// últimos 6 caracteres y el largo, para que el admin compare con el último que
// generó en Meta sin que el token completo salga del servidor. Usar en rutas
// que ya comprobaron que quien pide es admin; nunca importar desde un
// componente "use client".
export type ResumenToken = { ultimos6: string; largo: number } | null;

export function resumenToken(row: { token_cifrado?: string | null; token_iv?: string | null; token_tag?: string | null } | null | undefined): ResumenToken {
  if (!row?.token_cifrado || !row.token_iv || !row.token_tag) return null;
  try {
    const token = decrypt(row.token_cifrado, row.token_iv, row.token_tag);
    return { ultimos6: token.slice(-6), largo: token.length };
  } catch {
    return null;
  }
}
