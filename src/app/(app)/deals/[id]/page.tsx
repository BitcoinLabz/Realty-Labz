import { redirect } from "next/navigation";

// A deal is called a "transaction" in the UI now and lives under
// /transactions/[id]. Kept so older links and bookmarks still resolve.
export default async function LegacyDealRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/transactions/${id}`);
}
