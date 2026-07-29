"use client";

import { useMemo, useState } from "react";
import { TransactionList } from "../transaction-list";
import { CATEGORY_OPTIONS } from "../transaction-form";
import type { DealOption, TransactionDTO } from "../types";

const selectClass =
  "rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20";

export function TransactionHistory({
  transactions,
  deals,
  years,
  initialYear,
}: {
  transactions: TransactionDTO[];
  deals: DealOption[];
  years: string[];
  initialYear: string;
}) {
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState("");
  const [type, setType] = useState("");
  const [category, setCategory] = useState("");
  const [year, setYear] = useState(initialYear);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return transactions.filter((t) => {
      if (query && !(t.description ?? "").toLowerCase().includes(query)) return false;
      if (scope && t.scope !== scope) return false;
      if (type && t.type !== type) return false;
      if (category && t.category !== category) return false;
      if (year && t.date.slice(0, 4) !== year) return false;
      return true;
    });
  }, [transactions, search, scope, type, category, year]);

  const hasActiveFilters = search.trim() !== "" || scope !== "" || type !== "" || category !== "" || year !== "";

  function clearFilters() {
    setSearch("");
    setScope("");
    setType("");
    setCategory("");
    setYear("");
  }

  if (transactions.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-background p-8 text-center text-sm text-muted">
        No transactions yet. Add your first one on the Transactions page.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by description…"
          className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        <select value={scope} onChange={(e) => setScope(e.target.value)} className={selectClass}>
          <option value="">All scopes</option>
          <option value="BUSINESS">Business</option>
          <option value="PERSONAL">Personal</option>
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className={selectClass}>
          <option value="">All types</option>
          <option value="INCOME">Income</option>
          <option value="EXPENSE">Expense</option>
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
          <option value="">All categories</option>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <select value={year} onChange={(e) => setYear(e.target.value)} className={selectClass}>
          <option value="">All years</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          Showing {filtered.length} of {transactions.length} transactions
        </p>
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm font-medium text-accent hover:opacity-80"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-background p-8 text-center text-sm text-muted">
          No transactions match your search or filters.
        </div>
      ) : (
        <TransactionList transactions={filtered} deals={deals} />
      )}
    </div>
  );
}
