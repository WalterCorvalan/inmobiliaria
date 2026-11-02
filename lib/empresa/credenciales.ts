// Credenciales de Meta de cada empresa (secreto de la app, ID de la app de Instagram). Se guardan cifradas en la
// configuración de cada canal; ya no hay un secreto único del servidor. Usar siempre dentro de dentroDeEmpresa(...).
import { createHmac, timingSafeEqual } from "node:crypto";
import { decrypt } from "@/lib/crypto";
import { supabaseEmpresa, type CanalConfig } from "@/lib/empresa/db";
import { registrarError } from "@/lib/panel/logger";

type Fila = Record<string, string | null> | null;

function descifrar(fila: Fila, prefijo: string): string | null {
  const c = fila?.[`${prefijo}_cifrado`], iv = fila?.[`${prefijo}_iv`], tag = fila?.[`${prefijo}_tag`];
  if (!c || !iv || !tag) return null;
  try { return decrypt(c, iv, tag); } catch { return null; }
}

/** Secretos con los que Meta puede firmar los mensajes de esta empresa. Instagram acepta el de su app o el de la app de Meta. */
export async function secretosDeApp(canal: CanalConfig): Promise<string[]> {
  const columnas = "app_secret_cifrado, app_secret_iv, app_secret_tag" + (canal === "instagram" ? ", meta_app_secret_cifrado, meta_app_secret_iv, meta_app_secret_tag" : "");
  const { data } = await supabaseEmpresa.from(`${canal}_configuracion`).select(columnas).maybeSingle();
  const fila = data as unknown as Fila;
  return [descifrar(fila, "app_secret"), descifrar(fila, "meta_app_secret")].filter((s): s is string => !!s);
}

/** ID y secreto de la app de Instagram de la empresa, para el inicio de sesión (OAuth). */
export async function appDeInstagram(): Promise<{ appId: string | null; secreto: string | null }> {
  const { data } = await supabaseEmpresa.from("instagram_configuracion")
    .select("app_id, app_secret_cifrado, app_secret_iv, app_secret_tag, meta_app_secret_cifrado, meta_app_secret_iv, meta_app_secret_tag").maybeSingle();
  const fila = data as unknown as Fila;
  return { appId: fila?.app_id ?? null, secreto: descifrar(fila, "app_secret") ?? descifrar(fila, "meta_app_secret") };
}

export function firmaCoincide(secretos: string[], cuerpo: string, firma: string): boolean {
  return secretos.some((secreto) => {
    const esperada = "sha256=" + createHmac("sha256", secreto).update(cuerpo).digest("hex");
    return firma.length === esperada.length && timingSafeEqual(Buffer.from(firma), Buffer.from(esperada));
  });
}

/** Comprueba la firma de Meta con el/los secretos de la empresa. Si falta el secreto o no coincide, queda en Errores del sistema. */
export async function verificarFirmaDeMeta(canal: CanalConfig, cuerpo: string, firma: string, origenDelError: string): Promise<boolean> {
  const secretos = await secretosDeApp(canal);
  if (secretos.length === 0) {
    await registrarError(origenDelError, new Error(`Falta el secreto de la app de Meta de esta empresa (Configuración → ${canal}).`));
    return false;
  }
  if (!firmaCoincide(secretos, cuerpo, firma)) {
    await registrarError(origenDelError, new Error(`Firma de Meta inválida: el webhook de ${canal} llegó pero se rechazó (revisar el secreto de la app cargado en Configuración).`), { conFirma: !!firma });
    return false;
  }
  return true;
}
