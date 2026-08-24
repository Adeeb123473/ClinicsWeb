import { useState } from "react";
import { PageHeader } from "../../components/PageHeader";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { PrintIcon } from "../../components/icons";
import { printA4Html, PRINT_SETTINGS_HELP } from "../../utils/printLetterhead";
import { calibrationSheetHtml } from "../../features/letterhead/calibrationSheet";
import { A4, PX_PER_MM, dewarpPixelSize, mmPerPxFor } from "../../features/letterhead/units";

/**
 * Prints a sheet of known-position marks so the millimetre coordinate system can be verified
 * against a physical ruler. Built before the rest of the letterhead feature on purpose: if the
 * numbers on this page do not survive the printer, no amount of field placement will help.
 */
export function LetterheadCalibrationPage() {
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  const print = () =>
    printA4Html("Letterhead calibration sheet", calibrationSheetHtml({ offsetXMm: offsetX, offsetYMm: offsetY }));

  const { widthPx, heightPx } = dewarpPixelSize(A4);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Letterhead calibration"
        subtitle="Verify that millimetre positioning survives your printer"
        actions={
          <Button onClick={print}>
            <PrintIcon className="h-4 w-4" /> Print calibration sheet
          </Button>
        }
      />

      <div className="rounded-xl border border-warning-200 bg-warning-50 p-4">
        <p className="text-sm font-semibold text-warning-800">Set these in the print dialog first</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-warning-700">
          {PRINT_SETTINGS_HELP.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-warning-700">
          A page printed at “Fit to page” is silently scaled by a few percent — several millimetres of drift by the
          bottom of an A4 sheet. This is the most common cause of misaligned letterheads.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-800">What to check on the printed sheet</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>
            Both <strong>100 mm reference lines</strong> (one horizontal, one vertical) measure exactly 100 mm.
          </li>
          <li>
            The <strong>50 × 25 mm box</strong> measures 50 mm across and 25 mm down.
          </li>
          <li>
            Each <strong>crosshair</strong> sits at the coordinates printed beside it, measured from the top-left
            corner of the paper.
          </li>
        </ol>
        <p className="mt-3 text-sm text-slate-600">
          If everything measures correctly, the coordinate system is sound and letterhead fields will land where the
          editor says they will. If the marks are off by a consistent amount in one direction, enter that amount
          below and reprint — the same offset is available per-letterhead as the global calibration knob.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-800">Test a global offset</h3>
        <p className="mt-1 text-sm text-slate-500">
          Shifts every mark right and down by the given amount, exactly as a letterhead’s global offset does.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Input
            label="Offset X (mm)"
            type="number"
            step="0.5"
            value={offsetX}
            onChange={(e) => setOffsetX(Number(e.target.value) || 0)}
            className="w-36"
          />
          <Input
            label="Offset Y (mm)"
            type="number"
            step="0.5"
            value={offsetY}
            onChange={(e) => setOffsetY(Number(e.target.value) || 0)}
            className="w-36"
          />
          <Button variant="secondary" onClick={() => { setOffsetX(0); setOffsetY(0); }}>
            Reset
          </Button>
          <Button onClick={print}>
            <PrintIcon className="h-4 w-4" /> Print with offset
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-800">Constants in use</h3>
        <dl className="mt-2 grid grid-cols-1 gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
          <div className="flex justify-between border-b border-slate-100 py-1">
            <dt className="text-slate-500">Paper</dt>
            <dd className="font-mono text-slate-700">A4 — {A4.widthMm} × {A4.heightMm} mm</dd>
          </div>
          <div className="flex justify-between border-b border-slate-100 py-1">
            <dt className="text-slate-500">CSS px per mm</dt>
            <dd className="font-mono text-slate-700">{PX_PER_MM.toFixed(6)} (96 dpi)</dd>
          </div>
          <div className="flex justify-between border-b border-slate-100 py-1">
            <dt className="text-slate-500">Dewarped raster</dt>
            <dd className="font-mono text-slate-700">{widthPx} × {heightPx} px @ 200 dpi</dd>
          </div>
          <div className="flex justify-between border-b border-slate-100 py-1">
            <dt className="text-slate-500">mm per image px</dt>
            <dd className="font-mono text-slate-700">{mmPerPxFor(A4).toFixed(6)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
