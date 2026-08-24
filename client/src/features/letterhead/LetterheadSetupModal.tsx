import { useEffect, useState } from "react";
import { Modal } from "../../components/Modal";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Badge } from "../../components/Badge";
import { toast } from "../../store/toastStore";
import { errorMessage } from "../../api/http";
import { PRINT_SETTINGS_HELP } from "../../utils/printLetterhead";
import { rasterisePdfFirstPage, isA4Page, pageSizeMm } from "./pdfRaster";
import { CornerStep } from "./CornerStep";
import { FieldStep } from "./FieldStep";
import { defaultFields, sampleValues, type LetterheadField } from "./fields";
import { letterheadApi, fetchImageObjectUrl, type LetterheadTemplateDto } from "./letterheadApi";
import { printTemplate } from "./printTemplate";
import { A4, dewarpPixelSize, mmPerPxFor } from "./units";
import type { Point } from "./geometry";

type Step = "upload" | "corners" | "verify" | "fields" | "review";

/**
 * Walks a user through turning a scanned pad into a positioned letterhead template.
 *
 * Mounted both from doctor registration and from the doctor's profile, so it must work with
 * either no existing template or one being re-edited. Every step is skippable: the person
 * registering a doctor is often an admin with no pad in front of them, so setup must never
 * block saving the doctor.
 */
