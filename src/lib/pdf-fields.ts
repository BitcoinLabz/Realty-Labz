export type FieldRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Converts a field's normalized rectangle (fractions 0-1 of page size,
 * top-left origin — how fields are stored and rendered on screen) into PDF
 * point-space (bottom-left origin — how pdf-lib draws). pageWidth/pageHeight
 * are in PDF points, from `page.getSize()`.
 *
 * Hand-verified against three cases before any UI was built on top of this:
 * a field near the top of a 612x792 (US Letter) page, one flush against the
 * very top edge, and one flush against the very bottom edge all produced the
 * expected bottom-left draw coordinates.
 */
export function fieldRectToPdfPoints(rect: FieldRect, pageWidth: number, pageHeight: number) {
  const widthPts = rect.width * pageWidth;
  const heightPts = rect.height * pageHeight;
  const xPts = rect.x * pageWidth;
  const yPts = pageHeight - rect.y * pageHeight - heightPts;
  return { x: xPts, y: yPts, width: widthPts, height: heightPts };
}

/** A font size that comfortably fits a field's height, capped to a sane range. */
export function fontSizeForFieldHeight(heightPts: number) {
  return Math.max(7, Math.min(14, heightPts * 0.6));
}

/**
 * The exact inverse of fieldRectToPdfPoints -- PDF point space (bottom-left
 * origin, what pdf-lib reports for an AcroForm widget) back into the
 * normalized top-left fractions this app stores and renders.
 *
 * Used when importing the fields a fillable PDF already carries, so an agent
 * doesn't hand-place forty boxes that the file already describes.
 *
 * Round-trip tested against fieldRectToPdfPoints rather than only against
 * hand-derived numbers: if either direction is ever changed, a mismatch fails
 * immediately instead of quietly shifting every imported field.
 */
export function pdfPointsToFieldRect(
  rect: FieldRect,
  pageWidth: number,
  pageHeight: number,
): FieldRect {
  return {
    x: rect.x / pageWidth,
    y: (pageHeight - rect.y - rect.height) / pageHeight,
    width: rect.width / pageWidth,
    height: rect.height / pageHeight,
  };
}
