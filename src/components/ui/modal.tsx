"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

// The one popup for "fill in a form without leaving the page" (2026-11-28).
// First used for Add a client; Mileage and Income & Expenses are next.
//
// Built on the browser's own <dialog> opened with showModal(): that gives
// Escape-to-close, keeps keyboard focus inside the popup, and makes the page
// behind it inert for screen readers -- none of it hand-rolled. The page
// stays faintly visible through a dimmed backdrop. Tapping outside the
// panel, the X, Escape, or a form's own Cancel all close it without saving.
//
// Content is only rendered while open, so closing discards anything typed:
// reopening always starts from a clean form.

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="modal-title"
      // Escape fires "cancel"; keep React state in charge of closing.
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // A click whose target is the <dialog> itself landed on the backdrop
      // (the panel covers the dialog's own box), so it's an outside tap.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-2xl border border-border bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px] open:animate-in"
    >
      {open ? (
        <div className="flex max-h-[min(90dvh,48rem)] flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <h2 id="modal-title" className="text-base font-semibold text-foreground">
                {title}
              </h2>
              {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-foreground"
            >
              <X size={18} />
            </button>
          </div>
          {/* Long forms scroll inside the panel; the page behind stays put. */}
          <div className="overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">{children}</div>
        </div>
      ) : null}
    </dialog>
  );
}

/**
 * A button that opens a Modal. `children` receives `close` so a form can
 * shut the popup after it saves or when its Cancel is tapped.
 */
export function ModalButton({
  label,
  title,
  description,
  icon,
  defaultOpen = false,
  children,
}: {
  label: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const close = () => {
    setOpen(false);
    // Opened from a link like ?new=1: drop it so a refresh doesn't reopen.
    if (defaultOpen && window.location.search) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  };
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-accent px-5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
      >
        {icon}
        {label}
      </button>
      <Modal open={open} onClose={close} title={title} description={description}>
        {children(close)}
      </Modal>
    </>
  );
}
