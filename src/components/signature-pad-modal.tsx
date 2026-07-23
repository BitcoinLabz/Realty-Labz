"use client";

import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";

export function SignaturePadModal({
  label,
  onConfirm,
  onClose,
}: {
  label: string;
  onConfirm: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const padRef = useRef<SignatureCanvas>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-lg">
        <h3 className="mb-1 text-base font-semibold text-foreground">{label}</h3>
        <p className="mb-4 text-sm text-muted">Draw your signature below using your mouse or finger.</p>

        <div className="overflow-hidden rounded-xl border border-border bg-white">
          <SignatureCanvas
            ref={padRef}
            penColor="#1d1d1f"
            canvasProps={{ width: 420, height: 160, className: "block w-full touch-none" }}
            onEnd={() => setIsEmpty(padRef.current?.isEmpty() ?? true)}
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              padRef.current?.clear();
              setIsEmpty(true);
            }}
            className="text-sm font-medium text-muted hover:text-foreground"
          >
            Clear
          </button>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isEmpty}
              onClick={() => {
                const pad = padRef.current;
                if (!pad || pad.isEmpty()) return;
                const dataUrl = pad.getTrimmedCanvas().toDataURL("image/png");
                onConfirm(dataUrl);
              }}
            >
              Use this signature
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
