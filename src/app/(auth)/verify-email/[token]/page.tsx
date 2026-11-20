import { ConfirmEmailForm } from "./confirm-form";

export default async function VerifyEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ConfirmEmailForm token={token} />;
}
