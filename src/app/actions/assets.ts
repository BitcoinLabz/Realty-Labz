"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { assetSchema } from "@/lib/validation";
import { fetchWalletBalanceUsd, WalletBalanceError } from "@/lib/wallet-balance";
import { fetchStockValueUsd, StockPriceError } from "@/lib/stock-price";
import type { FormState } from "@/app/actions/auth";

function parseAssetForm(formData: FormData) {
  return assetSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    currentValue: formData.get("currentValue") || undefined,
    notes: formData.get("notes") || undefined,
    walletNetwork: formData.get("walletNetwork") || undefined,
    walletAddress: formData.get("walletAddress") || undefined,
    stockTicker: formData.get("stockTicker") || undefined,
    shareCount: formData.get("shareCount") || undefined,
  });
}

type AssetValueFields = {
  currentValue: number;
  walletNetwork: "BITCOIN" | "STACKS" | null;
  walletAddress: string | null;
  walletBalance: number | null;
  walletBalanceCheckedAt: Date | null;
  stockTicker: string | null;
  shareCount: number | null;
  stockPricePerShare: number | null;
  stockPriceCheckedAt: Date | null;
};

// Resolves what to write for the value-tracking fields (and the resulting
// currentValue) across the three mutually-exclusive modes: a linked crypto
// wallet, a tracked stock ticker, or a plain manual value. Switching modes
// on an existing asset explicitly nulls out the other two modes' fields
// rather than leaving stale data behind.
async function resolveAssetValue(parsed: {
  walletNetwork?: "BITCOIN" | "STACKS";
  walletAddress?: string;
  stockTicker?: string;
  shareCount?: number;
  currentValue?: number;
}): Promise<
  | { ok: true; data: AssetValueFields; currentValue: number }
  | { ok: false; field: "walletAddress" | "stockTicker"; error: string }
> {
  if (parsed.walletNetwork && parsed.walletAddress) {
    try {
      const { balance, usdValue } = await fetchWalletBalanceUsd(parsed.walletNetwork, parsed.walletAddress);
      return {
        ok: true,
        currentValue: usdValue,
        data: {
          currentValue: usdValue,
          walletNetwork: parsed.walletNetwork,
          walletAddress: parsed.walletAddress,
          walletBalance: balance,
          walletBalanceCheckedAt: new Date(),
          stockTicker: null,
          shareCount: null,
          stockPricePerShare: null,
          stockPriceCheckedAt: null,
        },
      };
    } catch (err) {
      const message = err instanceof WalletBalanceError ? err.message : "Couldn't fetch wallet balance";
      return { ok: false, field: "walletAddress", error: message };
    }
  }

  if (parsed.stockTicker && parsed.shareCount) {
    try {
      const { pricePerShare, usdValue } = await fetchStockValueUsd(parsed.stockTicker, parsed.shareCount);
      return {
        ok: true,
        currentValue: usdValue,
        data: {
          currentValue: usdValue,
          stockTicker: parsed.stockTicker.trim().toUpperCase(),
          shareCount: parsed.shareCount,
          stockPricePerShare: pricePerShare,
          stockPriceCheckedAt: new Date(),
          walletNetwork: null,
          walletAddress: null,
          walletBalance: null,
          walletBalanceCheckedAt: null,
        },
      };
    } catch (err) {
      const message = err instanceof StockPriceError ? err.message : "Couldn't fetch a stock price";
      return { ok: false, field: "stockTicker", error: message };
    }
  }

  return {
    ok: true,
    currentValue: parsed.currentValue!,
    data: {
      currentValue: parsed.currentValue!,
      walletNetwork: null,
      walletAddress: null,
      walletBalance: null,
      walletBalanceCheckedAt: null,
      stockTicker: null,
      shareCount: null,
      stockPricePerShare: null,
      stockPriceCheckedAt: null,
    },
  };
}

