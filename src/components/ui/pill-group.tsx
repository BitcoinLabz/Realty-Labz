"use client";

// A labelled row of mutually-exclusive choices, submitted via a hidden input
// so it works inside a plain <form action={serverAction}> like every other
// control in this app.
//
// Collapses three verbatim copies of a local `pillClass(active)` helper that
// had been pasted into transaction-form.tsx, asset-form.tsx, and
// loan-form.tsx.
export function PillGroup<T extends string>({
  label,
  name,
  value,
  onChange,
  options,
  description,
  columns = 2,
}: {
  label: string;
  // Omit to render selection-only (when the parent submits the value itself).
  name?: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  description?: React.ReactNode;
  columns?: 2 | 3;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {description ? <p className="-mt-1 text-sm text-muted">{description}</p> : null}
      <div className={`grid gap-2 ${columns === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={active}
              className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-foreground hover:bg-surface"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {name ? <input type="hidden" name={name} value={value} /> : null}
    </div>
  );
}
