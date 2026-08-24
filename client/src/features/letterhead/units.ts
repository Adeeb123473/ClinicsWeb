/**
 * Unit conversion for letterhead printing.
 *
 * Every coordinate in a letterhead template is stored in millimetres from the top-left of the
 * physical page, because millimetres are the only unit that survives the trip to a printer.
 *
 * CSS absolute units are defined against a fixed reference of 96 CSS pixels per inch
 * (CSS Values & Units 3, "absolute lengths"), so:
 *
 *     1in = 96px = 25.4mm   =>   1mm = 96/25.4 px ≈ 3.7795px
 *
 * That ratio is fixed by the spec. It is NOT the physical DPI of the screen or of the printer,
 * and it does not change between devices — which is exactly why it is safe to rely on. When a
 * page is printed at Scale 100% with Margins None, the browser maps CSS mm onto physical mm, so
 * an element positioned at 25mm lands 25mm from the paper edge. Any other print scale breaks
 * that mapping proportionally, which is why the print step insists on 100% / no margins.
 */

/** CSS pixels per millimetre. Fixed by the CSS spec at 96dpi, not device-dependent. */
export const PX_PER_MM = 96 / 25.4;

/** Millimetres per CSS pixel. */
export const MM_PER_PX = 25.4 / 96;

export function mmToPx(mm: number): number {
  return mm * PX_PER_MM;
}

export function pxToMm(px: number): number {
  return px * MM_PER_PX;
}

export interface PaperSize {
  widthMm: number;
  heightMm: number;
}

/** The only supported paper size. Pads are scanned to an A4 canvas and printed on A4. */
export const A4: PaperSize = { widthMm: 210, heightMm: 297 };

/**
 * Fixed raster resolution for the dewarped letterhead image. Pinning this — rather than
 * inheriting whatever resolution the upload happened to have — is what makes mmPerPx exact and
 * constant for every template, so field coordinates mean the same thing across doctors.
 */
export const DEWARP_DPI = 200;

/**
 * Output pixel dimensions of the dewarped image.
 *
 * The height is derived from the width and the paper aspect (rather than rounded independently)
 * so that a single mmPerPx describes both axes. A4 at 200dpi gives 1654x2339; the residual
 * error from integer rounding is ~0.04mm over the full height, far below what any printer or
 * hand-placed corner can resolve.
 */
export function dewarpPixelSize(paper: PaperSize = A4): { widthPx: number; heightPx: number } {
  const widthPx = Math.round((paper.widthMm / 25.4) * DEWARP_DPI);
  const heightPx = Math.round(widthPx * (paper.heightMm / paper.widthMm));
  return { widthPx, heightPx };
}

/** Millimetres represented by one pixel of the dewarped image. Exact by construction. */
export function mmPerPxFor(paper: PaperSize = A4): number {
  return paper.widthMm / dewarpPixelSize(paper).widthPx;
}

/** True when a point lies inside the paper. Used to validate stored field coordinates. */
export function isInsidePaper(xMm: number, yMm: number, paper: PaperSize = A4): boolean {
  return xMm >= 0 && yMm >= 0 && xMm <= paper.widthMm && yMm <= paper.heightMm;
}

/**
 * True when a field's box fits entirely within the paper. widthMm is optional because a field
 * with no explicit box is positioned by its origin alone.
 */
export function isBoxInsidePaper(
  xMm: number,
  yMm: number,
  widthMm: number | null | undefined,
  heightMm: number | null | undefined,
  paper: PaperSize = A4,
): boolean {
  if (!isInsidePaper(xMm, yMm, paper)) return false;
  if (widthMm != null && xMm + widthMm > paper.widthMm) return false;
  if (heightMm != null && yMm + heightMm > paper.heightMm) return false;
  return true;
}
