"use client";

import { useState } from "react";

// The in-place confirmation for a destructive button that stands on its own
// (delete this client, decline to sign), where a "..." menu would hide the
// only action. Same question-then-confirm as RowMenu, without confirm().

export function ConfirmSubmit({
  action,
  fields,
  label,
  confirm,
  buttonClassName,
}: {
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, string>;
  label: string;
  confirm: string;
  buttonClassName: string;
}) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className={buttonClassName}>
        {label}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <p className="max-w-sm text-sm text-foreground">{confirm}</p>
      <div className="flex flex-wrap gap-2">
        <form action={action}>
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <button type="submit" className="rounded-full bg-danger px-5 py-2.5 text-sm font-medium text-white hover:opacity-90">
            {label}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setAsking(false)}
          className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-surface"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
