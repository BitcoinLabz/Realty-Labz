"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

// The one pattern for a list row's actions (2026-11-19): a 44px "⋯" button
// that opens a small menu, replacing cramped inline Edit / Delete links that
// overflowed on phones. A destructive item asks once more inside the menu
// ("Delete this? Delete / Cancel") instead of the browser's confirm() box.
//
// Items either run onSelect, or -- for server actions -- submit a hidden
// form, so this works inside the plain <form action={serverAction}> pattern
// the rest of the app uses.

export type RowMenuItem = {
  label: string;
  onSelect?: () => void;
  /** Server action to submit, with these hidden fields. */
  action?: (formData: FormData) => void | Promise<void>;
  fields?: Record<string, string>;
  href?: string;
  destructive?: boolean;
  /** For destructive items: the question asked before running it. */
  confirm?: string;
};

export function RowMenu({ items, label = "Actions" }: { items: RowMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(null);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const itemClass = (destructive?: boolean) =>
    `flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm font-medium transition-colors hover:bg-surface ${
      destructive ? "text-danger" : "text-foreground"
    }`;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          setOpen((v) => !v);
          setConfirming(null);
        }}
        className="flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-foreground"
      >
        <MoreHorizontal size={18} />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="animate-in absolute right-0 top-12 z-30 w-56 rounded-xl border border-border bg-background p-1 shadow-lg"
        >
          {confirming !== null ? (
            <div className="flex flex-col gap-1 p-2">
              <p className="px-1 pb-1 text-sm text-foreground">{items[confirming].confirm ?? "Are you sure?"}</p>
              <ItemButton item={items[confirming]} className={itemClass(true)} onDone={() => setOpen(false)} />
              <button type="button" className={itemClass()} onClick={() => setConfirming(null)}>
                Cancel
              </button>
            </div>
          ) : (
            items.map((item, i) =>
              item.destructive && item.confirm ? (
                <button key={item.label} type="button" role="menuitem" className={itemClass(true)} onClick={() => setConfirming(i)}>
                  {item.label}
                </button>
              ) : (
                <ItemButton key={item.label} item={item} className={itemClass(item.destructive)} onDone={() => setOpen(false)} />
              ),
            )
          )}
        </div>
      ) : null}
    </div>
  );
}

function ItemButton({ item, className, onDone }: { item: RowMenuItem; className: string; onDone: () => void }) {
  if (item.href) {
    return (
      <a role="menuitem" href={item.href} className={className} onClick={onDone}>
        {item.label}
      </a>
    );
  }
  if (item.action) {
    return (
      <form action={item.action} onSubmit={onDone}>
        {Object.entries(item.fields ?? {}).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <button type="submit" role="menuitem" className={className}>
          {item.label}
        </button>
      </form>
    );
  }
  return (
    <button
      type="button"
      role="menuitem"
      className={className}
      onClick={() => {
        item.onSelect?.();
        onDone();
      }}
    >
      {item.label}
    </button>
  );
}
