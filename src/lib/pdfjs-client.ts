"use client";

// Client-only pdfjs-dist setup — imported by both the designer and the
// public fill page, the two places that render a PDF to <canvas>. The
// worker file needs to be resolvable as a static asset by the bundler; the
// `new URL(..., import.meta.url)` form is the standard pattern pdfjs-dist's
// own docs recommend for webpack-family bundlers, which is what Turbopack
// aims to be compatible with here too. Verified directly in a real browser
// before any field-placement UI was built on top of it.
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export { pdfjsLib };
