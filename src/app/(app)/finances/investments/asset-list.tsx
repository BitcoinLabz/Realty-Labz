"use client";

import { useActionState, useState } from "react";
import { deleteAssetAction, refreshStockPriceAction, refreshWalletBalanceAction } from "@/app/actions/assets";
import type { FormState } from "@/app/actions/auth";
import { formatCurrency } from "@/lib/format";
import { AssetForm } from "./asset-form";
import type { AssetDTO } from "./types";

const initialState: FormState = {};

// Each list row gets its own instance of this, so pending/error state is
// isolated per-asset. Previously a plain <form action={...}> with no
// pending/error UI at all -- a failed refresh (rate limit, Yahoo/CoinGecko
// hiccup, etc.) looked identical to a successful one: nothing visibly
// happened either way.
function RefreshButton({
  assetId,
  action,
}: {
  assetId: string;
  action: typeof refreshWalletBalanceAction;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="id" value={assetId} />
      <button
        type="submit"
        disabled={isPending}
        className="self-start text-sm font-medium text-muted hover:text-foreground disabled:opacity-50"
      >
        {isPending ? "Refreshing…" : "Refresh"}
      </button>
      {state.error ? <span className="text-xs text-danger">{state.error}</span> : null}
    </form>
  );
}

const typeLabels: Record<string, string> = {
  STOCKS: "Stocks",
  RETIREMENT: "Retirement",
  REAL_ESTATE: "Real estate",
  CRYPTO: "Crypto",
  SAVINGS: "Savings",
  OTHER: "Other",
};

const networkLabels: Record<string, string> = {
  BITCOIN: "Bitcoin",
  STACKS: "Stacks",
};

const networkUnits: Record<string, string> = {
  BITCOIN: "BTC",
  STACKS: "STX",
};

function truncateAddress(address: string) {
  return address.length > 14 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

function formatBalance(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

function formatCheckedAt(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AssetList({ assets }: { assets: AssetDTO[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (assets.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-background p-8 text-center text-sm text-muted">
        Nothing added yet. Track savings, retirement, property, or anything else you own using the form above.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {assets.map((a) =>
        editingId === a.id ? (
          <div key={a.id} className="rounded-2xl border border-accent bg-background p-6">
            <AssetForm
              key={a.updatedAt}
              defaultValues={{
                id: a.id,
                name: a.name,
                type: a.type,
                currentValue: String(a.currentValue),
                notes: a.notes ?? "",
                walletNetwork: a.walletNetwork,
                walletAddress: a.walletAddress,
                stockTicker: a.stockTicker,
                shareCount: a.shareCount !== null ? String(a.shareCount) : null,
              }}
              onDone={() => setEditingId(null)}
            />
          </div>
        ) : (
          // Stacked rather than one side-by-side row: details, value and four
          // actions in a single line crushed the details into a sliver on a
          // phone and pushed Delete off the edge. Name + value on top, the
          // specifics under them, actions along the bottom -- fits any width.
          <div key={a.id} className="rounded-2xl border border-border bg-background px-5 py-4 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-col">
                <span className="break-words text-sm font-medium text-foreground">{a.name}</span>
                <span className="text-sm text-muted">
                  {typeLabels[a.type]}
                  {a.walletNetwork ? ` · ${networkLabels[a.walletNetwork]}` : ""}
                </span>
              </div>
              <span className="shrink-0 text-base font-semibold tabular-nums text-foreground">
                {formatCurrency(a.currentValue)}
              </span>
            </div>

            {a.walletNetwork && a.walletBalance !== null ? (
              <div className="mt-3 flex flex-col gap-0.5">
                <span className="text-sm tabular-nums text-foreground">
                  {formatBalance(a.walletBalance)} {networkUnits[a.walletNetwork]}
                </span>
                <span className="text-xs text-muted">
                  {truncateAddress(a.walletAddress!)}
                  {a.walletBalanceCheckedAt ? ` · Updated ${formatCheckedAt(a.walletBalanceCheckedAt)}` : ""}
                </span>
              </div>
            ) : null}
            {a.stockTicker && a.shareCount !== null ? (
              <div className="mt-3 flex flex-col gap-0.5">
                <span className="text-sm tabular-nums text-foreground">
                  {a.shareCount.toLocaleString("en-US", { maximumFractionDigits: 4 })} shares of{" "}
                  {a.stockTicker}
                  {a.stockPricePerShare !== null ? ` @ ${formatCurrency(a.stockPricePerShare)}` : ""}
                </span>
                {a.stockPriceCheckedAt ? (
                  <span className="text-xs text-muted">Updated {formatCheckedAt(a.stockPriceCheckedAt)}</span>
                ) : null}
              </div>
            ) : null}
            {a.notes ? <p className="mt-3 break-words text-sm text-muted">{a.notes}</p> : null}

            <div className="mt-4 flex items-start gap-5 border-t border-border pt-3">
              {a.walletNetwork ? <RefreshButton assetId={a.id} action={refreshWalletBalanceAction} /> : null}
              {a.stockTicker ? <RefreshButton assetId={a.id} action={refreshStockPriceAction} /> : null}
              <button
                type="button"
                onClick={() => setEditingId(a.id)}
                className="text-sm font-medium text-muted hover:text-foreground"
              >
                Edit
              </button>
              <form
                action={deleteAssetAction}
                onSubmit={(e) => {
                  if (!confirm(`Delete "${a.name}"?`)) e.preventDefault();
                }}
                className="ml-auto"
              >
                <input type="hidden" name="id" value={a.id} />
                <button type="submit" className="text-sm font-medium text-danger hover:opacity-80">
                  Delete
                </button>
              </form>
            </div>
          </div>
        ),
      )}
    </div>
  );
}
