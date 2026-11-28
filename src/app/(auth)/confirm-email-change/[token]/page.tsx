import type { Metadata } from "next";
import { ConfirmEmailChangeForm } from "./confirm-form";

export const metadata: Metadata = { title: "Confirm new email", robots: { index: false } };

// Opened from the link sent to the new address. A button rather than an
// automatic switch on page load: email scanners pre-open links, and that
// mustn't change someone's sign-in email.
export default async function ConfirmEmailChangePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ConfirmEmailChangeForm token={token} />;
}
