import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Select } from "../../components/Select";
import { A4 } from "./units";
import { FIELD_LABELS, composeFields, sampleValues, type FieldKey, type LetterheadField } from "./fields";

const DISPLAY_WIDTH = 520;
const DISPLAY_HEIGHT = Math.round((DISPLAY_WIDTH * A4.heightMm) / A4.widthMm);
const SNAP_MM = 0.5;
const FINE_MM = 0.1;

const pxPerMm = DISPLAY_WIDTH / A4.widthMm;

/** Fields offered in the editor. consultationBody is placed here too, as a sized box. */
const EDITABLE_KEYS: FieldKey[] = ["date", "patientName", "age", "gender", "consultationBody"];

export function FieldStep({
  backdropUrl,
  showBackdrop,
  fields,
  onChange,
  onBack,
  onNext,
}: {
  backdropUrl: string | null;
  showBackdrop: boolean;
  fields: LetterheadField[];
  onChange: (fields: LetterheadField[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [selected, setSelected] = useState<FieldKey>("patientName");
  const [dragKey, setDragKey] = useState<FieldKey | null>(null);
  const [snapOff, setSnapOff] = useState(false);
  const areaRef = useRef<HTMLDivElement | null>(null);
  const dragOffset = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  const values = sampleValues();
  const rendered = composeFields(fields, values);
  const current = fields.find((f) => f.key === selected);

  // Alt/Meta temporarily disables snapping while held.
  useEffect(() => {
    const down = (e: KeyboardEvent) => (e.altKey || e.metaKey) && setSnapOff(true);
    const up = (e: KeyboardEvent) => !(e.altKey || e.metaKey) && setSnapOff(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const update = (key: FieldKey, patch: Partial<LetterheadField>) =>
    onChange(fields.map((f) => (f.key === key ? { ...f, ...patch } : f)));

  const snap = (mm: number) => (snapOff ? Math.round(mm * 100) / 100 : Math.round(mm / SNAP_MM) * SNAP_MM);

  const onPointerDown = (e: React.PointerEvent, key: FieldKey) => {
    const field = fields.find((f) => f.key === key);
    if (!field || !areaRef.current) return;
    const rect = areaRef.current.getBoundingClientRect();
    const mmX = ((e.clientX - rect.left) / rect.width) * A4.widthMm;
    const mmY = ((e.clientY - rect.top) / rect.height) * A4.heightMm;
    dragOffset.current = { dx: mmX - field.xMm, dy: mmY - field.yMm };
    setSelected(key);
    setDragKey(key);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragKey || !areaRef.current) return;
    const rect = areaRef.current.getBoundingClientRect();
    const mmX = ((e.clientX - rect.left) / rect.width) * A4.widthMm - dragOffset.current.dx;
    const mmY = ((e.clientY - rect.top) / rect.height) * A4.heightMm - dragOffset.current.dy;
    update(dragKey, {
      xMm: Math.min(Math.max(snap(mmX), 0), A4.widthMm),
      yMm: Math.min(Math.max(snap(mmY), 0), A4.heightMm),
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!current) return;
    const step = e.shiftKey ? FINE_MM : SNAP_MM;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    update(current.key, {
      xMm: Math.round(Math.min(Math.max(current.xMm + move[0], 0), A4.widthMm) * 100) / 100,
      yMm: Math.round(Math.min(Math.max(current.yMm + move[1], 0), A4.heightMm) * 100) / 100,
    });
  };

  const toggleField = (key: FieldKey) => {
    const existing = fields.find((f) => f.key === key);
    if (existing) {
      update(key, { visible: existing.visible === false });
    } else {
      onChange([...fields, { key, xMm: 20, yMm: 100, widthMm: key === "consultationBody" ? 150 : 60, heightMm: key === "consultationBody" ? 120 : undefined }]);
    }
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="flex flex-col gap-2">
        <p className="text-xs text-slate-500">
          Drag a field onto its blank. Arrow keys nudge {SNAP_MM} mm, shift+arrow {FINE_MM} mm. Hold Alt to disable
          snapping.
        </p>
        <div
          ref={areaRef}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => setDragKey(null)}
          className="relative shrink-0 touch-none overflow-hidden rounded-xl border border-slate-300 bg-white outline-none focus:ring-2 focus:ring-primary-400"
          style={{ width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT }}
        >
          {showBackdrop && backdropUrl && (
            <img src={backdropUrl} alt="" className="absolute inset-0 h-full w-full object-fill" />
          )}
          {rendered.map(({ field, text }) => {
            const isSel = field.key === selected;
            return (
              <div
                key={field.key}
                onPointerDown={(e) => onPointerDown(e, field.key)}
                className={`absolute cursor-move ${isSel ? "outline outline-2 outline-primary-500" : "outline outline-1 outline-dashed outline-slate-400"}`}
                style={{
                  left: field.xMm * pxPerMm,
                  top: field.yMm * pxPerMm,
                  width: field.widthMm ? field.widthMm * pxPerMm : undefined,
                  height: field.heightMm ? field.heightMm * pxPerMm : undefined,
                  fontFamily: `${field.fontFamily || "Arial"}, sans-serif`,
                  // Font size is in pt; convert to display px at the board's scale so what is
                  // shown matches what prints.
                  fontSize: ((field.fontSizePt ?? 11) / 72) * 25.4 * pxPerMm,
                  fontWeight: field.fontWeight ?? "normal",
                  textAlign: field.align ?? "left",
                  lineHeight: field.key === "consultationBody" ? 1.35 : 1,
                  whiteSpace: field.key === "consultationBody" ? "pre-wrap" : "nowrap",
                  background: isSel ? "rgba(20,184,166,0.10)" : "transparent",
                  color: "#000",
                }}
              >
                {text}
              </div>
            );
          })}
        </div>
        {current && (
          <p className="font-mono text-xs text-slate-500">
            {FIELD_LABELS[current.key]} — x {current.xMm.toFixed(1)} mm, y {current.yMm.toFixed(1)} mm
            {snapOff && " · snapping off"}
          </p>
        )}
      </div>

      <div className="flex min-w-64 flex-1 flex-col gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Fields</p>
          <div className="flex flex-wrap gap-1">
            {EDITABLE_KEYS.map((key) => {
              const f = fields.find((x) => x.key === key);
              const on = f && f.visible !== false;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => (f ? setSelected(key) : toggleField(key))}
                  onDoubleClick={() => toggleField(key)}
                  className={`rounded-lg border px-2 py-1 text-xs ${
                    selected === key
                      ? "border-primary-500 bg-primary-50 text-primary-700"
                      : on
                        ? "border-slate-200 text-slate-600"
                        : "border-slate-200 text-slate-300 line-through"
                  }`}
                >
                  {FIELD_LABELS[key]}
                </button>
              );
            })}
          </div>
        </div>

        {current && (
          <div className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={current.visible !== false}
                onChange={(e) => update(current.key, { visible: e.target.checked })}
                className="h-4 w-4"
              />
              Show this field
            </label>

            <div className="grid grid-cols-2 gap-2">
              <Input
                label="X (mm)"
                type="number"
                step="0.5"
                value={current.xMm}
                onChange={(e) => update(current.key, { xMm: Number(e.target.value) })}
              />
              <Input
                label="Y (mm)"
                type="number"
                step="0.5"
                value={current.yMm}
                onChange={(e) => update(current.key, { yMm: Number(e.target.value) })}
              />
              <Input
                label="Width (mm)"
                type="number"
                value={current.widthMm ?? ""}
                onChange={(e) => update(current.key, { widthMm: e.target.value === "" ? null : Number(e.target.value) })}
              />
              <Input
                label="Font size (pt)"
                type="number"
                value={current.fontSizePt ?? 11}
                onChange={(e) => update(current.key, { fontSizePt: Number(e.target.value) })}
              />
            </div>

            {current.key === "consultationBody" && (
              <Input
                label="Height (mm)"
                type="number"
                value={current.heightMm ?? ""}
                onChange={(e) => update(current.key, { heightMm: e.target.value === "" ? null : Number(e.target.value) })}
                hint="Text longer than this box continues on a second page"
              />
            )}

            <div className="grid grid-cols-2 gap-2">
              <Select
                label="Align"
                value={current.align ?? "left"}
                onChange={(e) => update(current.key, { align: e.target.value as LetterheadField["align"] })}
                options={[
                  { value: "left", label: "Left" },
                  { value: "center", label: "Center" },
                  { value: "right", label: "Right" },
                ]}
              />
              <Select
                label="Weight"
                value={current.fontWeight ?? "normal"}
                onChange={(e) => update(current.key, { fontWeight: e.target.value as "normal" | "bold" })}
                options={[
                  { value: "normal", label: "Normal" },
                  { value: "bold", label: "Bold" },
                ]}
              />
            </div>

            <Select
              label="Font"
              value={current.fontFamily ?? "Arial"}
              onChange={(e) => update(current.key, { fontFamily: e.target.value })}
              options={[
                { value: "Arial", label: "Arial" },
                { value: "Helvetica", label: "Helvetica" },
                { value: "Times New Roman", label: "Times New Roman" },
                { value: "Georgia", label: "Georgia" },
                { value: "Courier New", label: "Courier New" },
              ]}
            />

            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Prefix"
                value={current.prefix ?? ""}
                onChange={(e) => update(current.key, { prefix: e.target.value })}
                hint="e.g. “Age: ”"
              />
              <Input
                label="Suffix"
                value={current.suffix ?? ""}
                onChange={(e) => update(current.key, { suffix: e.target.value })}
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={current.uppercase ?? false}
                onChange={(e) => update(current.key, { uppercase: e.target.checked })}
                className="h-4 w-4"
              />
              Uppercase
            </label>

            {current.key !== "consultationBody" && (
              <Select
                label="Print inside another field"
                value={current.inlineWith ?? ""}
                onChange={(e) =>
                  update(current.key, { inlineWith: e.target.value === "" ? null : (e.target.value as FieldKey) })
                }
                options={[
                  { value: "", label: "No — its own box" },
                  ...fields
                    .filter((f) => f.key !== current.key && !f.inlineWith && f.key !== "consultationBody")
                    .map((f) => ({ value: f.key, label: `Append to ${FIELD_LABELS[f.key]}` })),
                ]}
                hint="For pads with no separate blank, e.g. gender after the patient name"
              />
            )}
          </div>
        )}

        <div className="mt-auto flex justify-between gap-2">
          <Button variant="secondary" onClick={onBack}>
            Back
          </Button>
          <Button onClick={onNext}>Continue</Button>
        </div>
      </div>
    </div>
  );
}
