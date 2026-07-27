"use client";

import { useActionState } from "react";
import { createFinancialGoalAction, deleteFinancialGoalAction } from "@/app/actions/financial-goals";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";

const initialState: FormState = {};

export type FinancialGoalDTO = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
  linkedAssetId: string | null;
  linkedAssetName: string | null;
};

export type AssetOption = { id: string; name: string };

function GoalForm({ assets }: { assets: AssetOption[] }) {
  const [state, formAction, isPending] = useActionState(createFinancialGoalAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field
        label="Goal name"
        name="name"
        type="text"
        placeholder="e.g. House down payment"
        required
        error={state.fieldErrors?.name}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Target amount"
          name="targetAmount"
          type="number"
          step="0.01"
          min="0"
          required
          error={state.fieldErrors?.targetAmount}
        />
        <Field
          label="Target date (optional)"
          name="targetDate"
          type="date"
          error={state.fieldErrors?.targetDate}
        />
      </div>

      <Field
        label="Current amount (optional — ignored if you link an asset below)"
        name="currentAmount"
        type="number"
        step="0.01"
        min="0"
        error={state.fieldErrors?.currentAmount}
      />

      {assets.length > 0 ? (
        <Select label="Track progress from an asset instead (optional)" name="linkedAssetId" defaultValue="">
          <option value="">Update progress manually</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      ) : null}

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Adding…" : "Add goal"}
        </Button>
      </div>
    </form>
  );
}

export function GoalsSection({ goals, assets }: { goals: FinancialGoalDTO[]; assets: AssetOption[] }) {
  return (
    <section className="rounded-2xl border border-border bg-background p-8">
      <h2 className="mb-1 text-base font-semibold text-foreground">Goals</h2>
      <p className="mb-6 text-sm text-muted">
        Savings targets or debt payoff goals — optionally tracked against one of your assets above.
      </p>

      <div className="mb-6 max-w-md border-b border-border pb-6">
        <GoalForm assets={assets} />
      </div>

      {goals.length === 0 ? (
        <p className="text-sm text-muted">No goals yet. Add your first one above.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {goals.map((g) => {
            const percent = g.targetAmount > 0 ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0;
            return (
              <div key={g.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">
                    {g.name}
                    {g.linkedAssetName ? ` · tracking ${g.linkedAssetName}` : ""}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-muted">
                      {formatCurrency(g.currentAmount)} / {formatCurrency(g.targetAmount)}
                      {g.targetDate
                        ? ` · by ${new Date(g.targetDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
                        : ""}
                    </span>
                    <form action={deleteFinancialGoalAction}>
                      <input type="hidden" name="id" value={g.id} />
                      <button type="submit" className="text-sm font-medium text-danger hover:opacity-80">
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface">
                  <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${percent}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
