/**
 * A4 print output for letterheads and for the calibration sheet.
 *
 * Follows the same isolated-print-window approach as utils/print.ts: we open a blank window and
 * write a self-contained document into it. That matters more here than anywhere else in the app
 * — in OVERLAY mode the printed page must contain *nothing* except the field values, and the
 * surest way to guarantee that is to print a document that never contained the app in the first
 * place. There is no app chrome to suppress because there is no app.
 *
 * Positioning is absolute and in millimetres. See units.ts for why CSS mm maps to physical mm.
 */
import { A4 } from "../features/letterhead/units";

export interface AbsBox {
  xMm: number;
  yMm: number;
  widthMm?: number | null;
  heightMm?: number | null;
}

/** Inline style for an absolutely positioned, millimetre-placed box. */
export function absMm(box: AbsBox): string {
  const parts = [`position:absolute`, `left:${box.xMm}mm`, `top:${box.yMm}mm`];
  if (box.widthMm != null) parts.push(`width:${box.widthMm}mm`);
  if (box.heightMm != null) parts.push(`height:${box.heightMm}mm`);
  return parts.join(";");
}

export function escapeHtml(v: string | number | null | undefined): string {
  return String(v ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
  );
}

/**
 * The print dialog settings the user must set for millimetre positioning to hold. Surfaced in
 * the UI as well as here, because misconfigured print settings are the most common cause of
 * "the text is in the wrong place" — a page printed at "Fit to page" is silently scaled by a
 * few percent, which at the bottom of an A4 sheet is several millimetres of drift.
 */
export const PRINT_SETTINGS_HELP = [
  "Scale: 100% (not “Fit to page” or “Shrink to fit”)",
  "Margins: None",
  "Headers and footers: off",
  "Paper size: A4",
] as const;

/**
 * Opens a print window containing exactly `bodyHtml` on a single A4 page.
 *
 * `@page { size: A4; margin: 0 }` removes the browser's own printable-area margin so that
 * 0mm in our coordinate system is the physical corner of the sheet.
 */
export function printA4Html(title: string, bodyHtml: string, extraCss = ""): boolean {
  const win = window.open("", "_blank", "width=900,height=1000");
  // A blocked popup is the one failure a user cannot diagnose — printing just does nothing —
  // so report it rather than returning silently.
  if (!win) return false;

  win.document.write(`<!doctype html>
<html>
<head>
<title>${escapeHtml(title)}</title>
<meta charset="utf-8" />
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    width: ${A4.widthMm}mm; height: ${A4.heightMm}mm;
    background: #fff; color: #000;
    font-family: Arial, Helvetica, sans-serif;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .page { position: relative; width: ${A4.widthMm}mm; height: ${A4.heightMm}mm; overflow: hidden; }
  ${extraCss}
</style>
</head>
<body><div class="page">${bodyHtml}</div></body>
</html>`);
  win.document.close();
  win.focus();

  // Wait for images to finish decoding before printing. A fixed delay is not enough: a
  // full-page letterhead is around a megabyte, and printing before it decodes yields a page
  // with the fields but no letterhead. Falls back to a timeout so a stuck image cannot leave
  // the user staring at a print window that never opens the dialog.
  const images = Array.from(win.document.images);
  const decoded = Promise.all(
    images.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          }),
    ),
  );
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 5000));

  void Promise.race([decoded, timeout]).then(() => {
    // A short beat after decode so layout settles before the print dialog snapshots the page.
    setTimeout(() => win.print(), 150);
  });
  return true;
}
