"use client";

import { useEffect, useRef, useState } from "react";
import { pdfjsLib } from "@/lib/pdfjs-client";
import type { PDFDocumentProxy } from "pdfjs-dist";

export function usePdfDocument(url: string) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadingTask = pdfjsLib.getDocument({ url });
    loadingTask.promise
      .then((doc) => {
        if (cancelled) return;
        setPdf(doc);
        setNumPages(doc.numPages);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load PDF");
      });
    return () => {
      cancelled = true;
      loadingTask.destroy();
    };
  }, [url]);

  return { pdf, numPages, error };
}

/**
 * Renders one page of an already-loaded PDF document to a <canvas> at the
 * given target width (aspect ratio preserved). Reports the actual rendered
 * pixel size via onRendered so callers can size an absolutely-positioned
 * overlay to match exactly.
 *
 * pageNumber is 1-indexed (pdfjs's own convention) — FormField.page is
 * stored 0-indexed in the database (matching pdf-lib's page array), so
 * callers add 1 when passing a field's page number in here. Keep that
 * conversion at the call site, not in this shared component.
 */
export function PdfPageCanvas({
  pdf,
  pageNumber,
  width,
  onRendered,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  width: number;
  onRendered?: (size: { width: number; height: number }) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]> | null = null;

    pdf.getPage(pageNumber).then((page) => {
      if (cancelled) return;
      const unscaledViewport = page.getViewport({ scale: 1 });
      const scale = width / unscaledViewport.width;
      const viewport = page.getViewport({ scale });

      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      renderTask = page.render({ canvas, viewport });
      renderTask.promise
        .then(() => {
          if (!cancelled) onRendered?.({ width: viewport.width, height: viewport.height });
        })
        .catch(() => {
          // Cancelled renders reject — expected on rapid unmount/prop change.
        });
    });

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf, pageNumber, width]);

  return <canvas ref={canvasRef} className="block w-full" />;
}