export async function createAssetAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const parsed = parseAssetForm(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  const { name, type, notes, ...valueFields } = parsed.data;

  const resolved = await resolveAssetValue(valueFields);
  if (!resolved.ok) return { fieldErrors: { [resolved.field]: resolved.error } };

  const created = await prisma.asset.create({
    data: { userId: session.user.id, name, type, notes, ...resolved.data },
  });

  // Every value-setting write gets a timestamped snapshot -- this is what
  // powers the net worth trend chart (src/lib/finance-data.ts's
  // getNetWorthSeries) with zero extra "log a value" UI.
  await prisma.assetValueSnapshot.create({
    data: { assetId: created.id, value: created.currentValue },
  });

  revalidatePath("/finances");
  revalidatePath("/finances/investments");
  revalidatePath("/dashboard");
  return {};
}

export async function updateAssetAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing asset id" };

  const parsed = parseAssetForm(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  const { name, type, notes, ...valueFields } = parsed.data;

  const resolved = await resolveAssetValue(valueFields);
  if (!resolved.ok) return { fieldErrors: { [resolved.field]: resolved.error } };

  const result = await prisma.asset.updateMany({
    where: { id, userId: session.user.id },
    data: { name, type, notes, ...resolved.data },
  });

  if (result.count === 0) return { error: "Asset not found" };

  // Same snapshot-on-write as create -- see the comment there.
  await prisma.assetValueSnapshot.create({ data: { assetId: id, value: resolved.currentValue } });

  revalidatePath("/finances");
  revalidatePath("/finances/investments");
  revalidatePath("/dashboard");
  return {};
}

export async function deleteAssetAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  await prisma.asset.deleteMany({ where: { id, userId: session.user.id } });

  revalidatePath("/finances");
  revalidatePath("/finances/investments");
  revalidatePath("/dashboard");
}

export async function refreshWalletBalanceAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing asset id" };

  const asset = await prisma.asset.findFirst({ where: { id, userId: session.user.id } });
  if (!asset || !asset.walletNetwork || !asset.walletAddress) return { error: "Asset not found" };

  try {
    const { balance, usdValue } = await fetchWalletBalanceUsd(asset.walletNetwork, asset.walletAddress);
    await prisma.asset.update({
      where: { id: asset.id },
      data: { currentValue: usdValue, walletBalance: balance, walletBalanceCheckedAt: new Date() },
    });
    await prisma.assetValueSnapshot.create({ data: { assetId: asset.id, value: usdValue } });
  } catch (err) {
    // Previously swallowed silently -- from the founder's chair that was
    // indistinguishable from "the app just doesn't update prices." Now
    // surfaced as a real FormState error the Refresh button can display.
    const message = err instanceof WalletBalanceError ? err.message : "Couldn't refresh the wallet balance";
    return { error: message };
  }

  revalidatePath("/finances");
  revalidatePath("/finances/investments");
  revalidatePath("/dashboard");
  return {};
}

export async function refreshStockPriceAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing asset id" };

  const asset = await prisma.asset.findFirst({ where: { id, userId: session.user.id } });
  if (!asset || !asset.stockTicker || !asset.shareCount) return { error: "Asset not found" };

  try {
    const { pricePerShare, usdValue } = await fetchStockValueUsd(asset.stockTicker, Number(asset.shareCount));
    await prisma.asset.update({
      where: { id: asset.id },
      data: { currentValue: usdValue, stockPricePerShare: pricePerShare, stockPriceCheckedAt: new Date() },
    });
    await prisma.assetValueSnapshot.create({ data: { assetId: asset.id, value: usdValue } });
  } catch (err) {
    // Same fix as refreshWalletBalanceAction above -- see that comment.
    const message = err instanceof StockPriceError ? err.message : "Couldn't refresh the stock price";
    return { error: message };
  }

  revalidatePath("/finances");
  revalidatePath("/finances/investments");
  revalidatePath("/dashboard");
  return {};
}
