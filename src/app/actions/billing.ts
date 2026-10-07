"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { APP_URL } from "@/lib/app-url";
import { getStripe, isBillingConfigured, priceIdFor } from "@/lib/stripe";
import type { FormState } from "@/app/actions/auth";

// Upgrade and billing management (2026-10-05). Both hand off to Stripe's own
// hosted pages -- checkout and the customer portal -- so no card details ever
// touch this app. Return URLs use the fixed APP_URL, never a request header.

async function customerFor(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, stripeCustomerId: true },
  });
  if (!user) throw new Error("No user");
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await getStripe().customers.create({
    email: user.email,
    name: user.name ?? undefined,
    metadata: { userId },
  });
  // Only set if still empty, so two clicks at once can't leave two customers
  // with the account pointing at the wrong one.
  const saved = await prisma.user.updateMany({
    where: { id: userId, stripeCustomerId: null },
    data: { stripeCustomerId: customer.id },
  });
  if (saved.count === 1) return customer.id;
  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } });
  return existing!.stripeCustomerId!;
}

export async function startCheckoutAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };
  if (!isBillingConfigured()) return { error: "Upgrades aren't switched on yet. Check back soon." };

  const interval = formData.get("interval") === "annual" ? "annual" : "monthly";
  let url: string | null;
  try {
    const checkout = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer: await customerFor(session.user.id),
      client_reference_id: session.user.id,
      line_items: [{ price: priceIdFor(interval), quantity: 1 }],
      subscription_data: { metadata: { userId: session.user.id } },
      allow_promotion_codes: true,
      success_url: `${APP_URL}/account?upgraded=1#plan`,
      cancel_url: `${APP_URL}/account#plan`,
    });
    url = checkout.url;
  } catch (err) {
    console.error("[billing] checkout failed", err);
    return { error: "Couldn't start checkout right now. Try again in a moment." };
  }
  if (!url) return { error: "Couldn't start checkout right now. Try again in a moment." };
  redirect(url);
}

export async function openBillingPortalAction(_prev: FormState, _formData: FormData): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };
  if (!isBillingConfigured()) return { error: "Billing isn't switched on yet." };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeCustomerId: true },
  });
  if (!user?.stripeCustomerId) return { error: "No billing account yet." };

  let url: string;
  try {
    const portal = await getStripe().billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${APP_URL}/account#plan`,
    });
    url = portal.url;
  } catch (err) {
    console.error("[billing] portal failed", err);
    return { error: "Couldn't open billing right now. Try again in a moment." };
  }
  redirect(url);
}
