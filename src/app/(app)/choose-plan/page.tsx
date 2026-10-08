import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isOversightRole } from "@/lib/authorization";
import { FREE_FEATURES, PRO_FEATURES, PRO_PRICE } from "@/lib/plan";
import { chooseFreePlanAction } from "@/app/actions/billing";
import { PlanTiers } from "@/components/plan-tiers";

// Shown once, right after sign-up (2026-10-08): pick Free or Pro before the
// dashboard. Existing accounts never see it (User.planChosen defaults true),
// and brokers/office admins skip it -- office plans come later.
export default async function ChoosePlanPage() {
  const session = await auth();
  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { name: true, planChosen: true, role: true, teamId: true },
  });
  if (!user || user.planChosen || (user.teamId && isOversightRole(user.role))) redirect("/dashboard");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome{user.name ? `, ${user.name.split(" ")[0]}` : ""}. Pick your plan.
        </h1>
        <p className="mt-2 text-sm text-muted">
          Start free and upgrade whenever you like — or go Pro and let Realty Labz read your contracts for you.
        </p>
      </div>

      <PlanTiers
        freeFeatures={FREE_FEATURES}
        proFeatures={PRO_FEATURES}
        prices={PRO_PRICE}
        freeAction={chooseFreePlanAction}
      />

      <p className="text-center text-xs text-muted">
        Secure checkout by Stripe. Switch or cancel anytime in Account → Plan.
      </p>
    </div>
  );
}
