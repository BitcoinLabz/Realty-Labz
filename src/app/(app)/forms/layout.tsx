import { redirect } from "next/navigation";
import { E_SIGNATURE_ENABLED } from "@/lib/features";

// Forms is now only the e-signature section (ready-to-send forms and their
// designer). Its contract library and deadline sets moved under
// Transactions, where the contracts they serve actually live.
//
// While e-signature is switched off (src/lib/features.ts) every /forms page
// lands on Transactions instead -- one check here covers them all.
export default function FormsLayout({ children }: { children: React.ReactNode }) {
  if (!E_SIGNATURE_ENABLED) redirect("/transactions");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Forms</h1>
        <p className="mt-1 text-sm text-muted">
          Ready-to-send versions of your contracts that you email clients to sign.
        </p>
      </div>
      {children}
    </div>
  );
}
