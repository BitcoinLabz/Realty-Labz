import { describe, expect, it } from "vitest";
import { fieldRectToPdfPoints, fontSizeForFieldHeight } from "./pdf-fields";

// US Letter in PDF points, matching the three cases fieldRectToPdfPoints's
// own doc comment says were hand-verified before any UI was built on top of
// it — this test just captures that verification permanently instead of
// letting it live only as a one-time manual check. This is directly in
// service of this project's own #1 flagged competitor pain point ("buggy
// text box / signature field behavior") — a regression here is exactly that
// bug.
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;

describe("fieldRectToPdfPoints", () => {
  it("converts a field near the top of the page", () => {
    // 10% from the left, 10% from the top, 30% wide, 5% tall.
    const result = fieldRectToPdfPoints(
      { x: 0.1, y: 0.1, width: 0.3, height: 0.05 },
      PAGE_WIDTH,
      PAGE_HEIGHT,
    );
    expect(result.x).toBeCloseTo(61.2, 5);
    expect(result.width).toBeCloseTo(183.6, 5);
    expect(result.height).toBeCloseTo(39.6, 5);
    // y = pageHeight - (y * pageHeight) - heightPts = 792 - 79.2 - 39.6
    expect(result.y).toBeCloseTo(673.2, 5);
  });

  it("converts a field flush against the very top edge (y=0)", () => {
    const result = fieldRectToPdfPoints({ x: 0, y: 0, width: 0.2, height: 0.05 }, PAGE_WIDTH, PAGE_HEIGHT);
    const heightPts = 0.05 * PAGE_HEIGHT;
    // Flush to the top means the draw origin sits exactly one field-height
    // down from the page's full height, in bottom-left-origin space.
    expect(result.y).toBeCloseTo(PAGE_HEIGHT - heightPts, 5);
    expect(result.y + result.height).toBeCloseTo(PAGE_HEIGHT, 5);
  });

  it("converts a field flush against the very bottom edge", () => {
    const height = 0.05;
    const result = fieldRectToPdfPoints(
      { x: 0, y: 1 - height, width: 0.2, height },
      PAGE_WIDTH,
      PAGE_HEIGHT,
    );
    // Flush to the bottom means the draw origin sits at y=0 in PDF space.
    expect(result.y).toBeCloseTo(0, 5);
  });

  it("keeps a full-height field within [0, pageHeight] (round-trip boundary check)", () => {
    const result = fieldRectToPdfPoints({ x: 0, y: 0, width: 1, height: 1 }, PAGE_WIDTH, PAGE_HEIGHT);
    expect(result.y).toBeCloseTo(0, 5);
    expect(result.y + result.height).toBeCloseTo(PAGE_HEIGHT, 5);
    expect(result.width).toBeCloseTo(PAGE_WIDTH, 5);
  });
});

describe("fontSizeForFieldHeight", () => {
  it("clamps to a minimum of 7 for a tiny field", () => {
    expect(fontSizeForFieldHeight(1)).toBe(7);
  });

  it("clamps to a maximum of 14 for a huge field", () => {
    expect(fontSizeForFieldHeight(1000)).toBe(14);
  });

  it("scales at 60% of height in the middle of the range", () => {
    expect(fontSizeForFieldHeight(15)).toBeCloseTo(9, 5);
  });
});
