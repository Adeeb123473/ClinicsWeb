import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../../components/Button";
import { A4, dewarpPixelSize } from "./units";
import { warpPerspective, type Point } from "./geometry";
import { applyCleanup, DEFAULT_CLEANUP, type CleanupOptions } from "./imageCleanup";

const DISPLAY_WIDTH = 520;
const HANDLE_HIT_PX = 28; // generous: this is done on phones and tablets
const LOUPE_SIZE = 120;
const LOUPE_ZOOM = 3;

export interface CornerStepResult {
  dewarpedDataUrl: string;
  cornerPoints: Point[];
  widthPx: number;
  heightPx: number;
}

/**
 * Places the four page corners on the scanned image and rectifies it.
 *
 * Scanner apps already remove most perspective, so in practice the handles start at the image
 * corners and get nudged inward to exclude the desk the pad was photographed on. The transform
 * is the same either way.
 */
export function CornerStep({
  sourceCanvas,
  initialCorners,
  onBack,
  onDone,
}: {
  sourceCanvas: HTMLCanvasElement;
  initialCorners?: Point[] | null;
  onBack: () => void;
  onDone: (result: CornerStepResult) => void;
}) {
  const displayRef = useRef<HTMLCanvasElement | null>(null);
  const loupeRef = useRef<HTMLCanvasElement | null>(null);
  const [corners, setCorners] = useState<Point[]>(
    () =>
      initialCorners ?? [
        { x: 0, y: 0 },
        { x: sourceCanvas.width, y: 0 },
        { x: sourceCanvas.width, y: sourceCanvas.height },
        { x: 0, y: sourceCanvas.height },
      ],
  );
  const [dragging, setDragging] = useState<number | null>(null);
  const [cleanup, setCleanup] = useState<CleanupOptions>(DEFAULT_CLEANUP);
  const [busy, setBusy] = useState(false);

  const scale = DISPLAY_WIDTH / sourceCanvas.width;
  const displayHeight = Math.round(sourceCanvas.height * scale);

  /** Redraws the scan with the quadrilateral and handles on top. */
  const draw = useCallback(() => {
    const canvas = displayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);

    const pts = corners.map((p) => ({ x: p.x * scale, y: p.y * scale }));

    // Dim everything outside the marked page so the crop is obvious.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fillStyle = "rgba(15,23,42,0.55)";
    ctx.fill("evenodd");
    ctx.restore();

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.strokeStyle = "#14b8a6";
    ctx.lineWidth = 2;
    ctx.stroke();

    pts.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, dragging === i ? 11 : 9, 0, Math.PI * 2);
      ctx.fillStyle = dragging === i ? "#0d9488" : "#14b8a6";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2.5;
      ctx.stroke();
    });
  }, [corners, dragging, scale, sourceCanvas]);

  useEffect(draw, [draw]);

  /** Magnifier showing source pixels around the handle being dragged. */
  const drawLoupe = useCallback(
    (index: number) => {
      const canvas = loupeRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const p = corners[index];
      const half = LOUPE_SIZE / (2 * LOUPE_ZOOM);

      ctx.clearRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        sourceCanvas,
        p.x - half,
        p.y - half,
        half * 2,
        half * 2,
        0,
        0,
        LOUPE_SIZE,
        LOUPE_SIZE,
      );
      ctx.strokeStyle = "#14b8a6";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(LOUPE_SIZE / 2, 0);
      ctx.lineTo(LOUPE_SIZE / 2, LOUPE_SIZE);
      ctx.moveTo(0, LOUPE_SIZE / 2);
      ctx.lineTo(LOUPE_SIZE, LOUPE_SIZE / 2);
      ctx.stroke();
    },
    [corners, sourceCanvas],
  );

  useEffect(() => {
    if (dragging != null) drawLoupe(dragging);
  }, [dragging, drawLoupe]);

  const pointerPos = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * sourceCanvas.width,
      y: ((e.clientY - rect.top) / rect.height) * sourceCanvas.height,
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = pointerPos(e);
    let nearest = 0;
    let best = Infinity;
    corners.forEach((c, i) => {
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    if (best * scale <= HANDLE_HIT_PX) {
      setDragging(nearest);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragging == null) return;
    const p = pointerPos(e);
    setCorners((prev) =>
      prev.map((c, i) =>
        i === dragging
          ? {
              x: Math.min(Math.max(p.x, 0), sourceCanvas.width),
              y: Math.min(Math.max(p.y, 0), sourceCanvas.height),
            }
          : c,
      ),
    );
  };

  const endDrag = () => setDragging(null);

  const reset = () =>
    setCorners([
      { x: 0, y: 0 },
      { x: sourceCanvas.width, y: 0 },
      { x: sourceCanvas.width, y: sourceCanvas.height },
      { x: 0, y: sourceCanvas.height },
    ]);

  const rectify = async () => {
    setBusy(true);
    try {
      const srcCtx = sourceCanvas.getContext("2d");
      if (!srcCtx) throw new Error("no context");
      const src = srcCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);

      const { widthPx, heightPx } = dewarpPixelSize(A4);
      const warped = warpPerspective(
        { data: src.data, width: src.width, height: src.height },
        corners,
        widthPx,
        heightPx,
      );
      const cleaned = applyCleanup(warped, cleanup);

      const out = document.createElement("canvas");
      out.width = widthPx;
      out.height = heightPx;
      const outCtx = out.getContext("2d");
      if (!outCtx) throw new Error("no context");
      // Built via createImageData + set() rather than `new ImageData(data, w, h)`: the DOM types
      // require an ArrayBuffer-backed array, while a plain Uint8ClampedArray is typed over
      // ArrayBufferLike (which admits SharedArrayBuffer) and is therefore not assignable.
      const imageData = outCtx.createImageData(widthPx, heightPx);
      imageData.data.set(cleaned.data);
      outCtx.putImageData(imageData, 0, 0);

      onDone({
        // JPEG keeps a 1654x2339 scan well under the upload limit; the backdrop does not need
        // lossless fidelity, and in FULL mode it is a photo anyway.
        dewarpedDataUrl: out.toDataURL("image/jpeg", 0.9),
        cornerPoints: corners,
        widthPx,
        heightPx,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Mark the corners of the pad</h3>
        <p className="mt-1 text-sm text-slate-500">
          Drag each handle onto a corner of the printed pad, excluding any desk or background around it. Most scans
          are already straight, so this is usually a small adjustment.
        </p>
      </div>

      <div className="relative inline-block self-start">
        <canvas
          ref={displayRef}
          width={DISPLAY_WIDTH}
          height={displayHeight}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="max-w-full touch-none rounded-xl border border-slate-200"
          style={{ cursor: dragging != null ? "grabbing" : "crosshair" }}
        />
        {dragging != null && (
          <div
            className="pointer-events-none absolute z-10 overflow-hidden rounded-lg border-2 border-primary-400 bg-white shadow-lg"
            style={{
              width: LOUPE_SIZE,
              height: LOUPE_SIZE,
              // Park the loupe in the opposite corner so it never sits under the finger.
              left: corners[dragging].x * scale > DISPLAY_WIDTH / 2 ? 8 : undefined,
              right: corners[dragging].x * scale > DISPLAY_WIDTH / 2 ? undefined : 8,
              top: corners[dragging].y * scale > displayHeight / 2 ? 8 : undefined,
              bottom: corners[dragging].y * scale > displayHeight / 2 ? undefined : 8,
            }}
          >
            <canvas ref={loupeRef} width={LOUPE_SIZE} height={LOUPE_SIZE} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-xl bg-slate-50 p-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={cleanup.enhance}
            onChange={(e) => setCleanup({ ...cleanup, enhance: e.target.checked })}
            className="h-4 w-4"
          />
          Enhance (white balance + contrast)
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={cleanup.grayscale}
            onChange={(e) => setCleanup({ ...cleanup, grayscale: e.target.checked })}
            className="h-4 w-4"
          />
          Grayscale
        </label>
        <Button size="sm" variant="ghost" onClick={reset}>
          Reset corners
        </Button>
      </div>

      <div className="flex justify-between">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button onClick={rectify} isLoading={busy}>
          Straighten &amp; continue
        </Button>
      </div>
    </div>
  );
}
