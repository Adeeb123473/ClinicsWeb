import { describe, expect, it } from "vitest";
import {
  applyHomography,
  rectCorners,
  solveHomography,
  warpPerspective,
  type Point,
  type RasterImage,
} from "./geometry";

const near = (a: Point, b: Point, digits = 6) => {
  expect(a.x).toBeCloseTo(b.x, digits);
  expect(a.y).toBeCloseTo(b.y, digits);
};

describe("solveHomography", () => {
  it("maps a known skewed quadrilateral onto known rectangle coordinates", () => {
    // A page photographed at an angle: corners TL, TR, BR, BL in source-image pixels.
    const quad: Point[] = [
      { x: 100, y: 60 },
      { x: 900, y: 140 },
      { x: 840, y: 1180 },
      { x: 60, y: 1020 },
    ];
    const rect = rectCorners(1654, 2339);
    const h = solveHomography(quad, rect);

    // Each source corner must land exactly on its destination corner.
    near(applyHomography(h, quad[0]), { x: 0, y: 0 });
    near(applyHomography(h, quad[1]), { x: 1654, y: 0 });
    near(applyHomography(h, quad[2]), { x: 1654, y: 2339 });
    near(applyHomography(h, quad[3]), { x: 0, y: 2339 });
  });

  it("recovers an exact identity for a rectangle mapped onto itself", () => {
    const rect = rectCorners(200, 100);
    const h = solveHomography(rect, rect);
    for (const p of [...rect, { x: 37, y: 61 }, { x: 199, y: 1 }]) {
      near(applyHomography(h, p), p);
    }
  });

  it("handles a pure translation and scale", () => {
    const src: Point[] = [
      { x: 10, y: 10 },
      { x: 110, y: 10 },
      { x: 110, y: 60 },
      { x: 10, y: 60 },
    ];
    const h = solveHomography(src, rectCorners(200, 100));
    near(applyHomography(h, { x: 60, y: 35 }), { x: 100, y: 50 }); // centre -> centre
  });

  it("preserves straight lines (the defining property of a projective map)", () => {
    const quad: Point[] = [
      { x: 100, y: 60 },
      { x: 900, y: 140 },
      { x: 840, y: 1180 },
      { x: 60, y: 1020 },
    ];
    const h = solveHomography(quad, rectCorners(1000, 1400));
    // Three collinear source points must stay collinear after the transform.
    const a = applyHomography(h, { x: 100, y: 60 });
    const b = applyHomography(h, { x: 500, y: 100 });
    const c = applyHomography(h, { x: 900, y: 140 });
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    expect(Math.abs(cross)).toBeLessThan(1e-6);
  });

  it("rejects degenerate corners instead of returning silent nonsense", () => {
    const collinear: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 30, y: 0 },
    ];
    expect(() => solveHomography(collinear, rectCorners(100, 100))).toThrow(/degenerate/i);
    expect(() => solveHomography([{ x: 0, y: 0 }], rectCorners(10, 10))).toThrow(/exactly 4/i);
  });
});

describe("warpPerspective", () => {
  /** Solid-colour quadrants, so we can assert which region each output pixel came from. */
  function quadrantImage(size: number): RasterImage {
    const data = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const o = (y * size + x) * 4;
        const left = x < size / 2;
        const top = y < size / 2;
        data[o] = top && left ? 255 : 0; // R: top-left
        data[o + 1] = top && !left ? 255 : 0; // G: top-right
        data[o + 2] = !top && left ? 255 : 0; // B: bottom-left
        data[o + 3] = 255;
      }
    }
    return { data, width: size, height: size };
  }

  it("maps an axis-aligned crop to the output rectangle", () => {
    const img = quadrantImage(100);
    // Crop exactly the top-left red quadrant.
    const out = warpPerspective(
      img,
      [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 50 },
        { x: 0, y: 50 },
      ],
      20,
      20,
    );
    expect(out.width).toBe(20);
    expect(out.height).toBe(20);
    const centre = ((10 * 20) + 10) * 4;
    expect(out.data[centre]).toBeGreaterThan(200); // red
    expect(out.data[centre + 1]).toBeLessThan(60);
  });

  it("keeps the quadrant layout when rectifying the whole image", () => {
    const img = quadrantImage(100);
    const out = warpPerspective(
      img,
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
      40,
      40,
    );
    const at = (x: number, y: number, ch: number) => out.data[(y * 40 + x) * 4 + ch];
    expect(at(10, 10, 0)).toBeGreaterThan(200); // top-left still red
    expect(at(30, 10, 1)).toBeGreaterThan(200); // top-right still green
    expect(at(10, 30, 2)).toBeGreaterThan(200); // bottom-left still blue
  });

  it("writes every output pixel (inverse mapping leaves no gaps)", () => {
    const img = quadrantImage(64);
    const out = warpPerspective(
      img,
      [
        { x: 5, y: 3 },
        { x: 60, y: 8 },
        { x: 58, y: 61 },
        { x: 2, y: 55 },
      ],
      37,
      53,
    );
    expect(out.data).toHaveLength(37 * 53 * 4);
    for (let i = 3; i < out.data.length; i += 4) {
      expect(out.data[i]).toBe(255); // alpha written everywhere
    }
  });
});
