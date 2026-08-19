"use client";

import { useMemo, useState } from "react";
import { MileageList } from "../mileage-list";
import type { MileageLogDTO } from "../types";

const selectClass =
  "rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20";

export function MileageHistory({
  logs,
  years,
  initialYear,
}: {
  logs: MileageLogDTO[];
  years: string[];
  initialYear: string;
}) {
  const [search, setSearch] = useState("");
  const [businessFilter, setBusinessFilter] = useState("");
  const [year, setYear] = useState(initialYear);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return logs.filter((log) => {
      if (query && !(log.note ?? "").toLowerCase().includes(query)) return false;
      if (businessFilter && String(log.isBusiness) !== businessFilter) return false;
      if (year && log.date.slice(0, 4) !== year) return false;
      return true;
    });
  }, [logs, search, businessFilter, year]);

  const hasActiveFilters = search.trim() !== "" || businessFilter !== "" || year !== "";

  function clearFilters() {
    setSearch("");
    setBusinessFilter("");
    setYear("");
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-background p-8 text-center text-sm text-muted">
        No trips yet. Log your first one on the Mileage page.
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
          placeholder="Search by note…"
          className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        <select
          value={businessFilter}
          onChange={(e) => setBusinessFilter(e.target.value)}
          className={selectClass}
        >
          <option value="">All trips</option>
          <option value="true">Business</option>
          <option value="false">Personal</option>
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
          Showing {filtered.length} of {logs.length} trips
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
          No trips match your search or filters.
        </div>
      ) : (
        <MileageList logs={filtered} />
      )}
    </div>
  );
}
