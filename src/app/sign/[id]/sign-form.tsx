"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  declineSignerAction,
  markSignerViewedAction,
  submitSignerResponseAction,
} from "@/app/actions/form-submissions";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { PdfPageCanvas, usePdfDocument } from "@/components/pdf-page-canvas";
import { SignaturePadModal } from "@/components/signature-pad-modal";
import type { SignFieldDTO } from "./types";

const initialState: FormState = {};

export function SignForm({
  signerId,
  pdfUrl,
  templateName,
  agentName,
  recipientName,
  fields,
}: {
  signerId: string;
  pdfUrl: string;
  templateName: string;
  agentName: string;
  recipientName: string;
  fields: SignFieldDTO[];
}) {
  const { pdf, numPages, error: pdfError } = usePdfDocument(pdfUrl);
  // Start on this signer's first field's page, not always page 0 — their
  // fields may all be on a later page, and nothing on the page should force
  // them to go hunting for "Next" before anything looks interactive.
  const [pageIndex, setPageIndex] = useState(() => (fields.length > 0 ? Math.min(...fields.map((f) => f.page)) : 0));
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [values, setValues] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [signingFieldId, setSigningFieldId] = useState<string | null>(null);
  const [state, formAction, isPending] = useActionState(submitSignerResponseAction, initialState);

  useEffect(() => {
    markSignerViewedAction(signerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fieldsOnPage = useMemo(() => fields.filter((f) => f.page === pageIndex), [fields, pageIndex]);

  const requiredIncomplete = fields.some((f) => {
    if (!f.required) return false;
    const v = values[f.id];
    return f.type === "CHECKBOX" ? v !== "true" : !v;
  });

  function setValue(fieldId: string, value: string) {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  }

  const signingField = fields.find((f) => f.id === signingFieldId);

  if (pdfError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4">
        <p className="text-sm text-danger">Couldn&apos;t load this document: {pdfError}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface px-4 py-10">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="rounded-2xl border border-border bg-background p-6">
          <h1 className="text-lg font-semibold text-foreground">{templateName}</h1>
          <p className="mt-1 text-sm text-muted">
            {agentName} sent you this document to review and sign, {recipientName}.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-border">
          {numPages > 1 ? (
            <div className="flex items-center justify-between border-b border-border bg-background p-3">
              <Button
                type="button"
                variant="secondary"
                disabled={pageIndex === 0}
                onClick={() => setPageIndex((p) => p - 1)}
              >
                ← Previous
              </Button>
              <span className="text-sm text-muted">
                Page {pageIndex + 1} of {numPages}
              </span>
              <Button
                type="button"
                variant="secondary"
                disabled={pageIndex >= numPages - 1}
                onClick={() => setPageIndex((p) => p + 1)}
              >
                Next →
              </Button>
            </div>
          ) : null}

          <div className="relative" style={{ userSelect: "none" }}>
            {pdf ? (
              <PdfPageCanvas pdf={pdf} pageNumber={pageIndex + 1} width={720} onRendered={setCanvasSize} />
            ) : (
              <div className="flex h-96 items-center justify-center text-sm text-muted">Loading document…</div>
            )}

            {pdf && canvasSize.width > 0
              ? fieldsOnPage.map((f) => (
                  <div
                    key={f.id}
                    className="absolute"
                    style={{
                      left: `${f.x * 100}%`,
                      top: `${f.y * 100}%`,
                      width: `${f.width * 100}%`,
                      height: `${f.height * 100}%`,
                    }}
                  >
                    {f.type === "TEXT" || f.type === "DATE" ? (
                      <input
                        type={f.type === "DATE" ? "date" : "text"}
                        value={values[f.id] ?? ""}
                        onChange={(e) => setValue(f.id, e.target.value)}
                        placeholder={f.label}
                        className="h-full w-full rounded border-2 border-accent bg-white/95 px-1 text-xs text-black outline-none"
                      />
                    ) : null}
                    {f.type === "CHECKBOX" ? (
                      <button
                        type="button"
                        onClick={() => setValue(f.id, values[f.id] === "true" ? "false" : "true")}
                        aria-pressed={values[f.id] === "true"}
                        className="flex h-full w-full items-center justify-center rounded border-2 border-accent bg-white/95 text-black"
                      >
                        {values[f.id] === "true" ? "✓" : ""}
                      </button>
                    ) : null}
                    {f.type === "SIGNATURE" || f.type === "INITIALS" ? (
                      <button
                        type="button"
                        onClick={() => setSigningFieldId(f.id)}
                        className="flex h-full w-full items-center justify-center overflow-hidden rounded border-2 border-dashed border-accent bg-white/95 text-xs font-medium text-accent"
                      >
                        {values[f.id] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={values[f.id]} alt={f.label} className="h-full w-full object-contain" />
                        ) : (
                          `Click to ${f.type === "SIGNATURE" ? "sign" : "initial"}`
                        )}
                      </button>
                    ) : null}
                  </div>
                ))
              : null}
          </div>
        </div>

        <form action={formAction} className="rounded-2xl border border-border bg-background p-6">
          <input type="hidden" name="signerId" value={signerId} />
          {fields.map((f) => (
            <input key={f.id} type="hidden" name={`field_${f.id}`} value={values[f.id] ?? ""} />
          ))}
          <input type="hidden" name="consent" value={consent ? "true" : "false"} />

          <div className="mb-4 flex items-start gap-2">
            <input
              type="checkbox"
              id="consent-checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1"
            />
            <label htmlFor="consent-checkbox" className="text-sm text-foreground">
              I agree that my electronic signature on this document is legally binding, the same as a
              handwritten signature, and I consent to conduct this transaction electronically.
            </label>
          </div>

          {state.error ? <p className="mb-3 text-sm text-danger">{state.error}</p> : null}
          {state.fieldErrors ? (
            <p className="mb-3 text-sm text-danger">Please fill in all required fields before continuing.</p>
          ) : null}

          <Button type="submit" disabled={isPending || !pdf || !consent || requiredIncomplete}>
            {isPending ? "Submitting…" : "Complete signing"}
          </Button>
        </form>

        <form
          action={declineSignerAction}
          onSubmit={(e) => {
            if (!confirm("Are you sure you want to decline to sign this document?")) e.preventDefault();
          }}
        >
          <input type="hidden" name="signerId" value={signerId} />
          <button type="submit" className="text-sm font-medium text-danger hover:opacity-80">
            I can&apos;t sign this
          </button>
        </form>
      </div>

      {signingField ? (
        <SignaturePadModal
          label={`${signingField.type === "SIGNATURE" ? "Sign" : "Initial"}: ${signingField.label}`}
          onConfirm={(dataUrl) => {
            setValue(signingField.id, dataUrl);
            setSigningFieldId(null);
          }}
          onClose={() => setSigningFieldId(null)}
        />
      ) : null}
    </div>
  );
}