export function LetterheadSetupModal({
  doctorId,
  doctorName,
  onClose,
  onSaved,
}: {
  doctorId: string;
  doctorName: string;
  onClose: () => void;
  onSaved?: (t: LetterheadTemplateDto) => void;
}) {
  const [step, setStep] = useState<Step>("upload");
  const [template, setTemplate] = useState<LetterheadTemplateDto | null>(null);
  const [sourceCanvas, setSourceCanvas] = useState<HTMLCanvasElement | null>(null);
  const [originalDataUrl, setOriginalDataUrl] = useState<string | null>(null);
  const [dewarpedUrl, setDewarpedUrl] = useState<string | null>(null);
  const [dewarpedDataUrl, setDewarpedDataUrl] = useState<string | null>(null);
  const [corners, setCorners] = useState<Point[] | null>(null);
  const [fields, setFields] = useState<LetterheadField[]>(defaultFields());
  const [mode, setMode] = useState<"OVERLAY" | "FULL">("OVERLAY");
  const [showBackdrop, setShowBackdrop] = useState(true);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pdfNote, setPdfNote] = useState<string | null>(null);

  // Load any existing template so this doubles as the edit screen.
  useEffect(() => {
    let cancelled = false;
    letterheadApi
      .get(doctorId)
      .then(async (t) => {
        if (cancelled || !t) return;
        setTemplate(t);
        setMode(t.mode);
        setOffset(t.globalOffsetMm);
        if (t.fields.length) setFields(t.fields);
        if (t.cornerPoints) setCorners(t.cornerPoints);
        if (t.letterheadImageUrl) {
          try {
            const url = await fetchImageObjectUrl(t.letterheadImageUrl);
            if (!cancelled) {
              setDewarpedUrl(url);
              setStep("fields");
            }
          } catch {
            /* backdrop is optional; setup can continue without it */
          }
        }
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [doctorId]);

  const onFile = async (file: File) => {
    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF — export the scan from your scanner app as a PDF.");
      return;
    }
    setBusy(true);
    setPdfNote(null);
    try {
      const raster = await rasterisePdfFirstPage(file);
      setSourceCanvas(raster.canvas);

      const size = pageSizeMm(raster.pageWidthPt, raster.pageHeightPt);
      if (!isA4Page(raster.pageWidthPt, raster.pageHeightPt)) {
        setPdfNote(
          `This PDF's page is ${size.widthMm.toFixed(0)}×${size.heightMm.toFixed(0)} mm, not A4. ` +
            `Printing is always A4, so mark the pad's corners carefully on the next step.`,
        );
      }
      if (raster.pageCount > 1) {
        setPdfNote((n) => [n, `Only page 1 of ${raster.pageCount} is used.`].filter(Boolean).join(" "));
      }

      const reader = new FileReader();
      reader.onload = () => setOriginalDataUrl(String(reader.result));
      reader.readAsDataURL(file);

      setStep("corners");
    } catch (err) {
      toast.error(errorMessage(err, "Could not read that PDF"));
    } finally {
      setBusy(false);
    }
  };

  /** Uploads original + dewarped and saves the template metadata. */
  const persist = async (status: "DRAFT" | "CALIBRATED") => {
    setBusy(true);
    try {
      // The template row must exist before images can attach to it.
      const calib = dewarpPixelSize(A4);
      let saved = await letterheadApi.save(doctorId, {
        mode,
        cornerPoints: corners,
        imageWidthPx: calib.widthPx,
        imageHeightPx: calib.heightPx,
        mmPerPx: mmPerPxFor(A4),
        globalOffsetXMm: offset.x,
        globalOffsetYMm: offset.y,
        // CALIBRATED is only accepted once an image exists, so send DRAFT on this first save.
        status: "DRAFT",
        fields,
      });

      if (originalDataUrl) saved = await letterheadApi.uploadImage(doctorId, "ORIGINAL", originalDataUrl);
      if (dewarpedDataUrl) {
        saved = await letterheadApi.uploadImage(doctorId, "DEWARPED", dewarpedDataUrl, {
          widthPx: calib.widthPx,
          heightPx: calib.heightPx,
        });
      }

      if (status === "CALIBRATED") {
        saved = await letterheadApi.save(doctorId, {
          mode,
          cornerPoints: corners,
          imageWidthPx: calib.widthPx,
          imageHeightPx: calib.heightPx,
          mmPerPx: mmPerPxFor(A4),
          globalOffsetXMm: offset.x,
          globalOffsetYMm: offset.y,
          status: "CALIBRATED",
          fields,
        });
      }

      setTemplate(saved);
      onSaved?.(saved);
      return saved;
    } catch (err) {
      toast.error(errorMessage(err));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const testPrint = () => {
    const result = printTemplate(
      { mode, globalOffsetMm: offset, status: "DRAFT", fields, letterheadImageUrl: dewarpedUrl },
      sampleValues(),
      `Letterhead test — ${doctorName}`,
    );
    if (!result.ok) {
      toast.error("Your browser blocked the print window. Allow pop-ups for this site and try again.");
    }
  };

  const saveAndClose = async (status: "DRAFT" | "CALIBRATED") => {
    const saved = await persist(status);
    if (saved) {
      toast.success(status === "CALIBRATED" ? "Letterhead calibrated" : "Letterhead saved as draft");
      onClose();
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Letterhead — ${doctorName}`}
      widthClass="max-w-4xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Set this up later
          </Button>
          {step === "review" ? (
            <>
              <Button variant="secondary" isLoading={busy} onClick={() => saveAndClose("DRAFT")}>
                Save as draft
              </Button>
              <Button isLoading={busy} onClick={() => saveAndClose("CALIBRATED")}>
                It lines up — mark calibrated
              </Button>
            </>
          ) : null}
        </>
      }
    >
      {loading ? (
        <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-xs">
            {(["upload", "corners", "verify", "fields", "review"] as Step[]).map((s, i) => (
              <span
                key={s}
                className={`rounded-full px-2 py-0.5 ${
                  step === s ? "bg-primary-100 text-primary-700" : "text-slate-400"
                }`}
              >
                {i + 1}. {{ upload: "Upload", corners: "Corners", verify: "Verify", fields: "Fields", review: "Test print" }[s]}
              </span>
            ))}
            {template && (
              <Badge tone={template.status === "CALIBRATED" ? "success" : "warning"}>{template.status}</Badge>
            )}
          </div>

          {step === "upload" && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-slate-600">
                Upload a scan of the doctor’s pre-printed pad as a <strong>PDF</strong>. A phone scanning app such as
                CamScanner is fine — it straightens the page for you.
              </p>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
                className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-primary-700"
              />
              {busy && <p className="text-sm text-slate-400">Reading PDF…</p>}
              {template?.originalImageUrl && (
                <p className="text-xs text-slate-500">
                  This doctor already has a letterhead. Uploading a new PDF replaces it; otherwise continue to edit the
                  existing one.
                </p>
              )}
              {template?.letterheadImageUrl && (
                <Button variant="secondary" onClick={() => setStep("fields")}>
                  Edit existing field positions
                </Button>
              )}
            </div>
          )}

          {step === "corners" && sourceCanvas && (
            <>
              {pdfNote && (
                <div className="rounded-xl border border-warning-200 bg-warning-50 p-3 text-sm text-warning-700">
                  {pdfNote}
                </div>
              )}
              <CornerStep
                sourceCanvas={sourceCanvas}
                initialCorners={corners}
                onBack={() => setStep("upload")}
                onDone={(r) => {
                  setDewarpedDataUrl(r.dewarpedDataUrl);
                  setDewarpedUrl(r.dewarpedDataUrl);
                  setCorners(r.cornerPoints);
                  setStep("verify");
                }}
              />
            </>
          )}

          {step === "verify" && dewarpedUrl && (
            <VerifyStep url={dewarpedUrl} onBack={() => setStep("corners")} onNext={() => setStep("fields")} />
          )}

          {step === "fields" && (
            <FieldStep
              backdropUrl={dewarpedUrl}
              showBackdrop={showBackdrop}
              fields={fields}
              onChange={setFields}
              onBack={() => setStep(dewarpedDataUrl ? "verify" : "upload")}
              onNext={() => setStep("review")}
            />
          )}

          {step === "review" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Print mode</p>
                <label className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm">
                  <input type="radio" checked={mode === "OVERLAY"} onChange={() => setMode("OVERLAY")} className="mt-1" />
                  <span>
                    <strong>Overlay</strong> — the doctor prints onto their pre-printed pads. Only the patient details
                    are printed; the letterhead image is never sent to the printer.
                  </span>
                </label>
                <label className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm">
                  <input type="radio" checked={mode === "FULL"} onChange={() => setMode("FULL")} className="mt-1" />
                  <span>
                    <strong>Full</strong> — we print the letterhead as well, for plain paper.
                  </span>
                </label>
                {mode === "FULL" && (
                  <div className="rounded-xl border border-warning-200 bg-warning-50 p-3 text-sm text-warning-700">
                    This letterhead came from a scan, so printing it will look noticeably worse than the real pad —
                    softer, slightly tinted, and any scanner watermark will be printed too. A flatbed scan or a
                    vector PDF from the printer who made the pads will look far better.
                  </div>
                )}
              </div>

              {mode === "OVERLAY" && (
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={!showBackdrop}
                    onChange={(e) => setShowBackdrop(!e.target.checked)}
                    className="h-4 w-4"
                  />
                  Preview what actually prints (hide the pad image)
                </label>
              )}

              <div className="rounded-xl border border-warning-200 bg-warning-50 p-3">
                <p className="text-sm font-semibold text-warning-800">Set these in the print dialog</p>
                <ul className="mt-1 list-disc pl-5 text-sm text-warning-700">
                  {PRINT_SETTINGS_HELP.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <Button variant="secondary" onClick={testPrint}>
                  Print test page
                </Button>
                <Input
                  label="Shift right (mm)"
                  type="number"
                  step="0.5"
                  value={offset.x}
                  onChange={(e) => setOffset({ ...offset, x: Number(e.target.value) || 0 })}
                  className="w-32"
                />
                <Input
                  label="Shift down (mm)"
                  type="number"
                  step="0.5"
                  value={offset.y}
                  onChange={(e) => setOffset({ ...offset, y: Number(e.target.value) || 0 })}
                  className="w-32"
                />
              </div>
              <p className="text-sm text-slate-500">
                Print the test page onto a real pad. If the text is consistently off, enter the shift needed and print
                again. When it lines up, mark it calibrated.
              </p>

              <Button variant="ghost" onClick={() => setStep("fields")}>
                Back to field positions
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/** Ruler overlay so a mis-set corner is caught before it corrupts every field coordinate. */
function VerifyStep({ url, onBack, onNext }: { url: string; onBack: () => void; onNext: () => void }) {
  const width = 460;
  const height = Math.round((width * A4.heightMm) / A4.widthMm);
  const pxPerMm = width / A4.widthMm;

  const ticks = (horizontal: boolean) => {
    const len = horizontal ? A4.widthMm : A4.heightMm;
    const out = [];
    for (let mm = 0; mm <= len; mm += 10) {
      out.push(
        <div
          key={mm}
          className="absolute bg-primary-600"
          style={
            horizontal
              ? { left: mm * pxPerMm, top: 0, width: 1, height: mm % 50 === 0 ? 12 : 7 }
              : { top: mm * pxPerMm, left: 0, height: 1, width: mm % 50 === 0 ? 12 : 7 }
          }
        />,
      );
    }
    return out;
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Check the page edges</h3>
        <p className="mt-1 text-sm text-slate-500">
          The pad’s edges should line up with the rulers, with no desk or background visible. If not, go back and move
          the corners — every field position depends on this being right.
        </p>
      </div>
      <div className="relative self-start" style={{ width, height }}>
        <img src={url} alt="Straightened letterhead" className="absolute inset-0 h-full w-full object-fill rounded" />
        <div className="pointer-events-none absolute inset-0 border-2 border-primary-500" />
        <div className="pointer-events-none absolute left-0 top-0 w-full">{ticks(true)}</div>
        <div className="pointer-events-none absolute left-0 top-0 h-full">{ticks(false)}</div>
      </div>
      <div className="flex justify-between">
        <Button variant="secondary" onClick={onBack}>
          Back to corners
        </Button>
        <Button onClick={onNext}>Edges look right</Button>
      </div>
    </div>
  );
}
