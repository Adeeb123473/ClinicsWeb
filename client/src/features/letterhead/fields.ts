/**
 * Field composition and print layout for letterhead templates.
 *
 * Kept as pure functions separate from the React editor and from the print HTML builder,
 * because this is the logic that decides what text ends up where — and it needs to be
 * testable without a DOM or a printer.
 */

export type FieldKey =
  | "patientName"
  | "age"
  | "gender"
  | "date"
  | "mrNo"
  | "doctorName"
  | "consultationBody";

export interface LetterheadField {
  key: FieldKey;
  label?: string;
  xMm: number;
  yMm: number;
  widthMm?: number | null;
  heightMm?: number | null;
  fontFamily?: string;
  fontSizePt?: number;
  fontWeight?: "normal" | "bold";
  align?: "left" | "center" | "right";
  uppercase?: boolean;
  prefix?: string;
  suffix?: string;
  visible?: boolean;
  /** Render appended to another field instead of in its own box. */
  inlineWith?: FieldKey | null;
}

export type FieldValues = Partial<Record<FieldKey, string | number | null | undefined>>;

export const FIELD_LABELS: Record<FieldKey, string> = {
  patientName: "Patient name",
  age: "Age",
  gender: "Gender",
  date: "Date",
  mrNo: "MR No",
  doctorName: "Doctor",
  consultationBody: "Consultation body",
};

/** Sample values so the editor shows real rendered output rather than placeholder rectangles. */
export function sampleValues(today = new Date()): FieldValues {
  return {
    patientName: "Muhammad Ahmed",
    age: "42",
    gender: "Male",
    date: today.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    mrNo: "MR-2026-0042",
    doctorName: "Dr. Ahmed Raza",
    consultationBody: "Tab. Paracetamol 500mg — 1 tab three times a day for 5 days",
  };
}

/** Applies prefix/suffix and uppercase to a raw value. Empty values stay empty: a prefix must
 *  never print on its own, or a pad would show a stray "Age:" with no age after it. */
export function formatFieldValue(field: LetterheadField, raw: string | number | null | undefined): string {
  const value = raw == null ? "" : String(raw).trim();
  if (value === "") return "";
  const cased = field.uppercase ? value.toUpperCase() : value;
  return `${field.prefix ?? ""}${cased}${field.suffix ?? ""}`;
}

export interface RenderableField {
  field: LetterheadField;
  text: string;
}

/**
 * Resolves the field list into the boxes that actually get printed.
 *
 * Fields marked `inlineWith` do not get a box of their own: their formatted text is appended to
 * the host field's text. That is what makes a pad with no gender blank work — gender rides along
 * after the patient name as "Muhammad Ahmed / M".
 *
 * Rules:
 *  - invisible fields contribute nothing, whether standalone or inlined
 *  - an inlined field whose host is missing or invisible is dropped (it has nowhere to go)
 *  - a host with no value of its own still prints if an inlined field supplies text
 *  - inlining is one level deep, matching the server-side validation
 */
export function composeFields(fields: LetterheadField[], values: FieldValues): RenderableField[] {
  const visible = fields.filter((f) => f.visible !== false);
  const hosts = visible.filter((f) => !f.inlineWith);

  return hosts
    .map((host) => {
      const parts: string[] = [];
      const own = formatFieldValue(host, values[host.key]);
      if (own !== "") parts.push(own);

      for (const guest of visible) {
        if (guest.inlineWith !== host.key) continue;
        const text = formatFieldValue(guest, values[guest.key]);
        if (text !== "") parts.push(text);
      }

      return { field: host, text: parts.join("") };
    })
    .filter((r) => r.text !== "");
}

/**
 * Splits consultation body text into pages.
 *
 * Wrapping is estimated rather than measured: at print time the browser does the real line
 * breaking inside the box, so this only needs to decide how much text can go on page one. The
 * estimate uses an average character width of ~0.5em, which is close enough for the proportional
 * fonts in use and errs toward putting less on the first page rather than overflowing it.
 */
export function paginateBody(
  text: string,
  opts: { widthMm: number; heightMm: number; fontSizePt: number; lineHeight?: number },
): string[] {
  const clean = (text ?? "").trim();
  if (clean === "") return [];

  const lineHeight = opts.lineHeight ?? 1.35;
  const fontSizeMm = (opts.fontSizePt / 72) * 25.4;
  const lineHeightMm = fontSizeMm * lineHeight;
  const linesPerPage = Math.max(1, Math.floor(opts.heightMm / lineHeightMm));
  const charsPerLine = Math.max(8, Math.floor(opts.widthMm / (fontSizeMm * 0.5)));

  // Greedy word wrap.
  const lines: string[] = [];
  for (const paragraph of clean.split(/\n+/)) {
    let current = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = current === "" ? word : `${current} ${word}`;
      if (candidate.length <= charsPerLine) {
        current = candidate;
      } else {
        if (current !== "") lines.push(current);
        current = word;
      }
    }
    lines.push(current);
  }

  const pages: string[] = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage).join("\n"));
  }
  return pages;
}

/**
 * Starting positions for a new template, placed near the top of the page where prescription
 * pads almost always put their Date / Patient Name / Age rule. They are a starting point to
 * drag from, not a guess at any particular pad.
 */
export function defaultFields(): LetterheadField[] {
  return [
    { key: "date", xMm: 14, yMm: 60, widthMm: 32, fontSizePt: 10 },
    { key: "patientName", xMm: 62, yMm: 60, widthMm: 80, fontSizePt: 11 },
    { key: "age", xMm: 178, yMm: 60, widthMm: 22, fontSizePt: 10 },
    { key: "gender", xMm: 145, yMm: 60, widthMm: 25, fontSizePt: 10, visible: false },
  ];
}

/** Applies the template's global calibration offset to a field's position. */
export function offsetPosition(
  field: LetterheadField,
  offset: { x: number; y: number },
): { xMm: number; yMm: number } {
  return { xMm: field.xMm + offset.x, yMm: field.yMm + offset.y };
}
