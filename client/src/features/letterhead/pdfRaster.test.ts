import { describe, expect, it } from "vitest";
import { isA4Page, pageSizeMm, scaleForDpi } from "./pdfRaster";

describe("PDF page geometry", () => {
  it("converts PDF points to millimetres", () => {
    // A4 in PDF points, as emitted by every scanner app we have seen.
    const a4 = pageSizeMm(595.276, 841.89);
    expect(a4.widthMm).toBeCloseTo(210, 1);
    expect(a4.heightMm).toBeCloseTo(297, 1);

    // 72pt = 1in = 25.4mm
    expect(pageSizeMm(72, 72).widthMm).toBeCloseTo(25.4, 6);
  });

  it("recognises A4 pages, including the rounded 595x842 that scanners emit", () => {
    expect(isA4Page(595.276, 841.89)).toBe(true);
    expect(isA4Page(595, 842)).toBe(true);
    expect(isA4Page(612, 792)).toBe(false); // US Letter
    expect(isA4Page(420, 595)).toBe(false); // A5
  });

  it("derives the pdfjs render scale from a target DPI", () => {
    // pdfjs viewports are in points, so scale = dpi / 72.
    expect(scaleForDpi(72)).toBeCloseTo(1, 10);
    expect(scaleForDpi(200)).toBeCloseTo(2.7777777, 6);
    expect(scaleForDpi(144)).toBeCloseTo(2, 10);
  });

  it("renders an A4 page at 200dpi to approximately the fixed dewarp raster size", () => {
    // 595.276pt * (200/72) = 1653.5px wide, matching the 1654x2339 dewarp target.
    const scale = scaleForDpi(200);
    expect(Math.round(595.276 * scale)).toBe(1654);
    expect(Math.round(841.89 * scale)).toBe(2339);
  });
});
