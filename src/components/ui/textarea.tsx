import { TextareaHTMLAttributes } from "react";

export function Textarea({
  label,
  name,
  error,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  name: string;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={3}
        className="min-h-11 rounded-xl border border-border bg-background px-4 py-2.5 text-base text-foreground md:text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
        {...props}
      />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
