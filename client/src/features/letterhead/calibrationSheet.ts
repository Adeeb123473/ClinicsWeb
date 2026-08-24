/**
 * The calibration sheet: an A4 page of known-position marks that can be checked with a ruler.
 *
 * This exists because every other part of the letterhead feature is worthless if millimetre
 * positioning does not survive the trip to a physical printer. If the 100mm reference line
 * measures 100mm, the whole coordinate system is trustworthy; if it measures 97mm, the print
 * dialog is scaling and no amount of field-nudging will fix the alignment.
 */
import { A4 } from "./units";
import { absMm, escapeHtml } from "../../utils/printLetterhead";

/** Crosshair targets at exactly-known page coordinates, chosen to span the sheet. */
export const CALIBRATION_MARKS: { xMm: number; yMm: number }[] = [
  { xMm: 20, yMm: 20 },
  { xMm: 190, yMm: 20 },
  { xMm: 105, yMm: 148.5 }, // exact page centre
  { xMm: 20, yMm: 277 },
  { xMm: 190, yMm: 277 },
];

function ruler(orientation: "top" | "left"): string {
  const lengthMm = orientation === "top" ? A4.widthMm : A4.heightMm;
  const parts: string[] = [];

  for (let mm = 0; mm <= lengthMm; mm++) {
    const major = mm % 10 === 0;
    const medium = !major && mm % 5 === 0;
    const tickMm = major ? 8 : medium ? 5 : 2.5;

    parts.push(
      orientation === "top"
        ? `<div style="${absMm({ xMm: mm, yMm: 0, widthMm: 0.2, heightMm: tickMm })};background:#000"></div>`
        : `<div style="${absMm({ xMm: 0, yMm: mm, widthMm: tickMm, heightMm: 0.2 })};background:#000"></div>`,
    );

    // Skip labels within 15mm of the origin: the top and left rulers would otherwise print
    // their "10" on top of each other in the corner that everything is measured from.
    if (major && mm >= 15 && mm < lengthMm) {
      parts.push(
        orientation === "top"
          ? `<div style="${absMm({ xMm: mm + 0.6, yMm: 8.2 })};font-size:6pt;line-height:1">${mm}</div>`
          : `<div style="${absMm({ xMm: 8.4, yMm: mm - 1.1 })};font-size:6pt;line-height:1">${mm}</div>`,
      );
    }
  }
  return parts.join("");
}

function crosshair(xMm: number, yMm: number): string {
  const arm = 4;
  return [
    `<div style="${absMm({ xMm: xMm - arm, yMm, widthMm: arm * 2, heightMm: 0.2 })};background:#000"></div>`,
    `<div style="${absMm({ xMm, yMm: yMm - arm, widthMm: 0.2, heightMm: arm * 2 })};background:#000"></div>`,
    `<div style="${absMm({ xMm: xMm + 2, yMm: yMm + 1.5 })};font-size:6pt;line-height:1">${xMm}, ${yMm}</div>`,
  ].join("");
}

/**
 * Builds the calibration page body. Everything on it is positioned in millimetres by the same
 * code path that positions real letterhead fields, so measuring this sheet measures that path.
 */
export function calibrationSheetHtml(opts: { offsetXMm?: number; offsetYMm?: number } = {}): string {
  const ox = opts.offsetXMm ?? 0;
  const oy = opts.offsetYMm ?? 0;

  const shifted = (inner: string) =>
    ox === 0 && oy === 0
      ? inner
      : `<div style="position:absolute;left:0;top:0;transform:translate(${ox}mm,${oy}mm)">${inner}</div>`;

  const body = [
    ruler("top"),
    ruler("left"),

    // A 100mm reference line: the single most diagnostic mark on the page.
    `<div style="${absMm({ xMm: 55, yMm: 60, widthMm: 100, heightMm: 0.4 })};background:#000"></div>`,
    `<div style="${absMm({ xMm: 55, yMm: 56, widthMm: 0.4, heightMm: 8 })};background:#000"></div>`,
    `<div style="${absMm({ xMm: 155, yMm: 56, widthMm: 0.4, heightMm: 8 })};background:#000"></div>`,
    `<div style="${absMm({ xMm: 55, yMm: 62.5, widthMm: 100 })};font-size:9pt;text-align:center">
       This line is exactly 100 mm — measure it
     </div>`,

    // A vertical 100mm reference, to catch non-uniform scaling between axes.
    `<div style="${absMm({ xMm: 30, yMm: 90, widthMm: 0.4, heightMm: 100 })};background:#000"></div>`,
    `<div style="${absMm({ xMm: 26, yMm: 90, widthMm: 8, heightMm: 0.4 })};background:#000"></div>`,
    `<div style="${absMm({ xMm: 26, yMm: 190, widthMm: 8, heightMm: 0.4 })};background:#000"></div>`,
    `<div style="${absMm({ xMm: 34, yMm: 137 })};font-size:9pt">100 mm vertical</div>`,

    // A known box: 50mm x 25mm at (120, 100).
    `<div style="${absMm({ xMm: 120, yMm: 100, widthMm: 50, heightMm: 25 })};border:0.3mm solid #000"></div>`,
    `<div style="${absMm({ xMm: 120, yMm: 126.5, widthMm: 60 })};font-size:8pt">50 × 25 mm box at (120, 100)</div>`,

    ...CALIBRATION_MARKS.map((m) => crosshair(m.xMm, m.yMm)),

    `<div style="${absMm({ xMm: 55, yMm: 200, widthMm: 120 })};font-size:8pt;line-height:1.5">
       <strong>How to read this sheet</strong><br/>
       1. Measure the 100 mm lines with a ruler. Both must read 100 mm.<br/>
       2. Check the crosshairs sit at the coordinates printed beside them,<br/>
       &nbsp;&nbsp;&nbsp;measuring from the top-left corner of the sheet.<br/>
       3. If they are consistently short or long, the print dialog is scaling:<br/>
       &nbsp;&nbsp;&nbsp;set Scale to 100%, Margins to None, and turn headers/footers off.<br/>
       4. If they are off by a fixed amount in one direction, use the global<br/>
       &nbsp;&nbsp;&nbsp;offset on the letterhead setup screen to correct it.
     </div>`,

    ox !== 0 || oy !== 0
      ? `<div style="${absMm({ xMm: 55, yMm: 232, widthMm: 120 })};font-size:8pt">
           Printed with global offset X ${escapeHtml(ox)} mm, Y ${escapeHtml(oy)} mm.
         </div>`
      : "",
  ].join("");

  return shifted(body);
}
