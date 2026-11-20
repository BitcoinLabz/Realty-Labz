import { planFromSubscription } from "@/lib/plan";

// Checkout and webhook decisions that must stay testable without a Stripe
// call. Nothing in this file talks to Stripe or the database.

// Stripe Tax (automatic tax on Checkout and the subscription it creates).
// Off unless explicitly switched on, so a deploy without the Stripe Tax
// setup in the dashboard keeps working. Distinct from Managed Payments,
// which stays off: that product makes Stripe the merchant of record and
// adds its own fee. See billing.ts.
export function automaticTaxEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.STRIPE_AUTOMATIC_TAX === "true";
}

// The only prices that may grant Pro. Empty when the env vars aren't set,
// in which case the webhook falls back to "any active subscription" so a
// missing variable can't silently cancel someone who already paid.
export function knownStripePriceIds(env: Record<string, string | undefined> = process.env): string[] {
  return [env.STRIPE_PRICE_MONTHLY, env.STRIPE_PRICE_ANNUAL].filter((id): id is string => !!id);
}

export type CheckoutSessionParams = {
  mode: "subscription";
  customer: string;
  client_reference_id: string;
  line_items: { price: string; quantity: number }[];
  subscription_data: { metadata: { userId: string } };
  allow_promotion_codes: true;
  managed_payments: { enabled: false };
  success_url: string;
  cancel_url: string;
  automatic_tax?: { enabled: true };
  billing_address_collection?: "required";
  customer_update?: { address: "auto"; name: "auto" };
};

// Address collection is tied to tax: Stripe Tax can't calculate without a
// billing address, and customer_update writes that address onto the Customer
// so renewals are taxed too. Checkout copies automatic_tax onto the
// Subscription it creates.
export function buildCheckoutSessionParams(options: {
  userId: string;
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  automaticTax: boolean;
}): CheckoutSessionParams {
  return {
    mode: "subscription",
    customer: options.customerId,
    client_reference_id: options.userId,
    line_items: [{ price: options.priceId, quantity: 1 }],
    subscription_data: { metadata: { userId: options.userId } },
    allow_promotion_codes: true,
    managed_payments: { enabled: false },
    success_url: options.successUrl,
    cancel_url: options.cancelUrl,
    ...(options.automaticTax
      ? {
          automatic_tax: { enabled: true } as const,
          billing_address_collection: "required" as const,
          customer_update: { address: "auto" as const, name: "auto" as const },
        }
      : {}),
  };
}

export function customerIdOf(customer: string | { id: string } | null | undefined): string | null {
  if (!customer) return null;
  if (typeof customer === "string") return customer;
  // A deleted customer still has the id the account was linked with. The
  // subscription status (usually canceled) is what removes Pro.
  return customer.id;
}

export function subscriptionItemPriceIds(items: { price: string | { id: string } }[]): string[] {
  return items.map((item) => (typeof item.price === "string" ? item.price : item.price.id));
}

// An active-looking subscription only grants Pro when it is actually for one
// of our prices. A different price on the same Stripe account (a $0 test
// price, a one-off invoice product) must not flip the account to Pro.
export function grantsPro(status: string, priceIds: string[], knownPriceIds: string[]): boolean {
  if (planFromSubscription(status) !== "PRO") return false;
  if (knownPriceIds.length === 0) return true;
  return priceIds.some((id) => knownPriceIds.includes(id));
}

// Stripe can deliver an older event after a newer one (a retry). The event's
// created time is seconds. Equal times still apply, so a retry of the same
// event converges instead of being dropped.
export function stripeEventIsCurrent(stored: Date | null, eventCreatedUnix: number): boolean {
  if (!stored) return true;
  return eventCreatedUnix * 1000 >= stored.getTime();
}

export function stripeEventAt(eventCreatedUnix: number): Date {
  return new Date(eventCreatedUnix * 1000);
}

// Current Stripe API puts the subscription on the invoice parent. Older
// payloads used a top-level subscription field; accept both.
export function subscriptionIdFromInvoice(invoice: {
  subscription?: string | { id: string } | null;
  parent?: {
    subscription_details?: { subscription?: string | { id: string } | null } | null;
  } | null;
}): string | null {
  const nested = invoice.parent?.subscription_details?.subscription;
  const direct = invoice.subscription;
  const subscription = nested ?? direct;
  if (!subscription) return null;
  return typeof subscription === "string" ? subscription : subscription.id;
}
