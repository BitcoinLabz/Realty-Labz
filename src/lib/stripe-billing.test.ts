import { describe, expect, it } from "vitest";
import {
  automaticTaxEnabled,
  buildCheckoutSessionParams,
  customerIdOf,
  grantsPro,
  knownStripePriceIds,
  stripeEventAt,
  stripeEventIsCurrent,
  subscriptionIdFromInvoice,
  subscriptionItemPriceIds,
} from "./stripe-billing";

describe("automaticTaxEnabled", () => {
  it("is on only for the exact string true", () => {
    expect(automaticTaxEnabled({ STRIPE_AUTOMATIC_TAX: "true" })).toBe(true);
    expect(automaticTaxEnabled({})).toBe(false);
    expect(automaticTaxEnabled({ STRIPE_AUTOMATIC_TAX: "1" })).toBe(false);
    expect(automaticTaxEnabled({ STRIPE_AUTOMATIC_TAX: "false" })).toBe(false);
  });
});

describe("buildCheckoutSessionParams", () => {
  const base = {
    userId: "user_1",
    customerId: "cus_1",
    priceId: "price_month",
    successUrl: "https://www.realtylabz.com/account?upgraded=1#plan",
    cancelUrl: "https://www.realtylabz.com/account#plan",
  };

  it("leaves tax off and still refuses Managed Payments", () => {
    const params = buildCheckoutSessionParams({ ...base, automaticTax: false });
    expect(params.automatic_tax).toBeUndefined();
    expect(params.billing_address_collection).toBeUndefined();
    expect(params.customer_update).toBeUndefined();
    expect(params.managed_payments).toEqual({ enabled: false });
    expect(params.subscription_data.metadata.userId).toBe("user_1");
    expect(params.line_items).toEqual([{ price: "price_month", quantity: 1 }]);
  });

  it("collects a billing address and turns on automatic tax together", () => {
    const params = buildCheckoutSessionParams({ ...base, automaticTax: true });
    expect(params.automatic_tax).toEqual({ enabled: true });
    expect(params.billing_address_collection).toBe("required");
    expect(params.customer_update).toEqual({ address: "auto", name: "auto" });
    expect(params.managed_payments).toEqual({ enabled: false });
  });
});

describe("knownStripePriceIds", () => {
  it("drops missing ids", () => {
    expect(knownStripePriceIds({ STRIPE_PRICE_MONTHLY: "price_m" })).toEqual(["price_m"]);
    expect(knownStripePriceIds({})).toEqual([]);
  });
});

describe("grantsPro", () => {
  const known = ["price_m", "price_y"];

  it("grants Pro for an active or past-due subscription on a known price", () => {
    expect(grantsPro("active", ["price_m"], known)).toBe(true);
    expect(grantsPro("past_due", ["price_y"], known)).toBe(true);
    expect(grantsPro("trialing", ["price_m"], known)).toBe(true);
  });

  it("does not grant Pro for a canceled status or an unknown price", () => {
    expect(grantsPro("canceled", ["price_m"], known)).toBe(false);
    expect(grantsPro("unpaid", ["price_m"], known)).toBe(false);
    expect(grantsPro("incomplete", ["price_m"], known)).toBe(false);
    expect(grantsPro("active", ["price_other"], known)).toBe(false);
    expect(grantsPro("active", [], known)).toBe(false);
  });

  it("trusts the status when no prices are configured", () => {
    expect(grantsPro("active", ["price_other"], [])).toBe(true);
    expect(grantsPro("canceled", ["price_m"], [])).toBe(false);
  });
});

describe("subscription helpers", () => {
  it("reads price ids from expanded and unexpanded items", () => {
    expect(subscriptionItemPriceIds([{ price: "price_m" }, { price: { id: "price_y" } }])).toEqual([
      "price_m",
      "price_y",
    ]);
  });

  it("reads the customer id", () => {
    expect(customerIdOf("cus_1")).toBe("cus_1");
    expect(customerIdOf({ id: "cus_2" })).toBe("cus_2");
    expect(customerIdOf(null)).toBeNull();
  });

  it("reads the subscription id from either invoice shape", () => {
    expect(subscriptionIdFromInvoice({ parent: { subscription_details: { subscription: "sub_1" } } })).toBe("sub_1");
    expect(
      subscriptionIdFromInvoice({ parent: { subscription_details: { subscription: { id: "sub_2" } } } }),
    ).toBe("sub_2");
    expect(subscriptionIdFromInvoice({ subscription: "sub_3" })).toBe("sub_3");
    expect(subscriptionIdFromInvoice({})).toBeNull();
  });
});

describe("stripe event ordering", () => {
  it("applies the first event and a retry, and ignores an older one", () => {
    expect(stripeEventIsCurrent(null, 1_700_000_000)).toBe(true);
    const stored = stripeEventAt(1_700_000_100);
    expect(stripeEventIsCurrent(stored, 1_700_000_100)).toBe(true);
    expect(stripeEventIsCurrent(stored, 1_700_000_200)).toBe(true);
    expect(stripeEventIsCurrent(stored, 1_700_000_050)).toBe(false);
  });
});
