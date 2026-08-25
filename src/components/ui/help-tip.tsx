"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";

// A small "?" that explains a term in plain English on hover or tap.
//
// This exists so industry vocabulary that genuinely can't be renamed --
// contingency, escrow, amortization, net commission -- can be explained
// without adding another paragraph of grey text to pages that are already
// too tall. Prefer renaming a term outright; reach for this only when the
// real-estate word IS the right word and the reader may not know it.
//
// Hover covers mouse users; click covers touch, where there is no hover.
export function HelpTip({ label, text }: { label?: string; text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex items-center align-middle">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onBlur={() => setOpen(false)}
        aria-label={label ? `What is ${label}?` : "More information"}
        className="text-muted transition-colors hover:text-foreground"
      >
        <HelpCircle size={14} />
      </button>
      {open ? (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-xl border border-border bg-background p-3 text-left text-xs font-normal leading-relaxed text-muted shadow-lg"
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}
