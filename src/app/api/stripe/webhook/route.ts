import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { planFromSubscription } from "@/lib/plan";
import {
  customerIdOf,
  grantsPro,
  knownStripePriceIds,
  stripeEventAt,
  stripeEventIsCurrent,
  subscriptionIdFromInvoice,
  subscriptionItemPriceIds,
} from "@/lib/stripe-billing";

// Stripe -> Realty Labz (2026-10-05). The ONLY place that grants or removes
// Pro: a browser returning from checkout proves nothing, a signed event from
// Stripe does. Every event is verified against STRIPE_WEBHOOK_SECRET using the
// raw body; anything unsigned or forged is rejected before it's read.
//
// Each handler re-reads the subscription from Stripe and writes that current
// state, so a retried delivery converges. An older event that arrives late
// is dropped by comparing event.created to User.stripeEventAt, which the
// UPDATE rechecks under the row lock.

async function applySubscription(sub: Stripe.Subscription, eventCreated: number) {
  const eventAt = stripeEventAt(eventCreated);
  const customerId = customerIdOf(sub.customer);
  const userId = sub.metadata?.userId || null;
  const priceIds = subscriptionItemPriceIds(sub.items.data);
  const known = knownStripePriceIds();
  const pro = grantsPro(sub.status, priceIds, known);
  if (!pro && planFromSubscription(sub.status) === "PRO" && known.length > 0) {
    console.error("[stripe-webhook] subscription is not a known Pro price", sub.id);
  }

  // In this API version the billing period lives on the subscription item.
  const periodEnd = sub.items.data[0]?.current_period_end;
  const data = {
    stripeSubscriptionId: sub.id,
    subscriptionStatus: sub.status,
    plan: pro ? ("PRO" as const) : ("FREE" as const),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    stripeEventAt: eventAt,
  };
  // lte, not lt: a retry of the same event still applies.
  const notStale = { OR: [{ stripeEventAt: null }, { stripeEventAt: { lte: eventAt } }] };

  if (customerId) {
    const byCustomer = await prisma.user.updateMany({
      where: { stripeCustomerId: customerId, ...notStale },
      data,
    });
    if (byCustomer.count > 0) return;
    // Linked, but this event is older than one we already applied.
    const owner = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
      select: { stripeEventAt: true },
    });
    if (owner) {
      if (!stripeEventIsCurrent(owner.stripeEventAt, eventCreated)) return;
      // The row moved between the two writes. One more attempt.
      await prisma.user.updateMany({ where: { stripeCustomerId: customerId, ...notStale }, data });
      return;
    }
  }

  // Customer not linked yet. The userId in metadata is the fallback, and
  // only while the account has no customer -- never overwrite a different one.
  if (userId && customerId) {
    await prisma.user.updateMany({
      where: { id: userId, stripeCustomerId: null, ...notStale },
      data: { ...data, stripeCustomerId: customerId },
    });
  }
}

async function syncSubscription(subscriptionId: string, eventCreated: number) {
  await applySubscription(await getStripe().subscriptions.retrieve(subscriptionId), eventCreated);
}

function subscriptionIdFromSession(session: Stripe.Checkout.Session): string | null {
  const subscription = session.subscription;
  if (!subscription) return null;
  return typeof subscription === "string" ? subscription : subscription.id;
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
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
      case "checkout.session.async_payment_failed": {
        const session = event.data.object;
        if (session.mode === "subscription") {
          const subId = subscriptionIdFromSession(session);
          if (subId) await syncSubscription(subId, event.created);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object.id, event.created);
        break;
      case "invoice.paid":
      case "invoice.payment_failed": {
        const subId = subscriptionIdFromInvoice(event.data.object);
        if (subId) await syncSubscription(subId, event.created);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("[stripe-webhook] failed to apply", event.type, err);
    // 500 makes Stripe retry later, rather than the change being lost.
    return new NextResponse("Error", { status: 500 });
  }

  return NextResponse.json({ received: true });
}
