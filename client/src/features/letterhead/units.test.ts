import { describe, expect, it } from "vitest";
import {
  A4,
  DEWARP_DPI,
  MM_PER_PX,
  PX_PER_MM,
  dewarpPixelSize,
  isBoxInsidePaper,
  isInsidePaper,
  mmPerPxFor,
  mmToPx,
  pxToMm,
} from "./units";

describe("mm <-> px conversion", () => {
  it("uses the CSS-spec 96dpi reference, not device DPI", () => {
    // 1in = 96px = 25.4mm is fixed by the CSS spec; these exact numbers are what make a
    // printed page land where the template says it should.
    expect(PX_PER_MM).toBeCloseTo(3.7795275590551185, 12);
    expect(MM_PER_PX).toBeCloseTo(0.26458333333333334, 12);
  });

  it("converts known landmarks exactly", () => {
    expect(mmToPx(25.4)).toBeCloseTo(96, 10); // one inch
    expect(mmToPx(0)).toBe(0);
    expect(pxToMm(96)).toBeCloseTo(25.4, 10);
    expect(mmToPx(210)).toBeCloseTo(793.7007874015748, 9); // A4 width
    expect(mmToPx(297)).toBeCloseTo(1122.5196850393702, 9); // A4 height
  });

  it("round-trips without drift", () => {
    for (const mm of [0, 0.1, 0.5, 1, 12.7, 148, 210, 297]) {
      expect(pxToMm(mmToPx(mm))).toBeCloseTo(mm, 12);
    }
  });
});

describe("dewarp raster size", () => {
  it("produces 1654x2339 for A4 at 200dpi", () => {
    expect(DEWARP_DPI).toBe(200);
    expect(dewarpPixelSize(A4)).toEqual({ widthPx: 1654, heightPx: 2339 });
  });

  it("gives a single mmPerPx that is exact by construction", () => {
    const mmPerPx = mmPerPxFor(A4);
    expect(mmPerPx).toBeCloseTo(210 / 1654, 12);
    // Width is exact by definition...
    expect(1654 * mmPerPx).toBeCloseTo(210, 10);
    // ...and the derived height stays within a small fraction of a millimetre, well under
    // what a printer or a hand-placed corner can resolve.
    expect(2339 * mmPerPx).toBeCloseTo(297, 1);
    expect(Math.abs(2339 * mmPerPx - 297)).toBeLessThan(0.1);
  });
});

describe("paper bounds validation", () => {
  it("accepts points on and inside the page, rejects those outside", () => {
    expect(isInsidePaper(0, 0)).toBe(true);
    expect(isInsidePaper(210, 297)).toBe(true);
    expect(isInsidePaper(105, 148)).toBe(true);
    expect(isInsidePaper(-0.1, 10)).toBe(false);
    expect(isInsidePaper(10, -0.1)).toBe(false);
    expect(isInsidePaper(210.1, 10)).toBe(false);
    expect(isInsidePaper(10, 297.1)).toBe(false);
  });

  it("rejects a box whose extent runs off the page", () => {
    expect(isBoxInsidePaper(150, 10, 60, null)).toBe(true); // 150+60 = 210, exactly flush
    expect(isBoxInsidePaper(150, 10, 61, null)).toBe(false);
    expect(isBoxInsidePaper(10, 280, null, 17)).toBe(true);
    expect(isBoxInsidePaper(10, 280, null, 18)).toBe(false);
    expect(isBoxInsidePaper(10, 10, undefined, undefined)).toBe(true);
  });
});
