import Stripe from "stripe";

// Lazy client, same pattern as getResendClient in email.ts: the app builds
// and runs with no Stripe keys at all -- everyone is simply on Free and the
// upgrade button says billing isn't switched on yet.
let client: Stripe | undefined;

export function isBillingConfigured(): boolean {
  return !!(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_WEBHOOK_SECRET &&
    process.env.STRIPE_PRICE_MONTHLY &&
    process.env.STRIPE_PRICE_ANNUAL
  );
}

export function getStripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    client = new Stripe(key);
  }
  return client;
}

export function priceIdFor(interval: "monthly" | "annual"): string {
  const id = interval === "annual" ? process.env.STRIPE_PRICE_ANNUAL : process.env.STRIPE_PRICE_MONTHLY;
  if (!id) throw new Error("Stripe price ids are not set");
  return id;
}
