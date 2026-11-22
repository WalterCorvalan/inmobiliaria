import { redirect } from "next/navigation";

// La dirección principal lleva a la demo pública (el panel está en /panel).
export default function Inicio() {
  redirect("/demo");
}
