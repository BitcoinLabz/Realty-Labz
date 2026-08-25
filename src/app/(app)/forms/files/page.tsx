import { redirect } from "next/navigation";

// The Forms > Files tab became the top-level Transactions section.
export default function LegacyFilesRedirect() {
  redirect("/transactions");
}
