import { SelectHTMLAttributes } from "react";

export function Select({
  label,
  name,
  error,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  name: string;
  error?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <select
        id={name}
        name={name}
        className="w-full min-w-0 min-h-11 rounded-xl border border-border bg-background px-4 py-2.5 text-base text-foreground md:text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
        {...props}
      >
        {children}
      </select>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
