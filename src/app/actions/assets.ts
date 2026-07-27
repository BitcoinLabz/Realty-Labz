"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { assetSchema } from "@/lib/validation";
import { fetchWalletBalanceUsd, WalletBalanceError } from "@/lib/wallet-balance";
import type { FormState } from "@/app/actions/auth";

function parseAssetForm(formData: FormData) {
  return assetSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    currentValue: formData.get("currentValue") || undefined,
    notes: formData.get("notes") || undefined,
    walletNetwork: formData.get("walletNetwork") || undefined,
    walletAddress: formData.get("walletAddress") || undefined,
  });
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

  const { walletNetwork, walletAddress, currentValue, ...rest } = parsed.data;

  let created;
  if (walletNetwork && walletAddress) {
    try {
      const { balance, usdValue } = await fetchWalletBalanceUsd(walletNetwork, walletAddress);
      created = await prisma.asset.create({
        data: {
          userId: session.user.id,
          ...rest,
          currentValue: usdValue,
          walletNetwork,
          walletAddress,
          walletBalance: balance,
          walletBalanceCheckedAt: new Date(),
        },
      });
    } catch (err) {
      const message = err instanceof WalletBalanceError ? err.message : "Couldn't fetch wallet balance";
      return { fieldErrors: { walletAddress: message } };
    }
  } else {
    created = await prisma.asset.create({
      data: { userId: session.user.id, ...rest, currentValue: currentValue! },
    });
  }

  // Every value-setting write gets a timestamped snapshot -- this is what
  // powers the net worth trend chart (src/lib/finance-data.ts's
  // getNetWorthSeries) with zero extra "log a value" UI.
  await prisma.assetValueSnapshot.create({
    data: { assetId: created.id, value: created.currentValue },
  });

  revalidatePath("/finances");
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

  const { walletNetwork, walletAddress, currentValue, ...rest } = parsed.data;

  let data: Record<string, unknown> = { ...rest };
  let newValue: number;

  if (walletNetwork && walletAddress) {
    try {
      const { balance, usdValue } = await fetchWalletBalanceUsd(walletNetwork, walletAddress);
      data = {
        ...data,
        currentValue: usdValue,
        walletNetwork,
        walletAddress,
        walletBalance: balance,
        walletBalanceCheckedAt: new Date(),
      };
      newValue = usdValue;
    } catch (err) {
      const message = err instanceof WalletBalanceError ? err.message : "Couldn't fetch wallet balance";
      return { fieldErrors: { walletAddress: message } };
    }
  } else {
    data = {
      ...data,
      currentValue: currentValue!,
      walletNetwork: null,
      walletAddress: null,
      walletBalance: null,
      walletBalanceCheckedAt: null,
    };
    newValue = currentValue!;
  }

  const result = await prisma.asset.updateMany({
    where: { id, userId: session.user.id },
    data,
  });

  if (result.count === 0) return { error: "Asset not found" };

  // Same snapshot-on-write as create -- see the comment there.
  await prisma.assetValueSnapshot.create({ data: { assetId: id, value: newValue } });

  revalidatePath("/finances");
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
  revalidatePath("/dashboard");
}

export async function refreshWalletBalanceAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  const asset = await prisma.asset.findFirst({ where: { id, userId: session.user.id } });
  if (!asset || !asset.walletNetwork || !asset.walletAddress) return;

  try {
    const { balance, usdValue } = await fetchWalletBalanceUsd(asset.walletNetwork, asset.walletAddress);
    await prisma.asset.update({
      where: { id: asset.id },
      data: { currentValue: usdValue, walletBalance: balance, walletBalanceCheckedAt: new Date() },
    });
    await prisma.assetValueSnapshot.create({ data: { assetId: asset.id, value: usdValue } });
  } catch {
    // Silently ignore -- the asset keeps its last known balance/value, and
    // this is a background-ish "refresh" action with no form state to show
    // an error in. A future retry (or the founder asking for one) can add a
    // visible error if this proves to matter in practice.
  }

  revalidatePath("/finances");
  revalidatePath("/dashboard");
}
