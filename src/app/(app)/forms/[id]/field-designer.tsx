"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { saveFormFieldsAction } from "@/app/actions/form-templates";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { PdfPageCanvas, usePdfDocument } from "@/components/pdf-page-canvas";
import type { TemplateFieldDTO, TemplateSignerDTO } from "../types";

const FIELD_TYPES = ["TEXT", "DATE", "CHECKBOX", "SIGNATURE", "INITIALS"] as const;
type FieldType = (typeof FIELD_TYPES)[number];

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  TEXT: "Text",
  DATE: "Date",
  CHECKBOX: "Checkbox",
  SIGNATURE: "Signature",
  INITIALS: "Initials",
};

type DesignerField = {
  key: string;
  page: number; // 0-indexed, matches DB/pdf-lib convention
  x: number;
  y: number;
  width: number;
  height: number;
  type: FieldType;
  label: string;
  required: boolean;
  order: number;
  signerId: string;
};

const SIGNER_COLORS = ["#0071e3", "#34c759", "#ff9500", "#af52de", "#ff2d55"];

function colorForSigner(signers: TemplateSignerDTO[], signerId: string) {
  const index = signers.findIndex((s) => s.id === signerId);
  return SIGNER_COLORS[index % SIGNER_COLORS.length] ?? SIGNER_COLORS[0];
}

const initialState: FormState = {};

