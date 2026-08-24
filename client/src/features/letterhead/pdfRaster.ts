/**
 * Rasterises page 1 of an uploaded letterhead PDF.
 *
 * Uploads are PDFs because that is what a phone scanning app (CamScanner and friends) produces,
 * and what admins will actually have to hand. Those apps already remove most of the perspective
 * distortion, so what arrives is close to flat — but the page is fitted onto the scanner's own
 * export canvas, usually A4 regardless of the physical pad, and the crop typically includes some
 * surrounding desk. That is why the corner step still exists: it maps "where the pad actually is
 * in this image" onto the declared paper.
 *
 * pdfjs is loaded dynamically so its worker bundle is only fetched when someone actually opens
 * the letterhead setup modal, rather than on every page load of the app.
 */
import { A4, DEWARP_DPI } from "./units";

export interface RasterisedPdf {
  /** The rendered page as a canvas, ready to be cropped/warped. */
  canvas: HTMLCanvasElement;
  widthPx: number;
  heightPx: number;
  /** Page box in PDF points (1pt = 1/72in), as declared by the file. */
  pageWidthPt: number;
  pageHeightPt: number;
  pageCount: number;
}

/** Points per inch in PDF's user-space unit. */
const PT_PER_INCH = 72;

/**
 * Page size in millimetres as declared by the PDF.
 *
 * Useful as a sanity signal, but deliberately NOT used as the paper size: a phone scanner
 * exports to its own canvas (typically A4) whatever the physical pad measured, so this number
 * describes the export, not the pad.
 */
export function pageSizeMm(pageWidthPt: number, pageHeightPt: number): { widthMm: number; heightMm: number } {
  return {
    widthMm: (pageWidthPt / PT_PER_INCH) * 25.4,
    heightMm: (pageHeightPt / PT_PER_INCH) * 25.4,
  };
}

/** True when the declared page is A4 within a millimetre of tolerance. */
export function isA4Page(pageWidthPt: number, pageHeightPt: number): boolean {
  const { widthMm, heightMm } = pageSizeMm(pageWidthPt, pageHeightPt);
  return Math.abs(widthMm - A4.widthMm) < 1 && Math.abs(heightMm - A4.heightMm) < 1;
}

/**
 * The scale to hand pdfjs so the rendered page comes out at the given DPI.
 * pdfjs viewports are in points, so scale = dpi / 72.
 */
export function scaleForDpi(dpi: number = DEWARP_DPI): number {
  return dpi / PT_PER_INCH;
}

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const lib = await import("pdfjs-dist");
      // The `?url` suffix is Vite's documented way to get a bundled asset URL for the worker.
      // `new URL("pdfjs-dist/...", import.meta.url)` does NOT work here: Vite only rewrites
      // that pattern for relative specifiers, so a bare package specifier silently resolves to
      // a path that 404s and pdfjs then hangs waiting for a worker that never starts.
      const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      lib.GlobalWorkerOptions.workerSrc = workerUrl;
      return lib;
    })();
  }
  return pdfjsPromise;
}

/**
 * Renders page 1 of `file` to a canvas at roughly `dpi`.
 *
 * Rendering above the source scan's own resolution buys nothing, but rendering below it throws
 * away detail that the corner step needs, so 200dpi (the same resolution the dewarped output is
 * fixed at) is the sensible default.
 */
export async function rasterisePdfFirstPage(file: Blob, dpi: number = DEWARP_DPI): Promise<RasterisedPdf> {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  // destroy() lives on the loading task, not on the resolved document, so keep the task.
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;

  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: scaleForDpi(dpi) });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create a canvas context to render the PDF");

    // Scans are opaque, but a PDF page is transparent by default — without this, any
    // unpainted area would warp into black rather than white paper.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // pdfjs v4 renders into a 2D context; `canvas` is not part of its RenderParameters.
    await page.render({ canvasContext: ctx, viewport }).promise;

    return {
      canvas,
      widthPx: canvas.width,
      heightPx: canvas.height,
      pageWidthPt: base.width,
      pageHeightPt: base.height,
      pageCount: doc.numPages,
    };
  } finally {
    // Releasing the worker is best-effort. A throw here would propagate out of `finally` and
    // replace an already-successful render with a failure, which is exactly the kind of bug
    // that makes a working pipeline look broken.
    try {
      void loadingTask.destroy();
    } catch {
      /* the page is already rendered; a failed teardown must not fail the upload */
    }
  }
}
