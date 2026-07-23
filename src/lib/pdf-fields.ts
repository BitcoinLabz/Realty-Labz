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
