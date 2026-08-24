/**
 * Cleanup for the dewarped letterhead image.
 *
 * Phone scans of a pad on a desk pick up a colour cast from indoor lighting (usually warm or
 * green), uneven exposure, and low contrast. None of that matters in OVERLAY mode, where the
 * image is only an alignment backdrop — but in FULL mode the image is physically printed, so it
 * is worth offering. Kept optional and non-destructive: the caller keeps the original pixels and
 * can toggle back.
 */

export interface CleanupOptions {
  /** Auto white balance + contrast normalisation. */
  enhance: boolean;
  /** Convert to grayscale — often the best choice for printing a scanned letterhead. */
  grayscale: boolean;
}

export const DEFAULT_CLEANUP: CleanupOptions = { enhance: false, grayscale: false };

/**
 * Grey-world white balance: assume the average of the image should be neutral grey, and scale
 * each channel toward that. Cheap, no parameters, and effective on a photo of white paper
 * because the subject genuinely is mostly neutral.
 */
function whiteBalance(data: Uint8ClampedArray): void {
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  const n = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    rSum += data[i];
    gSum += data[i + 1];
    bSum += data[i + 2];
  }
  const rAvg = rSum / n;
  const gAvg = gSum / n;
  const bAvg = bSum / n;
  const grey = (rAvg + gAvg + bAvg) / 3;
  if (rAvg === 0 || gAvg === 0 || bAvg === 0) return;

  const rGain = grey / rAvg;
  const gGain = grey / gAvg;
  const bGain = grey / bAvg;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i] * rGain;
    data[i + 1] = data[i + 1] * gGain;
    data[i + 2] = data[i + 2] * bGain;
  }
}

/**
 * Contrast normalisation by percentile stretch. Uses the 2nd/98th percentiles rather than the
 * absolute min/max so a single dark speck or a blown highlight cannot flatten the whole image.
 */
function normaliseContrast(data: Uint8ClampedArray): void {
  const hist = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) {
    const lum = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
    hist[Math.round(lum)]++;
  }
  const total = data.length / 4;
  const lowCut = total * 0.02;
  const highCut = total * 0.98;

  let cum = 0;
  let low = 0;
  let high = 255;
  for (let v = 0; v < 256; v++) {
    cum += hist[v];
    if (cum >= lowCut) {
      low = v;
      break;
    }
  }
  cum = 0;
  for (let v = 0; v < 256; v++) {
    cum += hist[v];
    if (cum >= highCut) {
      high = v;
      break;
    }
  }
  if (high <= low) return;

  const scale = 255 / (high - low);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = (data[i] - low) * scale;
    data[i + 1] = (data[i + 1] - low) * scale;
    data[i + 2] = (data[i + 2] - low) * scale;
  }
}

function toGrayscale(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const lum = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
    data[i] = lum;
    data[i + 1] = lum;
    data[i + 2] = lum;
  }
}

/** Applies the selected cleanup to a copy of the pixels, leaving the input untouched. */
export function applyCleanup(
  source: { data: Uint8ClampedArray; width: number; height: number },
  options: CleanupOptions,
): { data: Uint8ClampedArray; width: number; height: number } {
  const data = new Uint8ClampedArray(source.data);
  if (options.enhance) {
    whiteBalance(data);
    normaliseContrast(data);
  }
  if (options.grayscale) toGrayscale(data);
  return { data, width: source.width, height: source.height };
}
