import { redirect } from "next/navigation";

// Deals now live inside each client's page (Properties & offers) rather than
// as their own top-level section — see CLAUDE.md. Individual deals are still
// reachable and editable at /deals/[id]; this route just catches old links.
export default function DealsIndexRedirect() {
  redirect("/forms");
}
