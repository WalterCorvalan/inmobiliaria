// Datos del cliente que la seña exige (Walter, 19/10/2026): sin fecha de nacimiento ni sexo no se guarda. La fecha
// alimenta el aviso de cumpleaños (lib/panel/cumpleanosClientes.ts) y los dos van al boleto.

export const SEXOS_CLIENTE = ["Femenino", "Masculino", "Prefiero no decir"] as const;

/** Qué le falta al cliente para guardar la seña, o null si está completo. */
export function faltaEnClienteSena(datos: { fechaNacimiento: string; sexo: string }, hoy: string): string | null {
  const faltan: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datos.fechaNacimiento)) faltan.push("la fecha de nacimiento");
  else if (datos.fechaNacimiento >= hoy) return "La fecha de nacimiento no puede ser de hoy ni del futuro.";
  if (!(SEXOS_CLIENTE as readonly string[]).includes(datos.sexo)) faltan.push("el sexo");
  return faltan.length ? `Cargá ${faltan.join(" y ")} del cliente.` : null;
}
