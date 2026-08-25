import { redirect } from "next/navigation";

export default function LegacyDealsIndexRedirect() {
  redirect("/transactions");
}
