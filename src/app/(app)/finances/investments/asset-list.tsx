"use client";

import { useState } from "react";
import { deleteAssetAction } from "@/app/actions/assets";
import { formatCurrency } from "@/lib/format";
import { AssetForm } from "./asset-form";
import type { AssetDTO } from "./types";

const typeLabels: Record<string, string> = {
  STOCKS: "Stocks",
  RETIREMENT: "Retirement",
  REAL_ESTATE: "Real estate",
  CRYPTO: "Crypto",
  SAVINGS: "Savings",
  OTHER: "Other",
};

export function AssetList({ assets }: { assets: AssetDTO[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (assets.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-background p-8 text-center text-sm text-muted">
        No assets yet. Add your first one above.
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
              }}
              onDone={() => setEditingId(null)}
            />
          </div>
        ) : (
          <div
            key={a.id}
            className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background px-6 py-4"
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">{a.name}</span>
              <span className="text-sm text-muted">{typeLabels[a.type]}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-foreground">
                {formatCurrency(a.currentValue)}
              </span>
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
