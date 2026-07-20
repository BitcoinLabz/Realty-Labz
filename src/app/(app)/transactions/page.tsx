import { redirect } from "next/navigation";

// Transactions + mileage moved under the Finances section (2026-07-20) —
// see CLAUDE.md. This route just catches old links/bookmarks.
export default function TransactionsIndexRedirect() {
  redirect("/finances/transactions");
}
