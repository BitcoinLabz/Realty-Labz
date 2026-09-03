import { describe, expect, it } from "vitest";
import { fieldRectToPdfPoints, pdfPointsToFieldRect, type FieldRect } from "./pdf-fields";

// US Letter, the size essentially every real estate form uses.
const W = 612;
const H = 792;

describe("pdfPointsToFieldRect", () => {
  it("round-trips with fieldRectToPdfPoints", () => {
    const cases: FieldRect[] = [
      { x: 0.1, y: 0.1, width: 0.3, height: 0.05 },
      { x: 0, y: 0, width: 1, height: 1 },
      { x: 0.5, y: 0.95, width: 0.4, height: 0.05 },
      { x: 0.72, y: 0.33, width: 0.08, height: 0.02 },
    ];

    for (const original of cases) {
      const points = fieldRectToPdfPoints(original, W, H);
      const back = pdfPointsToFieldRect(points, W, H);
      expect(back.x).toBeCloseTo(original.x, 10);
      expect(back.y).toBeCloseTo(original.y, 10);
      expect(back.width).toBeCloseTo(original.width, 10);
      expect(back.height).toBeCloseTo(original.height, 10);
    }
  });

  // Hand-derived, not just round-tripped -- a pair of mutually-inverse but
  // both-wrong functions would round-trip perfectly and still misplace every
  // field on the page.
  it("puts a widget at the bottom-left of the page at the bottom-left in fractions", () => {
    const rect = pdfPointsToFieldRect({ x: 0, y: 0, width: 612, height: 79.2 }, W, H);
    expect(rect.x).toBeCloseTo(0, 10);
    expect(rect.y).toBeCloseTo(0.9, 10); // top-left origin: bottom of page is y=0.9..1.0
    expect(rect.width).toBeCloseTo(1, 10);
    expect(rect.height).toBeCloseTo(0.1, 10);
  });

  it("puts a widget at the top-left of the page at y=0", () => {
    const rect = pdfPointsToFieldRect({ x: 0, y: 712.8, width: 306, height: 79.2 }, W, H);
    expect(rect.x).toBeCloseTo(0, 10);
    expect(rect.y).toBeCloseTo(0, 10);
    expect(rect.width).toBeCloseTo(0.5, 10);
  });
});
