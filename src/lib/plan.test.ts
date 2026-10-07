import { describe, expect, it } from "vitest";
import {
  FREE_STORAGE_BYTES,
  formatBytes,
  hasPro,
  planFromSubscription,
  storageLimitBytes,
  wouldExceedStorage,
} from "./plan";

const free = { plan: "FREE" as const, subscriptionStatus: null, compedPro: false };

describe("hasPro", () => {
  it("is false on the free plan", () => {
    expect(hasPro(free)).toBe(false);
  });

  it("is true for an active, trialing, or briefly past-due subscription", () => {
    for (const status of ["active", "trialing", "past_due"]) {
      expect(hasPro({ plan: "PRO", subscriptionStatus: status, compedPro: false })).toBe(true);
    }
  });

  it("ends for canceled, unpaid, or never-completed subscriptions", () => {
    for (const status of ["canceled", "unpaid", "incomplete", "incomplete_expired", "paused"]) {
      expect(hasPro({ plan: "PRO", subscriptionStatus: status, compedPro: false })).toBe(false);
    }
  });

  it("is always true when comped by the founder", () => {
    expect(hasPro({ ...free, compedPro: true })).toBe(true);
  });
});

describe("storage", () => {
  it("limits Free to 250 MB and gives Pro unlimited", () => {
    expect(storageLimitBytes(free)).toBe(FREE_STORAGE_BYTES);
    expect(storageLimitBytes({ plan: "PRO", subscriptionStatus: "active", compedPro: false })).toBeNull();
  });

  it("blocks an upload only if it would go over the limit", () => {
    const mb = 1024 * 1024;
    expect(wouldExceedStorage(249 * mb, 1 * mb, FREE_STORAGE_BYTES)).toBe(false);
    expect(wouldExceedStorage(249 * mb, 2 * mb, FREE_STORAGE_BYTES)).toBe(true);
    expect(wouldExceedStorage(10_000 * mb, 15 * mb, null)).toBe(false);
  });
});

describe("planFromSubscription", () => {
  it("maps Stripe statuses to a plan", () => {
    expect(planFromSubscription("active")).toBe("PRO");
    expect(planFromSubscription("past_due")).toBe("PRO");
    expect(planFromSubscription("canceled")).toBe("FREE");
  });
});

describe("formatBytes", () => {
  it("reads naturally", () => {
    expect(formatBytes(500 * 1024)).toBe("500 KB");
    expect(formatBytes(5.5 * 1024 * 1024)).toBe("5.5 MB");
    expect(formatBytes(120 * 1024 * 1024)).toBe("120 MB");
    expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe("2.5 GB");
  });
});