export function FieldDesigner({
  templateId,
  pdfUrl,
  signers,
  initialFields,
}: {
  templateId: string;
  pdfUrl: string;
  signers: TemplateSignerDTO[];
  initialFields: TemplateFieldDTO[];
}) {
  const { pdf, numPages, error: pdfError } = usePdfDocument(pdfUrl);
  const [pageIndex, setPageIndex] = useState(0); // 0-indexed for our own UI state
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [fields, setFields] = useState<DesignerField[]>(() =>
    initialFields.map((f) => ({ ...f, key: f.id, type: f.type })),
  );
  const [selectedSignerId, setSelectedSignerId] = useState(signers[0]?.id ?? "");
  const [selectedType, setSelectedType] = useState<FieldType>("TEXT");
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const [dragRect, setDragRect] = useState<{ x: number; y: number; width: number; height: number } | null>(
    null,
  );

  const [state, formAction, isPending] = useActionState(saveFormFieldsAction, initialState);

  useEffect(() => {
    if (signers[0] && !signers.some((s) => s.id === selectedSignerId)) {
      setSelectedSignerId(signers[0].id);
    }
  }, [signers, selectedSignerId]);

  const fieldsOnPage = useMemo(() => fields.filter((f) => f.page === pageIndex), [fields, pageIndex]);

  function fractionFromEvent(e: React.MouseEvent<HTMLDivElement>) {
    const rect = overlayRef.current!.getBoundingClientRect();
    return {
      x: Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1),
      y: Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1),
    };
  }

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (!selectedSignerId) return;
    dragStart.current = fractionFromEvent(e);
    setDragRect({ x: dragStart.current.x, y: dragStart.current.y, width: 0, height: 0 });
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!dragStart.current) return;
    const current = fractionFromEvent(e);
    setDragRect({
      x: Math.min(dragStart.current.x, current.x),
      y: Math.min(dragStart.current.y, current.y),
      width: Math.abs(current.x - dragStart.current.x),
      height: Math.abs(current.y - dragStart.current.y),
    });
  }

  function handleMouseUp() {
    if (dragRect && dragRect.width > 0.015 && dragRect.height > 0.01) {
      setFields((prev) => [
        ...prev,
        {
          key: crypto.randomUUID(),
          page: pageIndex,
          x: dragRect.x,
          y: dragRect.y,
          width: dragRect.width,
          height: dragRect.height,
          type: selectedType,
          label: FIELD_TYPE_LABELS[selectedType],
          required: true,
          order: prev.length,
          signerId: selectedSignerId,
        },
      ]);
    }
    dragStart.current = null;
    setDragRect(null);
  }

  function updateField(key: string, patch: Partial<DesignerField>) {
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }

  function deleteField(key: string) {
    setFields((prev) => prev.filter((f) => f.key !== key));
  }

  const fieldsJson = JSON.stringify(
    fields.map(({ key: _key, ...rest }) => rest),
  );

  if (pdfError) {
    return <p className="text-sm text-danger">Couldn&apos;t load this PDF: {pdfError}</p>;
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="flex-1">
        {numPages > 1 ? (
          <div className="mb-3 flex items-center justify-between">
            <Button
              type="button"
              variant="secondary"
              disabled={pageIndex === 0}
              onClick={() => setPageIndex((p) => p - 1)}
            >
              ← Previous page
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
              Next page →
            </Button>
          </div>
        ) : null}

        <div className="relative w-full max-w-2xl rounded-xl border border-border" style={{ userSelect: "none" }}>
          {pdf ? (
            <PdfPageCanvas
              pdf={pdf}
              pageNumber={pageIndex + 1}
              width={760}
              onRendered={setCanvasSize}
            />
          ) : (
            <div className="flex h-96 items-center justify-center text-sm text-muted">Loading PDF…</div>
          )}

          {pdf && canvasSize.width > 0 ? (
            <div
              ref={overlayRef}
              className="absolute inset-0 cursor-crosshair"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => {
                dragStart.current = null;
                setDragRect(null);
              }}
            >
              {fieldsOnPage.map((f) => (
                <div
                  key={f.key}
                  className="absolute flex items-center justify-between gap-1 border-2 bg-white/10 px-1 text-[10px] font-medium text-white"
                  style={{
                    left: `${f.x * 100}%`,
                    top: `${f.y * 100}%`,
                    width: `${f.width * 100}%`,
                    height: `${f.height * 100}%`,
                    borderColor: colorForSigner(signers, f.signerId),
                    backgroundColor: colorForSigner(signers, f.signerId),
                  }}
                >
                  <span className="truncate">{f.label}</span>
                  <button
                    type="button"
                    onClick={() => deleteField(f.key)}
                    className="shrink-0 rounded-full bg-black/30 px-1 leading-none hover:bg-black/50"
                    aria-label={`Delete ${f.label}`}
                  >
                    ×
                  </button>
                </div>
              ))}
              {dragRect ? (
                <div
                  className="absolute border-2 border-dashed"
                  style={{
                    left: `${dragRect.x * 100}%`,
                    top: `${dragRect.y * 100}%`,
                    width: `${dragRect.width * 100}%`,
                    height: `${dragRect.height * 100}%`,
                    borderColor: colorForSigner(signers, selectedSignerId),
                  }}
                />
              ) : null}
            </div>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-muted">
          Click and drag on the page to place a field. Fields are colored by which signer they belong to.
        </p>
      </div>

      <div className="flex w-full flex-col gap-6 lg:w-80">
        <section>
          <h3 className="mb-3 text-sm font-semibold text-foreground">Signers</h3>
          <p className="mb-2 text-xs text-muted">New fields are assigned to whichever signer is selected here.</p>
          <div className="flex flex-wrap gap-2">
            {signers.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedSignerId(s.id)}
                className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium"
                style={{
                  borderColor: colorForSigner(signers, s.id),
                  backgroundColor: selectedSignerId === s.id ? colorForSigner(signers, s.id) : "transparent",
                  color: selectedSignerId === s.id ? "white" : "var(--foreground)",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold text-foreground">Field type</h3>
          <div className="grid grid-cols-2 gap-2">
            {FIELD_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedType(type)}
                className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                  selectedType === type
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-foreground hover:bg-surface"
                }`}
              >
                {FIELD_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            Fields ({fields.length} total, {fieldsOnPage.length} on this page)
          </h3>
          {fieldsOnPage.length === 0 ? (
            <p className="text-sm text-muted">No fields on this page yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {fieldsOnPage.map((f) => (
                <div key={f.key} className="rounded-xl border border-border p-3">
                  <input
                    type="text"
                    value={f.label}
                    onChange={(e) => updateField(f.key, { label: e.target.value })}
                    className="mb-2 w-full rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus-visible:border-accent"
                  />
                  <div className="flex items-center justify-between text-xs text-muted">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={f.required}
                        onChange={(e) => updateField(f.key, { required: e.target.checked })}
                      />
                      Required
                    </label>
                    <span>{signers.find((s) => s.id === f.signerId)?.label}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <form action={formAction}>
          <input type="hidden" name="templateId" value={templateId} />
          <input type="hidden" name="fields" value={fieldsJson} />
          {state.error ? <p className="mb-2 text-sm text-danger">{state.error}</p> : null}
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Saving…" : "Save fields"}
          </Button>
        </form>
      </div>
    </div>
  );
}
