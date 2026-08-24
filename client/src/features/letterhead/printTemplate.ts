/**
 * Builds the printable page for a letterhead template.
 *
 * OVERLAY: the doctor's pad is already printed, so the page contains ONLY the positioned field
 * values — no header, no footer, no borders, and never the uploaded image. That last point is
 * the whole reason the backdrop is kept separate from the print path: the stored image exists to
 * align the editor, and must not reach the printer.
 *
 * FULL: the same field values, over the dewarped image rendered as a full-page background.
 */
import { absMm, escapeHtml, printA4Html } from "../../utils/printLetterhead";
import { composeFields, offsetPosition, paginateBody, type FieldValues, type LetterheadField } from "./fields";
import { fetchImageDataUrl, needsInlining } from "./letterheadApi";
import { A4 } from "./units";

export interface LetterheadTemplate {
  mode: "OVERLAY" | "FULL";
  globalOffsetMm: { x: number; y: number };
  status: "DRAFT" | "CALIBRATED";
  fields: LetterheadField[];
  letterheadImageUrl?: string | null;
}

function fieldHtml(field: LetterheadField, text: string, offset: { x: number; y: number }): string {
  const { xMm, yMm } = offsetPosition(field, offset);
  const style = [
    absMm({ xMm, yMm, widthMm: field.widthMm ?? undefined }),
    `font-family:${field.fontFamily || "Arial"}, sans-serif`,
    `font-size:${field.fontSizePt ?? 11}pt`,
    `font-weight:${field.fontWeight ?? "normal"}`,
    `text-align:${field.align ?? "left"}`,
    // Line height 1 keeps the text's visual top at yMm, so the coordinate means what the
    // editor showed rather than drifting by half a line.
    "line-height:1",
    "white-space:pre-wrap",
    "color:#000",
  ].join(";");
  return `<div style="${style}">${escapeHtml(text)}</div>`;
}

function bodyBoxHtml(field: LetterheadField, text: string, offset: { x: number; y: number }): string[] {
  const widthMm = field.widthMm ?? A4.widthMm - field.xMm - 10;
  const heightMm = field.heightMm ?? A4.heightMm - field.yMm - 15;
  const pages = paginateBody(text, {
    widthMm,
    heightMm,
    fontSizePt: field.fontSizePt ?? 11,
  });
  const { xMm, yMm } = offsetPosition(field, offset);

  return pages.map((pageText) => {
    const style = [
      absMm({ xMm, yMm, widthMm, heightMm }),
      `font-family:${field.fontFamily || "Arial"}, sans-serif`,
      `font-size:${field.fontSizePt ?? 11}pt`,
      `font-weight:${field.fontWeight ?? "normal"}`,
      `text-align:${field.align ?? "left"}`,
      "line-height:1.35",
      "white-space:pre-wrap",
      "overflow:hidden",
      "color:#000",
    ].join(";");
    return `<div style="${style}">${escapeHtml(pageText)}</div>`;
  });
}

/**
 * Renders one or more A4 pages of HTML for the template.
 *
 * Returns an array so a long consultation body can overflow onto a second sheet; each entry is
 * the inner HTML of one page.
 */
export function renderTemplatePages(
  template: LetterheadTemplate,
  values: FieldValues,
): string[] {
  const offset = template.globalOffsetMm ?? { x: 0, y: 0 };

  // consultationBody is laid out separately because it is the only field that wraps and can
  // span pages; everything else is a single line placed in a blank.
  const bodyField = template.fields.find((f) => f.key === "consultationBody" && f.visible !== false);
  const headerFields = template.fields.filter((f) => f.key !== "consultationBody");

  const headerHtml = composeFields(headerFields, values)
    .map((r) => fieldHtml(r.field, r.text, offset))
    .join("");

  const bodyPages = bodyField
    ? bodyBoxHtml(bodyField, String(values.consultationBody ?? ""), offset)
    : [];

  const background =
    template.mode === "FULL" && template.letterheadImageUrl
      ? `<img src="${escapeHtml(template.letterheadImageUrl)}" style="${absMm({
          xMm: 0,
          yMm: 0,
          widthMm: A4.widthMm,
          heightMm: A4.heightMm,
        })};object-fit:fill" />`
      : "";

  if (bodyPages.length <= 1) {
    return [`${background}${headerHtml}${bodyPages[0] ?? ""}`];
  }

  // Header fields repeat on continuation sheets so a loose second page is still identifiable.
  return bodyPages.map((page) => `${background}${headerHtml}${page}`);
}

export interface PrintResult {
  ok: boolean;
  /** Set when the print window could not be opened, almost always a popup blocker. */
  reason?: "popup-blocked";
}

/**
 * Prints the template.
 *
 * In FULL mode the letterhead image is inlined as a data URL first: the stored value is an
 * authenticated API path, which a print window cannot load (wrong origin, and an <img> sends no
 * Authorization header) and which silently renders as a broken-image placeholder. Resolving it
 * here rather than in each caller means no print path can forget to do it.
 *
 * Returns a result rather than throwing so the caller can surface a blocked popup as a visible
 * message — otherwise printing silently does nothing, which a user cannot diagnose.
 */
export async function printTemplate(
  template: LetterheadTemplate,
  values: FieldValues,
  title = "Prescription",
): Promise<PrintResult> {
  let resolved = template;
  if (template.mode === "FULL" && needsInlining(template.letterheadImageUrl)) {
    try {
      const dataUrl = await fetchImageDataUrl(template.letterheadImageUrl as string);
      resolved = { ...template, letterheadImageUrl: dataUrl };
    } catch {
      // Better to print the fields on plain paper than to print nothing at all.
      resolved = { ...template, letterheadImageUrl: null };
    }
  }

  const pages = renderTemplatePages(resolved, values);
  const html = pages
    .map((page, i) =>
      i === 0
        ? page
        : // Each subsequent sheet is its own positioned A4 page.
          `</div><div class="page" style="page-break-before:always">${page}`,
    )
    .join("");

  const opened = printA4Html(title, html);
  return opened ? { ok: true } : { ok: false, reason: "popup-blocked" };
}
