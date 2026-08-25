import { redirect } from "next/navigation";

// /forms used to be the client list; clients are now their own top-level
// section. Land on the first real Forms tab instead, and catch old links.
export default function FormsIndexPage() {
  redirect("/forms/templates");
}
