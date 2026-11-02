export type ToastTipo = "success" | "error" | "info";

/** Dispara un toast global (ver ToastHost, montado en el layout del panel). */
export function mostrarToast(mensaje: string, tipo: ToastTipo = "success") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("app-toast", { detail: { mensaje, tipo } }));
}
