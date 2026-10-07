import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { planFromSubscription } from "@/lib/plan";

// Stripe -> Realty Labz (2026-10-05). The ONLY place that grants or removes
// Pro: a browser returning from checkout proves nothing, a signed event from
// Stripe does. Every event is verified against STRIPE_WEBHOOK_SECRET using the
// raw body; anything unsigned or forged is rejected before it's read.
//
// Idempotent by construction -- each event just writes the subscription's
// current state onto the account, so a retried or out-of-order delivery
// converges on the truth.

async function applySubscription(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const userId = sub.metadata?.userId;
  // In this API version the billing period lives on the subscription item.
  const periodEnd = sub.items.data[0]?.current_period_end;

  const data = {
    stripeSubscriptionId: sub.id,
    subscriptionStatus: sub.status,
    plan: planFromSubscription(sub.status),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
  };

  // Matched by the Stripe customer we created for the account; the userId in
  // metadata is a fallback for a customer not yet linked.
  const byCustomer = await prisma.user.updateMany({ where: { stripeCustomerId: customerId }, data });
  if (byCustomer.count === 0 && userId) {
    await prisma.user.updateMany({
      where: { id: userId, stripeCustomerId: null },
      data: { ...data, stripeCustomerId: customerId },
    });
  }
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return new NextResponse("Not configured", { status: 400 });

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode === "subscription" && session.subscription) {
          const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          await applySubscription(await getStripe().subscriptions.retrieve(subId));
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await applySubscription(event.data.object);
        break;
      default:
        // Not something this app tracks.
        break;
    }
  } catch (err) {
    console.error("[stripe-webhook] failed to apply", event.type, err);
    // 500 makes Stripe retry later, rather than the change being lost.
    return new NextResponse("Error", { status: 500 });
  }

  return NextResponse.json({ received: true });
}
