/**
 * Perspective (projective) geometry for rectifying a scanned letterhead.
 *
 * The scanning app usually removes most perspective already, so in practice this is doing a
 * crop-and-square-up rather than a dramatic warp — but the same transform covers both cases,
 * so there is one code path regardless of how skewed the input is.
 *
 * Deliberately dependency-free: this is the piece the whole feature's accuracy rests on, so it
 * is plain arithmetic that can be unit-tested in isolation rather than a call into a 8MB
 * computer-vision bundle.
 */

export interface Point {
  x: number;
  y: number;
}

/** Row-major 3x3 projective transform. h[8] is normalised to 1. */
export type Homography = number[];

/**
 * Solves the 3x3 homography H mapping four source points onto four destination points.
 *
 * For each correspondence (x,y) -> (u,v), with H normalised so h8 = 1:
 *
 *     u = (h0·x + h1·y + h2) / (h6·x + h7·y + 1)
 *     v = (h3·x + h4·y + h5) / (h6·x + h7·y + 1)
 *
 * Multiplying out the denominator gives two linear equations per point:
 *
 *     h0·x + h1·y + h2                       − h6·x·u − h7·y·u = u
 *                       h3·x + h4·y + h5     − h6·x·v − h7·y·v = v
 *
 * Four correspondences therefore give 8 equations in the 8 unknowns h0..h7, which we solve by
 * Gaussian elimination with partial pivoting.
 *
 * @throws if the correspondences are degenerate (three collinear points, duplicate corners).
 */
export function solveHomography(src: Point[], dst: Point[]): Homography {
  if (src.length !== 4 || dst.length !== 4) {
    throw new Error("solveHomography requires exactly 4 source and 4 destination points");
  }

  // Augmented 8x9 matrix: 8 coefficients + RHS.
  const m: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    m.push([x, y, 1, 0, 0, 0, -x * u, -y * u, u]);
    m.push([0, 0, 0, x, y, 1, -x * v, -y * v, v]);
  }

  // Gaussian elimination with partial pivoting.
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let r = col + 1; r < 8; r++) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    }
    if (Math.abs(m[pivot][col]) < 1e-12) {
      throw new Error("Degenerate corner points: cannot solve a perspective transform");
    }
    if (pivot !== col) {
      const t = m[pivot];
      m[pivot] = m[col];
      m[col] = t;
    }

    const p = m[col][col];
    for (let c = col; c < 9; c++) m[col][c] /= p;

    for (let r = 0; r < 8; r++) {
      if (r === col) continue;
      const f = m[r][col];
      if (f === 0) continue;
      for (let c = col; c < 9; c++) m[r][c] -= f * m[col][c];
    }
  }

  const h = m.map((row) => row[8]);
  h.push(1);
  return h;
}

/** Applies a homography to a single point. */
export function applyHomography(h: Homography, p: Point): Point {
  const denom = h[6] * p.x + h[7] * p.y + h[8];
  return {
    x: (h[0] * p.x + h[1] * p.y + h[2]) / denom,
    y: (h[3] * p.x + h[4] * p.y + h[5]) / denom,
  };
}

/** The destination rectangle corners, in the order corner points are stored: TL, TR, BR, BL. */
export function rectCorners(widthPx: number, heightPx: number): Point[] {
  return [
    { x: 0, y: 0 },
    { x: widthPx, y: 0 },
    { x: widthPx, y: heightPx },
    { x: 0, y: heightPx },
  ];
}

/** Minimal structural view of ImageData, so warping is testable without a DOM. */
export interface RasterImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

function sampleBilinear(img: RasterImage, x: number, y: number, out: Uint8ClampedArray, o: number): void {
  // Clamp to the edge rather than returning transparent, so rounding at the border does not
  // punch black lines into the rectified page.
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;

  const cx0 = Math.min(Math.max(x0, 0), img.width - 1);
  const cy0 = Math.min(Math.max(y0, 0), img.height - 1);
  const cx1 = Math.min(cx0 + 1, img.width - 1);
  const cy1 = Math.min(cy0 + 1, img.height - 1);

  for (let ch = 0; ch < 4; ch++) {
    const p00 = img.data[(cy0 * img.width + cx0) * 4 + ch];
    const p10 = img.data[(cy0 * img.width + cx1) * 4 + ch];
    const p01 = img.data[(cy1 * img.width + cx0) * 4 + ch];
    const p11 = img.data[(cy1 * img.width + cx1) * 4 + ch];
    const top = p00 + (p10 - p00) * fx;
    const bottom = p01 + (p11 - p01) * fx;
    out[o + ch] = top + (bottom - top) * fy;
  }
}

/**
 * Rectifies the quadrilateral `srcCorners` (TL, TR, BR, BL in source-image pixels) onto a
 * `outWidth` x `outHeight` rectangle.
 *
 * Works by inverse mapping: for each destination pixel we ask the destination->source
 * homography where it came from, then bilinearly sample there. Inverse mapping is what
 * guarantees every output pixel is written exactly once, with no gaps or overdraw.
 */
export function warpPerspective(
  img: RasterImage,
  srcCorners: Point[],
  outWidth: number,
  outHeight: number,
): RasterImage {
  // Solve destination -> source directly; no matrix inversion needed.
  const inverse = solveHomography(rectCorners(outWidth, outHeight), srcCorners);
  const out = new Uint8ClampedArray(outWidth * outHeight * 4);

  for (let y = 0; y < outHeight; y++) {
    for (let x = 0; x < outWidth; x++) {
      const denom = inverse[6] * x + inverse[7] * y + inverse[8];
      const sx = (inverse[0] * x + inverse[1] * y + inverse[2]) / denom;
      const sy = (inverse[3] * x + inverse[4] * y + inverse[5]) / denom;
      sampleBilinear(img, sx, sy, out, (y * outWidth + x) * 4);
    }
  }

  return { data: out, width: outWidth, height: outHeight };
}
