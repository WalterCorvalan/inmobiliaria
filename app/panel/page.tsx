import { redirect } from "next/navigation";

// La v1 no tiene Dashboard: la entrada al panel es Leads.
export default function PanelPage() {
  redirect("/panel/leads");
}
