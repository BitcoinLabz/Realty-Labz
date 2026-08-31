import { InputHTMLAttributes } from "react";

export function Field({
  label,
  name,
  error,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  error?: string;
  // Explains what the field is for, under the input. Shown only when there's
  // no error -- stacking guidance under a red message buries the thing the
  // user actually needs to read.
  hint?: React.ReactNode;
}) {
  const describedBy = hint && !error ? `${name}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={name}
        name={name}
        aria-describedby={describedBy}
        className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
        {...props}
      />
      {error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : hint ? (
        <p id={`${name}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
